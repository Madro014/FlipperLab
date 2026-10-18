export const NETWORK_APPS = [
  {id:'marauder',name:'ESP32 WiFi Marauder',paths:['/ext/apps/GPIO/ESP/esp32_wifi_marauder.fap','/ext/apps/GPIO/esp32_wifi_marauder.fap']},
  {id:'scanner',name:'WiFi Scanner',paths:['/ext/apps/GPIO/ESP/wifi_scanner.fap','/ext/apps/GPIO/wifi_scanner.fap']},
];
export const SECURITY = {unknown:'Sin confirmar',open:'Abierta',wep:'WEP',wpa:'WPA / TKIP',legacyMixed:'WPA / WPA2 mixto',wpa2:'WPA2 Personal / AES',wpa2Unknown:'WPA2 (cifrado sin confirmar)',mixed:'WPA2 / WPA3 Personal',wpa3:'WPA3 Personal',enterprise:'WPA2 / WPA3 Enterprise'};
export const ROUTER_CHECKS = [
  {id:'wps',label:'WPS',help:'Busca WPS o Wi-Fi Protected Setup en los ajustes inalámbricos.',options:[['off','Desactivado'],['on','Activado']]},
  {id:'updates',label:'Actualizaciones del router',help:'Consulta la versión y el soporte en la web del fabricante.',options:[['current','Actualizado y con soporte'],['pending','Actualización pendiente'],['unsupported','Sin soporte del fabricante']]},
  {id:'admin',label:'Contraseña de administración',help:'Comprueba que cambiaste la clave de acceso al router. No la escribas aquí.',options:[['changed','Única y cambiada'],['default','Predeterminada o compartida']]},
  {id:'password',label:'Clave de la red Wi-Fi',help:'Declara si es larga, única y no reutilizada. No escribas la clave.',options:[['unique','Larga y única'],['weak','Corta o reutilizada'],['na','No aplica a esta red']]},
  {id:'remote',label:'Administración desde Internet',help:'Revisa acceso remoto / WAN; distingue esto del panel dentro de tu casa.',options:[['off','Desactivada'],['on','Activada sin necesidad'],['needed','Necesaria; debo revisar restricciones']]},
  {id:'upnp',label:'UPnP',help:'Revisa si alguna aplicación necesita aperturas automáticas de puertos.',options:[['off','Desactivado'],['on','Activado sin necesidad'],['needed','Necesario; debo revisar las reglas']]},
  {id:'isolation',label:'Invitados y dispositivos IoT',help:'Busca red de invitados, aislamiento y acceso a la red principal.',options:[['isolated','Separados y con aislamiento'],['shared','Comparten acceso a la red principal'],['na','No hay invitados ni IoT']]},
];
export const emptyObservation=()=>({ssid:'',bssid:'',security:'unknown',channel:'',rssi:'',band:'unknown'});
export const emptyRouter=()=>Object.fromEntries(ROUTER_CHECKS.map(check=>[check.id,'unknown']));
export const normalizeMac=value=>String(value||'').trim().replace(/-/g,':').toUpperCase();
export const validMac=value=>/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalizeMac(value));
export function observationErrors(value) {
  const errors=[];
  if(!String(value.ssid||'').trim()) errors.push('Escribe el nombre de tu red (SSID).');
  if(value.bssid&&!validMac(value.bssid)) errors.push('El BSSID debe tener seis pares, por ejemplo AA:BB:CC:DD:EE:FF.');
  if(value.channel!==''&&(!Number.isInteger(Number(value.channel))||Number(value.channel)<1||Number(value.channel)>233)) errors.push('El canal debe ser un entero entre 1 y 233, o quedar vacío.');
  if(value.rssi!==''&&(!Number.isFinite(Number(value.rssi))||Number(value.rssi)<-127||Number(value.rssi)>0)) errors.push('La señal RSSI debe estar entre -127 y 0 dBm, o quedar vacía.');
  return errors;
}
function securityFrom(value) {
  const text=String(value||'').toUpperCase().replace(/[_-]/g,' ');
  if(/EAP|ENTERPRISE/.test(text)) return 'enterprise';
  if(/WEP/.test(text)) return 'wep';
  if(/WPA3/.test(text)&&/WPA2/.test(text)) return 'mixed';
  if(/WPA3/.test(text)) return 'wpa3';
  if(/TKIP/.test(text)) return 'wpa';
  if(/WPA2/.test(text)&&/AES|CCMP/.test(text)) return 'wpa2';
  if(/^(OPEN|NONE|ABIERTA)$/.test(text.trim())) return 'open';
  if(/^WPA( |$)/.test(text)&&!/WPA2|WPA3/.test(text)) return 'wpa';
  return 'unknown';
}
// Quoted CSV, including commas and line breaks inside fields. No execution or fetching.
function csvRows(text) {
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(value=>value.trim()))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted) throw new Error('El CSV contiene comillas sin cerrar.');
  row.push(field);if(row.some(value=>value.trim()))rows.push(row);
  return rows;
}
export function parseNetworkImport(raw) {
  if(new TextEncoder().encode(raw).length>1024*1024) throw new Error('El archivo debe pesar menos de 1 MB.');
  const output=[],warnings=[];
  const add=value=>{
    const observation={...emptyObservation(),...value,bssid:normalizeMac(value.bssid)};
    if(!observation.ssid.trim()||!validMac(observation.bssid)||observationErrors(observation).length){warnings.push('Se omitió una fila incompleta o con valores inválidos.');return;}
    output.push(observation);
    if(output.length>2000) throw new Error('El archivo supera las 2000 observaciones. Divide el registro antes de importarlo.');
  };
  const text=String(raw).replace(/^\uFEFF/,'');
  if(/RSSI:\s*-?\d+.*?\bCh:\s*\d+.*?BSSID:/i.test(text)) {
    for(const line of text.split(/\r?\n/)) {
      const match=line.match(/RSSI:\s*(-?\d+)\s+Ch:\s*(\d+)\s+BSSID:\s*([\da-f:-]+)\s+ESSID:\s*(.*)$/i);
      if(match) add({rssi:match[1],channel:match[2],bssid:match[3],ssid:match[4].trim()});
    }
    warnings.push('Este registro de Marauder no indica el cifrado: debes confirmarlo en la información del AP o en el router.');
  } else {
    const rows=csvRows(text),normalized=rows.map(row=>row.map(v=>v.trim().toLowerCase()));
    const headerIndex=normalized.findIndex(row=>row.includes('ssid')&&(row.includes('bssid')||row.includes('mac')));
    if(headerIndex<0) throw new Error('Usa un CSV con columnas SSID y BSSID (o MAC), o texto de Marauder con RSSI, Ch, BSSID y ESSID.');
    const header=normalized[headerIndex];
    const get=(row,...keys)=>{const i=header.findIndex(value=>keys.includes(value));return i<0?'':(row[i]||'').trim();};
    for(const row of rows.slice(headerIndex+1)) add({ssid:get(row,'ssid'),bssid:get(row,'bssid','mac'),channel:get(row,'channel','canal'),rssi:get(row,'rssi'),security:securityFrom(get(row,'security','authmode','encryption','seguridad')),band:/^(2\.4|5|6)$/.test(get(row,'band','banda'))?get(row,'band','banda'):'unknown'});
  }
  if(!output.length) throw new Error('No se encontraron observaciones válidas. Revisa el formato y que la red tenga un SSID visible.');
  return {observations:output,warnings:[...new Set(warnings)]};
}
export function compareNetwork(current,baseline,allowed='') {
  const allowedMacs=allowed.split(/[\s,;]+/).filter(Boolean).map(normalizeMac);
  const invalid=allowedMacs.filter(mac=>!validMac(mac));
  if(invalid.length) throw new Error('Revisa los BSSID de referencia: usa pares AA:BB:CC:DD:EE:FF separados por coma o salto de línea.');
  const rows=[];
  if(allowedMacs.length&&current.bssid) rows.push({id:'identity',state:allowedMacs.includes(normalizeMac(current.bssid))?'same':'review',text:allowedMacs.includes(normalizeMac(current.bssid))?'El BSSID coincide con la lista declarada del router.':'El BSSID no está en tu lista: comprueba repetidores, malla, bandas y la etiqueta del router. Esto no demuestra una suplantación.'});
  if(baseline?.ssid===current.ssid) {
    for(const [key,label] of [['bssid','BSSID'],['security','Seguridad'],['channel','Canal'],['rssi','Señal RSSI']]) {
      if(current[key]!==''&&baseline[key]!==''&&current[key]!=='unknown'&&baseline[key]!=='unknown'&&baseline[key]!=null) {
        const same=String(current[key])===String(baseline[key]);
        rows.push({id:key,state:same?'same':'review',text:`${label}: ${key==='security'?SECURITY[baseline[key]]:baseline[key]} → ${key==='security'?SECURITY[current[key]]:current[key]}. ${same?'Sin cambio.':key==='bssid'?'Confirma si pertenece a tu router, malla o repetidor.':key==='security'?'Confirma el modo de seguridad en el router.':'Una variación de canal o señal no es por sí sola una vulnerabilidad.'}`});
      }
    }
  }
  return rows;
}
export function evaluateNetwork(observation,router,comparison=[]) {
  const findings=[],pending=[];
  const add=(id,severity,title,evidence,why,fix,flipper='Repite la consulta de tu AP en Marauder y registra lo que muestre; si el dato no aparece, déjalo sin confirmar.')=>findings.push({id,severity,title,evidence,why,fix,steps:{router:fix,flipper,page:'Inicia una nueva revisión, registra los datos después del cambio y compara el nuevo resultado con esta práctica.'}});
  const security=observation.security;
  if(!SECURITY[security]||security==='unknown') pending.push('Modo de seguridad y cifrado de la red');
  if(!observation.bssid) pending.push('BSSID del punto de acceso');
  if(['open','wep','wpa','legacyMixed'].includes(security)) add('encryption','high','Protección Wi-Fi insuficiente',`Seguridad declarada: ${SECURITY[security]}.`,'Una red abierta no cifra el enlace Wi-Fi; WEP y WPA/TKIP son mecanismos antiguos que requieren sustitución. El modo WPA/WPA2 mixto conserva compatibilidad con WPA heredado.','Configura WPA3 Personal si todos los equipos lo admiten, o WPA2 Personal con AES/CCMP. Usa una clave larga y única; vuelve a conectar tus dispositivos.');
  if(security==='wpa2Unknown')pending.push('Cifrado AES/CCMP de WPA2: no se ha confirmado');
  if(security==='mixed') add('transition','low','Revisa si todavía necesitas el modo mixto','Modo WPA2 / WPA3 declarado.','El modo de transición mantiene compatibilidad con dispositivos WPA2. Conviene revisar qué equipos lo necesitan.','Comprueba la compatibilidad de tus dispositivos y usa WPA3 exclusivo cuando sea posible. Si mantienes WPA2, confirma AES/CCMP.');
  if(security==='enterprise') pending.push('Configuración de certificados, servidor de autenticación y validación del cliente (fuera de esta revisión doméstica)');
  for(const check of ROUTER_CHECKS) if(!check.options.some(([value])=>value===router[check.id])) pending.push(check.label);
  if(router.wps==='on') add('wps','medium','WPS está activado','WPS activado, según revisión del usuario.','WPS añade una vía de incorporación de dispositivos que puede resultar innecesaria.','Desactiva WPS en el panel inalámbrico, guarda los cambios y confirma que el ajuste queda apagado.','El escaneo de AP no confirma por sí solo que WPS esté desactivado. Comprueba el panel del router.');
  if(router.updates==='pending') add('updates','medium','Hay una actualización pendiente','Firmware pendiente de actualizar, declarado por el usuario.','Las actualizaciones pueden corregir fallos del router que el escaneo Wi-Fi no detecta.','Guarda la configuración y actualiza desde el fabricante o el panel oficial. Anota la versión instalada y vuelve a revisar.');
  if(router.updates==='unsupported') add('support','high','El router ya no tiene soporte','Fin de soporte declarado por el usuario.','Sin mantenimiento del fabricante pueden quedar fallos sin corregir.','Consulta al fabricante o proveedor y planifica sustituir el router por un modelo con soporte. Mantén el acceso remoto desactivado.');
  if(router.admin==='default') add('admin','high','La clave administrativa requiere cambio','Clave predeterminada o compartida, declarada por el usuario.','Quien conozca esa clave podría cambiar la configuración del equipo si alcanza el panel.','Cambia la contraseña de administración por una larga y exclusiva; guarda la clave en un gestor y cierra sesiones antiguas.');
  if(router.password==='weak'&&!['open','enterprise'].includes(security)) add('password','high','La clave Wi-Fi es corta o reutilizada','Calidad de la clave declarada; no se recibió ni se comprobó la contraseña.','Una clave reutilizada aumenta el riesgo si se divulga en otro servicio.','Usa una frase de contraseña larga y única, y actualiza los dispositivos autorizados. No introduzcas esa clave en esta página.');
  if(router.password==='na'&&['wpa','wpa2','mixed','wpa3','wep'].includes(security)) pending.push('La clave Wi-Fi se marcó «no aplica» pero el modo declarado utiliza una clave: revisa esa respuesta');
  if(['on','needed'].includes(router.remote)) add('remote','medium','Revisa la administración desde Internet',`Acceso remoto: ${router.remote==='on'?'activado sin necesidad':'necesario, restricciones pendientes'}.`,'Exponer la administración amplía quién puede intentar acceder al equipo.','Desactiva el acceso desde WAN si no lo necesitas. Si es necesario, limita el acceso mediante VPN y revisa autenticación, restricciones y registros.');
  if(['on','needed'].includes(router.upnp)) add('upnp','low','Revisa las aperturas automáticas de puertos',`UPnP: ${router.upnp==='on'?'activado sin necesidad':'necesario; reglas pendientes'}.`,'Una aplicación de la red puede solicitar aperturas de puertos cuando UPnP está habilitado.','Revisa la lista de puertos del router. Desactiva UPnP si no hace falta y elimina reglas que ya no utilices.');
  if(router.isolation==='shared') add('isolation','medium','Invitados o IoT comparten la red principal','Separación pendiente, declarada por el usuario.','Estos dispositivos pueden tener acceso a otros equipos de la red según la configuración del router.','Crea una red de invitados o IoT con aislamiento y sin acceso a la LAN principal. Comprueba desde un dispositivo invitado que no abre el panel local del router.');
  if(comparison.some(row=>row.id==='identity'&&row.state==='review')) add('identity','info','Identidad del punto de acceso por confirmar','El BSSID observado no coincide con la lista de referencia declarada.','Un SSID puede corresponder a varias bandas, repetidores o nodos legítimos. La diferencia no confirma un punto malicioso.','Contrasta el BSSID con el panel del router y sus nodos. Actualiza la lista de referencia solo cuando hayas identificado el equipo.','Vuelve a observar el BSSID del AP y contrástalo con el router. No concluyas la identidad por el nombre SSID.');
  findings.sort((a,b)=>({high:0,medium:1,low:2,info:3}[a.severity]-{high:0,medium:1,low:2,info:3}[b.severity]));
  return {findings,pending,scope:'Revisión orientativa de una red propia. Los datos Wi-Fi proceden de una importación o transcripción del usuario; los ajustes del router son declaraciones manuales. USB solo verifica el Flipper y abre aplicaciones. No comprueba contraseñas, puertos, tráfico, CVE ni ausencia de vulnerabilidades.'};
}
