import test from 'node:test';
import assert from 'node:assert/strict';
import {isFlipperCandidate} from '../src/serial.js';
import {simulatedEvents,MAX_HTML_BYTES} from '../src/portal.js';
import {createTestBundle,MAX_DEVICE_HTML_BYTES} from '../src/portal.js';
import {FlipperSerial} from '../src/serial.js';
import {parseDeviceInfo,parseStorageText,PORTAL_DIR} from '../src/device-protocol.js';
import {makeFakePort} from './fake-flipper.js';
test('solo identifica puertos compatibles con el USB esperado',()=>{
 assert.equal(isFlipperCandidate({usbVendorId:0x0483,usbProductId:0x5740}),true);
 assert.equal(isFlipperCandidate({usbVendorId:0x0483,usbProductId:0x0001}),false);
 assert.equal(isFlipperCandidate({}),false);
});
test('plantilla compatible escapa HTML, conserva código y no pide datos',()=>{
 const bundle=createTestBundle({title:'Prueba <script>alert(1)</script>',token:'ABC123'});
 assert.ok(new TextEncoder().encode(bundle.html).length<=MAX_DEVICE_HTML_BYTES);
 assert.match(bundle.html,/&lt;script&gt;/);assert.match(bundle.html,/ABC123/);
 assert.doesNotMatch(bundle.html,/<(?:form|input|script)[\s>]/i);
 assert.doesNotMatch(bundle.html,/\r|\n/);
 assert.throws(()=>createTestBundle({ssid:'Otra-red'}));
 assert.throws(()=>createTestBundle({token:'x\r\n'}));
});
test('parseo conserva bytes UTF-8 y rechaza respuestas incompletas',()=>{
 assert.equal(parseDeviceInfo('hardware.model : Flipper Zero\r\nfirmware.origin.fork : Momentum\r\n').firmware,'Momentum');
 assert.equal(parseStorageText('Size: 4\r\nniño\r\n'.replace('Size: 4','Size: 5')),'niño');
 assert.throws(()=>parseStorageText('Size: 10\r\nhola\r\n'));
});
test('carga por bloques, guarda originales y verifica contenido completo',async()=>{
 const port=makeFakePort(),serial=new FlipperSerial();
 try{
  await serial.connect(port);const diagnostic=await serial.diagnose();
  assert.equal(diagnostic.device.firmware,'Momentum');assert.ok(diagnostic.appPath);
  const deployment=await serial.deployTest({token:'ABC123'});
  assert.equal(await serial.readText(`${PORTAL_DIR}/index.html`),deployment.html);
  assert.equal(await serial.readText(`${deployment.backupDir}/index.html`),'<html>Original</html>');
  assert.equal(await serial.readText(`${deployment.backupDir}/ap.config.txt`),'Original-LAB');
  assert.match(await serial.openPortal(),/is running/);
  await assert.rejects(serial.deployTest({token:'ABC123'}),/Cierra la aplicación/);
 }finally{await serial.disconnect();}
});
test('un fallo al promover configuración recupera los dos originales',async()=>{
 const port=makeFakePort({failPromotion:true}),serial=new FlipperSerial();
 try{
  await serial.connect(port);await serial.diagnose();
  await assert.rejects(serial.deployTest({token:'ABC123'}),/se recuperaron/);
  assert.equal(await serial.readText(`${PORTAL_DIR}/index.html`),'<html>Original</html>');
  assert.equal(await serial.readText(`${PORTAL_DIR}/ap.config.txt`),'Original-LAB');
 }finally{await serial.disconnect();}
});
test('simulación produce eventos sin credenciales ni dependencias de hardware',()=>{
 const events=simulatedEvents('Práctica 01');
 assert.equal(events.length,5);assert.match(events[0].message,/Práctica 01/);
 assert.match(events.at(-1).message,/No se emitieron/);
 assert.ok(events.every(e=>Object.keys(e).sort().join(',')==='message,type'));
 assert.equal(MAX_HTML_BYTES,1048576);
});
