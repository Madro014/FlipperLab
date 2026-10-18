import {cleanMarauder,parseApList,parseApInfo,parseLanInfo,parseLanResults,quoteWifiPassword} from './marauder-protocol.js';
import {lanPolicy} from './network-scope.js';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const allowed=/^(?:info|help|stopscan|scanap|scanall|list -[ai]|info -a \d{1,5}|pingscan|portscan -s (?:telnet|http|https|ssh|rdp))$/;
export class MarauderSerial {
  constructor(onClose=()=>{}){this.onClose=onClose;this.port=null;this.reader=null;this.pending=null;this.busy=false;this.closing=false;this.cancelled=false;this.identity=null;this.capabilities=new Set();this.networks=null;}
  async connect(selectedPort){
    if(this.port)throw new Error('Ya existe una conexión directa con Marauder.');
    const port=selectedPort||await navigator.serial.requestPort();
    await port.open({baudRate:115200});this.port=port;this.closing=false;
    try{
      await port.setSignals?.({dataTerminalReady:true});this.loop=this.read();
      const info=await this.exchange('info');
      if(!/marauder/i.test(info)||!/(version|hardware|esp32)/i.test(info)||/>:/.test(info))throw new Error('Este puerto no respondió como Marauder. Activa GPIO → USB-UART Bridge en el Flipper (canal USB 0, 115200 baudios) y selecciona su puerto.');
      const help=await this.exchange('help');
      for(const word of ['scanap','scanall','info','join','pingscan','portscan'])if(new RegExp('\\b'+word+'\\b','i').test(help))this.capabilities.add(word);
      this.identity={firmware:info.trim().slice(0,1600),version:info.match(/\bVersion:\s*([^\r\n]+)/i)?.[1]||'Versión no informada',capabilities:[...this.capabilities],checkedAt:new Date().toISOString()};return this.identity;
    }catch(e){await this.disconnect();throw e;}
  }
  async read(){
    const decoder=new TextDecoder();
    try{
      this.reader=this.port.readable.getReader();
      while(!this.closing){const {value,done}=await this.reader.read();if(done)break;if(!value)continue;const chunk=decoder.decode(value,{stream:true});const p=this.pending;if(!p)continue;p.buffer+=chunk;if(p.buffer.length>1024*1024){p.finish(new Error('La salida serial superó el límite de 1 MB.'));continue;}if(p.validate){try{p.validate(p.buffer);}catch(e){p.finish(e);continue;}}if(p.mode==='query'&&/(?:^|\n)> ?$/.test(cleanMarauder(p.buffer))){clearTimeout(p.quiet);p.quiet=setTimeout(()=>p.finish(),180);}}
    }catch(e){this.pending?.finish(e);}
    finally{this.reader?.releaseLock();this.reader=null;this.pending?.finish(new Error('Se interrumpió el puente USB-UART.'));if(!this.closing){try{await this.port?.close();}catch{}this.port=null;this.identity=null;this.onClose();}}
  }
  async write(text){if(!this.port?.writable||this.closing)throw new Error('Conecta el puente Marauder primero.');const writer=this.port.writable.getWriter();try{await writer.write(new TextEncoder().encode(text+'\n'));}finally{writer.releaseLock();}}
  async exchange(command,{duration=0,secret=false,validate=null,timeout=8000}={}){
    const validJoin=secret&&/^join -a \d{1,5} -p (?:(?:"[^"\r\n]*")|(?:'[^'\r\n]*'))+$/.test(command);
    if(/[\x00-\x1f\x7f]/.test(command)||command.length>512||(!allowed.test(command)&&!validJoin))throw new Error('Comando fuera del diagnóstico permitido.');
    if(this.pending)throw new Error('Hay una lectura de Marauder en curso.');
    const retryable=!duration&&!secret&&/^(?:info|help|stopscan|list -[ai]|info -a \d{1,5})$/.test(command);
    for(let attempt=0;attempt<=(retryable?1:0);attempt++){
      const response=new Promise((resolve,reject)=>{
        const p={buffer:'',mode:duration?'stream':'query',validate,finish:error=>{if(this.pending!==p)return;this.pending=null;clearTimeout(p.timer);clearTimeout(p.quiet);if(error)reject(error);else if(!p.buffer.trim())reject(new Error('Marauder no devolvió datos. Comprueba el puente USB-UART y los pines UART.'));else resolve(cleanMarauder(p.buffer));}};
        p.timer=setTimeout(()=>{const error=duration?null:Object.assign(new Error('La respuesta serial de Marauder quedó incompleta. Desconecta y vuelve a conectar el puente USB-UART desde esta página.'),{code:'MARAUDER_TIMEOUT'});p.finish(error);},duration||timeout);this.pending=p;
      });
      try{await this.write(command);}catch(e){this.pending?.finish(e);}
      let raw;
      try{raw=await response;}
      catch(e){
        if(e.code==='MARAUDER_TIMEOUT'&&attempt===0&&retryable&&!this.cancelled&&!this.closing){await wait(250);continue;}
        if(e.code==='MARAUDER_TIMEOUT')await this.disconnect();
        throw e;
      }
      if(/unknown command|command not found|not recognized|proper args|invalid argument/i.test(raw))throw new Error('El firmware rechazó esta operación de diagnóstico.');
      return raw;
    }
  }
  async operation(action){if(this.busy)throw new Error('Espera a que termine la prueba actual.');this.busy=true;this.cancelled=false;try{return await action();}finally{if(this.cancelled&&this.port&&!this.closing&&!this.pending){try{await this.exchange('stopscan');}catch{}}this.busy=false;}}
  checkCancelled(){if(this.cancelled)throw new Error('Diagnóstico detenido por el usuario.');}
  async window(command,duration,validate){
    let data;
    try{data=await this.exchange(command,{duration,validate});}
    finally{if(this.port&&!this.closing)await this.exchange('stopscan');}
    this.checkCancelled();
    if(!/starting|start scan|scanning/i.test(data))throw new Error('El firmware no confirmó el inicio de esta comprobación.');
    return data;
  }
  async scanNetworks({duration=18000,onProgress=()=>{}}={}){
    return this.operation(async()=>{
      this.networks=null;
      const command=this.capabilities.has('scanap')?'scanap':this.capabilities.has('scanall')?'scanall':'';
      if(!command)throw new Error('El firmware no anuncia un comando compatible para escanear redes.');
      onProgress('Buscando redes de 2,4 GHz…');await this.exchange('stopscan');
      await this.window(command,duration);onProgress('Leyendo la lista del ESP32…');
      const rows=parseApList(await this.exchange('list -a'));
      if(!rows.length)throw new Error('La lectura no contiene puntos de acceso reconocibles. Acerca la AIO a tu red y repite el escaneo.');
      this.networks=rows;
      return rows;
    });
  }
  async apInfo(target){
    if(!Number.isInteger(target?.index)||target.index<0||target.index>65535)throw new Error('Selecciona un punto de acceso de la lista.');
    // La lista solo cambia con otro escaneo de esta conexión. Consultarla de nuevo
    // aquí provocaba bloqueos intermitentes del firmware tras elegir un AP.
    const rows=this.networks||parseApList(await this.exchange('list -a'));
    const current=rows.find(row=>row.index===target.index&&row.ssid===target.ssid);
    if(!current)throw new Error('La lista del ESP32 cambió. Vuelve a escanear y selecciona tu red.');
    const observation=parseApInfo(await this.exchange(`info -a ${target.index}`));
    if(observation.ssid!==target.ssid)throw new Error('La información recibida pertenece a otro punto de acceso. Repite el escaneo.');
    return observation;
  }
  async diagnose(target,{profiles=[],password='',duration=18000,onProgress=()=>{}}={}){
    return this.operation(async()=>{
      const tests=[],startedAt=new Date().toISOString();let hosts=[],services=[],lanInfo=null;
      onProgress('Consultando el punto de acceso…');const observation=await this.apInfo(target);this.checkCancelled();
      tests.push({id:'ap',label:'Datos y protección Wi-Fi',status:'observed',detail:'Información del AP recibida del ESP32.',at:new Date().toISOString()});
      const policy=lanPolicy(observation,profiles,[...this.capabilities],password);
      let accessValidation={status:policy.status==='unsupported'?'unsupported':'skipped',title:policy.code==='credentials'?'Pendiente de la clave de tu red':policy.code==='firmware'?'Conexión no compatible con este firmware':'Solo lectura inalámbrica',detail:policy.detail};
      if(policy.code!=='ready')tests.push({id:'lan',label:'Equipos y servicios de la LAN',status:policy.status,detail:policy.detail});
      else {
        try{
          onProgress('Conectando la AIO al perfil autorizado…');const quoted=quoteWifiPassword(password);const joined=await this.exchange(`join -a ${target.index} -p ${quoted}`,{secret:true,timeout:16000});if(/could not connect|failed to connect/i.test(joined))throw Object.assign(new Error('Marauder intentó conectar la AIO, pero no confirmó la conexión Wi-Fi. Comprueba que elegiste la red de 2,4 GHz, que la clave corresponde a ese SSID y que el modo de seguridad admite el ESP32-S2; después vuelve a escanear y repite la prueba. El firmware no informa la causa exacta.'),{code:'MARAUDER_JOIN_FAILED'});
          this.checkCancelled();onProgress('Buscando equipos en tu red…');
          const validate=raw=>{if(/Netmask:\s*\d+\.\d+\.\d+\.\d+\s*[\r\n]/i.test(raw)){const found=parseLanInfo(raw);if(lanInfo&&(found.ip!==lanInfo.ip||found.mask!==lanInfo.mask||found.gateway!==lanInfo.gateway))throw Object.assign(new Error('La subred de la AIO cambió durante el diagnóstico.'),{code:'MARAUDER_SCOPE'});lanInfo=found;}};
          const ping=await this.window('pingscan',duration,validate);lanInfo=parseLanInfo(ping);
          accessValidation={status:'observed',title:'Conexión autorizada observada',detail:'La AIO informó una IP privada tras solicitar la conexión al SSID autorizado. Conectarse con una clave válida no demuestra una vulnerabilidad. El firmware conecta por SSID y no confirma el BSSID de la asociación; no se probó la resistencia a accesos forzados.'};
          const found=parseLanResults(ping,lanInfo);hosts=found.hosts;
          tests.push({id:'hosts',label:'Descubrimiento de equipos',status:'partial',detail:`Ventana de ${Math.round(duration/1000)} s; ${hosts.length} direcciones respondieron.`,at:new Date().toISOString()});
          for(const service of ['telnet','http','https','ssh','rdp']){
            this.checkCancelled();onProgress(`Comprobando ${service.toUpperCase()}…`);
            try{const raw=await this.window(`portscan -s ${service}`,duration,validate);const result=parseLanResults(raw,lanInfo);services.push(...result.services);hosts=[...new Set([...hosts,...result.hosts])];tests.push({id:service,label:`Puerto ${service.toUpperCase()}`,status:'partial',detail:`${result.services.length} respuestas de puerto abierto en una ventana de ${Math.round(duration/1000)} s.`,at:new Date().toISOString()});}
            catch(e){if(this.cancelled||e.code==='MARAUDER_SCOPE')throw e;tests.push({id:service,label:`Puerto ${service.toUpperCase()}`,status:'error',detail:e.message});}
          }
        }catch(e){if(this.cancelled)throw e;tests.push({id:'lan-error',label:'Equipos y servicios de la LAN',status:'error',detail:e.message});accessValidation={status:'inconclusive',title:e.code==='MARAUDER_JOIN_FAILED'?'La AIO no se conectó a la red':'Conexión o alcance no confirmados',detail:e.code==='MARAUDER_JOIN_FAILED'?'No se ejecutaron las pruebas de equipos ni puertos. La respuesta del firmware no permite distinguir entre clave, modo de seguridad, señal u otra causa de asociación. Esto no demuestra que la red rechace accesos no autorizados.':`No se completaron las pruebas de equipos ni puertos. ${e.message} Esto no demuestra que la red rechace accesos no autorizados.`};}
      }
      this.checkCancelled();return {observation,tests,hosts,services:[...new Map(services.map(row=>[row.ip+':'+row.port,row])).values()],lanInfo,authorization:policy.profile,accessValidation,startedAt,finishedAt:new Date().toISOString(),firmware:this.identity.firmware};
    });
  }
  async stop(){this.cancelled=true;if(this.pending?.mode==='stream')this.pending.finish();}
  async disconnect(){if(this.closing)return;this.cancelled=true;if(this.busy){try{await this.stop();await wait(200);}catch{}}this.closing=true;this.pending?.finish(new Error('Conexión Marauder cerrada.'));try{await this.reader?.cancel();await this.loop;await this.port?.close();}finally{this.port=null;this.identity=null;this.capabilities.clear();this.networks=null;this.onClose();}}
}
