import {APP_PATHS, PORTAL_DIR, cleanTerminal, parseDeviceInfo, parseStorageText, storageExists, stripResponse} from './device-protocol.js';
import {createTestBundle} from './portal.js';
import {NETWORK_APPS} from './network-audit.js';

export const FLIPPER_FILTER = {usbVendorId: 0x0483, usbProductId: 0x5740};
export const isFlipperCandidate = (info = {}) => info.usbVendorId === FLIPPER_FILTER.usbVendorId && info.usbProductId === FLIPPER_FILTER.usbProductId;

export class FlipperSerial {
  constructor(onData = () => {}, onClose = () => {}) {
    this.onData = onData; this.onClose = onClose;
    this.port = null; this.reader = null; this.pending = null; this.closing = false; this.busy = false;
  }

  async connect(selectedPort) {
    if (this.port) throw new Error('Ya existe una conexión USB.');
    const api = globalThis.navigator?.serial;
    if (!selectedPort && !api) throw new Error('Abre esta aplicación en Chrome o Edge desde localhost.');
    const port = selectedPort || await api.requestPort({filters: [FLIPPER_FILTER]});
    await port.open({baudRate: 230400});
    this.port = port; this.closing = false;
    try {
      await port.setSignals?.({dataTerminalReady: true});
      this.loop = this.read();
      await this.request('\r', {command: '', timeout: 5000});
      return port.getInfo();
    } catch (error) { await this.disconnect(); throw error; }
  }

  async read() {
    const decoder = new TextDecoder();
    try {
      this.reader = this.port.readable.getReader();
      while (!this.closing) {
        const {value, done} = await this.reader.read();
        if (done) break;
        if (!value) continue;
        const chunk = decoder.decode(value, {stream: true});
        this.onData(chunk);
        if (this.pending) {
          this.pending.buffer += chunk;
          if (this.pending.buffer.length > 200000) throw new Error('Respuesta USB demasiado larga.');
          if (this.pending.match(cleanTerminal(this.pending.buffer))) {
            const pending = this.pending; this.pending = null;
            clearTimeout(pending.timer); pending.resolve(pending.buffer);
          }
        }
      }
    } catch (error) {
      if (!this.closing) this.onData(`\nUSB: ${error.message}\n`);
    } finally {
      this.reader?.releaseLock(); this.reader = null;
      this.rejectPending(new Error('Se interrumpió la conexión USB.'));
      if (!this.closing) {
        try { await this.port?.close(); } catch {}
        this.port = null; this.identity = null; this.onClose();
      }
    }
  }

  rejectPending(error) {
    if (!this.pending) return;
    const pending = this.pending; this.pending = null;
    clearTimeout(pending.timer); pending.reject(error);
  }

  async write(bytes) {
    if (!this.port?.writable || this.closing) throw new Error('Conecta el Flipper primero.');
    const writer = this.port.writable.getWriter();
    try { await writer.write(typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes); }
    finally { writer.releaseLock(); }
  }

  async request(data, {command = '', timeout = 8000, match = text => (!command || text.includes(command + '\r\n') || text.includes(command + '\n')) && /(?:^|\r?\n)>: $/.test(text)} = {}) {
    if (this.pending) throw new Error('Hay una operación USB en curso.');
    const response = new Promise((resolve, reject) => {
      this.pending = {resolve, reject, match, buffer: '', timer: setTimeout(() => {
        this.rejectPending(new Error('El Flipper no respondió a tiempo. Desconecta y vuelve a conectar antes de continuar.'));
        // Close on timeout: a late reply cannot be assigned to the next command.
        void this.disconnect().catch(() => {});
      }, timeout)};
    });
    try { await this.write(data); } catch (error) { this.rejectPending(error); }
    return stripResponse(await response, command);
  }

  async command(command, {allowError = false} = {}) {
    const response = await this.request(command + '\r', {command});
    if (!allowError && /Storage error:|command not found|unknown command|Usage:/i.test(response)) throw new Error(response.trim());
    return response;
  }

  async exclusive(operation) {
    if (this.busy) throw new Error('Espera a que termine la operación USB actual.');
    this.busy = true;
    try { return await operation(); } finally { this.busy = false; }
  }

  async deviceInfo() {
    return this.exclusive(async () => {
      const info = parseDeviceInfo(await this.command('info device'));
      if (info.model !== 'Flipper Zero' || !info.uid) throw new Error('El puerto no respondió como un Flipper Zero.');
      this.identity = info;
      return info;
    });
  }

  async exists(path) { return storageExists(await this.command(`storage stat ${path}`, {allowError: true})); }

  async diagnose() {
    return this.exclusive(async () => {
      const device = parseDeviceInfo(await this.command('info device'));
      if (device.model !== 'Flipper Zero' || !device.uid) throw new Error('No se pudo confirmar la identidad del Flipper.');
      this.identity = device;
      const sd = await this.exists('/ext');
      let appPath = '';
      if (sd) for (const path of APP_PATHS) if (await this.exists(path)) { appPath = path; break; }
      const networkApps=[];
      for(const app of NETWORK_APPS) {
        let installedPath='';
        if(sd) for(const path of app.paths) if(await this.exists(path)){installedPath=path;break;}
        networkApps.push({id:app.id,name:app.name,path:installedPath});
      }
      return {device, sd, appPath, networkApps, index: sd && await this.exists(`${PORTAL_DIR}/index.html`), checkedAt: new Date().toISOString()};
    });
  }

  async requireIdle() {
    const response = await this.command('loader info');
    if (!/No application is running/.test(response)) throw new Error('Cierra la aplicación abierta en el Flipper y vuelve a intentarlo.');
  }

  async openNetworkTool(id) {
    const app=NETWORK_APPS.find(item=>item.id===id);
    if(!app) throw new Error('Herramienta de red no reconocida.');
    return this.exclusive(async()=>{
      if(!this.identity) throw new Error('Conecta el Flipper y ejecuta el diagnóstico primero.');
      await this.requireIdle();
      for(const path of app.paths) if(await this.exists(path)) {
        const response=await this.command(`loader open ${path}`);
        if(response.trim()) throw new Error(response.trim());
        const state=await this.command('loader info');
        if(!/Application .*is running/.test(state)) throw new Error('No se confirmó la apertura. Revisa la pantalla del Flipper.');
        return {id:app.id,name:app.name,path,state};
      }
      throw new Error(`${app.name} no está instalada en las rutas compatibles de la microSD.`);
    });
  }

  async ensureDir(path) { if (!await this.exists(path)) await this.command(`storage mkdir ${path}`); }
  async readText(path) { return parseStorageText(await this.command(`storage read ${path}`)); }

  async writeNew(path, text, progress = () => {}) {
    if (await this.exists(path)) throw new Error('El archivo temporal ya existe; no se sobrescribió.');
    const bytes = new TextEncoder().encode(text);
    for (let offset = 0; offset < bytes.length; offset += 256) {
      const chunk = bytes.slice(offset, offset + 256);
      // CLI consumes CR as Enter. Adding LF would become the first payload byte.
      const ready = await this.request(`storage write_chunk ${path} ${chunk.length}\r`, {
        match: response => /(?:^|\r?\n)Ready\r?\n$/.test(response) || /(?:^|\r?\n)>: $/.test(response),
      });
      if (!/(?:^|\r?\n)Ready\r?\n$/.test(ready)) throw new Error('El Flipper no aceptó el bloque de datos.');
      await this.request(chunk);
      progress(Math.min(1, (offset + chunk.length) / bytes.length));
    }
    if (await this.readText(path) !== text) throw new Error('La verificación del archivo no coincide.');
  }

  async deployTest(config, progress = () => {}) {
    const bundle = createTestBundle(config);
    return this.exclusive(async () => {
      if (!this.identity) throw new Error('Ejecuta el diagnóstico primero.');
      await this.requireIdle();
      if (!await this.exists('/ext')) throw new Error('No se encontró una microSD disponible.');
      let installed = false;
      for (const path of APP_PATHS) if (await this.exists(path)) { installed = true; break; }
      if (!installed) throw new Error('Evil Portal no está instalado en las rutas compatibles.');
      await this.ensureDir('/ext/apps_data'); await this.ensureDir(PORTAL_DIR); await this.ensureDir(`${PORTAL_DIR}/logs`);
      const id = Date.now().toString(36) + '-' + globalThis.crypto.randomUUID().slice(0, 8);
      const backupDir = `${PORTAL_DIR}/semillero-${id}`;
      await this.command(`storage mkdir ${backupDir}`);
      const files = [{name: 'index.html', text: bundle.html}, {name: 'ap.config.txt', text: bundle.ssid}];
      for (const [i, item] of files.entries()) await this.writeNew(`${backupDir}/new-${item.name}`, item.text, value => progress(Math.round((i + value) / files.length * 80)));
      const moved = [], promoted = [];
      try {
        for (const item of files) {
          item.original = await this.exists(`${PORTAL_DIR}/${item.name}`);
          if (item.original) {
            await this.command(`storage rename ${PORTAL_DIR}/${item.name} ${backupDir}/${item.name}`);
            moved.push(item);
          }
          await this.command(`storage rename ${backupDir}/new-${item.name} ${PORTAL_DIR}/${item.name}`);
          promoted.push(item);
        }
        for (const item of files) if (await this.readText(`${PORTAL_DIR}/${item.name}`) !== item.text) throw new Error('La verificación final no coincide.');
      } catch (error) {
        try {
          if (!this.port || this.closing) throw new Error('Puerto desconectado.');
          for (const item of [...promoted].reverse()) await this.command(`storage remove ${PORTAL_DIR}/${item.name}`);
          for (const item of [...moved].reverse()) await this.command(`storage rename ${backupDir}/${item.name} ${PORTAL_DIR}/${item.name}`);
        } catch { throw new Error(`Se interrumpió la carga. Conserva el respaldo en ${backupDir} y revisa los archivos con qFlipper. ${error.message}`); }
        throw new Error(`No se aplicó el cambio; se recuperaron los archivos anteriores. ${error.message}`);
      }
      progress(100);
      return {backupDir, uid: this.identity.uid, files: files.map(({name, original}) => ({name, original})), token: bundle.token, ssid: bundle.ssid, html: bundle.html, deployedAt: new Date().toISOString()};
    });
  }

  async openPortal() {
    return this.exclusive(async () => {
      await this.requireIdle();
      for (const path of APP_PATHS) if (await this.exists(path)) {
        const result = await this.command(`loader open ${path}`);
        if (result.trim()) throw new Error(result.trim());
        const state = await this.command('loader info');
        if (!/Application .*is running/.test(state)) throw new Error('Comprueba la pantalla: no se confirmó que la aplicación esté abierta.');
        return state;
      }
      throw new Error('No se encontró la aplicación Evil Portal.');
    });
  }

  async disconnect() {
    if (this.closing) return;
    this.closing = true; this.rejectPending(new Error('Conexión USB cerrada.'));
    try { await this.reader?.cancel(); await this.loop; await this.port?.close(); }
    finally { this.port = null; this.identity = null; this.onClose(); }
  }
}
