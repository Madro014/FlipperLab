import test from 'node:test';
import assert from 'node:assert/strict';
import {isFlipperCandidate} from '../src/serial.js';
import {simulatedEvents,MAX_HTML_BYTES} from '../src/portal.js';
test('solo identifica puertos compatibles con el USB esperado',()=>{
 assert.equal(isFlipperCandidate({usbVendorId:0x0483,usbProductId:0x5740}),true);
 assert.equal(isFlipperCandidate({usbVendorId:0x0483,usbProductId:0x0001}),false);
 assert.equal(isFlipperCandidate({}),false);
});
test('simulación produce eventos sin credenciales ni dependencias de hardware',()=>{
 const events=simulatedEvents('Práctica 01');
 assert.equal(events.length,5);assert.match(events[0].message,/Práctica 01/);
 assert.match(events.at(-1).message,/No se emitieron/);
 assert.ok(events.every(e=>Object.keys(e).sort().join(',')==='message,type'));
 assert.equal(MAX_HTML_BYTES,1048576);
});
