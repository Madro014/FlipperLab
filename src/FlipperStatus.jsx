import React from 'react';
import flipperIcon from './assets/flipper-lab-256.png?inline';
import './flipper-status.css';

const frameCount = 6;

export function FlipperAnimation({size = 'normal', label = 'El delfín sube entre burbujas'}) {
  return <div className={`flipper-animation flipper-animation--${size}`} role="img" aria-label={label}>
    <div className="flipper-animation__sprite" aria-hidden="true">
      {Array.from({length: frameCount}, (_, frame) => <img key={frame} src={flipperIcon} alt="" className="flipper-animation__frame" style={{'--frame': frame}} draggable="false"/>)}
    </div>
    <span className="flipper-animation__bubble flipper-animation__bubble--one" aria-hidden="true"/>
    <span className="flipper-animation__bubble flipper-animation__bubble--two" aria-hidden="true"/>
    <span className="flipper-animation__bubble flipper-animation__bubble--three" aria-hidden="true"/>
  </div>;
}

export function LoadingOverlay({label = 'Preparando el laboratorio…', progress}) {
  return <div className="flipper-loading" role="status" aria-live="polite" aria-label={label}>
    <div className="flipper-loading__card">
      <FlipperAnimation label="Delfín de Flipper Lab flotando entre burbujas"/>
      <strong>{label}</strong>
      {Number.isFinite(progress) && <div className="flipper-loading__progress" aria-label={`Progreso: ${progress}%`}><span style={{width: `${progress}%`}}/></div>}
      <small>FLIPPER LAB</small>
    </div>
  </div>;
}

export function OfflineNotice() {
  return <section className="flipper-offline" role="status">
    <FlipperAnimation size="small" label="Delfín flotando mientras no hay internet"/>
    <div><strong>Sin conexión a internet</strong><p>El laboratorio local sigue disponible. Las funciones que necesitan internet pueden no cargar.</p></div>
  </section>;
}

export function NotFoundPage() {
  return <main className="flipper-status-page">
    <div className="flipper-status-page__card">
      <FlipperAnimation size="large" label="Delfín de Flipper Lab flotando entre burbujas"/>
      <span>ERROR 404</span>
      <h1>No encontramos esta página</h1>
      <p>Puede que el enlace haya cambiado. Vuelve al laboratorio para continuar.</p>
      <a className="button primary" href="/">Volver al laboratorio</a>
    </div>
  </main>;
}
