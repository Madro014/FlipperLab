// Only a serial fixture. It never opens a real port or emits radio traffic.
export function makeMarauderPort(options={}) {
  const encoder=new TextEncoder();let controller,line='',cancelled=false;
  const commands=[];
  const send=value=>{const bytes=encoder.encode(value);for(let i=0;i<bytes.length;i+=11)controller.enqueue(bytes.slice(i,i+11));};
  const finish=body=>send(body+'\n> ');
  const port={commands,getInfo:()=>({usbVendorId:0x0483,usbProductId:0x5740}),async setSignals(){},async close(){},
    async open({baudRate}){
      if(baudRate!==115200)throw new Error('Expected Marauder baud rate');
      port.readable=new ReadableStream({start(c){controller=c;},cancel(){cancelled=true;}});
      port.writable=new WritableStream({write(bytes){
        line+=new TextDecoder().decode(bytes);
        while(line.includes('\n')){
          const index=line.indexOf('\n'),command=line.slice(0,index);line=line.slice(index+1);commands.push(command);
          if(cancelled)throw new Error('Port closed');
          send('#'+command+'\n');
          if(command==='info')finish(options.wrongDevice?'Flipper Zero CLI\n>: ':`Marauder Info\nVersion: ${options.oldFirmware?'v1.5.0':'v1.6-fixture'}\nHardware: ESP32-S2`);
          else if(command==='help')finish(options.oldFirmware?'info help scanap scanall stopscan list':'info help scanap scanall join pingscan portscan stopscan list');
          else if(command==='stopscan')finish('Stopped');
          else if(command==='scanap'||command==='scanall')finish('Starting scan\n-43 Ch: 8 aa:bb:cc:dd:ee:01 ESSID: Casa de prueba');
          else if(command==='list -a'){
            if(options.partialListOnce&&commands.filter(value=>value==='list -a').length===1)send('[8][CH:8] Casa de prueba');
            else finish('[8][CH:8] Casa de prueba -43\n[9][CH:6] Vecino-EXCLUIR -70\n0 selected');
          }
          else if(command==='info -a 8')finish('ESSID: Casa de prueba\nBSSID: '+(options.bssid||'AA:BB:CC:DD:EE:01')+'\nChannel: 8\nRSSI: -43\nSecurity: '+(options.security||'WEP')+'\nWPS: '+(options.wps||'Enabled')+'\nPMF: '+(options.pmf||'Disabled'));
          else if(command==='info -a 9')finish('ESSID: Vecino-EXCLUIR\nBSSID: AA:BB:CC:DD:EE:09\nChannel: 6\nRSSI: -70\nSecurity: WPA2');
          else if(command.startsWith('join -a 8 -p '))finish(options.joinFailed?'Could not connect to WiFi network':'Using SSID: Casa de prueba\nConnecting to WiFi');
          else if(command==='pingscan')finish('Starting Ping Scan\nIP address: 192.168.20.25\nGateway: 192.168.20.1\nNetmask: '+(options.badMask?'255.255.0.0':'255.255.255.0')+'\n192.168.20.1\n192.168.20.50');
          else if(command.startsWith('portscan -s ')){
            const name=command.split(' ').at(-1),number={telnet:23,http:80,https:443,ssh:22,rdp:3389}[name];
            finish(`Starting port scan\nIP address: 192.168.20.25\nGateway: 192.168.20.1\nNetmask: 255.255.255.0\n192.168.20.1: ${number}\n203.0.113.20: ${number}`);
          }else finish('Unknown command');
        }
      }});
    }
  };
  if(typeof window!=='undefined'){
    window.__marauderPort=port;
    Object.defineProperty(navigator,'serial',{configurable:true,value:{requestPort:async()=>port,getPorts:async()=>[],addEventListener(){},removeEventListener(){}}});
    const original=window.setTimeout;window.setTimeout=(handler,delay,...args)=>original(handler,delay===18000?80:delay,...args);
  }
  return port;
}
