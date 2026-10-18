import {normalizeMac,validMac} from './network-audit.js';

export const PROFILE_KEY='semillero.authorized-networks.v1';
function validProfile(profile) {
  return profile&&typeof profile.ssid==='string'&&profile.ssid.length>0&&profile.ssid.length<=128&&validMac(profile.bssid)&&profile.authorization==='user-declared'&&typeof profile.declaredAt==='string'&&Number.isFinite(Date.parse(profile.declaredAt));
}
function cleanProfile(profile) {
  return {ssid:profile.ssid,bssid:normalizeMac(profile.bssid),authorization:'user-declared',declaredAt:profile.declaredAt};
}
export function authorizeNetwork(observation) {
  const profile={ssid:observation.ssid,bssid:observation.bssid,authorization:'user-declared',declaredAt:new Date().toISOString()};
  if(!validProfile(profile))throw new Error('Falta un SSID y BSSID válidos para registrar la autorización.');
  return cleanProfile(profile);
}
export function readProfiles(storage) {
  const raw=storage.getItem(PROFILE_KEY);if(!raw)return [];
  const data=JSON.parse(raw);
  if(data?.version!==1||!Array.isArray(data.profiles)||data.profiles.length>64||!data.profiles.every(validProfile))throw new Error('Los perfiles guardados no son válidos. No se habilitarán pruebas de LAN.');
  return data.profiles.map(cleanProfile);
}
export function writeProfiles(storage,profiles) {
  if(profiles.length>64||!profiles.every(validProfile))throw new Error('No se pudo guardar el perfil autorizado.');
  storage.setItem(PROFILE_KEY,JSON.stringify({version:1,profiles:profiles.map(cleanProfile)}));
}
export function matchProfile(observation,profiles) {
  const found=profiles.find(profile=>validProfile(profile)&&profile.ssid===observation.ssid&&normalizeMac(profile.bssid)===normalizeMac(observation.bssid));
  return found?cleanProfile(found):null;
}
export function lanPolicy(observation,profiles,capabilities,password='') {
  const profile=matchProfile(observation,profiles);
  if(!profile)return {status:'skipped',code:'authorization',profile:null,detail:'No coincide con un SSID y BSSID que hayas autorizado. Se limita a la lectura del punto de acceso.'};
  if(!['join','pingscan','portscan'].every(command=>capabilities.includes(command)))return {status:'unsupported',code:'firmware',profile,detail:'El firmware no anuncia join, pingscan y portscan. La lectura inalámbrica sigue disponible.'};
  if(observation.security!=='open'&&!password)return {status:'skipped',code:'credentials',profile,detail:'Red autorizada reconocida. Introduce su clave Wi-Fi para conectar la AIO y continuar automáticamente.'};
  return {status:'ready',code:'ready',profile,detail:'Equipos y puertos incluidos automáticamente para el perfil autorizado.'};
}
