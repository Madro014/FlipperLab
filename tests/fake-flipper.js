// A byte-oriented CLI fixture shared by protocol and browser tests.
export function makeFakePort(options = {}) {
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const files = new Map([
    ['/ext/apps/GPIO/ESP/evil_portal.fap', encoder.encode('app')],
    ['/ext/apps/GPIO/ESP/esp32_wifi_marauder.fap', encoder.encode('marauder-app')],
    ['/ext/apps/GPIO/ESP/wifi_scanner.fap', encoder.encode('scanner-app')],
    ['/ext/apps_data/evil_portal/index.html', encoder.encode('<html>Original</html>')],
    ['/ext/apps_data/evil_portal/ap.config.txt', encoder.encode('Original-LAB')],
  ]);
  const dirs = new Set(['/ext','/ext/apps_data','/ext/apps_data/evil_portal','/ext/apps_data/evil_portal/logs']);
  let controller, raw = null, line = '', app = '', failed = false;
  const commands = [];
  const send = text => {
    const bytes = encoder.encode(text);
    for(let i = 0; i < bytes.length; i += 17) controller.enqueue(bytes.slice(i, i + 17));
  };
  const answer = text => send(text + '\r\n>: ');
  const error = message => answer('Storage error: ' + message + '\r\n');
  const port = {
    files, dirs, commands,
    getInfo: () => ({usbVendorId:0x0483,usbProductId:0x5740}),
    async setSignals() {},
    async open() {
      raw = null;line = '';app = '';
      port.readable = new ReadableStream({start(value){controller = value;}});
      port.writable = new WritableStream({write(bytes) {
        for(const byte of bytes) {
          if(raw) {
            raw.buffer.push(byte);
            if(raw.buffer.length === raw.size) {
              const previous = files.get(raw.path) || new Uint8Array();
              files.set(raw.path, new Uint8Array([...previous, ...raw.buffer]));raw = null;answer('');
            }
          } else if(byte === 13) {
            const command = line;line = '';commands.push(command);send(command + '\r\n');
            const parts = command.split(' '), path = parts[2];
            if(!command) answer('');
            else if(command === 'info device') answer('hardware.model : Flipper Zero\r\nhardware.name : Prueba\r\nhardware.uid : TEST-DEVICE\r\nfirmware.origin.fork : Momentum\r\nfirmware.version : mntm-dev\r\nfirmware.build.date : 18-08-2026\r\n');
            else if(command === 'loader info') answer(app ? `Application "${app}" is running\r\n` : 'No application is running\r\n');
            else if(parts[0] === 'loader' && parts[1] === 'open') {app = path?.includes('marauder')?'ESP32 WiFi Marauder':path?.includes('wifi_scanner')?'WiFi Scanner':'Evil Portal';answer('');}
            else if(parts[0] !== 'storage') answer('Unknown command\r\n');
            else if(parts[1] === 'stat') {
              if(dirs.has(path)) answer(path === '/ext' ? 'Storage, 100000KiB total, 99999KiB free\r\n' : 'Directory\r\n');
              else if(files.has(path)) answer(`File, size: ${files.get(path).length}b\r\n`);
              else error('file/dir not exist');
            } else if(parts[1] === 'mkdir') {dirs.add(path);answer('');}
            else if(parts[1] === 'read') {
              if(files.has(path)) answer(`Size: ${files.get(path).length}\r\n${decoder.decode(files.get(path))}\r\n`);
              else error('file/dir not exist');
            } else if(parts[1] === 'write_chunk') {raw = {path, size:Number(parts[3]), buffer:[]};send('Ready\r\n');}
            else if(parts[1] === 'remove') {if(files.delete(path)) answer(''); else error('file/dir not exist');}
            else if(parts[1] === 'rename') {
              if(options.failPromotion && !failed && path.endsWith('/new-ap.config.txt')) {failed = true;error('injected write failure');}
              else if(!files.has(path)) error('file/dir not exist');
              else if(files.has(parts[3])) error('already exists');
              else {files.set(parts[3],files.get(path));files.delete(path);answer('');}
            } else answer('Usage:\r\n');
          } else line += String.fromCharCode(byte);
        }
      }});
    },
    async close() {},
  };
  if(typeof window !== 'undefined') {
    window.__fakePort = port;
    Object.defineProperty(navigator,'serial',{configurable:true,value:{requestPort:async() => port,getPorts:async() => [],addEventListener(){},removeEventListener(){}}});
  }
  return port;
}
