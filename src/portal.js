export const MAX_HTML_BYTES = 1024 * 1024;
export const MAX_DEVICE_HTML_BYTES = 3900;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const newToken = () => [...crypto.getRandomValues(new Uint8Array(3))].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();

export function createTestBundle({ssid = 'Semillero-LAB', token = 'A1B2C3', title = 'Tu conexión llegó al laboratorio.', message = 'Esta es una prueba de portal cautivo con dispositivos propios.'} = {}) {
  if (!/^Semillero-LAB(?:-[A-Za-z0-9]{1,12})?$/.test(ssid)) throw new Error('Usa Semillero-LAB y un sufijo de hasta 12 letras o números.');
  if (!/^[A-F0-9]{6}$/.test(token)) throw new Error('El código de prueba debe tener seis caracteres hexadecimales.');
  if (!title.trim() || title.length > 56 || message.length > 180) throw new Error('Revisa el título (1–56 caracteres) y el mensaje (hasta 180).');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';base-uri 'none';form-action 'none'"><title>Semillero - Prueba de conexión</title><style>*{box-sizing:border-box}body{margin:0;padding:38px 22px;background:#eef2eb;color:#23382f;font:15px/1.6 system-ui,sans-serif}main{max-width:370px;margin:auto;background:white;border:1px solid #dce3d7;border-radius:24px;padding:30px}small{font-size:10px;letter-spacing:1.8px;color:#60795f}.icon{background:#d6efac;border-radius:16px;width:54px;height:54px;display:grid;place-items:center;font-size:26px;margin:26px 0}h1{font-size:29px;line-height:1.18;letter-spacing:-1px;margin:0 0 18px}p{color:#627265;font-size:13px}.code{margin:26px 0;background:#f2f6ef;border:1px dashed #b5c6a5;border-radius:12px;text-align:center;padding:20px}.code span{display:block;font-size:10px;color:#72806a;letter-spacing:1px}.code strong{font:700 30px/1.8 monospace;letter-spacing:5px}a{display:block;text-align:center;background:#264d3b;color:white;padding:14px;border-radius:10px;text-decoration:none;font-size:13px}#ok{display:none;color:#2d6945;background:#eaf5df;padding:14px;border-radius:10px;margin-top:14px;font-size:12px}#ok:target{display:block}footer{font-size:10px;color:#7f8b79;border-top:1px solid #edf0e9;margin-top:24px;padding-top:16px}</style></head><body><main><small>SEMILLERO / PRUEBA AUTORIZADA</small><div class="icon">&#8779;</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><div class="code"><span>CÓDIGO DE ESTA PRUEBA</span><strong>${token}</strong></div><a href="#ok">Comprobar visualmente &#8594;</a><div id="ok">Página cargada. Compara el código con el del computador para documentar la prueba.</div><footer>Red: ${escapeHtml(ssid)}<br>Sin acceso a Internet. Esta página no solicita datos personales ni contraseñas.</footer></main></body></html>`;
  if (new TextEncoder().encode(html).length > MAX_DEVICE_HTML_BYTES) throw new Error('El portal supera el tamaño compatible con Evil Portal. Acorta el texto.');
  return {html, ssid, token};
}
export const DEMO_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;padding:34px 22px;background:#f3f5f0;font-family:Arial,sans-serif;color:#243027}.card{max-width:340px;margin:0 auto;background:white;border:1px solid #e0e5dc;border-radius:18px;padding:30px} .mark{width:44px;height:44px;border-radius:14px;background:#dcf89a;display:grid;place-items:center;font-size:24px}small{display:block;color:#61705e;line-height:1.6}h1{font-size:25px;line-height:1.15;margin:24px 0 12px}label{display:block;font-size:12px;margin:22px 0 8px}input{width:100%;padding:13px;border:1px solid #d8dfd2;border-radius:8px}button{width:100%;padding:14px;background:#263b29;color:white;border:0;border-radius:8px;margin-top:16px;font-weight:bold}.badge{margin-bottom:20px;font-size:10px;letter-spacing:1px;color:#607057}footer{text-align:center;font-size:10px;color:#6d7868;margin-top:25px}
</style></head><body><div class="card"><div class="badge">ENTORNO DE PRÁCTICA · SIN CONEXIÓN REAL</div><div class="mark">⌁</div><h1>Bienvenido al<br>laboratorio.</h1><small>Este portal es una demostración académica. Utiliza únicamente información ficticia.</small><form><label>Alias de práctica</label><input placeholder="estudiante-demo" autocomplete="off"><button type="submit">Continuar con la práctica →</button></form><footer>Semillero / Compensar</footer></div></body></html>`;

// The browser adds a second layer of isolation through iframe sandbox="".
// No script, form submission, network, frame, plugin or navigation is allowed.
export function sanitizePortal(html) {
  // Template content stays inert during parsing, before resource attributes are removed.
  const template = document.createElement('template');
  template.innerHTML = html;
  const doc = template.content;
  doc.querySelectorAll('script,iframe,frame,frameset,object,embed,base,link,meta,svg,math,audio,video,source,track,template').forEach(el=>el.remove());
  const resourceCss = /@(?:import|font-face)|url\s*\(|image-set|\\/i;
  doc.querySelectorAll('style').forEach(el=>{if(resourceCss.test(el.textContent))el.remove();});
  doc.querySelectorAll('*').forEach(el=>{
    if (resourceCss.test(el.getAttribute('style') || '')) el.removeAttribute('style');
    [...el.attributes].forEach(attr=>{
      if (/^on/i.test(attr.name) || ['href','action','formaction','srcdoc','ping','target','download','background','xlink:href','srcset'].includes(attr.name.toLowerCase())) el.removeAttribute(attr.name);
    });
    if (el.hasAttribute('src') && !(el.tagName==='IMG' && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(el.getAttribute('src')))) el.removeAttribute('src');
    if (el.tagName==='INPUT' && ['password','email'].includes(el.type)) { el.type='text'; el.value=''; el.placeholder='Dato ficticio de práctica'; }
    if (el.tagName==='INPUT') { el.removeAttribute('value'); el.value=''; }
    if (el.tagName==='TEXTAREA') el.textContent='';
    if (el.matches('input,textarea,select')) {el.setAttribute('disabled','');el.setAttribute('autocomplete','off');}
    if(el.tagName==='BUTTON') {el.setAttribute('type','button');el.setAttribute('disabled','');}
  });
  const policy="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body>${template.innerHTML}</body></html>`;
}

export function simulatedEvents(name) {
  return [
    {type:'info', message:`Escenario iniciado: ${name}.`},
    {type:'info', message:'Cliente ficticio DEMO-01 visita el portal local.'},
    {type:'info', message:'Vista del portal renderizada en la simulación.'},
    {type:'success', message:'Interacción ficticia completada. No se recopilaron datos.'},
    {type:'success', message:'Práctica finalizada. No se emitieron señales Wi-Fi.'}
  ];
}
