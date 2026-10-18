import React,{useMemo,useRef,useState} from 'react';
import {ArrowRight,CheckCircle2,Code2,FileCode2,Search,ShieldCheck,Upload} from 'lucide-react';
import {analyzeHtml,ANALYZER_LIMIT,SEVERITIES} from './analyzer.js';

const categories=[['findings','Hallazgos'],['forms','Formularios'],['resources','Recursos y enlaces'],['http','Conexiones HTTP']];
const relations={'externo':'Otro origen','mismo-origen':'Mismo origen','origen-por-confirmar':'Confirma el origen','sin-base':'Falta URL de origen','local-u-otro':'Local u otro protocolo','sin-envio':'Sin envío de red'};
export default function AnalyzerPanel({portal,onSave,onEvent}) {
  const [source,setSource]=useState(''),[fileName,setFileName]=useState('portal.html'),[documentUrl,setDocumentUrl]=useState('');
  const [result,setResult]=useState(null),[category,setCategory]=useState('findings'),[line,setLine]=useState(1),[limit,setLimit]=useState(100),[error,setError]=useState(''),[saved,setSaved]=useState('');
  const input=useRef(null);
  const lines=useMemo(()=>source.split(/\r?\n/),[source]);
  const start=Math.max(0,line-6),end=Math.min(lines.length,line+7);
  const stale=Boolean(result && (source!==result.original || documentUrl.trim()!==result.originInput));
  async function load(file) {
    if(!file)return;setError('');
    if(!/\.html?$/i.test(file.name)){setError('Selecciona un archivo .html o .htm.');return;}
    if(file.size>ANALYZER_LIMIT){setError('El HTML supera el límite de 1 MB.');return;}
    try{setSource(await file.text());setFileName(file.name);setResult(null);setSaved('');}catch{setError('No se pudo leer el archivo.');}
    finally{if(input.current)input.current.value='';}
  }
  function run() {
    setError('');setSaved('');
    try{
      const analysis=analyzeHtml(source,{documentUrl,fileName});
      setResult({...analysis,original:source,originInput:documentUrl.trim()});setLine(analysis.findings[0]?.line||1);setCategory('findings');setLimit(100);
      const record={id:crypto.randomUUID(),kind:'analysis',title:`Análisis: ${fileName}`,savedAt:analysis.analyzedAt,status:'Revisión estática',
        summary:`${analysis.forms.length} destinos de formularios, ${analysis.resources.length} recursos o enlaces, ${analysis.http.length} referencias HTTP y ${analysis.findings.length} hallazgos.`,analysis,
        events:[{at:analysis.analyzedAt,source:'Análisis local',type:'success',message:'HTML revisado sin ejecutar scripts ni realizar solicitudes externas.'}]};
      const persisted=onSave(record);setSaved(persisted?'Análisis guardado en el historial.':'Análisis disponible en memoria; revisa el aviso de almacenamiento.');
      onEvent(`Análisis de ${fileName}: ${analysis.findings.length} hallazgos para revisar.`);
    }catch(e){setError(e.message);}
  }
  const items=result?.[category]||[];
  return <div className="analyzer-tool">
    <section className="panel"><div className="panel-heading"><span className="section-index">NUEVA HERRAMIENTA / HTML</span><h2>Comprueba lo que contiene tu página.</h2><p>Revisa destinos y recursos del archivo original. El análisis se realiza en este navegador.</p></div>
      <div className="panel-body analyzer-inputs"><div className="analyzer-actions"><input ref={input} type="file" accept=".html,.htm,text/html" hidden aria-label="Cargar HTML para análisis" onChange={event=>load(event.target.files[0])}/><button className="button secondary" onClick={()=>input.current.click()}><Upload size={16}/> Cargar HTML</button><button className="button secondary" disabled={!portal.html} onClick={()=>{setSource(portal.html);setFileName(portal.name);setResult(null);setSaved('');}}><FileCode2 size={16}/> Usar portal actual</button><span>{fileName}</span></div>
        <div className="analyzer-options"><div><label htmlFor="analysis-name">Nombre del archivo o ejercicio</label><input id="analysis-name" value={fileName} maxLength={100} onChange={event=>{setFileName(event.target.value);setResult(null);setSaved('');}}/></div><div><label htmlFor="analysis-origin">URL donde se sirve la página (opcional)</label><input id="analysis-origin" placeholder="https://mi-laboratorio.example/portal/" value={documentUrl} onChange={event=>setDocumentUrl(event.target.value)}/><small className="field-help">Permite resolver rutas relativas y distinguir otros orígenes. No se visita esta URL.</small></div></div>
        <label htmlFor="analysis-source">Código HTML original</label><textarea id="analysis-source" className="html-editor" rows={9} spellCheck="false" placeholder="Pega aquí tu HTML o carga un archivo…" value={source} onChange={event=>setSource(event.target.value)}/>
        <div className="analyzer-run"><span><ShieldCheck size={14}/> Sin ejecución ni solicitudes externas · Hasta 1 MB</span><button className="button primary" disabled={!source.trim()} onClick={run}><Search size={16}/> Analizar HTML <ArrowRight size={16}/></button></div>
        {error&&<p className="tool-error" role="alert">{error}</p>}{saved&&!stale&&<p className="saved-message" role="status"><CheckCircle2 size={15}/>{saved}</p>}
      </div>
    </section>
    {result&&<>
      {stale&&<div className="alert"><p>El HTML o su URL cambiaron. Vuelve a analizar para actualizar los hallazgos y sus líneas.</p></div>}
      <div className="analysis-stats">{[['forms','Formularios'],['resources','Recursos / enlaces'],['http','Referencias HTTP'],['findings','Hallazgos']].map(([id,label])=><button key={id} onClick={()=>{setCategory(id);setLimit(100);}}><strong>{result[id].length}</strong><span>{label}</span></button>)}</div>
      <div className={`analysis-results ${stale?'results-stale':''}`} aria-disabled={stale}>
        <section className="panel"><div className="analysis-tabs" aria-label="Categorías de análisis">{categories.map(([id,label])=><button key={id} className={category===id?'selected':''} onClick={()=>{setCategory(id);setLimit(100);}}>{label} <span>{result[id].length}</span></button>)}</div><div className="analysis-list">
          {!items.length&&<div className="empty"><ShieldCheck size={25}/><strong>Sin elementos en este apartado</strong><p>Este resultado corresponde a las reglas de la revisión estática.</p></div>}
          {items.slice(0,limit).map((item,index)=>category==='findings'?<article className={`finding-card ${item.severity}`} key={item.id||index}><div><span className={`severity ${item.severity}`}>{SEVERITIES[item.severity]}</span><button className="line-link" disabled={stale} onClick={()=>setLine(item.line)}>Ver línea {item.line} <Code2 size={13}/></button></div><h3>{item.title}</h3><p>{item.why}</p><div className="finding-fix"><strong>Cómo revisarlo o corregirlo</strong><p>{item.fix}</p></div></article>:<article className="inventory-card" key={item.id||index}><div><strong>{item.kind}{item.method?` · ${item.method}`:''}</strong><button className="line-link" disabled={stale} onClick={()=>setLine(item.line)}>Línea {item.line} <Code2 size={13}/></button></div><code>{item.url||item.raw||'(página actual; falta origen)'}</code><small>{relations[item.relation]||''}{item.literal?' · URL literal: ejecución no confirmada':''}{item.fields!==undefined?` · ${item.fields} campos (sin leer valores)`:''}</small></article>)}
          {items.length>limit&&<button className="text-button more-findings" onClick={()=>setLimit(value=>value+100)}>Mostrar 100 más ({items.length-limit} pendientes)</button>}
        </div></section>
        <section className="panel code-panel"><div className="panel-heading"><span className="section-index">CÓDIGO ORIGINAL</span><h2>Línea {line}</h2><p>{fileName} · Contexto del elemento seleccionado</p></div><div className="code-lines" aria-label="Código con líneas señaladas">{lines.slice(start,end).map((text,index)=><div key={start+index} className={start+index+1===line?'highlighted':''}><span>{start+index+1}</span><code>{text||' '}</code></div>)}</div><p className="analysis-scope">{result.scope}</p></section>
      </div>
    </>}
  </div>;
}
