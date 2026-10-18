import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, CircleHelp, Code2, Cpu, ExternalLink, FileCode2, FlaskConical, Info, Link2, LoaderCircle, Monitor, Play, RefreshCw, ShieldCheck, Smartphone, Terminal, Unplug, Upload, Usb, Wifi, X} from 'lucide-react';
import {createTestBundle, MAX_HTML_BYTES, MAX_DEVICE_HTML_BYTES, newToken, sanitizePortal, simulatedEvents} from './portal.js';
import {FlipperSerial, isFlipperCandidate} from './serial.js';
import {History,Search} from 'lucide-react';
import AnalyzerPanel from './AnalyzerPanel.jsx';
import HistoryPanel from './HistoryPanel.jsx';
import NetworkPanel from './NetworkPanel.jsx';
import {NETWORK_APPS} from './network-audit.js';
import MarauderPanel from './MarauderPanel.jsx';
import {useHistory} from './use-history.js';
import {FlipperAnimation, LoadingOverlay, NotFoundPage, OfflineNotice} from './FlipperStatus.jsx';
import './style.css';
import './tools.css';

const steps = [{title:'Conecta tu equipo', text:'USB y diagnóstico'}, {title:'Prepara el portal', text:'Plantilla y carga real'}, {title:'Prueba desde tu móvil', text:'Verificación visual'}];
const tabs = [['lab', FlaskConical, 'Probar portal'], ['network', Wifi, 'Auditar red'], ['analyzer', Search, 'Analizar HTML'], ['history', History, 'Historial y PDF'], ['device', Usb, 'Mi dispositivo'], ['activity', Activity, 'Registro de sesión'], ['simulation', Play, 'Simulación']];
const clock = value => new Date(value).toLocaleTimeString('es-CO', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
function Badge({children, tone = 'neutral'}) { return <span className={`badge ${tone}`}>{children}</span>; }
function Button({children, variant = 'secondary', busy, className = '', ...props}) {
  return <button className={`button ${variant} ${className}`} {...props}>{busy && <LoaderCircle size={17} className="spin"/>}{children}</button>;
}
function downloadFile(name, content, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function EventList({events}) {
  return events.length ? <ol className="events" aria-live="polite">{[...events].reverse().map((event, index) => <li key={index}>
    <span className={`event-mark ${event.type}`}>{event.type === 'success' ? <Check size={12}/> : <span/>}</span>
    <div><p>{event.message}</p><span>{clock(event.at)} <b>·</b> {event.source}</span></div>
  </li>)}</ol> : <div className="empty"><Activity size={25}/><strong>Tu sesión empieza aquí</strong><p>Las lecturas USB, las cargas y tus observaciones aparecerán en este registro.</p></div>;
}
function StatusRow({title, detail, state}) {
  return <div className="status-row"><span className={`status-icon ${state}`}>{state === 'ok' ? <Check size={15}/> : state === 'pending' ? <Info size={15}/> : <X size={15}/>}</span><div><strong>{title}</strong><p>{detail}</p></div><Badge tone={state === 'ok' ? 'green' : state === 'bad' ? 'amber' : 'neutral'}>{state === 'ok' ? 'Confirmado' : state === 'bad' ? 'Revisar' : 'Pendiente'}</Badge></div>;
}

function App() {
  const [networkMode,setNetworkMode]=useState('direct'),[directConnection,setDirectConnection]=useState(false);
  const [tab, setTab] = useState('lab'), [step, setStep] = useState(0), [connected, setConnected] = useState(false), [busy, setBusy] = useState('');
  const [startupLoading,setStartupLoading]=useState(true),[isOnline,setIsOnline]=useState(navigator.onLine);
  const [diagnostic, setDiagnostic] = useState(null), [candidate, setCandidate] = useState(0), [error, setError] = useState(''), [usbText, setUsbText] = useState('');
  const [suffix, setSuffix] = useState(''), [title, setTitle] = useState('Tu conexión llegó al laboratorio.'), [message, setMessage] = useState('Esta es una prueba de portal cautivo con dispositivos propios.');
  const [token, setToken] = useState(newToken), [deployment, setDeployment] = useState(null), [uploadProgress, setUploadProgress] = useState(0), [appOpened, setAppOpened] = useState(false);
  const [observed, setObserved] = useState(''), [networkSeen, setNetworkSeen] = useState(false), [verified, setVerified] = useState(false), [events, setEvents] = useState([]);
  const [view, setView] = useState('preview'), [width, setWidth] = useState('mobile'), [custom, setCustom] = useState(null), [running, setRunning] = useState(false), [simStep, setSimStep] = useState(0), [help, setHelp] = useState(false);
  const serialRef = useRef(null), fileRef = useRef(null), timer = useRef(null), dialog = useRef(null);
  const history = useHistory(), practiceRef = useRef(null);
  if(!practiceRef.current) practiceRef.current={id:crypto.randomUUID(),startedAt:new Date().toISOString(),events:[]};
  const supported = Boolean(navigator.serial) && window.isSecureContext;
  const ssid = 'Semillero-LAB' + (suffix ? '-' + suffix : '');
  const bundle = useMemo(() => {try {return createTestBundle({ssid, title, message, token});} catch (e) {return {error:e.message, html:''};}}, [ssid, title, message, token]);
  const safeHtml = useMemo(() => sanitizePortal(custom?.html ?? bundle.html), [custom, bundle.html]);
  const canDeploy = connected && diagnostic?.sd && diagnostic?.appPath && !bundle.error;
  const sameDevice = connected && diagnostic?.device.uid === deployment?.uid;
  const isCurrent = deployment?.html === bundle.html && deployment?.ssid === ssid;
  const completedSteps = [Boolean(diagnostic?.sd && diagnostic?.appPath), Boolean(deployment), verified];
  const addEvent = (message, source = 'USB', type = 'info') => {
    const item={message,source,type,at:new Date().toISOString()};
    setEvents(previous=>[...previous,item].slice(-300));
    if(['USB','Usuario','Sistema'].includes(source)) practiceRef.current.events=[...practiceRef.current.events,item].slice(-300);
    return item;
  };
  if (!serialRef.current) serialRef.current = new FlipperSerial(chunk => setUsbText(text => (text + chunk).slice(-24000)), () => {setConnected(false);setDiagnostic(null);setAppOpened(false);});
  useEffect(() => {
    const api = navigator.serial; if (!api) return;
    let mounted = true;
    const scan = () => api.getPorts().then(ports => {if (mounted) setCandidate(ports.filter(port => isFlipperCandidate(port.getInfo())).length);}).catch(() => {});
    scan(); api.addEventListener('connect', scan); api.addEventListener('disconnect', scan);
    return () => {mounted = false;api.removeEventListener('connect',scan);api.removeEventListener('disconnect',scan);};
  }, []);
  useEffect(() => {
    const timerId=window.setTimeout(()=>setStartupLoading(false),1050);
    const updateOnline=()=>setIsOnline(navigator.onLine);
    window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);
    return ()=>{window.clearTimeout(timerId);window.removeEventListener('online',updateOnline);window.removeEventListener('offline',updateOnline);};
  }, []);
  useEffect(() => () => {clearInterval(timer.current);void serialRef.current.disconnect().catch(() => {});}, []);
  useEffect(() => {if (help) dialog.current?.showModal(); else dialog.current?.close();}, [help]);
  useEffect(() => {
    const prevent = event => {if (busy === 'upload') {event.preventDefault();event.returnValue = '';}};
    window.addEventListener('beforeunload', prevent);return () => window.removeEventListener('beforeunload',prevent);
  }, [busy]);

  async function perform(label, action) {
    if (busy) return;
    setError('');setBusy(label);
    try {await action();} catch (e) {
      const text = e.name === 'NotFoundError' ? 'No seleccionaste un puerto. Pulsa Conectar Flipper para intentarlo de nuevo.' : e.name === 'NetworkError' ? 'El puerto está ocupado o desconectado. Cierra qFlipper y otras terminales y vuelve a conectar.' : e.message;
      setError(text);addEvent(text, 'Sistema', 'error');
    } finally {setBusy('');}
  }
  const diagnose = async () => {
    const result = await serialRef.current.diagnose();setDiagnostic(result);
    addEvent(`${result.device.model} · ${result.device.firmware} ${result.device.version}. microSD ${result.sd ? 'disponible' : 'no disponible'}; Evil Portal ${result.appPath ? 'encontrado' : 'no encontrado'}; herramientas de red: ${result.networkApps.filter(app=>app.path).map(app=>app.name).join(', ')||'ninguna encontrada'}.`, 'USB', result.sd && result.appPath ? 'success' : 'info');
    return result;
  };
  const connect = () => perform('connect', async () => {
    if(directConnection)throw new Error('Desconecta Marauder en Auditar red y sal del puente USB-UART del Flipper antes de conectar el modo de portal.');
    await serialRef.current.connect();setConnected(true);addEvent('Puerto USB abierto. Iniciando diagnóstico real.');await diagnose();
  });
  const disconnect = () => perform('disconnect', async () => {await serialRef.current.disconnect();addEvent('Conexión USB cerrada.');});
  async function prepareMarauderBridge(){if(busy)throw new Error('Espera a que termine la operación USB actual.');if(connected){await serialRef.current.disconnect();addEvent('Puerto CLI liberado para el puente Marauder.','Red');}}
  async function openNetworkTool(id) {
    let opened=false;
    await perform('network-open',async()=>{
      const app=await serialRef.current.openNetworkTool(id);
      addEvent(`${app.name}: apertura confirmada por USB. El escaneo se inicia desde el Flipper.`, 'Red', 'success');opened=true;
    });
    return opened;
  }
  function savePractice(complete=verified) {
    return history.save({id:practiceRef.current.id,kind:'portal',title:deployment?`Portal: ${deployment.ssid} / ${deployment.token}`:'Práctica de conexión USB',
      startedAt:practiceRef.current.startedAt,savedAt:new Date().toISOString(),status:complete?'Comprobación manual registrada':'En curso',
      summary:complete?'Carga verificada por USB y comprobación visual registrada por el usuario.':deployment?'Portal cargado. La comprobación desde el teléfono está pendiente.':'Diagnóstico o preparación de una prueba con dispositivo.',
      device:diagnostic?{model:diagnostic.device.model,firmware:diagnostic.device.firmware,version:diagnostic.device.version}:null,
      portal:deployment?{ssid:deployment.ssid,token:deployment.token,backupDir:deployment.backupDir,observation:complete?'Confirmación manual del usuario':'Pendiente'}:null,
      events:[...practiceRef.current.events]});
  }
  const restart = () => perform('restart', async () => {
    if(practiceRef.current.events.length && !verified) savePractice();
    await serialRef.current.disconnect();
    setConnected(false);setDiagnostic(null);setDeployment(null);setAppOpened(false);
    setVerified(false);setObserved('');setNetworkSeen(false);setUploadProgress(0);
    setToken(newToken());setUsbText('');setCustom(null);setView('preview');setTab('lab');setStep(0);
    practiceRef.current={id:crypto.randomUUID(),startedAt:new Date().toISOString(),events:[]};
    addEvent('Nueva prueba iniciada. Completa de nuevo los tres pasos del recorrido.', 'Usuario');
  });
  const upload = () => perform('upload', async () => {
    setUploadProgress(0);
    const result = await serialRef.current.deployTest({ssid, token, title, message}, setUploadProgress);
    setDeployment(result);setAppOpened(false);setVerified(false);setObserved('');setNetworkSeen(false);setStep(2);setCustom(null);
    addEvent(`Portal y red ${result.ssid} cargados y verificados por lectura. Respaldo: ${result.backupDir}`, 'USB', 'success');
  });
  const openPortal = () => perform('open', async () => {
    if (!sameDevice) throw new Error('Conecta el mismo Flipper en el que cargaste la prueba.');
    if (await serialRef.current.readText('/ext/apps_data/evil_portal/index.html') !== deployment.html || await serialRef.current.readText('/ext/apps_data/evil_portal/ap.config.txt') !== deployment.ssid) throw new Error('Los archivos del Flipper cambiaron. Vuelve al paso 2 y carga la prueba.');
    await serialRef.current.openPortal();setAppOpened(true);addEvent('Evil Portal abierto en la pantalla del Flipper. Falta pulsar Start portal y comprobar la red desde el móvil.');
  });
  async function loadFile(file) {
    if (!file) return;setError('');
    if (!/\.html?$/i.test(file.name)) {setError('Selecciona un archivo .html o .htm.');return;}
    if (file.size > MAX_HTML_BYTES) {setError('El archivo supera el límite de 1 MB para vista previa.');return;}
    try {setCustom({name:file.name, html:await file.text()});setView('preview');addEvent(`Vista aislada de ${file.name}.`, 'Archivo');}
    catch {setError('No se pudo leer el archivo.');}
    finally {if (fileRef.current) fileRef.current.value = '';}
  }
  function verify(event) {
    event.preventDefault();
    if (!deployment || !networkSeen || observed.trim().toUpperCase() !== deployment.token) {setError('Marca que viste la red e ingresa el código que aparece en la página del teléfono.');return;}
    setError('');setVerified(true);addEvent(`Confirmaste desde tu móvil la red ${deployment.ssid} y el código ${deployment.token}. Esta es una observación manual.`, 'Usuario', 'success');
    savePractice(true);
  }
  function startSimulation() {
    if (running) return;setRunning(true);setSimStep(0);
    const list = simulatedEvents('Portal de bienvenida'),simulationEvents=[],simulationId=crypto.randomUUID();let index = 0;
    const push = () => {const event = list[index++];simulationEvents.push(addEvent(event.message, 'Simulación', event.type));setSimStep(index);if(index === list.length) {clearInterval(timer.current);setRunning(false);history.save({id:simulationId,kind:'simulation',title:'Simulación: portal de bienvenida',savedAt:new Date().toISOString(),status:'Simulación completada',summary:'Recorrido con eventos prefijados. No se emitieron señales Wi-Fi ni se modificó el dispositivo.',events:simulationEvents});}};
    push();timer.current = setInterval(push, 750);
  }
  function exportReport() {
    const report = {application:'Semillero Flipper Lab',version:2,exportedAt:new Date().toISOString(),device:diagnostic ? {model:diagnostic.device.model,firmware:diagnostic.device.firmware,version:diagnostic.device.version,appPath:diagnostic.appPath,checkedAt:diagnostic.checkedAt} : null,
      deployment:deployment ? {ssid:deployment.ssid,token:deployment.token,backupDir:deployment.backupDir,deployedAt:deployment.deployedAt} : null,
      observation:{method:'confirmacion-manual-del-usuario',completed:verified},esp32Firmware:'no-identificado-por-usb',events};
    downloadFile('reporte-semillero.json',JSON.stringify(report,null,2),'application/json');
  }
  const pageTitles = {lab:'Del USB a tu primera prueba.',network:'Conoce y mejora tu red.',analyzer:'Entiende lo que envía tu página.',history:'De la práctica al informe.',device:'Tu equipo, sin suposiciones.',activity:'Una sesión que puedes explicar.',simulation:'Ensaya el recorrido.'};
  const pageDescriptions = {lab:'Prepara Evil Portal y comprueba la página desde tu propio teléfono.',network:'Elige tu red y ejecuta comprobaciones con la AIO. Recibe evidencia y recomendaciones para corregir lo observado.',analyzer:'Formularios, recursos y conexiones HTTP, con evidencia en las líneas del HTML.',history:'Selecciona tus prácticas y decide qué contenido aparecerá en el PDF.',device:'Información leída por USB y lo que todavía necesitas verificar.',activity:'Distingue las lecturas del equipo, tus observaciones y las simulaciones.',simulation:'Recorre una demostración local sin usar el hardware.'};
  const loadingLabels={connect:'Conectando con el Flipper…',diagnose:'Leyendo el diagnóstico…',upload:`Cargando la prueba… ${uploadProgress}%`,open:'Abriendo la aplicación…',restart:'Reiniciando la prueba…',disconnect:'Cerrando la conexión…'};
  const showLoader=startupLoading||Boolean(busy);
  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setTab('lab')} aria-label="Inicio de Semillero"><span className="brand-symbol"><img src="/flipper-lab.svg" alt="" width="42" height="42"/></span><span>semillero<small>FLIPPER LAB</small></span></button>
      <span className="nav-label">TU LABORATORIO</span>
      <nav aria-label="Navegación principal">{tabs.map(([id,Icon,label]) => <button key={id} title={label} aria-current={tab === id ? 'page' : undefined} className={`nav-item ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}><Icon size={19}/><span>{label}</span>{tab === id && <i/>}</button>)}</nav>
      <div className="side-project"><span className="project-dot"/><div><strong>Portal y seguridad de red</strong><small>Flipper Zero + ESP32</small></div></div>
      <div className="sidebar-bottom"><div className="side-tip"><ShieldCheck size={22}/><strong>Un laboratorio propio.</strong><p>Una red de prueba, una página clara y evidencia de cada paso.</p><span>SEMILLERO / COMPENSAR</span></div><button className="help-button" aria-label="Ayuda y conexión" onClick={() => setHelp(true)}><CircleHelp size={18}/><span>Ayuda y conexión</span><ArrowRight size={15}/></button><div className="local-session"><span/> Aplicación local <small>v0.2</small></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div>Laboratorio <ChevronRight size={14}/><strong>{tabs.find(item => item[0] === tab)[2]}</strong></div><span><i/> localhost <span className="top-divider"/> ESPACIO DE PRÁCTICA</span></header>
      <main>
        <div className="page-heading"><div><p className="eyebrow">CONECTA. COMPRUEBA. APRENDE.</p><h1>{pageTitles[tab]}</h1><p>{pageDescriptions[tab]}</p></div><Badge tone="green"><ShieldCheck size={13}/> Entorno académico</Badge></div>
        {!isOnline&&<OfflineNotice/>}
        {history.storageError&&<div className="alert error" role="alert"><Info size={18}/><p>{history.storageError}</p></div>}
        {error && <div className="alert error" role="alert"><FlipperAnimation size="tiny" label="Delfín de Flipper Lab para este aviso"/><p>{error}</p><button aria-label="Cerrar aviso" onClick={() => setError('')}><X size={17}/></button></div>}
        <section hidden={tab==='analyzer'||tab==='history'||(tab==='network'&&networkMode==='direct')} className="connection-bar" aria-label="Estado de conexión"><div className={`usb-symbol ${connected ? 'on' : ''}`}><Usb size={25}/></div><div className="connection-text"><div><strong>{diagnostic?.device.name || 'Flipper Zero'}</strong><Badge tone={connected ? 'green' : 'neutral'}>{connected ? diagnostic ? 'Identidad confirmada' : 'USB abierto' : 'Sin conexión USB'}</Badge></div><p>{diagnostic ? `${diagnostic.device.firmware} · ${diagnostic.device.version} · ${diagnostic.sd ? 'microSD disponible' : 'Revisa la microSD'}` : candidate ? 'Hay un puerto compatible autorizado. Conéctalo para consultar el equipo.' : 'Conecta el Flipper por USB; el ESP32 permanece conectado a sus pines GPIO.'}</p></div><Button variant={connected ? 'secondary' : 'primary'} disabled={Boolean(busy) || (!supported && !connected)} busy={busy === 'connect'} onClick={connected ? disconnect : connect}>{!busy && (connected ? <Unplug size={16}/> : <Link2 size={16}/>)}{busy === 'connect' ? 'Conectando…' : connected ? 'Desconectar' : 'Conectar Flipper'}</Button></section>
        {!supported && tab!=='analyzer' && tab!=='history' && !(tab==='network'&&networkMode==='direct') && <div className="alert"><Info size={18}/><p>La conexión USB necesita <strong>Chrome o Edge en localhost</strong>. Puedes preparar la plantilla y usar la simulación.</p></div>}
        {tab === 'lab' && <>
          <div className="stepper" aria-label="Pasos de la prueba">{steps.map((item,index) => <button key={item.title} aria-label={`${item.title}: ${completedSteps[index] ? 'completado' : step === index ? 'en curso' : 'pendiente'}`} aria-current={step === index ? 'step' : undefined} className={`step ${step === index ? 'current' : ''} ${completedSteps[index] ? 'done' : ''}`} onClick={() => setStep(index)}><span className="step-number">{completedSteps[index] ? <Check size={16}/> : `0${index+1}`}</span><span><strong>{item.title}</strong><small>{item.text}</small></span>{index < 2 && <ChevronRight size={17} className="step-arrow"/>}</button>)}</div>
          <div className="lab-grid">
            <div className="control-column">
              {step === 0 && <section className="panel"><div className="panel-heading"><span className="section-index">01 / EQUIPO</span><h2>Primero, una conexión real.</h2><p>Consulta el Flipper y comprueba que la aplicación esté en la microSD.</p></div><div className="panel-body">
                <div className="hardware-path"><div><Usb size={24}/><strong>Computador</strong><small>USB</small></div><span>····</span><div className="flipper-mini"><img className="flipper-device-icon" src="/flipper-zero.svg" alt="Flipper Zero"/><strong>Flipper Zero</strong><small>GPIO / UART</small></div><span>····</span><div><Cpu size={27}/><strong>ESP32</strong><small>Wi-Fi</small></div></div>
                <div className="checklist"><StatusRow title="Flipper Zero" detail={diagnostic ? `Identidad y firmware ${diagnostic.device.firmware} leídos por USB.` : 'Conecta el puerto y espera el diagnóstico.'} state={diagnostic ? 'ok' : 'pending'}/><StatusRow title="microSD y aplicación" detail={diagnostic ? diagnostic.appPath ? 'Evil Portal encontrado en la tarjeta.' : 'No se encontró Evil Portal en GPIO/ESP ni GPIO.' : 'Se comprueban al conectar el dispositivo.'} state={diagnostic ? diagnostic.sd && diagnostic.appPath ? 'ok' : 'bad' : 'pending'}/><StatusRow title="Firmware del ESP32" detail="Se comprueba al iniciar el portal en el Flipper; USB no lo identifica." state="pending"/></div>
                <div className="note"><Info size={17}/><p>El ESP32 necesita un firmware compatible con esta aplicación Evil Portal. Si tiene Marauder o GhostESP, revisa la guía antes de iniciar.</p></div>
                <Button variant="primary" className="full" disabled={!diagnostic?.sd || !diagnostic?.appPath || Boolean(busy)} onClick={() => setStep(1)}>Continuar con el portal <ArrowRight size={17}/></Button>
                <div className="panel-actions"><button className="text-button" disabled={!connected || Boolean(busy)} onClick={() => perform('diagnose',diagnose)}><RefreshCw size={14}/> Repetir diagnóstico</button><button className="text-button" onClick={() => setHelp(true)}>Ver guía <ArrowRight size={14}/></button></div>
              </div></section>}
              {step === 1 && <section className="panel"><div className="panel-heading"><span className="section-index">02 / PORTAL</span><h2>Una página para comprobar.</h2><p>La carga usa esta plantilla de laboratorio, con un código único y sin campos de datos personales.</p></div><div className="panel-body form-stack">
                <div><label htmlFor="ssid-suffix">Nombre de la red <Badge>SSID</Badge></label><div className="input-prefix"><span>Semillero-LAB</span><input id="ssid-suffix" aria-label="Sufijo de la red" placeholder="Sufijo opcional" value={suffix} maxLength={12} disabled={Boolean(busy)} onChange={event => setSuffix(event.target.value.replace(/[^a-z0-9]/gi,''))}/></div><small className="field-help">Será una red abierta de prueba: <strong>{ssid}</strong></small></div>
                <div><label htmlFor="portal-title">Título de bienvenida</label><input id="portal-title" value={title} maxLength={56} disabled={Boolean(busy)} onChange={event => setTitle(event.target.value)}/></div>
                <div><label htmlFor="portal-message">Mensaje del laboratorio</label><textarea id="portal-message" value={message} maxLength={180} rows={3} disabled={Boolean(busy)} onChange={event => setMessage(event.target.value)}/></div>
                <div className="test-code"><div><small>CÓDIGO DE LA PRUEBA</small><strong data-testid="test-token">{token}</strong></div><button className="icon-button" aria-label="Generar otro código" disabled={Boolean(busy)} onClick={() => setToken(newToken())}><RefreshCw size={17}/></button></div>
                <div className="file-summary"><FileCode2 size={20}/><div><strong>index.html</strong><small>{new TextEncoder().encode(bundle.html).length.toLocaleString('es-CO')} / {MAX_DEVICE_HTML_BYTES.toLocaleString('es-CO')} bytes · HTML autónomo</small></div><Badge tone={bundle.error ? 'amber' : 'green'}>{bundle.error ? 'Revisar' : 'Compatible'}</Badge></div>
                {bundle.error && <p className="validation" role="alert">{bundle.error}</p>}
                <div className="note"><ShieldCheck size={18}/><p>Al cargar se guarda una copia de <code>index.html</code> y <code>ap.config.txt</code> en la microSD. Mantén la aplicación del Flipper cerrada durante la carga.</p></div>
                <Button variant="primary" className="full" disabled={!canDeploy || Boolean(busy)} busy={busy === 'upload'} onClick={upload}>{busy === 'upload' ? `Cargando y verificando… ${uploadProgress}%` : <><Upload size={17}/> Cargar prueba al Flipper <ArrowRight size={17}/></>}</Button>
                {busy === 'upload' && <progress aria-label="Progreso de carga" max="100" value={uploadProgress}/>}
                {!connected && <p className="field-help centered">Conecta el Flipper para habilitar la carga por USB.</p>}
                <div className="panel-actions"><button className="text-button" disabled={Boolean(bundle.error)} onClick={() => downloadFile('index.html',bundle.html,'text/html;charset=utf-8')}><ArrowDownToLine size={14}/> Descargar HTML</button><button className="text-button" onClick={() => downloadFile('ap.config.txt',ssid)}>Descargar SSID</button></div>
              </div></section>}
              {step === 2 && <section className="panel"><div className="panel-heading"><span className="section-index">03 / COMPROBACIÓN</span><h2>{verified ? 'Tu observación quedó registrada.' : 'Ahora, pruébalo en tu móvil.'}</h2><p>La carga por USB prepara los archivos. La emisión y la respuesta Wi-Fi se comprueban en el equipo y el teléfono.</p></div><div className="panel-body">
                {!deployment ? <div className="empty compact"><Smartphone size={30}/><strong>Primero carga la prueba.</strong><p>Necesitas una página y un código en el Flipper para comprobar esta sesión.</p><Button variant="primary" onClick={() => setStep(1)}>Preparar portal <ArrowRight size={16}/></Button></div> : <>
                  {!isCurrent && <div className="note amber"><Info size={17}/><p>La plantilla fue editada después de cargar. Esta prueba usa la red y el código de la última carga.</p></div>}
                  <div className="loaded-success"><CheckCircle2 size={21}/><div><strong>Archivos cargados y leídos de vuelta</strong><span>{deployment.ssid} · Código <b>{deployment.token}</b></span></div></div>
                  <ol className="test-instructions"><li><span>1</span><div><strong>Abre Evil Portal en el Flipper</strong><p>Usa el botón de abajo o Apps → GPIO → ESP → Evil Portal.</p><Button disabled={!sameDevice || Boolean(busy)} busy={busy === 'open'} onClick={openPortal}><ExternalLink size={15}/>{appOpened ? 'Volver a abrir aplicación' : 'Abrir en el Flipper'}</Button>{appOpened && <small className="success-text">Aplicación abierta. La red aún necesita Start portal.</small>}</div></li><li><span>2</span><div><strong>En el Flipper, pulsa Start portal</strong><p>Comprueba la respuesta del ESP32 en la pantalla. Si queda en espera, revisa su firmware y la conexión GPIO.</p></div></li><li><span>3</span><div><strong>Conecta tu teléfono a {deployment.ssid}</strong><p>Acepta permanecer en una red sin Internet. Si la página no se abre, usa la dirección HTTP que indique el ESP32; normalmente <code>http://192.168.4.1</code>.</p></div></li></ol>
                  <form className={`verify-form ${verified ? 'verified' : ''}`} onSubmit={verify}><div className="verify-title"><Smartphone size={18}/><strong>¿Qué ves en el teléfono?</strong><Badge>Manual</Badge></div><label className="checkbox-label"><input type="checkbox" checked={networkSeen} onChange={event => {setNetworkSeen(event.target.checked);setVerified(false);}}/>Veo y seleccioné la red {deployment.ssid}</label><label htmlFor="observed-code">Código que muestra el portal en el móvil</label><div className="code-entry"><input id="observed-code" value={observed} placeholder="6 caracteres" maxLength={6} autoComplete="off" onChange={event => {setObserved(event.target.value.toUpperCase());setVerified(false);}}/><Button type="submit" variant="primary" disabled={!networkSeen || observed.length !== 6}>{verified ? <><Check size={16}/> Registrado</> : 'Registrar prueba'}</Button></div><p>Confirma una observación tuya; la aplicación web no mide clientes ni tráfico Wi-Fi.</p></form>
                  <div className="note"><Info size={17}/><p>Al terminar, pulsa <strong>Stop portal</strong> en el Flipper y olvida la red en tu teléfono.</p></div>
                  {verified && <Button variant="primary" className="full" disabled={Boolean(busy)} busy={busy === 'restart'} onClick={restart}><RefreshCw size={17}/> Reiniciar prueba <ArrowRight size={17}/></Button>}
                  <details className="backup-details"><summary>Ver ubicación del respaldo</summary><code>{deployment.backupDir}</code><p>Para recuperar tus archivos: detén el portal, cierra esta conexión USB y usa el explorador de qFlipper para copiar el contenido de esa carpeta a <code>/ext/apps_data/evil_portal/</code>.</p></details>
                </>}
              </div></section>}
              <div className="step-bottom">{step > 0 && <button className="text-button" disabled={Boolean(busy)} onClick={() => setStep(step-1)}><ArrowLeft size={15}/> Paso anterior</button>}<span>PRÁCTICA CON EQUIPOS PROPIOS</span></div>
            </div>
            <div className="preview-column"><section className="panel preview-panel"><div className="preview-heading"><div><span className="section-index">VISTA DEL PORTAL</span><h3>Lo que verá tu teléfono</h3></div><div className="segmented"><button className={view === 'preview' ? 'selected' : ''} onClick={() => setView('preview')}>Vista previa</button><button className={view === 'code' ? 'selected' : ''} onClick={() => setView('code')}><Code2 size={14}/> HTML</button></div></div><div className="preview-toolbar"><span><i/>{custom ? 'Archivo importado · solo vista' : 'Plantilla de esta prueba'}</span><div><button className={width === 'mobile' ? 'selected' : ''} aria-label="Vista móvil" onClick={() => setWidth('mobile')}><Smartphone size={16}/></button><button className={width === 'desktop' ? 'selected' : ''} aria-label="Vista escritorio" onClick={() => setWidth('desktop')}><Monitor size={16}/></button></div></div><div className={`preview-stage ${width}`}>{view === 'preview' ? <div className={`browser-frame ${width}`}><div className="browser-chrome"><span/><span/><span/><small><ShieldCheck size={10}/> portal de laboratorio</small></div><iframe title="Vista previa aislada del portal" sandbox="" referrerPolicy="no-referrer" srcDoc={safeHtml}/></div> : <pre className="source">{custom?.html ?? bundle.html}</pre>}</div><div className="preview-foot"><ShieldCheck size={13}/> Vista aislada en este computador · Sin conexión al ESP32</div></section>
              <details className="import-section"><summary><FileCode2 size={16}/> Inspeccionar otro archivo HTML <Upload size={14}/></summary><p>Solo vista previa aislada. La carga al Flipper utiliza la plantilla de prueba de arriba.</p><input ref={fileRef} type="file" accept=".html,.htm,text/html" aria-label="Seleccionar archivo HTML" onChange={event => loadFile(event.target.files[0])}/>{custom && <div className="imported-file"><span>{custom.name}</span><button className="text-button" onClick={() => setCustom(null)}>Volver a la plantilla <X size={13}/></button></div>}</details>
              <div className="next-tip"><Wifi size={18}/><p><strong>El resultado es una página real.</strong> El código te permite reconocer la versión cargada y evitar confundirla con una copia anterior.</p></div>
            </div>
          </div>
        </>}
        {tab === 'device' && <div className="device-grid"><section className="panel"><div className="panel-heading"><span className="section-index">DIAGNÓSTICO USB</span><h2>Información del Flipper</h2><p>Estos valores provienen de la CLI del dispositivo conectado.</p></div><div className="panel-body"><dl className="device-facts">{[['Modelo',diagnostic?.device.model],['Nombre',diagnostic?.device.name],['Firmware',diagnostic && `${diagnostic.device.firmware} ${diagnostic.device.version}`],['Compilación',diagnostic?.device.build],['microSD',diagnostic && (diagnostic.sd ? 'Disponible' : 'No disponible')],['Ruta de Evil Portal',diagnostic?.appPath],...NETWORK_APPS.map(app=>[app.name,diagnostic?diagnostic.networkApps?.find(item=>item.id===app.id)?.path||'No encontrada':'Pendiente de consulta'])].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Pendiente de consulta'}</dd></div>)}</dl><div className="note"><Cpu size={18}/><p>La conexión USB del Flipper no confirma el modelo ni el firmware del ESP32. Comprueba su respuesta en la aplicación que vayas a utilizar.</p></div><Button variant="primary" disabled={!connected || Boolean(busy)} busy={busy === 'diagnose'} onClick={() => perform('diagnose',diagnose)}><RefreshCw size={16}/> Actualizar diagnóstico</Button></div></section><section className="panel terminal-panel"><div className="panel-heading"><span className="section-index">LECTURA DEL PUERTO</span><h2><Terminal size={20}/> Respuesta USB</h2><p>Salida real del Flipper. No es una consola de comandos.</p></div><pre className="terminal">{usbText || 'Esperando conexión USB…\nConecta el Flipper para leer su información.'}</pre><button className="text-button" onClick={() => setUsbText('')}>Limpiar lectura</button></section></div>}
        <div hidden={tab!=='network'}><div className="network-modes" role="group" aria-label="Modo de revisión de red"><button className={networkMode==='direct'?'selected':''} aria-pressed={networkMode==='direct'} onClick={()=>setNetworkMode('direct')}>Diagnóstico con Flipper</button><button className={networkMode==='manual'?'selected':''} aria-pressed={networkMode==='manual'} onClick={()=>setNetworkMode('manual')}>Revisión manual (opcional)</button></div><div hidden={networkMode!=='direct'}><MarauderPanel onPrepare={prepareMarauderBridge} onState={setDirectConnection} onSave={history.save} onHistory={()=>setTab('history')} records={history.records} blocked={Boolean(busy)}/></div><div hidden={networkMode!=='manual'}><NetworkPanel diagnostic={diagnostic} connected={connected} busy={busy} onOpenTool={openNetworkTool} onDiagnose={()=>perform('diagnose',diagnose)} onSave={history.save} records={history.records} onHistory={()=>setTab('history')}/></div></div>
        <div hidden={tab!=='analyzer'}><AnalyzerPanel portal={{html:custom?.html??bundle.html,name:custom?.name??'index.html'}} onSave={history.save} onEvent={message=>addEvent(message,'Archivo')}/></div>
        {tab==='history'&&<HistoryPanel records={history.records} onRemove={history.remove} onRestore={history.restore}/>}
        {tab === 'activity' && <section className="panel"><div className="record-heading"><div><span className="section-index">TRAZABILIDAD DE LA PRUEBA</span><h2>Registro de sesión <Badge>{events.length} eventos</Badge></h2></div><div className="record-buttons"><Button disabled={!practiceRef.current.events.length} onClick={()=>{savePractice();setTab('history');}}><History size={16}/> Guardar práctica actual</Button><Button disabled={!events.length} onClick={exportReport}><ArrowDownToLine size={16}/> Exportar registro</Button></div></div><div className="panel-body"><EventList events={events}/></div></section>}
        {tab === 'simulation' && <section className="panel simulation-panel"><div className="panel-heading"><Badge tone="amber">Demostración local</Badge><h2>Conoce el recorrido sin hardware.</h2><p>Esta secuencia tiene eventos prefijados. Los datos de la demostración quedan identificados como Simulación en el registro.</p></div><div className="panel-body"><div className="simulation-visual"><FlaskConical size={44}/><strong>{running ? 'Simulación en curso…' : simStep === 5 ? 'Recorrido completado.' : 'Lista para empezar.'}</strong><p>Sin transmisión Wi-Fi ni cambios en el Flipper.</p><progress aria-label="Progreso de simulación" value={simStep} max="5"/></div><Button variant="primary" disabled={running} onClick={startSimulation}><Play size={17}/>{running ? 'Simulando…' : 'Iniciar simulación'}</Button><EventList events={events.filter(event => event.source === 'Simulación').slice(-5)}/></div></section>}
        {tab === 'lab' && <section className="panel session-panel"><div className="record-heading"><div><Activity size={18}/><h3>Lo que pasó en esta sesión</h3><Badge>{events.length}</Badge></div><button className="text-button" disabled={!events.length} onClick={exportReport}><ArrowDownToLine size={15}/> Exportar registro</button></div><EventList events={events.slice(-4)}/>{events.length > 4 && <button className="text-button all-events" onClick={() => setTab('activity')}>Ver todos los eventos <ArrowRight size={14}/></button>}</section>}
        <footer><span>Semillero de investigación <b>·</b> Compensar</span><span><ShieldCheck size={13}/> Historial en este navegador · Registro de sesión en memoria</span></footer>
      </main>
    </div>
    <dialog ref={dialog} className="guide-dialog" onCancel={() => setHelp(false)} onClick={event => {if(event.target === dialog.current) setHelp(false);}}><div className="guide-content"><button className="close-guide icon-button" aria-label="Cerrar guía" onClick={() => setHelp(false)}><X size={21}/></button><span className="section-index">GUÍA DE CONEXIÓN</span><h2>Del cable a la página.</h2><ol><li><strong>USB y navegador.</strong> Abre en Chrome o Edge desde localhost. Conecta el Flipper con un cable de datos y cierra qFlipper u otras terminales que ocupen el puerto.</li><li><strong>Diagnóstico.</strong> Pulsa Conectar Flipper y selecciona el puerto del Flipper. Se revisan identidad, microSD y las rutas habituales de Evil Portal, Marauder y WiFi Scanner.</li><li><strong>ESP32 compatible.</strong> Cada aplicación necesita un firmware compatible en el ESP32. Usa Probar portal para Evil Portal o Auditar red para la guía de Marauder y la revisión del router. Si la placa no responde, identifica su modelo y firmware antes de cambiarlo. <a href="https://github.com/Next-Flip/Momentum-Apps/tree/dev/evil_portal" target="_blank" rel="noreferrer">Documentación de Momentum <ExternalLink size={12}/></a></li><li><strong>Carga.</strong> Usa el paso 2 con Evil Portal cerrado en el Flipper. Se guardan respaldos, se escriben los archivos y se leen de vuelta para verificar el contenido.</li><li><strong>Prueba.</strong> Abre Evil Portal, pulsa Start portal en el Flipper y entra desde tu teléfono a la red Semillero-LAB. Si no se abre la ventana, usa HTTP y la IP indicada por la placa; desactiva temporalmente el cambio automático a datos móviles si abandona la red.</li><li><strong>Cierre.</strong> Pulsa Stop portal en el Flipper, olvida la red del teléfono y exporta el registro de esta sesión.</li></ol><div className="note"><Info size={17}/><p>Si el puerto se interrumpe durante la carga, reconecta y revisa el respaldo indicado en el error. Si un archivo importado no se ve completo, incluye sus estilos e imágenes dentro del HTML.</p></div><Button className="full" variant="primary" onClick={() => setHelp(false)}>Entendido <Check size={16}/></Button></div></dialog>
    {showLoader&&<LoadingOverlay label={startupLoading?'Preparando el laboratorio…':loadingLabels[busy]||'Trabajando…'} progress={busy==='upload'?uploadProgress:undefined}/>}
  </div>;
}
function AppRoute() {
  const path=window.location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return <NotFoundPage/>;
  return <App/>;
}
createRoot(document.getElementById('root')).render(<AppRoute/>);
