export const HISTORY_KEY = 'semillero.practice-history.v1';
export const REPORT_SECTIONS = [
  ['summary','Resumen de la práctica'],['device','Equipo y datos de la prueba'],['events','Eventos del registro'],
  ['forms','Destinos de formularios'],['resources','Recursos y enlaces'],['http','Conexiones HTTP'],
  ['findings','Hallazgos y explicación'],['recommendations','Recomendaciones'],['code','Fragmentos y líneas de código'],
  ['network','Datos y configuración de red'],['plan','Plan de corrección de red'],
];
export const KIND_LABELS = {portal:'Portal con dispositivo',network:'Auditoría de red',analysis:'Análisis HTML',simulation:'Simulación'};
export function readHistory(storage) {
  const raw=storage.getItem(HISTORY_KEY);
  if(!raw) return [];
  const data=JSON.parse(raw);
  if(data.version!==1 || !Array.isArray(data.records) || data.records.some(record=>!record || typeof record.id!=='string' || !KIND_LABELS[record.kind] || typeof record.title!=='string' || !Number.isFinite(Date.parse(record.savedAt)))) throw new Error('El historial local no tiene un formato válido.');
  return data.records;
}
export function upsertRecord(records,record) {return [record,...records.filter(item=>item.id!==record.id)];}
export function writeHistory(storage,records) {storage.setItem(HISTORY_KEY,JSON.stringify({version:1,records}));}

export function selectReport(records,selectedIds,sections,metadata={}) {
  if(!selectedIds.length) throw new Error('Selecciona al menos una práctica del historial.');
  const enabled=REPORT_SECTIONS.filter(([id])=>sections.includes(id)).map(([id])=>id);
  if(!enabled.length) throw new Error('Selecciona al menos un apartado para el PDF.');
  const selected=records.filter(record=>selectedIds.includes(record.id));
  if(!selected.length) throw new Error('Las prácticas seleccionadas ya no están en el historial.');
  const include=id=>enabled.includes(id);
  const items=selected.map(record=>{
    const item={id:record.id,kind:record.kind,title:record.title,savedAt:record.savedAt,status:record.status};
    if(include('summary')) item.summary=record.summary || '';
    if(include('device')) {item.device=record.device || null;item.portal=record.portal || null;}
    if(include('events')) item.events=record.events || [];
    if(record.analysis) {
      const analysis=record.analysis;
      item.analysis={fileName:analysis.fileName,documentUrl:analysis.documentUrl,scope:analysis.scope};
      for(const key of ['forms','resources','http']) if(include(key)) item.analysis[key]=(analysis[key]||[]).map(({evidence,...row})=>include('code')?{...row,evidence}:row);
      if(include('findings') || include('recommendations') || include('code')) item.analysis.findings=(analysis.findings||[]).map(finding=>{
        const row={title:finding.title,line:finding.line,severity:finding.severity};
        if(include('findings')) row.why=finding.why;
        if(include('recommendations')) row.fix=finding.fix;
        if(include('code')) row.evidence=finding.evidence;
        return row;
      });
    }
    if(record.network && ['network','findings','recommendations','plan'].some(include)) {
      const network=record.network;
      item.network={scope:network.scope};
      if(include('network')) Object.assign(item.network,{observation:network.observation,router:network.router,sources:network.sources,profile:network.profile,allowedBssids:network.allowedBssids,comparison:network.comparison,baseline:network.baseline,pending:network.pending,automatic:network.automatic});
      if(include('findings')||include('recommendations')) item.network.findings=(network.findings||[]).map(finding=>{
        const row={id:finding.id,title:finding.title,severity:finding.severity};
        if(include('findings')){row.why=finding.why;row.evidence=finding.evidence;}
        if(include('recommendations'))row.fix=finding.fix;
        return row;
      });
      if(include('plan')) item.network.plan=(network.findings||[]).map(finding=>({id:finding.id,title:finding.title,steps:finding.steps,declaredDone:Boolean(network.actions?.[finding.id])}));
    }
    return item;
  });
  return {title:String(metadata.title||'Historial de prácticas').slice(0,100),author:String(metadata.author||'').slice(0,80),notes:String(metadata.notes||'').slice(0,1200),createdAt:new Date().toISOString(),sections:enabled,items};
}
