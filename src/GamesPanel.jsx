import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ArrowUp, Gamepad2, Pause, Play, Radio, RotateCcw, Unplug} from 'lucide-react';
import {RUNNER, newRun, jumpRun, stepRun, validJumpKey, keyLabel} from './runner.js';
import './games.css';
import NativeGamesGuide from './NativeGamesGuide.jsx';

export default function GamesPanel({active, connected, busy, onDisconnect, directConnection, onNetwork}) {
  const [mode, setMode] = useState('runner');
  const [run, setRun] = useState(newRun);
  const [best, setBest] = useState(0);
  const [binding, setBinding] = useState('ArrowRight');
  const [learning, setLearning] = useState(false);
  const [input, setInput] = useState({code: '', count: 0});
  const [hint, setHint] = useState('Pulsa «Asignar botón» y después un botón físico del Flipper.');
  const stage = useRef(null), capture = useRef(null);
  const pause = useCallback(() => setRun(previous => previous.status === 'running' ? {...previous, status: 'paused'} : previous), []);

  useEffect(() => {if (!active || mode !== 'runner') {pause(); setLearning(false);}}, [active, mode, pause]);
  useEffect(() => {
    const hidden = () => {if (document.hidden) pause();};
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', hidden);
    return () => {window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', hidden);};
  }, [pause]);
  useEffect(() => {if (learning) capture.current?.focus();}, [learning]);
  useEffect(() => {if (run.status === 'over') setBest(previous => Math.max(previous, run.score));}, [run.status, run.score]);
  useEffect(() => {
    if (!active || mode !== 'runner' || run.status !== 'running') return;
    let frame, last;
    const tick = now => {
      if (last !== undefined) {
        const elapsed = (now - last) / 1000;
        setRun(previous => stepRun(previous, elapsed));
      }
      last = now; frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, mode, run.status]);

  function received(code) {setInput(previous => ({code, count: previous.count + 1}));}
  function cancelLearning() {setLearning(false); setHint(`Asignación cancelada. Se conserva ${keyLabel(binding)} para saltar.`);}
  function learn(event) {
    if (event.target !== event.currentTarget) return;
    if (event.code === 'Escape') {event.preventDefault(); cancelLearning(); return;}
    if (event.code === 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    if (event.repeat) return;
    if (!validJumpKey(event.code)) {setHint('Usa una flecha, Espacio, Enter, Av. pág., una letra o un número.'); return;}
    setBinding(event.code); received(event.code); setLearning(false);
    setHint(`Botón asignado: ${keyLabel(event.code)}. Ya puedes empezar la partida.`);
    stage.current?.focus();
  }
  function jump() {stage.current?.focus(); setRun(jumpRun);}
  function keydown(event) {
    if (!active || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code === 'Escape') {event.preventDefault(); pause(); return;}
    if (event.code !== binding && event.code !== 'Space') return;
    event.preventDefault();
    if (event.repeat) return;
    received(event.code); setRun(jumpRun);
  }
  const labels = {ready: 'Listo para jugar', running: 'En carrera', paused: 'En pausa', over: 'Fin de la partida'};
  const overlay = {ready: ['Un botón. Un salto.', 'Pulsa tu botón para empezar.'], paused: ['Toma aire.', 'Pulsa tu botón para continuar.'], over: ['¡Otra oportunidad!', 'Pulsa tu botón para volver a correr.']};

  return <section className="games-section" aria-label="Juegos con Flipper">
    <div className="games-modes" role="group" aria-label="Dónde jugar"><button aria-pressed={mode === 'runner'} onClick={() => setMode('runner')}>En el computador · Flipper como mando</button><button aria-pressed={mode === 'device'} onClick={() => setMode('device')}>En el Flipper · Games</button></div>
    {mode === 'device' && <NativeGamesGuide/>}
    <div hidden={mode !== 'runner'}>
    <div className="games-intro"><span className="games-emblem"><Gamepad2 size={34}/></span><div><span className="section-index">FLIPPER EN MANO · JUEGO EN PANTALLA</span><h2>Salta al siguiente nivel.</h2><p>Usa un botón de tu Flipper para saltar obstáculos y superar tu marca.</p></div><span className="badge">USB o Bluetooth</span></div>
    <div className="games-layout">
      <section className="panel games-board-panel" aria-label="Juego de obstáculos">
        <div className="panel-heading games-board-heading"><div><span className="section-index">01 / FLIPPER RUN</span><h2>Que nada te detenga.</h2></div><span className="badge green" data-testid="runner-status">{labels[run.status]}</span></div>
        <div className="panel-body">
          <div className="games-stats"><div><strong>{run.score}</strong><span>Puntos</span></div><div><strong>{Math.max(best, run.score)}</strong><span>Mejor de esta sesión</span></div><div><strong>{keyLabel(binding)}</strong><span>Botón de salto</span></div></div>
          <div ref={stage} className="runner-stage" tabIndex={0} role="region" aria-label="Pista de Flipper Run" aria-describedby="runner-controls" onKeyDown={keydown} onBlur={pause} onClick={() => stage.current?.focus()}>
            <svg viewBox="0 0 800 300" role="img" aria-label="Un pequeño robot salta sobre bloques en una pista naranja">
              <defs><pattern id="runner-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" strokeOpacity=".04"/></pattern></defs>
              <rect width="800" height="300" fill="#1d1c1a"/><rect width="800" height="300" fill="url(#runner-grid)"/>
              <circle cx="690" cy="64" r="30" fill="#ff9a3c" opacity=".16"/>
              <path d="M0 218L100 160L190 210L300 125L420 210L550 145L680 215L800 165V240H0Z" fill="#34291f"/>
              <path d="M0 240H800" stroke="#ff9a3c" strokeWidth="3"/>
              {Array.from({length: 15}, (_, i) => <path key={i} d={`M${i * 65 - run.distance % 65} 267h24`} stroke="#69503a" strokeWidth="3"/>)}
              {run.obstacles.map(obstacle => <g key={obstacle.id}><rect x={obstacle.x} y={RUNNER.ground - obstacle.height} width={obstacle.width} height={obstacle.height} rx="3" fill="#e97328"/><path d={`M${obstacle.x + 6} ${RUNNER.ground - obstacle.height + 8}v${obstacle.height - 15}`} stroke="#ffbc72" strokeWidth="3"/></g>)}
              <g data-testid="runner-character" transform={`translate(${RUNNER.x},${RUNNER.ground - RUNNER.height - run.y})`}>
                <rect width="36" height="36" rx="8" fill={run.status === 'over' ? '#ad7560' : '#fff1d8'}/><rect x="7" y="9" width="25" height="15" rx="4" fill="#ff9a3c"/><rect x="22" y="13" width="4" height="5" fill="#24201b"/><path d="M7 36v6m22-6v6" stroke="#fff1d8" strokeWidth="6"/>
              </g>
            </svg>
            {run.status !== 'running' && <div className="runner-overlay"><strong>{overlay[run.status][0]}</strong><span>{overlay[run.status][1]}</span></div>}
          </div>
          <p id="runner-controls" className="games-message">Haz clic en la pista para darle el control. {keyLabel(binding)} o Espacio: saltar · Esc: pausa.</p>
          <div className="runner-actions" onPointerDown={event => event.preventDefault()}><button className="button primary" onClick={jump}>{run.status === 'running' ? <ArrowUp size={17}/> : <Play size={17}/>}{{ready:'Empezar partida',running:'Saltar',paused:'Continuar',over:'Volver a jugar'}[run.status]}</button><button className="button secondary" disabled={run.status !== 'running'} onClick={pause}><Pause size={16}/>Pausar</button><button className="button secondary" onClick={() => {setBest(previous => Math.max(previous, run.score)); setRun(newRun()); stage.current?.focus();}}><RotateCcw size={16}/>Reiniciar</button></div>
          <p className="runner-status-text" role="status">{labels[run.status]}{run.status === 'over' ? ` · ${run.score} puntos. Inténtalo otra vez.` : ''}</p>
        </div>
      </section>
      <aside className="panel games-instructions"><div className="panel-heading"><span className="section-index">02 / TU FLIPPER ES EL MANDO</span><h2>Conecta. Asigna. Salta.</h2></div><div className="panel-body">
        {connected && <div className="runner-port-note"><p>Libera la conexión de diagnóstico antes de abrir Remote por USB.</p><button className="button secondary" disabled={Boolean(busy)} onClick={onDisconnect}><Unplug size={16}/>Liberar conexión USB</button></div>}
        {directConnection && <div className="runner-port-note"><p>Desconecta Marauder y sal del puente USB-UART antes de cambiar a Remote.</p><button className="button secondary" onClick={onNetwork}>Ir a Auditar red</button></div>}
        <ol><li><strong>Abre Remote en el Flipper.</strong> Por cable: Apps → USB → Remote. Por Bluetooth: Apps → Bluetooth → Remote y empareja «Control …» en los ajustes del computador. En Momentum los nombres o carpetas pueden variar; busca USB Remote o BT Remote.</li><li><strong>Elige Keynote.</strong> Este modo envía pulsaciones con los botones físicos. También puedes usar Keyboard. Cierra qFlipper si ocupa la conexión.</li><li><strong>Asigna tu salto.</strong> Pulsa el botón de abajo y luego pulsa brevemente el botón del Flipper que quieras usar, por ejemplo, la flecha derecha.</li><li><strong>Empieza la partida.</strong> Mantén esta ventana activa y pulsa tu botón para saltar. Suelta entre saltos; no hay salto doble.</li></ol>
        <button className="button secondary" onClick={() => {pause(); setLearning(true); setHint('Ahora pulsa un botón del Flipper. Esc cancela.'); capture.current?.focus();}}><Radio size={16}/>Asignar botón</button>
        {learning && <div ref={capture} tabIndex={0} role="region" aria-label="Asignar botón del Flipper" className="runner-capture" onKeyDown={learn}><strong>Esperando tu pulsación…</strong><span>Usa Keynote o Keyboard en el Flipper.</span><button className="text-button" onClick={cancelLearning}>Cancelar</button></div>}
        <p className="games-session-note" role="status">{hint}</p>
        <div className="runner-input"><Radio size={18}/><span>{input.count ? `Entrada recibida: ${keyLabel(input.code)} · ${input.count} pulsaciones` : 'Aún no se ha recibido una pulsación'}</span></div>
        <p className="games-session-note">El navegador recibe teclas y no distingue el Flipper de un teclado. Puedes probar con Espacio. Si no llegan pulsaciones, revisa Remote, el emparejamiento y el foco de esta ventana.</p>
        <p className="games-session-note">La partida se pausa al salir de la pista o cambiar de sección. La mejor marca dura hasta recargar esta página.</p>
        <a href="https://docs.flipper.net/zero/apps/controllers" target="_blank" rel="noreferrer">Guía de Remote de Flipper ↗</a>
      </div></aside>
    </div>
    </div>
  </section>;
}
