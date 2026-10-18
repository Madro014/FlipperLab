export const MAX_HTML_BYTES = 1024 * 1024;
export const DEMO_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;padding:34px 22px;background:#f3f5f0;font-family:Arial,sans-serif;color:#243027}.card{max-width:340px;margin:0 auto;background:white;border:1px solid #e0e5dc;border-radius:18px;padding:30px} .mark{width:44px;height:44px;border-radius:14px;background:#dcf89a;display:grid;place-items:center;font-size:24px}small{display:block;color:#61705e;line-height:1.6}h1{font-size:25px;line-height:1.15;margin:24px 0 12px}label{display:block;font-size:12px;margin:22px 0 8px}input{width:100%;padding:13px;border:1px solid #d8dfd2;border-radius:8px}button{width:100%;padding:14px;background:#263b29;color:white;border:0;border-radius:8px;margin-top:16px;font-weight:bold}.badge{margin-bottom:20px;font-size:10px;letter-spacing:1px;color:#607057}footer{text-align:center;font-size:10px;color:#6d7868;margin-top:25px}
</style></head><body><div class="card"><div class="badge">ENTORNO DE PRÁCTICA · SIN CONEXIÓN REAL</div><div class="mark">⌁</div><h1>Bienvenido al<br>laboratorio.</h1><small>Este portal es una demostración académica. Utiliza únicamente información ficticia.</small><form><label>Alias de práctica</label><input placeholder="estudiante-demo" autocomplete="off"><button type="submit">Continuar con la práctica →</button></form><footer>Semillero / Compensar</footer></div></body></html>`;

// The browser adds a second layer of isolation through iframe sandbox="".
// No script, form submission, network, frame, plugin or navigation is allowed.
export function sanitizePortal(html, parser = new DOMParser()) {
  const doc = parser.parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,frame,frameset,object,embed,base,link,meta,svg,math,audio,video,source,track').forEach(el=>el.remove());
  doc.querySelectorAll('*').forEach(el=>{
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
  const csp=doc.createElement('meta');csp.httpEquiv='Content-Security-Policy';
  csp.content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'";
  doc.head.prepend(csp);
  return '<!doctype html>'+doc.documentElement.outerHTML;
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
