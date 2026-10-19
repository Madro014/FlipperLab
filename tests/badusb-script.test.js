import test from 'node:test';
import assert from 'node:assert/strict';
import {createSafeBadUsbScript, describeBadUsbScript} from '../src/badusb-script.js';
import {parseStorageList} from '../src/device-protocol.js';

test('genera una demo de texto sin acciones adicionales', () => {
  assert.equal(createSafeBadUsbScript('Hola desde mi laboratorio', 1500), [
    'REM Flipper Lab - demostración de escritura autorizada',
    'REM Escribe una línea en el campo activo; no pulsa Enter ni ejecuta comandos.',
    'DELAY 1500',
    'STRING Hola desde mi laboratorio',
    ''
  ].join('\n'));
});

test('rechaza texto vacío, multilínea y caracteres de control', () => {
  assert.throws(() => createSafeBadUsbScript('  '), /texto de demostración/);
  assert.throws(() => createSafeBadUsbScript('línea 1\nlínea 2'), /una sola línea/);
  assert.throws(() => createSafeBadUsbScript('hola\u0001mundo'), /una sola línea/);
  assert.throws(() => createSafeBadUsbScript('x'.repeat(161)), /160 caracteres/);
});

test('limita el retardo a valores seguros', () => {
  assert.throws(() => createSafeBadUsbScript('hola', 999), /1000 y 10000/);
  assert.throws(() => createSafeBadUsbScript('hola', 10001), /1000 y 10000/);
  assert.throws(() => createSafeBadUsbScript('hola', 1500.5), /1000 y 10000/);
});

test('genera script para Bloc de notas con notepad.exe', () => {
  const script = createSafeBadUsbScript({template: 'notepad', message: 'Escribiendo en notepad', delay: 1500});
  assert.match(script, /GUI r/);
  assert.match(script, /STRING notepad/);
  assert.match(script, /ENTER/);
  assert.match(script, /STRING Escribiendo en notepad/);
});

test('genera script para YouTube con enlace directo, parámetros con & y búsqueda', () => {
  const direct = createSafeBadUsbScript({template: 'youtube', url: 'https://www.youtube.com/watch?v=123', delay: 1500});
  assert.match(direct, /GUI r/);
  assert.match(direct, /STRING https:\/\/www\.youtube\.com\/watch\?v=123/);
  assert.match(direct, /ENTER/);

  const withParams = createSafeBadUsbScript({
    template: 'youtube',
    url: 'https://www.youtube.com/watch?v=K4dx42YzQCE&list=RD2ePjtJHXY3M&index=9',
    delay: 1500,
  });
  assert.match(withParams, /&list=RD2ePjtJHXY3M&index=9/);

  const query = createSafeBadUsbScript({template: 'youtube', url: 'semillero flipper', delay: 1500});
  assert.match(query, /STRING https:\/\/www\.youtube\.com\/results\?search_query=semillero%20flipper/);
});

test('genera script para URL web personalizada con parámetros', () => {
  const web = createSafeBadUsbScript({
    template: 'custom_url',
    url: 'https://example.com/demo?test=1&user=flipper',
    delay: 2000,
  });
  assert.match(web, /STRING https:\/\/example\.com\/demo\?test=1&user=flipper/);
});

test('genera script para Calculadora PoC sin pedir texto', () => {
  const calc = createSafeBadUsbScript({template: 'calc', delay: 1500});
  assert.match(calc, /STRING calc/);
  assert.doesNotMatch(calc, /notepad/);
});


test('guarda script en la carpeta de badusb y verifica contenido', async () => {
  const {FlipperSerial} = await import('../src/serial.js');
  const {makeFakePort} = await import('./fake-flipper.js');
  const port = makeFakePort(), serial = new FlipperSerial();
  try {
    await serial.connect(port);
    await serial.diagnose();
    const content = createSafeBadUsbScript('Prueba de escritura', 1500);
    const result = await serial.saveBadUsbScript({folder: 'semillero', fileName: 'test_script', text: content});
    assert.equal(result.path, '/ext/badusb/semillero/test_script.txt');
    assert.equal(await serial.readText(result.path), content);

    // Sobrescribir archivo existente
    const content2 = createSafeBadUsbScript('Segunda prueba', 2000);
    const result2 = await serial.saveBadUsbScript({folder: 'semillero', fileName: 'test_script', text: content2});
    assert.equal(await serial.readText(result2.path), content2);
  } finally {
    await serial.disconnect();
  }
});

test('abre Bad USB en el Flipper con la ruta del script', async () => {
  const {FlipperSerial} = await import('../src/serial.js');
  const {makeFakePort} = await import('./fake-flipper.js');
  const port = makeFakePort(), serial = new FlipperSerial();
  try {
    await serial.connect(port);
    await serial.diagnose();
    const res = await serial.openBadUsb('/ext/badusb/semillero/test_script.txt');
    assert.match(res.state, /Application "Bad USB" is running/);
  } finally {
    await serial.disconnect();
  }
});

test('parseStorageList interpreta archivos, tamaños y directorios', () => {
  const sample = '[D] semillero\r\n[F] demo_youtube.txt 145b\r\n[F] custom.txt 210b\r\n>: ';
  const parsed = parseStorageList(sample);
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed[0], {type: 'dir', name: 'semillero'});
  assert.deepEqual(parsed[1], {type: 'file', name: 'demo_youtube.txt', size: 145});
  assert.deepEqual(parsed[2], {type: 'file', name: 'custom.txt', size: 210});

  // Directorio no existente
  assert.deepEqual(parseStorageList('Storage error: file/dir not exist\r\n'), []);
});

test('describeBadUsbScript reconoce y describe qué hace cada script', () => {
  // YouTube
  const ytScript = createSafeBadUsbScript({template: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'});
  const ytDesc = describeBadUsbScript(ytScript);
  assert.equal(ytDesc.badge, 'YouTube');
  assert.match(ytDesc.summary, /YouTube/);
  assert.match(ytDesc.details, /https:\/\/www\.youtube\.com/);

  // Bloc de notas
  const noteScript = createSafeBadUsbScript({template: 'notepad', message: 'Mensaje de prueba'});
  const noteDesc = describeBadUsbScript(noteScript);
  assert.equal(noteDesc.badge, 'Bloc de notas');
  assert.match(noteDesc.summary, /notepad\.exe/);
  assert.match(noteDesc.details, /Mensaje de prueba/);

  // Calculadora
  const calcScript = createSafeBadUsbScript({template: 'calc'});
  const calcDesc = describeBadUsbScript(calcScript);
  assert.equal(calcDesc.badge, 'Calculadora');
  assert.match(calcDesc.summary, /calc\.exe/);

  // PowerShell
  const psScript = createSafeBadUsbScript({template: 'terminal_greeting', message: 'Bienvenido'});
  const psDesc = describeBadUsbScript(psScript);
  assert.equal(psDesc.badge, 'PowerShell');
  assert.match(psDesc.details, /Bienvenido/);

  // Enlace web
  const webScript = createSafeBadUsbScript({template: 'custom_url', url: 'https://www.compensar.com'});
  const webDesc = describeBadUsbScript(webScript);
  assert.equal(webDesc.badge, 'Enlace Web');
  assert.match(webDesc.details, /https:\/\/www\.compensar\.com/);

  // Archivo vacío
  assert.equal(describeBadUsbScript('').badge, 'Vacío');
});

test('lista y elimina scripts en la microSD del Flipper', async () => {
  const {FlipperSerial} = await import('../src/serial.js');
  const {makeFakePort} = await import('./fake-flipper.js');
  const port = makeFakePort(), serial = new FlipperSerial();
  try {
    await serial.connect(port);
    await serial.diagnose();

    // Guardar dos scripts
    const s1 = createSafeBadUsbScript({template: 'calc', delay: 1500});
    const s2 = createSafeBadUsbScript({template: 'notepad', message: 'Script para borrar', delay: 1500});
    await serial.saveBadUsbScript({folder: 'semillero', fileName: 'script_uno', text: s1});
    await serial.saveBadUsbScript({folder: 'semillero', fileName: 'script_dos', text: s2});

    // Listar scripts en la carpeta
    const list = await serial.listBadUsbScripts('semillero');
    assert.equal(list.length, 2);
    const names = list.map(item => item.name);
    assert.ok(names.includes('script_uno.txt'));
    assert.ok(names.includes('script_dos.txt'));

    // Verificar que describe qué hace cada uno
    const itemCalc = list.find(item => item.name === 'script_uno.txt');
    assert.equal(itemCalc.description.badge, 'Calculadora');
    assert.match(itemCalc.description.summary, /calc\.exe/);

    const itemNote = list.find(item => item.name === 'script_dos.txt');
    assert.equal(itemNote.description.badge, 'Bloc de notas');
    assert.match(itemNote.description.details, /Script para borrar/);

    // Eliminar un script individual
    const ok = await serial.deleteBadUsbScript('/ext/badusb/semillero/script_uno.txt');
    assert.equal(ok, true);

    const listAfterOne = await serial.listBadUsbScripts('semillero');
    assert.equal(listAfterOne.length, 1);
    assert.equal(listAfterOne[0].name, 'script_dos.txt');

    // Eliminar lote de scripts
    const deletedCount = await serial.deleteBadUsbScripts(['/ext/badusb/semillero/script_dos.txt']);
    assert.equal(deletedCount, 1);

    const listFinal = await serial.listBadUsbScripts('semillero');
    assert.equal(listFinal.length, 0);

    // Bloqueo de seguridad: no permite eliminar fuera de /ext/badusb/
    await assert.rejects(
      () => serial.deleteBadUsbScript('/ext/apps_data/evil_portal/index.html'),
      /Solo se permite eliminar scripts dentro de \/ext\/badusb\//
    );
  } finally {
    await serial.disconnect();
  }
});


