export const APP_PATHS = ['/ext/apps/GPIO/ESP/evil_portal.fap', '/ext/apps/GPIO/evil_portal.fap'];
export const PORTAL_DIR = '/ext/apps_data/evil_portal';
export const BADUSB_DIR = '/ext/badusb';
export const cleanTerminal = text => text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');

export function parseDeviceInfo(text) {
  const fields = {};
  for (const line of cleanTerminal(text).split(/\r?\n/)) {
    const match = line.match(/^([\w.]+)\s+:\s*(.*?)\s*$/);
    if (match) fields[match[1]] = match[2];
  }
  return {model: fields['hardware.model'] || '', name: fields['hardware.name'] || '', uid: fields['hardware.uid'] || '',
    firmware: fields['firmware.origin.fork'] || fields['firmware.branch.name'] || '', version: fields['firmware.version'] || '',
    build: fields['firmware.build.date'] || '', fields};
}

export function stripResponse(raw, command) {
  let text = cleanTerminal(raw).replace(/(?:^|\r?\n)>: $/, '').replace(/^\r?\n/, '');
  if (text.startsWith(command + '\r\n')) text = text.slice(command.length + 2);
  else if (text.startsWith(command + '\n')) text = text.slice(command.length + 1);
  return text;
}

export function parseStorageText(response) {
  const match = /(?:^|\r?\n)(?:File\s+)?Size:\s*(\d+)\r?\n/i.exec(response);
  if (!match) throw new Error('El Flipper no devolvió un archivo legible.');
  let content = response.slice(match.index + match[0].length);
  if (content.endsWith('\r\n')) content = content.slice(0, -2);
  else if (content.endsWith('\n')) content = content.slice(0, -1);
  const len = new TextEncoder().encode(content).length;
  const expected = Number(match[1]);
  if (Math.abs(len - expected) > 2 && len !== expected) {
    throw new Error('Lectura incompleta del archivo. Repite la conexión.');
  }
  return content;
}

export function storageExists(response) {
  if (/Storage error:/i.test(response)) {
    if (/not exist|not found/i.test(response)) return false;
    throw new Error(response.trim());
  }
  if (!/^(File, size: \d+b|Directory|Storage,)/m.test(response)) throw new Error('Respuesta de almacenamiento no reconocida.');
  return true;
}

export function parseStorageList(response) {
  const text = cleanTerminal(response);
  if (/Storage error:/i.test(text)) {
    if (/not exist|not found/i.test(text)) return [];
    throw new Error(text.trim());
  }
  const lines = text.split(/\r?\n/);
  const items = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('>:')) continue;
    const fileMatch = line.match(/^\[F\]\s+(.*?)(?:\s+(\d+)b)?$/i);
    if (fileMatch) {
      items.push({type: 'file', name: fileMatch[1], size: fileMatch[2] ? Number(fileMatch[2]) : null});
      continue;
    }
    const dirMatch = line.match(/^\[D\]\s+(.*)$/i);
    if (dirMatch) {
      items.push({type: 'dir', name: dirMatch[1]});
    }
  }
  return items;
}

