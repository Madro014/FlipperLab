import {KIND_LABELS,REPORT_SECTIONS} from './history.js';
import {SECURITY,ROUTER_CHECKS} from './network-audit.js';

const colors={ink:[35,51,44],green:[36,86,64],muted:[101,119,108],line:[220,229,214],pale:[240,246,232]};
const printable=value=>String(value??'').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/→/g,' -> ').replace(/·/g,' / ').replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g,'?');
const date=value=>new Date(value).toLocaleString('es-CO',{timeZone:'America/Bogota',dateStyle:'medium',timeStyle:'short'});

export async function createReportPdf(report) {
  if(!report.items?.length) throw new Error('Selecciona prácticas antes de generar el PDF.');
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  pdf.setProperties({title:printable(report.title),author:printable(report.author||'Semillero'),subject:'Prácticas seleccionadas de ciberseguridad',creator:'Semillero Flipper Lab'});
  const left=20,right=190,width=168,bottom=276;let y=0;
  function color(name){pdf.setTextColor(...colors[name]);}
  function header(first=false) {
    pdf.setFillColor(...colors.green);pdf.rect(0,0,210,first?35:20,'F');
    pdf.setTextColor(225,240,209);pdf.setFont('helvetica','bold');pdf.setFontSize(first?18:11);pdf.text('semillero / FLIPPER LAB',left,first?18:13);
    y=first?47:31;
  }
  function space(height){if(y+height>bottom){pdf.addPage();header();}}
  function measure(value,{size=10,bold=false,indent=0,gap=3,font='helvetica'}={}) {
    pdf.setFont(font,bold?'bold':'normal');pdf.setFontSize(size);
    return pdf.splitTextToSize(printable(value),width-indent).length*size*.3528*1.42+gap;
  }
  function text(value,{size=10,bold=false,shade='ink',indent=0,gap=3,font='helvetica'}={}) {
    pdf.setFont(font,bold?'bold':'normal');pdf.setFontSize(size);color(shade);
    const lines=pdf.splitTextToSize(printable(value),width-indent),lineHeight=size*.3528*1.42;
    for(const line of lines){space(lineHeight);pdf.setFont(font,bold?'bold':'normal');pdf.setFontSize(size);color(shade);pdf.text(line,left+indent,y);y+=lineHeight;}
    y+=gap;
  }
  function heading(value,followingHeight=10){space(16+followingHeight);y+=4;text(value,{size:12,bold:true,shade:'green',gap:4});}
  function rule(){space(4);pdf.setDrawColor(...colors.line);pdf.line(left,y,right,y);y+=7;}
  function evidence(row){if(row.evidence)text(row.evidence,{size:8,font:'courier',shade:'muted',indent:3});}
  function inventoryBlock(row) {
    const label=`Línea ${row.line} | ${row.kind}${row.method?' / '+row.method:''}${row.literal?' / URL literal; uso no confirmado':''}`;
    const destination=row.url||row.raw||'(página actual; origen pendiente)';
    return {label,destination,height:measure(label,{bold:true,size:9,gap:1})+measure(destination,{size:9,indent:3})+(row.evidence?measure(row.evidence,{size:8,font:'courier',indent:3}):0)};
  }
  function findingBlock(finding) {
    const label=`Línea ${finding.line} | ${{high:'Alto',medium:'Medio',low:'Bajo',info:'Información'}[finding.severity]||'Revisión'} | ${finding.title}`;
    return {label,height:measure(label,{size:10,bold:true,gap:2})+(finding.why?measure(finding.why,{size:9,indent:3}):0)+(finding.fix?measure(`Recomendación: ${finding.fix}`,{size:9,indent:3}):0)+(finding.evidence?measure(finding.evidence,{size:8,font:'courier',indent:3}):0)};
  }
  header(true);
  text(report.title,{size:23,bold:true,gap:7});
  text(`${report.items.length} práctica(s) seleccionada(s) | ${date(report.createdAt)} (Bogotá)`,{size:10,shade:'muted'});
  if(report.author)text(`Preparado por: ${report.author}`,{size:10});
  text(`Apartados: ${REPORT_SECTIONS.filter(([id])=>report.sections.includes(id)).map(([,label])=>label).join(' / ')}`,{size:9,shade:'muted'});
  if(report.notes){heading('Notas del informe');text(report.notes);}
  rule();
  for(const [index,item] of report.items.entries()) {
    space(34);text(`${String(index+1).padStart(2,'0')} / ${item.title}`,{size:15,bold:true,shade:'green',gap:5});
    text(`${KIND_LABELS[item.kind]} | ${item.status} | ${date(item.savedAt)}`,{size:9,shade:'muted'});
    if(item.summary)text(item.summary);
    if(report.sections.includes('device')) {
      heading('Equipo y prueba');
      if(item.device)text(`${item.device.model||'Flipper'} | ${item.device.firmware||''} ${item.device.version||''}`);
      if(item.portal)text(`Red: ${item.portal.ssid} | Código de prueba: ${item.portal.token}\nComprobación: ${item.portal.observation||'Pendiente'}`);
      if(!item.device&&!item.portal)text('Esta práctica no contiene información de dispositivo.',{shade:'muted'});
    }
    if(item.analysis) {
      const analysis=item.analysis;
      text(`Archivo: ${analysis.fileName}${analysis.documentUrl?' | Página: '+analysis.documentUrl:''}`,{size:9,shade:'muted'});
      for(const [key,label] of [['forms','Destinos de formularios'],['resources','Recursos y enlaces'],['http','Conexiones HTTP']]) if(analysis[key]) {
        heading(`${label} (${analysis[key].length})`,analysis[key].length?inventoryBlock(analysis[key][0]).height:10);
        if(!analysis[key].length)text('No se encontraron elementos en este apartado.',{shade:'muted'});
        for(const row of analysis[key]) {
          const block=inventoryBlock(row);space(block.height);
          text(block.label,{bold:true,size:9,gap:1});text(block.destination,{size:9,shade:'muted',indent:3});evidence(row);
        }
      }
      if(analysis.findings) {
        heading('Hallazgos seleccionados',analysis.findings.length?findingBlock(analysis.findings[0]).height:10);
        if(!analysis.findings.length)text('No se encontraron hallazgos con las reglas de esta revisión estática.',{shade:'muted'});
        for(const finding of analysis.findings) {
          const block=findingBlock(finding);space(block.height);
          text(block.label,{size:10,bold:true,gap:2});
          if(finding.why)text(finding.why,{size:9,indent:3});
          if(finding.fix)text(`Recomendación: ${finding.fix}`,{size:9,indent:3,shade:'green'});
          evidence(finding);
        }
      }
      text(analysis.scope,{size:8,shade:'muted'});
    }
    if(item.network) {
      const network=item.network;
      if(network.observation) {
        heading('Datos y configuración de red');
        for(const [key,label] of [['ssid','SSID'],['bssid','BSSID'],['security','Seguridad'],['band','Banda'],['channel','Canal'],['rssi','Señal RSSI']]) {
          const value=network.observation[key];
          text(`${label}: ${key==='security'?SECURITY[value]||'Sin confirmar':value&&value!=='unknown'?value:'Sin confirmar'} | ${network.sources?.[key]||'Sin confirmar'}`,{size:9});
        }
        text(`Método: ${network.automatic?'Respuestas del ESP32 mediante el puente USB-UART del Flipper':network.profile==='marauder'?'ESP32 Marauder / transcripción o importación':'Registro previo o transcripción manual'}`,{size:9,shade:'muted'});
        if(!network.automatic)for(const check of ROUTER_CHECKS)text(`${check.label}: ${check.options.find(([value])=>value===network.router?.[check.id])?.[1]||'Sin confirmar'} (declaración manual)`,{size:9});
        if(network.automatic) {
          text(`Protección anunciada: ${network.observation.securityRaw||'No informada'} | WPS: ${network.observation.wps||'No informado'} | PMF: ${network.observation.pmf||'No informado'}`,{size:9,shade:'muted'});
          const authorization=network.automatic.authorization,validation=network.automatic.accessValidation;
          text(authorization?`Autorización declarada por el usuario: ${authorization.ssid} / ${authorization.bssid}. Coincidencia con perfil local; no verifica propiedad.`:'Sin perfil autorizado coincidente: solo lectura del punto de acceso.',{size:9,shade:'muted'});
          if(validation){heading('Validación de conexión');text(`${validation.title}: ${validation.detail}`,{size:9});}
          heading('Comprobaciones ejecutadas con la AIO');
          for(const test of network.automatic.tests||[])text(`${test.label} / ${({observed:'Lectura recibida',partial:'Cobertura parcial',skipped:'No ejecutada',unsupported:'No compatible',error:'Sin resultado'})[test.status]||test.status}: ${test.detail}`,{size:9});
          text(`Equipos con respuesta: ${(network.automatic.hosts||[]).join(', ')||'Ninguno registrado en esta ejecución'}`,{size:9});
          heading('Puertos TCP abiertos observados');
          for(const service of network.automatic.services||[])text(`${service.ip}:${service.port} / Conexión TCP confirmada por el ESP32. Servicio y vulnerabilidad por confirmar.`,{size:9});
          if(!network.automatic.services?.length)text('No se registraron respuestas de puerto abierto. Esto no demuestra que todos los puertos estén cerrados.',{size:9,shade:'muted'});
        }
        if(network.allowedBssids)text(`BSSID de referencia declarados: ${network.allowedBssids}`,{size:9});
        if(network.comparison?.length) {
          heading('Comparación de la red');
          if(network.baseline)text(`Referencia: ${network.baseline.title} / ${date(network.baseline.savedAt)}`,{size:9,shade:'muted'});
          for(const row of network.comparison)text(`${row.state==='same'?'Coincide':'Revisar'}: ${row.text}`,{size:9});
        }
        if(network.pending?.length){heading('Comprobaciones pendientes');for(const pending of network.pending)text(`- ${pending}`,{size:9});}
      }
      if(network.findings) {
        const labelOf=finding=>`${{high:'Alto',medium:'Medio',low:'Bajo',info:'Por confirmar'}[finding.severity]} / ${finding.title}`;
        const heightOf=finding=>measure(labelOf(finding),{bold:true})+(finding.evidence?measure(`Evidencia: ${finding.evidence}`,{size:9,indent:3}):0)+(finding.why?measure(finding.why,{size:9,indent:3}):0)+(finding.fix?measure(`Recomendación: ${finding.fix}`,{size:9,indent:3}):0)+6;
        heading(`Hallazgos de red (${network.findings.length})`,network.findings.length?heightOf(network.findings[0]):10);
        if(!network.findings.length)text('Las respuestas no activaron las reglas de esta revisión. El resultado no certifica la seguridad de la red.',{size:9,shade:'muted'});
        for(const finding of network.findings) {
          space(heightOf(finding));text(labelOf(finding),{bold:true});
          if(finding.evidence)text(`Evidencia: ${finding.evidence}`,{size:9,indent:3});
          if(finding.why)text(finding.why,{size:9,indent:3});
          if(finding.fix)text(`Recomendación: ${finding.fix}`,{size:9,indent:3,shade:'green'});
        }
      }
      if(network.plan) {
        const planLabels={router:network.automatic?'En el equipo o punto de acceso':'En el router',flipper:'En el Flipper',page:'En esta página'};
        const statusOf=action=>`Avance declarado: ${action.declaredDone?'acción realizada por el usuario':'pendiente'}. Corrección por comprobar en una nueva revisión.`;
        const heightOf=action=>measure(action.title,{bold:true})+Object.entries(action.steps||{}).reduce((total,[key,value])=>total+measure(`${planLabels[key]}: ${value}`,{size:9,indent:3}),0)+measure(statusOf(action),{size:8,indent:3});
        heading('Plan de corrección de red',network.plan.length?heightOf(network.plan[0]):10);
        if(!network.plan.length)text('No hay acciones asociadas a los hallazgos de esta práctica.',{size:9});
        for(const action of network.plan) {
          const actionStatus=statusOf(action);
          const actionHeight=heightOf(action);
          space(actionHeight);text(action.title,{bold:true});
          for(const [key,label] of Object.entries(planLabels))if(action.steps?.[key])text(`${label}: ${action.steps[key]}`,{size:9,indent:3});
          text(actionStatus,{size:8,shade:'muted',indent:3});
        }
      }
      text(network.scope,{size:8,shade:'muted'});
    }
    if(item.events) {
      heading(`Eventos del registro (${item.events.length})`);
      if(!item.events.length)text('No se guardaron eventos para esta práctica.',{shade:'muted'});
      for(const event of item.events){const message=`${date(event.at)} / ${event.source}: ${event.message}`;space(measure(message,{size:9,gap:2}));text(message,{size:9,gap:2});}
    }
    rule();
  }
  const total=pdf.getNumberOfPages();
  for(let page=1;page<=total;page++) {
    pdf.setPage(page);pdf.setDrawColor(...colors.line);pdf.line(left,284,right,284);pdf.setFont('helvetica','normal');pdf.setFontSize(8);color('muted');
    pdf.text('Semillero / Selección realizada por el usuario',left,290);pdf.text(`${page} / ${total}`,right,290,{align:'right'});
  }
  return {blob:pdf.output('blob'),bytes:new Uint8Array(pdf.output('arraybuffer')),pages:total};
}
