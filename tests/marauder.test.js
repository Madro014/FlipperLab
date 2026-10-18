import test from 'node:test';
import assert from 'node:assert/strict';
import {MarauderSerial} from '../src/marauder-serial.js';
import {parseApList,parseApInfo,quoteWifiPassword,parseLanInfo,parseLanResults,diagnoseMarauder} from '../src/marauder-protocol.js';
import {selectReport} from '../src/history.js';
import {makeMarauderPort} from './fake-marauder.js';
import {authorizeNetwork} from '../src/network-scope.js';

const profiles=[authorizeNetwork({ssid:'Casa de prueba',bssid:'AA:BB:CC:DD:EE:01'})];

test('lista distingue redes repetidas por índice y AP Info conserva incertidumbre del cifrado',()=>{
  assert.equal(parseApList('[8][CH:8] Mi red -31\n[10][CH:8] Mi red -50 (selected)').length,2);
  assert.equal(parseApInfo('ESSID: Mi red\nBSSID: AA:BB:CC:DD:EE:01\nSecurity: WPA2').security,'wpa2Unknown');
  assert.equal(parseApInfo('ESSID: Mi red\nBSSID: AA:BB:CC:DD:EE:01\nSecurity: WPA/WPA2 Mixed').security,'legacyMixed');
  assert.throws(()=>parseApInfo('ESSID: Sin dirección'),/suficiente/);
  assert.throws(()=>quoteWifiPassword('abc\nattack -t deauth'),/caracteres/);
  const original='both\'" quotes \\ preserved',encoded=quoteWifiPassword(original);
  let decoded='',double=false,single=false;
  for(const char of encoded){if(char==='"'&&!single)double=!double;else if(char==="'"&&!double)single=!single;else decoded+=char;}
  assert.equal(decoded,original);assert.equal(double||single,false);
});
test('solo interpreta puertos confirmados de la subred y no convierte progreso en hallazgos',()=>{
  const lan=parseLanInfo('IP address: 192.168.20.25\nGateway: 192.168.20.1\nNetmask: 255.255.255.0');
  const result=parseLanResults('Checking IP: 192.168.20.1 Port: 1000\n192.168.20.1: 23\n203.0.113.5: 80\n192.168.20.50',lan);
  assert.deepEqual(result.services,[{ip:'192.168.20.1',port:23}]);assert.equal(result.hosts.length,2);
  assert.throws(()=>parseLanInfo('IP address: 10.0.0.2\nGateway: 10.0.0.1\nNetmask: 255.255.0.0'),/254/);
  assert.throws(()=>parseLanInfo('IP address: 203.0.113.2\nGateway: 203.0.113.1\nNetmask: 255.255.255.0'),/privada/);
});
test('diagnóstico ejecuta lecturas reales del protocolo sin router manual ni comandos de interrupción',async()=>{
  const port=makeMarauderPort(),serial=new MarauderSerial();await serial.connect(port);
  try{
    const networks=await serial.scanNetworks({duration:20});assert.equal(networks.length,2);
    const evidence=await serial.diagnose(networks[0],{profiles,password:'CLAVE-NO-PERSISTIR',duration:20});
    assert.equal(port.commands.filter(command=>command==='list -a').length,1);
    assert.equal(evidence.services.length,5);assert.ok(evidence.tests.some(row=>row.status==='partial'));
    const diagnosis=diagnoseMarauder(evidence.observation,evidence.tests,evidence.services);
    assert.ok(diagnosis.findings.some(f=>f.id==='wifi-protection'));assert.ok(diagnosis.findings.some(f=>f.id==='wps-advertised'));
    assert.ok(diagnosis.findings.some(f=>f.evidence.includes(':23')));assert.ok(diagnosis.pending.some(p=>p.includes('Ventana')));
    const record={id:'automatic',kind:'network',title:'Automático',savedAt:new Date().toISOString(),network:{...diagnosis,observation:evidence.observation,automatic:{tests:evidence.tests,hosts:evidence.hosts,services:evidence.services},actions:{}}};
    assert.equal(JSON.stringify(record).includes('CLAVE-NO-PERSISTIR'),false);
    assert.equal(selectReport([record],['automatic'],['findings']).items[0].network.automatic,undefined);
    assert.equal(selectReport([record],['automatic'],['network']).items[0].network.automatic.services.length,5);
    assert.equal(port.commands.some(command=>/attack|evilportal|deauth|reboot|update/.test(command)),false);
    await assert.rejects(serial.exchange('attack -t deauth',{secret:true}),/fuera/);
  }finally{await serial.disconnect();}
});
test('rechaza CLI del Flipper, índice cambiado y subred amplia; la parada envía stopscan',async()=>{
  const wrong=new MarauderSerial();await assert.rejects(wrong.connect(makeMarauderPort({wrongDevice:true})),/no respondió como Marauder/);
  const port=makeMarauderPort({badMask:true}),serial=new MarauderSerial();await serial.connect(port);
  try{
    await assert.rejects(serial.diagnose({index:999,ssid:'inventada'}),/lista.*cambió/);
    assert.equal(port.commands.includes('info -a 999'),false);
    const result=await serial.diagnose({index:8,ssid:'Casa de prueba'},{profiles,password:'test',duration:20});
    assert.ok(result.tests.some(t=>t.detail.includes('254')));assert.equal(port.commands.some(c=>c.startsWith('portscan')),false);
    const scan=serial.scanNetworks({duration:2000});await new Promise(resolve=>setTimeout(resolve,250));await serial.stop();await assert.rejects(scan,/detenido/);
    assert.equal(port.commands.at(-1),'stopscan');
  }finally{await serial.disconnect();}
});

test('la capa serial bloquea LAN sin autorización, con BSSID distinto o firmware incompatible',async()=>{
  for(const options of [{},{bssid:'AA:BB:CC:DD:EE:02'},{oldFirmware:true}]){
    const port=makeMarauderPort(options),serial=new MarauderSerial();await serial.connect(port);
    try{
      const result=await serial.diagnose({index:8,ssid:'Casa de prueba'},{profiles:Object.keys(options).length?profiles:[],password:'CLAVE-VALIDA',duration:20});
      assert.ok(['skipped','unsupported'].includes(result.accessValidation.status));
      assert.equal(port.commands.some(c=>/^(join|pingscan|portscan)/.test(c)),false);
      assert.equal(result.services.length,0);
    }finally{await serial.disconnect();}
  }
});

test('una conexión rechazada queda no concluyente y no inicia sondeos de LAN',async()=>{
  const port=makeMarauderPort({joinFailed:true}),serial=new MarauderSerial();await serial.connect(port);
  try{
    const result=await serial.diagnose({index:8,ssid:'Casa de prueba'},{profiles,password:'CLAVE*DE-PRUEBA',duration:20});
    assert.equal(result.accessValidation.status,'inconclusive');
    assert.equal(result.accessValidation.title,'La AIO no se conectó a la red');
    assert.match(result.accessValidation.detail,/no demuestra/);
    assert.match(result.tests.find(t=>t.id==='lan-error').detail,/firmware no informa la causa exacta/);
    assert.equal(port.commands.some(c=>c.startsWith('join -a 8 -p "CLAVE*DE-PRUEBA"')),true);
    assert.equal(port.commands.filter(c=>c.startsWith('join -a')).length,1);
    assert.equal(port.commands.some(c=>/^(pingscan|portscan)/.test(c)),false);
    assert.equal(JSON.stringify(result).includes('CLAVE*DE-PRUEBA'),false);
  }finally{await serial.disconnect();}
});

test('una lista serial cortada se reintenta una vez sin aceptar datos parciales',async()=>{
  const port=makeMarauderPort({partialListOnce:true}),serial=new MarauderSerial();await serial.connect(port);
  try{
    const rows=parseApList(await serial.exchange('list -a',{timeout:350}));
    assert.equal(rows.length,2);
    assert.equal(port.commands.filter(command=>command==='list -a').length,2);
  }finally{await serial.disconnect();}
});
