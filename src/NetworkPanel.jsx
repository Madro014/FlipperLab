import React,{useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,ExternalLink,FileUp,Info,RefreshCw,Save,ShieldCheck,Wifi} from 'lucide-react';
import {NETWORK_APPS,SECURITY,ROUTER_CHECKS,emptyObservation,emptyRouter,normalizeMac,observationErrors,parseNetworkImport,compareNetwork,evaluateNetwork} from './network-audit.js';
import './network.css';
import './network-details.css';
import BoardGuide from './BoardGuide.jsx';

const steps=['Prepara el equipo','Observa tu red','Revisa el router','Hallazgos y plan'];
const severity={high:'Alto',medium:'Medio',low:'Bajo',info:'Por confirmar'};
function Guide({flipper,page,router}) {return <div className="network-guide">{[['En el Flipper',flipper],['En esta página',page],['En el router',router]].filter(([,text])=>text).map(([label,text])=><div key={label}><strong>{label}</strong><p>{text}</p></div>)}</div>;}
export default function NetworkPanel({diagnostic,connected,busy,onOpenTool,onDiagnose,onSave,records,onHistory}) {
  const [step,setStep]=useState(0),[profile,setProfile]=useState('unknown'),[ready,setReady]=useState(false),[reviewed,setReviewed]=useState(false);
  const [observation,setObservation]=useState(emptyObservation),[router,setRouter]=useState(emptyRouter),[sources,setSources]=useState({}),[allowed,setAllowed]=useState('');
  const [imported,setImported]=useState([]),[importName,setImportName]=useState(''),[warnings,setWarnings]=useState([]),[error,setError]=useState('');
  const [actions,setActions]=useState({}),[saved,setSaved]=useState(false),[opened,setOpened]=useState(''),[baselineId,setBaselineId]=useState('auto');
  const run=useRef({id:crypto.randomUUID(),startedAt:new Date().toISOString()}),fileRef=useRef(null);
  const prior=records.filter(record=>record.kind==='network'&&record.id!==run.current.id&&record.network?.observation?.ssid===observation.ssid);
  const baseline=baselineId==='none'?null:baselineId==='auto'?prior[0]:prior.find(record=>record.id===baselineId);
  const comparison=useMemo(()=>{try{return {rows:compareNetwork(observation,baseline?.network.observation,allowed),error:''};}catch(e){return {rows:[],error:e.message};}},[observation,baseline,allowed]);
  const result=useMemo(()=>evaluateNetwork(observation,router,comparison.rows),[observation,router,comparison]);
  const errors=observationErrors(observation),completed=[ready,ready&&!errors.length,reviewed,saved];
  const touched=()=>{setSaved(false);setError('');};
  function edit(key,value) {
    setObservation(previous=>({...previous,[key]:key==='bssid'?value.toUpperCase():value}));setSources(previous=>({...previous,[key]:'Transcripción manual del usuario'}));
    if(key==='ssid'){setRouter(emptyRouter());setReviewed(false);}
    setActions({});touched();
  }
  function reset() {
    run.current={id:crypto.randomUUID(),startedAt:new Date().toISOString()};setStep(0);setReady(false);setReviewed(false);setObservation(emptyObservation());setRouter(emptyRouter());setSources({});setAllowed('');setImported([]);setImportName('');setWarnings([]);setActions({});setSaved(false);setError('');setOpened('');setBaselineId('auto');
    if(fileRef.current)fileRef.current.value='';
  }
  async function importFile(file) {
    if(!file)return;touched();
    try {
      if(file.size>1024*1024)throw new Error('El archivo debe pesar menos de 1 MB.');
      if(!/\.(csv|txt|log)$/i.test(file.name))throw new Error('Selecciona un archivo CSV, TXT o LOG.');
      const parsed=parseNetworkImport(await file.text());setImported(parsed.observations);setWarnings(parsed.warnings);setImportName(file.name);
    }catch(e){setImported([]);setWarnings([]);setImportName('');setError(e.message);}
  }
  function chooseImport(index) {
    if(index==='')return;
    const row=imported[Number(index)];
    if(row.ssid!==observation.ssid){setRouter(emptyRouter());setReviewed(false);}
    setObservation({...row});setSources(Object.fromEntries(Object.keys(row).map(key=>[key,row[key]!==''&&row[key]!=='unknown'?`Importado de ${importName}`:'Sin confirmar'])));setActions({});setBaselineId('auto');touched();
  }
  function advance() {
    if(step===0&&!ready){setError('Confirma el método con el que vas a obtener los datos.');return;}
    if(step===1&&(errors.length||comparison.error)){setError([...errors,comparison.error].filter(Boolean).join(' '));return;}
    if(step===2&&!reviewed){setError('Confirma que revisaste los ajustes; puedes dejar sin confirmar lo que no pudiste comprobar.');return;}
    setError('');setStep(current=>Math.min(3,current+1));
  }
  function save() {
    if(!ready||errors.length||!reviewed||comparison.error){setError('Completa los tres primeros pasos antes de guardar.');return;}
    const network={observation:{...observation,bssid:normalizeMac(observation.bssid)},router:{...router},sources:{...sources},profile,allowedBssids:allowed.trim(),comparison:comparison.rows,baseline:baseline?{title:baseline.title,savedAt:baseline.savedAt}:null,findings:result.findings,pending:result.pending,scope:result.scope,actions:{...actions}};
    onSave({id:run.current.id,kind:'network',title:`Red: ${observation.ssid}`,startedAt:run.current.startedAt,savedAt:new Date().toISOString(),status:result.pending.length?'Revisión con comprobaciones pendientes':'Revisión registrada',summary:`${result.findings.length} puntos para revisar y ${result.pending.length} datos pendientes. Datos de la red aportados por el usuario.`,device:diagnostic?{model:diagnostic.device.model,firmware:diagnostic.device.firmware,version:diagnostic.device.version}:null,network,events:[]});setSaved(true);setError('');
  }
  return <div className="network-tool">
    <div className="network-capabilities"><span><Wifi size={17}/> Revisión Wi-Fi</span><span><ShieldCheck size={17}/> Comparación de identidad</span><span><CheckCircle2 size={17}/> Plan de corrección</span></div>
    <div className="network-stepper" aria-label="Pasos de auditoría de red">{steps.map((title,index)=><button key={title} className={`${step===index?'current':''} ${completed[index]?'done':''}`} aria-current={step===index?'step':undefined} onClick={()=>{setError('');if(index<=step||completed.slice(0,index).every(Boolean))setStep(index);else setError('Completa el paso actual para continuar.');}}><span>{completed[index]?<Check size={16}/>:index+1}</span><strong>{title}</strong></button>)}</div>
    <div className="network-layout"><section className="panel network-main"><div className="panel-heading"><span className="section-index">0{step+1} / AUDITORÍA DE TU RED</span><h2>{steps[step]}</h2><p>{['Comprueba la aplicación y el método de lectura antes de empezar.','Transcribe lo que muestra el Flipper o importa un registro que ya hayas exportado.','Consulta el panel oficial del router y registra solo lo que puedas comprobar.','Prioriza los cambios, registra tus acciones y repite la revisión después.'][step]}</p></div><div className="panel-body">
    {step===0&&<>
      <BoardGuide/>
      <Guide flipper="Cierra Evil Portal con Stop portal y vuelve al menú principal. Abre Apps → GPIO → ESP → ESP32 WiFi Marauder, o usa el botón de abajo. Comprueba que el ESP32 responde y anota su firmware o versión si aparece." page="Conecta el Flipper por USB para comprobar las aplicaciones instaladas. La revisión también acepta un registro previo o datos transcritos."/>
      <div className="network-apps">{NETWORK_APPS.map(app=>{const detected=diagnostic?.networkApps?.find(item=>item.id===app.id);return <div key={app.id}><div><strong>{app.name}</strong><small>{!diagnostic?'Pendiente de diagnóstico USB':detected?.path?'Aplicación en microSD · lectura USB':'No encontrada en las rutas compatibles'}</small></div><button className="button secondary" disabled={!connected||!detected?.path||Boolean(busy)} onClick={async()=>{const ok=await onOpenTool(app.id);if(ok)setOpened(app.name);}}><ExternalLink size={15}/> Abrir {app.id==='marauder'?'Marauder':'WiFi Scanner'}</button></div>;})}</div>
      {opened&&<p className="saved-message" role="status"><CheckCircle2 size={15}/>{opened} abierta. Continúa en la pantalla del Flipper; el escaneo aún no se ha iniciado.</p>}
      <button className="text-button" disabled={!connected||Boolean(busy)} onClick={onDiagnose}><RefreshCw size={14}/> Actualizar aplicaciones instaladas</button>
      <div className="network-form"><label htmlFor="esp-profile">Firmware del ESP32 / método de lectura</label><select id="esp-profile" value={profile} onChange={event=>{setProfile(event.target.value);setReady(false);touched();}}><option value="unknown">Todavía no lo he confirmado</option><option value="marauder">ESP32 con Marauder y respuesta comprobada</option><option value="manual">Otro firmware / registro previo / transcripción manual</option></select><p className="field-help">Momentum es el firmware del Flipper. La conexión USB no identifica el firmware de la placa ESP32. WiFi Scanner necesita un firmware compatible con su propia aplicación.</p></div>
      {profile==='unknown'&&<div className="note amber"><Info size={17}/><p>Si Marauder no responde, comprueba el cableado y la versión de la placa. Confirma el firmware del ESP32 antes de continuar; esta página no lo cambia.</p></div>}
      <label className="checkbox-label network-confirm"><input type="checkbox" checked={ready} disabled={profile==='unknown'} onChange={event=>{setReady(event.target.checked);touched();}}/>{profile==='marauder'?'Confirmé que Marauder responde en mi Flipper y usaré mi propia red.':'Usaré datos de mi propia red y he confirmado cómo obtenerlos.'}</label>
    </>}
    {step===1&&<>
      <Guide flipper="En Marauder, usa la opción de escanear puntos de acceso (Scan APs / scanap). Detén el escaneo con la opción Stop y consulta la lista de AP y la información de tu red. En la interfaz nativa de Marauder: WiFi → Sniffers → Scan APs; WiFi → General → View AP Info. Los nombres del menú del Flipper pueden variar según la versión." page="Anota el SSID y, si aparecen, BSSID, canal, señal y seguridad. Si no se muestra el cifrado, déjalo sin confirmar y consúltalo en el router. Elige solamente tu punto de acceso."/>
      <details className="network-import"><summary><FileUp size={16}/> Importar observaciones CSV o texto</summary><p>CSV: SSID, BSSID, Channel, RSSI, Security. También admite CSV WiGLE y líneas de Marauder con RSSI, Ch, BSSID y ESSID. Solo se guardará la red que elijas; no se guardan coordenadas.</p><input ref={fileRef} type="file" accept=".csv,.txt,.log" aria-label="Importar registro de red" onChange={event=>importFile(event.target.files[0])}/>{imported.length>0&&<><label htmlFor="imported-ap">Selecciona tu punto de acceso ({imported.length})</label><select id="imported-ap" defaultValue="" key={importName+imported.length} onChange={event=>chooseImport(event.target.value)}><option value="">Elige una observación…</option>{imported.map((row,index)=><option value={index} key={index}>{row.ssid} · {row.bssid} · Canal {row.channel||'?'}</option>)}</select></>}{warnings.map(warning=><p className="field-help" key={warning}>{warning}</p>)}</details>
      <div className="network-fields">
        <div><label htmlFor="network-ssid">Nombre de tu red (SSID)</label><input id="network-ssid" maxLength={64} value={observation.ssid} onChange={event=>{edit('ssid',event.target.value);setBaselineId('auto');}}/></div>
        <div><label htmlFor="network-bssid">BSSID del punto de acceso (opcional)</label><input id="network-bssid" placeholder="AA:BB:CC:DD:EE:FF" maxLength={17} value={observation.bssid} onChange={event=>edit('bssid',event.target.value)}/></div>
        <div><label htmlFor="network-security">Seguridad observada / confirmada</label><select id="network-security" value={observation.security} onChange={event=>edit('security',event.target.value)}>{Object.entries(SECURITY).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
        <div><label htmlFor="network-band">Banda observada</label><select id="network-band" value={observation.band} onChange={event=>edit('band',event.target.value)}><option value="unknown">Sin confirmar</option>{['2.4','5','6'].map(band=><option key={band} value={band}>{band} GHz</option>)}</select><small className="field-help">Tu AIO V1.4 con ESP32-S2 observa 2,4 GHz. Usa 5 o 6 GHz solo para registros obtenidos con otro receptor compatible.</small></div>
        <div><label htmlFor="network-channel">Canal (opcional)</label><input id="network-channel" type="number" min="1" max="233" value={observation.channel} onChange={event=>edit('channel',event.target.value)}/></div>
        <div><label htmlFor="network-rssi">Señal RSSI en dBm (opcional)</label><input id="network-rssi" type="number" min="-127" max="0" value={observation.rssi} onChange={event=>edit('rssi',event.target.value)}/></div>
      </div>
      <details className="network-identity"><summary>Comparar identidad e historial</summary><label htmlFor="allowed-bssids">BSSID de referencia confirmados en tu router (opcional)</label><textarea id="allowed-bssids" rows={2} maxLength={3000} value={allowed} onChange={event=>{setAllowed(event.target.value);setActions({});touched();}} placeholder="Un BSSID por línea o separado por comas"/><p>Incluye las bandas, repetidores y nodos de tu red. Una diferencia requiere revisión y no confirma una suplantación.</p><label htmlFor="network-baseline">Práctica anterior para comparar</label><select id="network-baseline" value={baselineId} onChange={event=>{setBaselineId(event.target.value);touched();}}><option value="auto">La más reciente de este SSID {prior.length?'':'(sin registros)'}</option><option value="none">Sin comparación histórica</option>{prior.map(record=><option key={record.id} value={record.id}>{new Date(record.savedAt).toLocaleString('es-CO')} · {record.title}</option>)}</select>{comparison.error&&<p className="tool-error">{comparison.error}</p>}</details>
    </>}
    {step===2&&<>
      <Guide flipper="Conserva los datos del AP. Un escaneo no determina la contraseña del router, sus actualizaciones, la administración remota ni el aislamiento." page="Marca Sin confirmar cuando no tengas evidencia. No se solicitan contraseñas ni acceso al panel del router." router="Conéctate a tu red, abre la dirección del panel que indica el fabricante o la puerta de enlace de tu equipo e inicia sesión. Busca los apartados de Wi-Fi, administración, actualizaciones y red de invitados."/>
      <div className="router-checks">{ROUTER_CHECKS.map(check=><div key={check.id}><label htmlFor={`router-${check.id}`}>{check.label}</label><p>{check.help}</p><select id={`router-${check.id}`} value={router[check.id]} onChange={event=>{setRouter(previous=>({...previous,[check.id]:event.target.value}));setActions({});touched();}}><option value="unknown">Sin confirmar</option>{check.options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>)}</div>
      <label className="checkbox-label network-confirm"><input type="checkbox" checked={reviewed} onChange={event=>{setReviewed(event.target.checked);touched();}}/>Revisé estos apartados y dejé sin confirmar lo que no pude comprobar.</label>
    </>}
    {step===3&&<>
      <div className="network-result-head"><Wifi size={24}/><div><strong>{observation.ssid}</strong><span>{observation.bssid||'BSSID pendiente'} · {SECURITY[observation.security]}</span></div></div>
      <div className="network-metrics"><div><strong>{result.findings.filter(finding=>finding.severity==='high').length}</strong><span>Prioridad alta</span></div><div><strong>{result.findings.length}</strong><span>Puntos para revisar</span></div><div><strong>{result.pending.length}</strong><span>Datos pendientes</span></div></div>
      {!result.findings.length&&<div className="note"><ShieldCheck size={18}/><p>Las respuestas registradas no activaron estas reglas de revisión. Comprueba los datos pendientes; este resultado no certifica la seguridad de la red.</p></div>}
      <div className="network-findings">{result.findings.map((finding,index)=><article key={finding.id} className="network-finding"><span className={`severity ${finding.severity}`}>{severity[finding.severity]}</span><h3>{finding.title}</h3><p className="network-evidence"><b>Evidencia:</b> {finding.evidence}</p><details className="network-fix-details" open={index===0}><summary>Ver explicación y pasos de corrección</summary><p>{finding.why}</p><Guide router={finding.steps.router} flipper={finding.steps.flipper} page={finding.steps.page}/></details><label className="checkbox-label"><input type="checkbox" checked={Boolean(actions[finding.id])} onChange={event=>{setActions(previous=>({...previous,[finding.id]:event.target.checked}));touched();}}/>Acción declarada realizada: {finding.title}</label><small>Registra tu avance. La corrección se debe comprobar en una nueva revisión.</small></article>)}</div>
      {comparison.rows.length>0&&<section className="network-comparison"><h3>Comparación de la red</h3>{baseline&&<p>Referencia: {new Date(baseline.savedAt).toLocaleString('es-CO')} · {baseline.title}</p>}{comparison.rows.map(row=><p key={row.id}><span className={`badge ${row.state==='same'?'green':'amber'}`}>{row.state==='same'?'Coincide':'Revisar'}</span> {row.text}</p>)}</section>}
      {result.pending.length>0&&<details className="network-pending" open><summary>{result.pending.length} comprobaciones pendientes</summary><ul>{result.pending.map(item=><li key={item}>{item}</li>)}</ul></details>}
      <p className="network-scope">{result.scope}</p>
      <div className="network-save"><button className="button primary" onClick={save}><Save size={16}/>{saved?'Actualizar práctica guardada':'Guardar revisión en historial'}</button><button className="button secondary" onClick={reset}><RefreshCw size={16}/> Nueva revisión</button></div>{saved&&<p className="saved-message" role="status"><CheckCircle2 size={15}/>Revisión guardada. <button className="text-button" onClick={onHistory}>Elegir contenido del PDF <ArrowRight size={14}/></button></p>}
    </>}
    {error&&<p className="tool-error" role="alert">{error}</p>}
    <div className="network-navigation">{step>0&&<button className="text-button" onClick={()=>{setStep(current=>current-1);setError('');}}><ArrowLeft size={15}/> Volver</button>}{step<3&&<button className="button primary" onClick={advance}>Continuar <ArrowRight size={16}/></button>}</div>
    </div></section>
    <aside className="network-aside"><section className="panel"><div className="panel-body"><ShieldCheck size={25}/><h3>De la observación a la mejora.</h3><p><b>1.</b> El Flipper abre la herramienta y el ESP32 obtiene los datos que soporte su firmware.</p><p><b>2.</b> Tú registras la evidencia y revisas la configuración del router.</p><p><b>3.</b> La página explica los hallazgos y prepara un plan con tus respuestas.</p><div className="note"><Info size={16}/><p>La apertura por USB no inicia un escaneo. Los ajustes manuales y los registros importados se identifican como tales.</p></div><h4>Guías de referencia</h4><a href="https://github.com/justcallmekoko/ESP32Marauder/wiki/scanap" target="_blank" rel="noreferrer">Escaneo AP de Marauder <ExternalLink size={12}/></a><a href="https://github.com/justcallmekoko/ESP32Marauder/wiki/View-AP-Info" target="_blank" rel="noreferrer">Información del AP <ExternalLink size={12}/></a><a href="https://www.nsa.gov/Press-Room/News-Highlights/Article/Article/3304674/nsa-releases-best-practices-for-securing-your-home-network/" target="_blank" rel="noreferrer">Buenas prácticas de red doméstica <ExternalLink size={12}/></a></div></section></aside></div>
  </div>;
}
