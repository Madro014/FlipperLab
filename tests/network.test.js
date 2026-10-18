import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNetworkImport,emptyObservation,emptyRouter,evaluateNetwork,compareNetwork,observationErrors} from '../src/network-audit.js';
import {FlipperSerial} from '../src/serial.js';
import {makeFakePort} from './fake-flipper.js';
import {selectReport,readHistory} from '../src/history.js';

test('importación conserva SSID entre comillas y descarta coordenadas y cifrado ambiguo',()=>{
  const result=parseNetworkImport('WigleWifi-1.6\nMAC,SSID,AuthMode,Channel,RSSI,CurrentLatitude,CurrentLongitude\nAA:BB:CC:DD:EE:01,"Casa, red",[WPA2-PSK-CCMP][ESS],6,-55,4.6,-74\nAA:BB:CC:DD:EE:02,Otra,WPA2,11,-70,0,0');
  assert.equal(result.observations[0].ssid,'Casa, red');assert.equal(result.observations[0].security,'wpa2');assert.equal(result.observations[1].security,'unknown');
  assert.equal(JSON.stringify(result).includes('Latitude'),false);assert.equal(result.observations.length,2);
  assert.throws(()=>parseNetworkImport('SSID,BSSID\n"Sin cerrar,AA:BB:CC:DD:EE:FF'),/comillas/);
  assert.throws(()=>parseNetworkImport('SSID,BSSID,RSSI\nMiRed,not-a-mac,-50'),/válidas/);
});
test('registro Marauder no inventa cifrado ni banda; validación rechaza valores imposibles',()=>{
  const result=parseNetworkImport('RSSI: -57 Ch: 3 BSSID: 50:ff:20:84:d6:0f ESSID: Mi red local');
  assert.equal(result.observations[0].bssid,'50:FF:20:84:D6:0F');assert.equal(result.observations[0].security,'unknown');assert.equal(result.observations[0].band,'unknown');assert.ok(result.warnings.length);
  assert.equal(observationErrors({...emptyObservation(),ssid:'Lab',channel:'1.5',rssi:'20'}).length,2);
});
test('hallazgos priorizan evidencia declarada y los desconocidos quedan pendientes',()=>{
  const unknown=evaluateNetwork({...emptyObservation(),ssid:'Casa'},emptyRouter());assert.equal(unknown.findings.length,0);assert.equal(unknown.pending.length,9);
  const router={wps:'on',updates:'unsupported',admin:'default',password:'weak',remote:'on',upnp:'on',isolation:'shared'};
  const result=evaluateNetwork({...emptyObservation(),ssid:'Casa',security:'wep'},router);
  assert.ok(result.findings.filter(f=>f.severity==='high').length>=3);assert.equal(result.findings[0].id,'encryption');
  assert.ok(result.findings.every(f=>f.evidence&&f.steps.flipper&&f.steps.router&&f.steps.page));
  const contradictory=evaluateNetwork({...emptyObservation(),security:'wpa2'}, {...emptyRouter(),password:'na'});assert.ok(contradictory.pending.some(p=>p.includes('no aplica')));
});
test('comparación permite múltiples BSSID de malla y no declara una suplantación',()=>{
  const current={...emptyObservation(),ssid:'Casa',bssid:'AA:BB:CC:DD:EE:02',security:'wpa3',channel:'6',rssi:'-60'};
  assert.equal(compareNetwork(current,null,'AA:BB:CC:DD:EE:01\naa:bb:cc:dd:ee:02')[0].state,'same');
  const changed=compareNetwork(current,{...current,bssid:'AA:BB:CC:DD:EE:01',rssi:'-45'},'AA:BB:CC:DD:EE:01');
  assert.match(changed[0].text,/no demuestra una suplantación/);assert.ok(changed.find(row=>row.id==='rssi').text.includes('no es por sí sola'));
  assert.throws(()=>compareNetwork(current,null,'MAC-invalida'),/BSSID/);
});
test('PDF de red respeta exclusión de observaciones, explicaciones y acciones',()=>{
  const observation={...emptyObservation(),ssid:'Casa',security:'open'},result=evaluateNetwork(observation,emptyRouter());
  const record={id:'red-uno',kind:'network',title:'Red: Casa',savedAt:new Date().toISOString(),network:{...result,observation,router:emptyRouter(),sources:{ssid:'manual'},actions:{encryption:true},allowedBssids:'AA:BB:CC:DD:EE:01'}};
  const recommendations=selectReport([record],['red-uno'],['recommendations']).items[0].network;
  assert.equal(recommendations.observation,undefined);assert.equal(recommendations.allowedBssids,undefined);assert.equal(recommendations.plan,undefined);assert.equal(recommendations.findings[0].why,undefined);assert.equal(recommendations.findings[0].evidence,undefined);assert.ok(recommendations.findings[0].fix);
  const plan=selectReport([record],['red-uno'],['plan']).items[0].network;assert.equal(plan.findings,undefined);assert.equal(plan.plan[0].declaredDone,true);
  assert.equal(readHistory({getItem:()=>JSON.stringify({version:1,records:[record]})}).length,1);
});
test('apertura USB permite solo apps conocidas y no inicia escaneos ni escribe archivos',async()=>{
  const port=makeFakePort(),serial=new FlipperSerial();await serial.connect(port);
  try{
    const diagnostic=await serial.diagnose();assert.equal(diagnostic.networkApps.filter(app=>app.path).length,2);
    await assert.rejects(serial.openNetworkTool('arbitrary /command'),/no reconocida/);
    assert.equal((await serial.openNetworkTool('marauder')).id,'marauder');
    await assert.rejects(serial.openNetworkTool('scanner'),/Cierra la aplicación/);
    assert.equal(port.commands.some(command=>/storage (write|remove|rename)|uart|scanap|deauth/.test(command)),false);
  }finally{await serial.disconnect();}
  await serial.connect(port);await serial.deviceInfo();assert.equal((await serial.openNetworkTool('scanner')).id,'scanner');await serial.disconnect();
});
