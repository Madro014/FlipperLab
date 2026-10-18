import {normalizeMac,validMac} from './network-audit.js';
export const cleanMarauder=text=>String(text).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\r/g,'');
export function parseApList(text) {
  const rows=[];
  for(const line of cleanMarauder(text).split('\n')) {
    const m=line.match(/^\s*\[(\d+)\]\s*\[CH:\s*(\d+)\]\s*(.*?)\s+(-?\d+)(?:\s+\(selected\))?\s*$/i);
    if(m&&Number(m[1])<=65535&&Number(m[2])>0&&Number(m[2])<=233&&Number(m[4])>=-127&&Number(m[4])<=0) rows.push({index:Number(m[1]),ssid:m[3]||'(SSID oculto)',channel:m[2],rssi:m[4]});
  }
  return [...new Map(rows.map(row=>[row.index,row])).values()];
}
export function parseApInfo(raw) {
  const fields={};
  for(const line of cleanMarauder(raw).split('\n')) {const m=line.match(/^\s*(ESSID|BSSID|Channel|RSSI|Security|WPS|PMF|MFP)\s*:\s*(.*?)\s*$/i);if(m)fields[m[1].toLowerCase()]=m[2];}
  if(!fields.essid||!validMac(fields.bssid))throw new Error('Marauder no devolvió información suficiente del punto de acceso.');
  const value=(fields.security||'').toLowerCase();
  const security=/enterprise|eap/.test(value)?'enterprise':/wpa.*wpa2.*mixed|wpa\/wpa2/.test(value)?'legacyMixed':/wpa2.*wpa3/.test(value)?'mixed':/wpa3/.test(value)?'wpa3':/wpa2/.test(value)?(/aes|ccmp/.test(value)?'wpa2':'wpa2Unknown'):/wep/.test(value)?'wep':/^wpa(?:\s|$)/.test(value)?'wpa':/^open|^none|^abierta/.test(value)?'open':'unknown';
  return {ssid:fields.essid,bssid:normalizeMac(fields.bssid),channel:/^\d+$/.test(fields.channel||'')?fields.channel:'',rssi:/^-?\d+$/.test(fields.rssi||'')?fields.rssi:'',band:fields.channel&&Number(fields.channel)<=14?'2.4':'unknown',security,securityRaw:fields.security||'No informado',wps:fields.wps||'No informado',pmf:fields.pmf||fields.mfp||'No informado'};
}
export function quoteWifiPassword(password) {
  if(typeof password!=='string'||password.length>128||/[\x00-\x1f\x7f]/.test(password))throw new Error('La clave contiene caracteres que este protocolo no admite.');
  // Marauder concatenates adjacent quoted fragments in the same argument.
  return password.split('"').map(part=>'"'+part+'"').join("'\"'");
}
const ipv4=value=>/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)&&value.split('.').every(o=>Number(o)<=255);
const integer=value=>value.split('.').reduce((n,o)=>(n*256+Number(o))>>>0,0);
export function parseLanInfo(text) {
  const get=label=>cleanMarauder(text).match(new RegExp('^\\s*'+label+':\\s*([0-9.]+)\\s*$','im'))?.[1];
  const ip=get('IP address'),gateway=get('Gateway'),mask=get('Netmask');
  if(![ip,gateway,mask].every(v=>v&&ipv4(v)))throw new Error('No se confirmó una conexión Wi-Fi con IP, puerta de enlace y máscara.');
  const privateIp=v=>{const [a,b]=v.split('.').map(Number);return a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);};
  const maskNumber=integer(mask),inverse=(~maskNumber)>>>0;
  if(!privateIp(ip)||!privateIp(gateway)||inverse<3||inverse>255||((inverse+1)&inverse)!==0||(integer(ip)&maskNumber)!==(integer(gateway)&maskNumber))throw new Error('La prueba automática de equipos requiere una subred privada de hasta 254 direcciones.');
  return {ip,gateway,mask,network:(integer(ip)&maskNumber)>>>0,maskNumber,hosts:inverse-1};
}
export function parseLanResults(raw,network) {
  const hosts=new Set(),services=new Map();
  for(const line of cleanMarauder(raw).split('\n')) {
    const m=line.match(/^\s*(?:\[\d+\]\s*)?(\d{1,3}(?:\.\d{1,3}){3})(?::\s*(\d{1,5}))?\s*$/);
    if(!m||!ipv4(m[1])||((integer(m[1])&network.maskNumber)>>>0)!==network.network)continue;
    hosts.add(m[1]);
    if(m[2]&&Number(m[2])>0&&Number(m[2])<=65535)services.set(m[1]+':'+m[2],{ip:m[1],port:Number(m[2])});
  }
  return {hosts:[...hosts],services:[...services.values()]};
}
export function diagnoseMarauder(observation,tests,services=[],previous=null) {
  const findings=[],pending=[];
  const add=(id,severity,title,evidence,why,fix)=>findings.push({id,severity,title,evidence,why,fix,steps:{router:fix,flipper:'Repite el diagnóstico desde la página después de aplicar el cambio.',page:'Guarda esta práctica y compara los resultados de una nueva ejecución.'}});
  if(['open','wep','wpa','legacyMixed'].includes(observation.security))add('wifi-protection','high','Protección Wi-Fi débil o heredada',`Marauder anuncia: ${observation.securityRaw}.`,'Una red abierta no cifra el enlace; WEP y WPA heredado requieren sustitución. Un modo mixto con WPA conserva compatibilidad antigua.','Usa WPA3 Personal cuando tus equipos lo permitan o WPA2 con AES/CCMP, y una clave larga y única.');
  if(/^(on|enabled|yes|true|activado)$/i.test(observation.wps))add('wps-advertised','medium','El AP anuncia WPS',`Respuesta del ESP32: WPS ${observation.wps}.`,'WPS añade una vía de incorporación que conviene revisar. El anuncio no demuestra que un ataque a WPS funcione.','Desactiva WPS si no es necesario y vuelve a consultar el punto de acceso.');
  if(/^(off|disabled|no|false|desactivado)$/i.test(observation.pmf))add('pmf-disabled','medium','Protección de tramas de gestión no anunciada como activa',`Respuesta del ESP32: PMF ${observation.pmf}.`,'La ausencia de PMF deja menos protección para algunas tramas de gestión. No confirma que una desconexión forzada tenga éxito.','Activa PMF cuando sea compatible con tus dispositivos y vuelve a comprobar el anuncio.');
  for(const row of services) {
    const port=row.port;
    if(![22,23,80,443,3389].includes(port))continue;
    const descriptions={23:['medium','Puerto asociado a Telnet accesible','Si el servicio es Telnet, su comunicación carece de cifrado. El número de puerto por sí solo no identifica el servicio.','Identifica el servicio en el equipo, sustituye Telnet por SSH o desactívalo y limita el acceso.'],80:['medium','Puerto web 80 accesible','Hay un puerto TCP abierto asociado habitualmente a HTTP. Falta comprobar si redirige a HTTPS y qué información sirve.','Comprueba el servicio y sus redirecciones. Utiliza HTTPS para la administración y los datos sensibles.'],22:['info','Puerto de administración SSH accesible','SSH puede ser legítimo. Su disponibilidad no demuestra una vulnerabilidad ni una contraseña débil.','Confirma que es necesario, mantenlo actualizado y limita quién puede acceder.'],443:['info','Puerto web 443 accesible','El puerto abierto no confirma el protocolo, la validez del certificado ni la versión de TLS.','Revisa el certificado y la configuración HTTPS del servicio identificado.'],3389:['medium','Puerto asociado a escritorio remoto accesible','La exposición requiere revisar el servicio y sus controles. No demuestra acceso sin autorización.','Confirma si es RDP, restringe el acceso a equipos necesarios y revisa actualización y autenticación.']};
    const [level,title,why,fix]=descriptions[port];add(`service-${row.ip}-${port}`,level,title,`El ESP32 confirmó conexión TCP a ${row.ip}:${port}.`,why,fix);
  }
  if(previous?.ssid===observation.ssid&&previous.bssid&&previous.bssid!==observation.bssid)add('identity-change','info','El BSSID cambió respecto a la práctica anterior',`${previous.bssid} → ${observation.bssid}.`,'Puede deberse a una malla, repetidor o banda distinta. El cambio no demuestra suplantación.','Contrasta la identidad con tus puntos de acceso antes de actualizar la referencia.');
  if(['unknown','wpa2Unknown'].includes(observation.security))pending.push('Cifrado exacto: el firmware no informó un valor suficiente.');
  if(observation.wps==='No informado')pending.push('WPS: este firmware no lo informó.');
  if(observation.pmf==='No informado')pending.push('PMF: este firmware no lo informó.');
  for(const test of tests)if(test.status!=='observed')pending.push(`${test.label}: ${test.detail}`);
  findings.sort((a,b)=>({high:0,medium:1,low:2,info:3}[a.severity]-{high:0,medium:1,low:2,info:3}[b.severity]));
  return {findings,pending,scope:'Diagnóstico con respuestas seriales del ESP32 mediante el puente USB-UART del Flipper. Solo describe la ejecución y los datos observados. Las ventanas de sondeo de LAN son parciales; no encontrar un puerto no demuestra que esté cerrado. Un puerto abierto no identifica una vulnerabilidad, un servicio ni su versión. No se probaron contraseñas, explotación, CVE, acceso WAN ni configuraciones internas del router.'};
}
