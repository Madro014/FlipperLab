import {parse} from 'parse5';

export const ANALYZER_LIMIT = 1024 * 1024;
export const SEVERITIES = {high:'Alto',medium:'Medio',low:'Bajo',info:'Información'};
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const cleanEvidence = text => text.replace(/\bvalue\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'value="[omitido]"').slice(0,600);
const networkUrl = value => {try {const url = new URL(value);return /^https?:$/.test(url.protocol) ? url : null;} catch {return null;}};

export function analyzeHtml(source, {documentUrl = '', fileName = 'portal.html'} = {}) {
  if (!source.trim()) throw new Error('Carga o pega un HTML para analizar.');
  if (new TextEncoder().encode(source).length > ANALYZER_LIMIT) throw new Error('El HTML supera el límite de 1 MB.');
  const originUrl = documentUrl.trim() ? networkUrl(documentUrl.trim()) : null;
  if (documentUrl.trim() && !originUrl) throw new Error('La URL de la página debe ser una dirección HTTP o HTTPS completa.');
  const tree = parse(source, {sourceCodeLocationInfo:true});
  const nodes = [], stack = [tree];
  while (stack.length) {
    const node = stack.pop();nodes.push(node);
    if (node.content) stack.push(node.content);
    if (node.childNodes) stack.push(...[...node.childNodes].reverse());
  }
  let base = originUrl;
  const baseNode = nodes.find(node => node.tagName === 'base' && attr(node,'href') !== undefined);
  if (baseNode) {try {base = new URL(attr(baseNode,'href'), originUrl || undefined);} catch {base = null;}}
  const forms = [], resources = [], http = [], findings = [];
  const location = (node, attribute) => node.sourceCodeLocation?.attrs?.[attribute] || node.sourceCodeLocation;
  function info(node, attribute, override) {
    const loc = location(node,attribute) || {startLine:1,startCol:1,startOffset:0,endOffset:0};
    const tagLoc = node.sourceCodeLocation?.startTag || loc;
    return {line:loc.startLine,column:loc.startCol,evidence:cleanEvidence(override ?? source.slice(tagLoc.startOffset,tagLoc.endOffset))};
  }
  function resolve(raw, currentDocument = false) {
    if (currentDocument) return originUrl;
    try {return new URL(raw,base || undefined);} catch {return null;}
  }
  function urlInfo(raw, currentDocument = false) {
    const url = resolve(raw,currentDocument);
    const isNetwork = url && /^https?:$/.test(url.protocol);
    return {raw, url:url?.href || '', protocol:url?.protocol || '',
      relation:isNetwork ? originUrl ? url.origin === originUrl.origin ? 'mismo-origen' : 'externo' : 'origen-por-confirmar' : url ? 'local-u-otro' : 'sin-base'};
  }
  function finding(category,severity,title,entry,why,fix) {
    findings.push({id:`finding-${findings.length+1}`,category,severity,title,line:entry.line,column:entry.column,evidence:entry.evidence,url:entry.url || '',why,fix});
  }
  function inspectHttp(entry, category, literal = false) {
    if (entry.protocol !== 'http:') return;
    http.push({...entry,literal});
    const severity = entry.kind === 'Script' || category === 'forms' && entry.sensitive ? 'high' : entry.kind === 'Enlace' || literal ? 'low' : 'medium';
    finding('http',severity,literal ? 'URL HTTP literal en JavaScript' : `${entry.kind} usa HTTP`,entry,
      literal ? 'Esta cadena puede ser un destino de red. El análisis estático no confirma que se utilice.' : 'HTTP no cifra la solicitud ni su contenido. En un enlace, la solicitud ocurre al navegar; un recurso puede cargarse al abrir la página.',
      'Usa HTTPS con un certificado válido si el destino debe recibir información. Un portal cautivo HTTP de laboratorio debe permanecer libre de datos sensibles.');
  }
  const formNodes = nodes.filter(node => node.tagName === 'form');
  const formById=new Map(),controlsByForm=new Map();
  for(const form of formNodes){const id=attr(form,'id');if(id&&!formById.has(id))formById.set(id,form);controlsByForm.set(form,[]);}
  for(const control of nodes) if(['input','textarea','select'].includes(control.tagName)) {
    let owner=attr(control,'form')!==undefined?formById.get(attr(control,'form')):control.parentNode;
    if(attr(control,'form')===undefined) while(owner&&owner.tagName!=='form')owner=owner.parentNode;
    controlsByForm.get(owner)?.push(control);
  }
  function collectForm(node, owner, override = false) {
    const attribute = override ? 'formaction' : 'action';
    const raw = attr(node,attribute) || '';
    const declaredMethod=(override?(attr(node,'formmethod')??attr(owner,'method')):attr(node,'method'))||'get';
    const method=['GET','POST','DIALOG'].includes(declaredMethod.toUpperCase())?declaredMethod.toUpperCase():'GET';
    const controls = controlsByForm.get(owner)||[];
    const sensitive = controls.some(control => Boolean(attr(control,'name')) && attr(control,'disabled')===undefined && ['password','email'].includes((attr(control,'type') || '').toLowerCase()));
    const entry = {id:`form-${forms.length+1}`,kind:override ? 'Botón con destino alternativo' : 'Formulario',method,sensitive,fields:controls.length,...info(node,attribute),...urlInfo(raw,!raw)};
    if (method === 'DIALOG') {entry.url='';entry.protocol='';entry.relation='sin-envio';}
    forms.push(entry);
    if (method === 'DIALOG') return;
    inspectHttp(entry,'forms');
    if (entry.relation === 'externo') finding('forms','medium','El formulario apunta a otro origen',entry,'Los datos se enviarían a un origen distinto del de la página. Puede ser una integración legítima que debes verificar.','Comprueba el dominio, el responsable del servicio y qué campos necesita recibir.');
    if (method === 'GET' && sensitive) finding('forms','high','Campos sensibles enviados mediante GET',entry,'Los campos de contraseña o correo pueden quedar en la URL y en registros del navegador o servidor. No se han leído sus valores.','Usa POST sobre HTTPS y evita guardar datos sensibles en URLs o registros.');
    if (entry.relation === 'sin-base') finding('forms','info','Destino del formulario pendiente de resolver',entry,'El destino es relativo o usa la página actual, pero no se indicó una URL de origen.','Indica la URL de la página para resolver rutas relativas; revisa también cualquier JavaScript que cambie el envío.');
    if (attr(owner,'onsubmit') !== undefined) finding('forms','info','El envío tiene un manejador JavaScript',entry,'El código del evento puede cancelar el envío o cambiar el destino declarado.','Revisa el manejador onsubmit y las solicitudes fetch o XMLHttpRequest antes de concluir dónde se envían los datos.');
  }
  formNodes.forEach(node => collectForm(node,node));
  nodes.filter(node => attr(node,'formaction') !== undefined && (node.tagName==='button'?!['button','reset'].includes((attr(node,'type')||'').toLowerCase()):node.tagName==='input'&&['submit','image'].includes((attr(node,'type')||'').toLowerCase()))).forEach(node => {
    let owner = attr(node,'form') !== undefined ? formNodes.find(form => attr(form,'id') === attr(node,'form')) : node.parentNode;
    if (attr(node,'form') === undefined) while(owner && owner.tagName !== 'form') owner=owner.parentNode;
    if(owner?.tagName === 'form') collectForm(node,owner,true);
  });
  function resource(node, attribute, raw, kind, extra = {}) {
    if (!raw?.trim() || raw.startsWith('#')) return;
    const entry = {id:`resource-${resources.length+1}`,kind,attribute,...info(node,attribute),...urlInfo(raw),...extra};
    resources.push(entry);inspectHttp(entry,'resources');
    const remote = ['externo','origen-por-confirmar'].includes(entry.relation);
    if (remote) finding('resources',kind === 'Script' ? 'medium' : kind === 'Enlace' ? 'info' : 'low',
      entry.relation === 'externo' ? `${kind} apunta a un origen externo` : `${kind} con URL absoluta; confirma su origen`,entry,
      kind === 'Enlace' ? 'El enlace lleva a este destino al navegar. Su presencia no prueba actividad maliciosa.' : 'El navegador puede solicitar este recurso al abrir la página. Comprueba quién lo controla y qué información recibe.',
      kind === 'Script' ? 'Revisa la necesidad y la procedencia del script. Para archivos estáticos compatibles, considera integridad SRI y una política CSP apropiada.' : 'Comprueba el dominio y usa recursos propios cuando resulte adecuado.');
    if (entry.protocol === 'javascript:') finding('resources','medium','El enlace ejecuta JavaScript',entry,'Una URL javascript: ejecuta código cuando se activa.','Evita código en URLs; revisa su comportamiento y utiliza eventos controlados.');
  }
  const attributes = {script:[['src','Script']],img:[['src','Imagen']],a:[['href','Enlace']],link:[['href','Recurso enlazado']],iframe:[['src','Iframe']],source:[['src','Multimedia']],video:[['src','Vídeo'],['poster','Imagen']],audio:[['src','Audio']],object:[['data','Objeto']],embed:[['src','Objeto']]};
  for (const node of nodes) {
    for (const [attribute,kind] of attributes[node.tagName] || []) resource(node,attribute,attr(node,attribute),kind);
    if (['img','source'].includes(node.tagName) && attr(node,'srcset')) {
      // Tokenize candidates; embedded data URL commas stay within their URL token.
      const value=attr(node,'srcset');let position=0;
      while(position<value.length) {
        while(/[\s,]/.test(value[position] || '') && position<value.length) position++;
        const start=position;while(position<value.length && !/\s/.test(value[position])) position++;
        let candidate=value.slice(start,position);const terminated=candidate.endsWith(',');candidate=candidate.replace(/,+$/,'');
        if(candidate) resource(node,'srcset',candidate,'Imagen srcset');
        if(!terminated) {while(position<value.length && value[position]!==',') position++;position++;}
      }
    }
    const css = node.tagName === 'style' ? (node.childNodes || []).map(child=>child.value || '').join('') : attr(node,'style');
    if(css) {
      for(const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)|@import\s+["']([^"']+)["']/gi)) {
        const start = node.tagName === 'style' ? node.childNodes?.[0]?.sourceCodeLocation?.startLine || info(node).line : info(node,'style').line;
        const line = start + (css.slice(0,match.index).match(/\n/g)||[]).length;
        resource(node,'style',match[1]||match[2]||match[3]||match[4],'Recurso CSS',{line,evidence:cleanEvidence(match[0])});
      }
    }
    if(node.tagName === 'script' && !attr(node,'src')) for(const child of node.childNodes || []) {
      for(const match of (child.value || '').matchAll(/http:\/\/[^\s"'`<>\\)]+/gi)) {
        const line=(child.sourceCodeLocation?.startLine || info(node).line)+((child.value || '').slice(0,match.index).match(/\n/g)||[]).length;
        inspectHttp({kind:'JavaScript',line,column:1,evidence:match[0],...urlInfo(match[0])},'resources',true);
      }
    }
  }
  findings.sort((a,b)=>a.line-b.line);
  return {version:1,fileName,analyzedAt:new Date().toISOString(),documentUrl:originUrl?.href || '',baseUrl:base?.href || '',lineCount:source.split(/\r?\n/).length,
    forms,resources,http,findings,summary:{forms:forms.length,resources:resources.length,http:http.length,high:findings.filter(item=>item.severity==='high').length,findings:findings.length},
    scope:'Revisión estática del HTML original. No ejecuta scripts ni realiza solicitudes. Las URLs generadas dinámicamente y las cabeceras del servidor requieren revisión adicional.'};
}
