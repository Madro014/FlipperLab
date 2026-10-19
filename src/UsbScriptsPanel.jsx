import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  Folder,
  Info,
  Keyboard,
  Link2,
  LoaderCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
  Usb,
  Youtube,
} from 'lucide-react';
import {createSafeBadUsbScript, describeBadUsbScript, SCRIPT_TEMPLATES} from './badusb-script.js';

function badgeColorClass(badge = '') {
  const b = String(badge).toLowerCase();
  if (b.includes('youtube')) return 'red-badge';
  if (b.includes('nota')) return 'green';
  if (b.includes('calc')) return 'amber';
  if (b.includes('power') || b.includes('term')) return 'blue-badge';
  if (b.includes('enlace') || b.includes('web')) return 'purple-badge';
  return 'neutral';
}

function renderBadgeIcon(badge = '') {
  const b = String(badge).toLowerCase();
  if (b.includes('youtube')) return <Youtube size={12} style={{marginRight: '4px', verticalAlign: '-1px'}}/>;
  if (b.includes('nota')) return <FileText size={12} style={{marginRight: '4px', verticalAlign: '-1px'}}/>;
  if (b.includes('calc')) return <Sparkles size={12} style={{marginRight: '4px', verticalAlign: '-1px'}}/>;
  if (b.includes('power') || b.includes('term')) return <Terminal size={12} style={{marginRight: '4px', verticalAlign: '-1px'}}/>;
  if (b.includes('enlace') || b.includes('web')) return <ExternalLink size={12} style={{marginRight: '4px', verticalAlign: '-1px'}}/>;
  return <FileCode2 size={12} style={{marginRight: '4px', verticalAlign: '-1px'}}/>;
}

export default function UsbScriptsPanel({
  active = false,
  connected = false,
  diagnostic = null,
  busy = '',
  onConnect = () => {},
  onSaveScript = async () => null,
  onOpenBadUsb = async () => false,
  onListScripts = async () => [],
  onDeleteScripts = async () => 0,
}) {
  const [template, setTemplate] = useState('notepad');
  const [fileName, setFileName] = useState('demo_notepad');
  const [folderName, setFolderName] = useState('semillero');
  const [message, setMessage] = useState('Hola, este Flipper está escribiendo en el Bloc de notas.');
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [delay, setDelay] = useState(1500);

  const [downloaded, setDownloaded] = useState(false);
  const [localError, setLocalError] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [openedSuccess, setOpenedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  const currentTemplate = SCRIPT_TEMPLATES.find(t => t.id === template) || SCRIPT_TEMPLATES[0];

  const safeName = fileName.trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'mensaje_demo';
  const safeFolder = folderName.trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  const fullPath = `/ext/badusb/${safeFolder ? safeFolder + '/' : ''}${safeName}.txt`;

  const {script, validationError} = useMemo(() => {
    try {
      const text = createSafeBadUsbScript({
        template,
        message,
        url,
        delay: Number(delay),
      });
      return {script: text, validationError: ''};
    } catch (err) {
      return {script: '', validationError: err.message || 'Verifica los campos requeridos.'};
    }
  }, [template, message, url, delay]);

  function resetFeedback() {
    setSavedSuccess(false);
    setOpenedSuccess(false);
    setLocalError('');
    setDownloaded(false);
  }

  function handleTemplateChange(newTemplateId) {
    const nextT = SCRIPT_TEMPLATES.find(t => t.id === newTemplateId);
    if (!nextT) return;
    setTemplate(newTemplateId);

    // Sugerir nombre de archivo si aún coincide con alguna sugerencia previa
    const isPreviousSuggestion = SCRIPT_TEMPLATES.some(t => t.suggestedName === fileName);
    if (isPreviousSuggestion && nextT.suggestedName) {
      setFileName(nextT.suggestedName);
    }

    if (nextT.defaultMessage) {
      setMessage(nextT.defaultMessage);
    }
    if (nextT.defaultUrl) {
      setUrl(nextT.defaultUrl);
    }
    resetFeedback();
  }

  function download() {
    setLocalError('');
    setDownloaded(false);
    try {
      const content = createSafeBadUsbScript({
        template,
        message,
        url,
        delay: Number(delay),
      });
      const blobUrl = URL.createObjectURL(new Blob([content], {type: 'text/plain;charset=utf-8'}));
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `${safeName}.txt`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      setDownloaded(true);
    } catch (e) {
      setLocalError(e.message);
    }
  }

  async function handleSave() {
    setLocalError('');
    setSavedSuccess(false);
    setOpenedSuccess(false);
    if (!connected) {
      setLocalError('Conecta el Flipper por USB para guardar el script directamente en la tarjeta microSD.');
      return null;
    }
    if (!script) {
      setLocalError('Completa los campos requeridos para generar el script antes de guardarlo.');
      return null;
    }
    setSaving(true);
    setSaveProgress(0);
    try {
      const result = await onSaveScript({
        folder: safeFolder,
        fileName: safeName,
        text: script,
      }, val => setSaveProgress(Math.round(val * 100)));
      if (result) {
        setSavedPath(result.path);
        setSavedSuccess(true);
        refreshSavedScripts(result.folder || safeFolder);
        return result.path;
      }
    } catch (e) {
      setLocalError(e.message || 'Error al guardar el script en el Flipper.');
    } finally {
      setSaving(false);
    }
    return null;
  }

  async function handleOpen() {
    setLocalError('');
    setOpenedSuccess(false);
    if (!connected) {
      setLocalError('Conecta el Flipper por USB antes de abrir Bad USB.');
      return;
    }
    setOpening(true);
    try {
      let target = savedPath;
      if (!savedSuccess || !target) {
        target = await handleSave();
        if (!target) return;
      }
      const ok = await onOpenBadUsb(target);
      if (ok) {
        setOpenedSuccess(true);
      }
    } catch (e) {
      setLocalError(e.message || 'Error al abrir Bad USB en el Flipper.');
    } finally {
      setOpening(false);
    }
  }

  const [savedScripts, setSavedScripts] = useState([]);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [managerError, setManagerError] = useState('');
  const [managerSuccess, setManagerSuccess] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [openingScriptPath, setOpeningScriptPath] = useState('');

  const onListRef = useRef(onListScripts);
  onListRef.current = onListScripts;

  const loadingRef = useRef(false);
  const wasActiveAndConnected = useRef(false);

  const refreshSavedScripts = useCallback(async (targetFolder) => {
    if (!connected || !active) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingScripts(true);
    setManagerError('');
    try {
      const folderToUse = targetFolder || safeFolder || 'semillero';
      const list = await onListRef.current(folderToUse);
      setSavedScripts(list || []);
      setSelectedPaths(new Set());
    } catch (e) {
      setManagerError(e.message || 'Error al listar los scripts de la microSD.');
    } finally {
      loadingRef.current = false;
      setLoadingScripts(false);
    }
  }, [connected, active, safeFolder]);

  useEffect(() => {
    const isNowActiveAndConnected = Boolean(connected && active);
    if (isNowActiveAndConnected && !wasActiveAndConnected.current) {
      wasActiveAndConnected.current = true;
      refreshSavedScripts();
    } else if (!isNowActiveAndConnected) {
      wasActiveAndConnected.current = false;
      if (!connected) {
        setSavedScripts([]);
        setSelectedPaths(new Set());
        setConfirmDelete(null);
        setManagerSuccess('');
        setManagerError('');
      }
    }
  }, [connected, active, refreshSavedScripts]);

  function toggleSelectPath(path) {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedPaths.size === savedScripts.length && savedScripts.length > 0) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(savedScripts.map(s => s.path)));
    }
  }

  function requestDeleteSelected() {
    if (selectedPaths.size === 0) return;
    const paths = Array.from(selectedPaths);
    const names = savedScripts.filter(s => selectedPaths.has(s.path)).map(s => s.name);
    setConfirmDelete({paths, names});
    setManagerSuccess('');
    setManagerError('');
  }

  function requestDeleteSingle(scriptItem) {
    setConfirmDelete({paths: [scriptItem.path], names: [scriptItem.name]});
    setManagerSuccess('');
    setManagerError('');
  }

  async function executeDelete() {
    if (!confirmDelete || !confirmDelete.paths.length) return;
    setDeleting(true);
    setManagerError('');
    setManagerSuccess('');
    try {
      const count = await onDeleteScripts(confirmDelete.paths);
      setManagerSuccess(`Se eliminaron ${count} script(s) correctamente de la tarjeta microSD.`);
      setConfirmDelete(null);
      await refreshSavedScripts();
    } catch (e) {
      setManagerError(e.message || 'Error al eliminar los scripts del Flipper.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleLaunchFromManager(filePath) {
    setOpeningScriptPath(filePath);
    setManagerError('');
    try {
      await onOpenBadUsb(filePath);
      setManagerSuccess(`Script ${filePath.split('/').pop()} abierto en el Flipper y listo para lanzar.`);
    } catch (e) {
      setManagerError(e.message || 'Error al abrir el script en el Flipper.');
    } finally {
      setOpeningScriptPath('');
    }
  }

  return (
    <div className="usb-scripts-tool">
      <section className="panel">
        <div className="panel-heading">
          <span className="section-index">TECLADO USB · BADUSB</span>
          <h2><Keyboard size={21}/> Crea una demostración segura.</h2>
          <p>Elige una acción autorizada, guarda el script en la microSD del Flipper y ábrelo listo para lanzar.</p>
        </div>
        <div className="panel-body">
          <div className="note amber">
            <Info size={18}/>
            <p>
              <strong>Al conectar el Flipper no se ejecuta el script automáticamente.</strong> Bad USB requiere abrir la aplicación en el Flipper, elegir el archivo y pulsar Run. Esa confirmación evita que un script empiece a escribir solo al conectar el cable.{' '}
              <a href="https://docs.flipper.net/zero/bad-usb" target="_blank" rel="noreferrer">Guía oficial de Bad USB</a>
            </p>
          </div>

          <div className="usb-script-grid">
            <div className="usb-script-form">
              <label htmlFor="usb-script-name">Nombre del archivo</label>
              <input
                id="usb-script-name"
                value={fileName}
                maxLength={40}
                disabled={saving || opening || Boolean(busy)}
                onChange={event => {
                  setFileName(event.target.value);
                  resetFeedback();
                }}
              />
              <small className="field-help">Se guardará como <code>{safeName}.txt</code>.</small>

              <label htmlFor="usb-script-folder">Nombre de la carpeta en el Flipper</label>
              <div className="input-prefix">
                <span>/badusb/</span>
                <input
                  id="usb-script-folder"
                  placeholder="semillero (o vacío para raíz)"
                  value={folderName}
                  maxLength={32}
                  disabled={saving || opening || Boolean(busy)}
                  onChange={event => {
                    setFolderName(event.target.value);
                    resetFeedback();
                  }}
                />
              </div>
              <small className="field-help">
                Destino en la microSD: <code>{fullPath}</code>
              </small>

              <label htmlFor="usb-script-template">Acción que realizará el Flipper</label>
              <div className="usb-script-select">
                <select
                  id="usb-script-template"
                  value={template}
                  disabled={saving || opening || Boolean(busy)}
                  onChange={event => handleTemplateChange(event.target.value)}
                >
                  {SCRIPT_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown size={18} aria-hidden="true"/>
              </div>
              <small className="field-help">{currentTemplate.description}</small>

              {currentTemplate.requiresUrl && (
                <div className="conditional-field-group">
                  <label htmlFor="usb-script-url">{currentTemplate.urlLabel}</label>
                  <input
                    id="usb-script-url"
                    value={url}
                    maxLength={500}
                    placeholder={currentTemplate.urlPlaceholder}
                    disabled={saving || opening || Boolean(busy)}
                    onChange={event => {
                      setUrl(event.target.value.replace(/[\r\n\x00-\x1f\x7f]/g, ''));
                      resetFeedback();
                    }}
                  />
                  <small className="field-help">
                    {template === 'youtube'
                      ? 'Puedes ingresar un link directo (https://www.youtube.com/watch?v=...) o un término de búsqueda. El campo de texto libre se omite para esta acción.'
                      : 'Dirección web que se abrirá en el navegador por defecto.'}
                  </small>
                  {validationError && (
                    <small className="field-help" style={{color: '#f59e0b', fontWeight: 600}}>
                      ⚠️ {validationError}
                    </small>
                  )}
                </div>
              )}

              {currentTemplate.requiresText && (
                <div className="conditional-field-group">
                  <label htmlFor="usb-script-message">{currentTemplate.textLabel || 'Texto que escribirá el Flipper'}</label>
                  <input
                    id="usb-script-message"
                    value={message}
                    maxLength={160}
                    disabled={saving || opening || Boolean(busy)}
                    onChange={event => {
                      setMessage(event.target.value.replace(/[\r\n\x00-\x1f\x7f]/g, ''));
                      resetFeedback();
                    }}
                  />
                  <small className="field-help">Una sola línea, máximo 160 caracteres. No se agrega Enter ni órdenes del sistema.</small>
                  {validationError && (
                    <small className="field-help" style={{color: '#f59e0b', fontWeight: 600}}>
                      ⚠️ {validationError}
                    </small>
                  )}
                </div>
              )}

              {!currentTemplate.requiresText && !currentTemplate.requiresUrl && (
                <div className="note" style={{marginTop:'8px', marginBottom:'4px'}}>
                  <Info size={16}/>
                  <p>Esta demostración abre directamente la aplicación mediante el comando <code>calc</code> de Windows. No requiere texto adicional ni modifica archivos.</p>
                </div>
              )}

              <label htmlFor="usb-script-delay">Espera al empezar</label>
              <div className="usb-script-select">
                <select
                  id="usb-script-delay"
                  value={delay}
                  disabled={saving || opening || Boolean(busy)}
                  onChange={event => {
                    setDelay(Number(event.target.value));
                    resetFeedback();
                  }}
                >
                  {[1000, 1500, 2000, 3000, 5000, 10000].map(value => (
                    <option key={value} value={value}>{value / 1000} s</option>
                  ))}
                </select>
                <ChevronDown size={18} aria-hidden="true"/>
              </div>
              <small className="field-help">Da tiempo al computador para reconocer el teclado USB antes de enviar pulsaciones.</small>

              <div className="usb-script-actions">
                {connected ? (
                  <>
                    <button
                      className="button primary"
                      disabled={!script || saving || opening || Boolean(busy)}
                      onClick={handleSave}
                      title={!script ? (validationError || 'Completa los datos para habilitar') : 'Guardar script en la microSD del Flipper'}
                    >
                      {saving ? <LoaderCircle size={16} className="spin"/> : <Upload size={16}/>}
                      {saving ? `Guardando… ${saveProgress}%` : 'Guardar en el Flipper'}
                    </button>
                    <button
                      className="button primary ready-launch-btn"
                      disabled={!script || saving || opening || Boolean(busy)}
                      onClick={handleOpen}
                      title={!script ? (validationError || 'Completa los datos para habilitar') : 'Guardar y abrir Bad USB en la pantalla del Flipper'}
                    >
                      {opening ? <LoaderCircle size={16} className="spin"/> : <Play size={16}/>}
                      {opening ? 'Abriendo Bad USB…' : 'Abrir en el Flipper (Listo para lanzar)'}
                    </button>
                  </>
                ) : (
                  <div className="usb-script-connect-box">
                    <button
                      className="button primary"
                      disabled={Boolean(busy)}
                      onClick={onConnect}
                    >
                      <Link2 size={16}/> Conectar Flipper para guardar y lanzar
                    </button>
                    <small className="field-help">Conéctalo por USB para guardar el script y abrir Bad USB directamente.</small>
                  </div>
                )}
                <button
                  className="button secondary"
                  disabled={!script}
                  onClick={download}
                  title={!script ? (validationError || 'Completa los datos para habilitar') : 'Descargar archivo .txt'}
                >
                  <Download size={16}/> Descargar script .txt
                </button>
              </div>

              {saving && <progress aria-label="Progreso de guardado" max="100" value={saveProgress}/>}
              {localError && <p className="tool-error" role="alert">{localError}</p>}
              {downloaded && <p className="saved-message" role="status"><CheckCircle2 size={15}/> Archivo <code>{safeName}.txt</code> descargado en tu computador.</p>}
              {savedSuccess && !openedSuccess && (
                <p className="saved-message" role="status">
                  <CheckCircle2 size={15}/> Script guardado y verificado en la microSD: <code>{savedPath || fullPath}</code>. Pulsa el botón de abrir para mostrarlo en el Flipper.
                </p>
              )}
              {openedSuccess && (
                <div className="loaded-success" role="status">
                  <CheckCircle2 size={21}/>
                  <div>
                    <strong>¡Bad USB abierto en la pantalla del Flipper!</strong>
                    <span>
                      Archivo <code>{safeName}.txt</code> cargado en <code>{savedPath || fullPath}</code> y listo para lanzar.<br/>
                      Conecta el Flipper al equipo objetivo y pulsa <b>Run</b> en el Flipper.
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="usb-script-preview">
              <div>
                <div className="preview-path-header">
                  <span>VISTA PREVIA</span>
                  <span className="sd-path-badge"><Folder size={12}/> {fullPath}</span>
                </div>
                <code>{script || (validationError ? `⚠️ ${validationError}` : 'Completa los datos requeridos para generar la vista previa.')}</code>
              </div>
              <p>
                <ShieldCheck size={16}/> El generador utiliza comandos Duckyscript seguros (<code>REM</code>, <code>DELAY</code>, <code>GUI r</code>, <code>STRING</code>, <code>ENTER</code>) diseñados para demostraciones educativas sin riesgo para el sistema.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel usb-scripts-manager">
        <div className="panel-heading">
          <span className="section-index">MICROSD · GESTIÓN Y LIMPIEZA</span>
          <h2><Trash2 size={20}/> Limpiar y administrar scripts en el Flipper</h2>
          <p>
            Revisa los scripts almacenados en <code>/ext/badusb/{safeFolder || 'semillero'}</code>, conoce qué hace cada uno y elimina los que ya no necesites.
          </p>
        </div>
        <div className="panel-body">
          {!connected ? (
            <div className="usb-manager-disconnected">
              <Info size={18}/>
              <p>Conecta el Flipper Zero por USB para listar, inspeccionar y limpiar los scripts guardados en la tarjeta microSD.</p>
              <button className="button primary" disabled={Boolean(busy)} onClick={onConnect}>
                <Link2 size={16}/> Conectar Flipper
              </button>
            </div>
          ) : (
            <>
              <div className="usb-manager-toolbar">
                <div className="manager-toolbar-info">
                  <span className="sd-path-badge"><Folder size={12}/> /ext/badusb/{safeFolder || 'semillero'}/</span>
                  <button
                    className="text-button"
                    disabled={loadingScripts || deleting || Boolean(busy)}
                    onClick={() => refreshSavedScripts()}
                    title="Volver a leer la carpeta de la microSD"
                  >
                    <RefreshCw size={13} className={loadingScripts ? 'spin' : ''}/>
                    {loadingScripts ? 'Consultando…' : 'Refrescar lista'}
                  </button>
                </div>

                {savedScripts.length > 0 && (
                  <div className="manager-toolbar-actions">
                    <label className="checkbox-label manager-select-all">
                      <input
                        type="checkbox"
                        checked={selectedPaths.size === savedScripts.length && savedScripts.length > 0}
                        onChange={toggleSelectAll}
                        disabled={deleting || Boolean(busy)}
                      />
                      <span>Seleccionar todos ({selectedPaths.size}/{savedScripts.length})</span>
                    </label>

                    <button
                      className="button danger compact-btn"
                      disabled={selectedPaths.size === 0 || deleting || Boolean(busy)}
                      onClick={requestDeleteSelected}
                    >
                      <Trash2 size={14}/>
                      Eliminar seleccionados ({selectedPaths.size})
                    </button>
                  </div>
                )}
              </div>

              {confirmDelete && (
                <div className="confirm-delete-banner" role="alert">
                  <AlertTriangle size={20} className="warning-icon"/>
                  <div className="confirm-delete-content">
                    <strong>¿Confirmas la eliminación de {confirmDelete.paths.length} script(s)?</strong>
                    <p>
                      Se eliminarán permanentemente de la tarjeta microSD del Flipper:
                      {' '}<b>{confirmDelete.names.join(', ')}</b>. Esta acción no se puede deshacer.
                    </p>
                    <div className="confirm-delete-buttons">
                      <button
                        className="button danger"
                        disabled={deleting}
                        onClick={executeDelete}
                      >
                        {deleting ? <LoaderCircle size={15} className="spin"/> : <Trash2 size={15}/>}
                        {deleting ? 'Eliminando…' : 'Sí, eliminar del Flipper'}
                      </button>
                      <button
                        className="button secondary"
                        disabled={deleting}
                        onClick={() => setConfirmDelete(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {managerError && <p className="tool-error" role="alert">{managerError}</p>}
              {managerSuccess && (
                <p className="saved-message" role="status">
                  <CheckCircle2 size={16}/> {managerSuccess}
                </p>
              )}

              {loadingScripts && savedScripts.length === 0 ? (
                <div className="manager-loading">
                  <LoaderCircle size={22} className="spin"/>
                  <span>Leyendo scripts en la tarjeta microSD…</span>
                </div>
              ) : savedScripts.length === 0 ? (
                <div className="manager-empty">
                  <Folder size={32}/>
                  <strong>No hay scripts en /ext/badusb/{safeFolder || 'semillero'}</strong>
                  <p>Los scripts que generes y guardes arriba se almacenarán aquí para que puedas gestionarlos y probarlos.</p>
                </div>
              ) : (
                <div className="saved-scripts-list">
                  {savedScripts.map(item => {
                    const isSelected = selectedPaths.has(item.path);
                    const desc = item.description || {};
                    return (
                      <div key={item.path} className={`script-item-card ${isSelected ? 'selected' : ''}`}>
                        <div className="script-card-header">
                          <label className="script-checkbox-wrapper">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectPath(item.path)}
                              disabled={deleting || Boolean(busy)}
                            />
                            <span className="script-name">{item.name}</span>
                          </label>

                          <div className="script-header-badges">
                            <span className={`badge ${badgeColorClass(desc.badge)}`}>
                              {renderBadgeIcon(desc.badge)}
                              {desc.badge || 'Script'}
                            </span>
                            {item.size != null && (
                              <span className="script-size-tag">{item.size} bytes</span>
                            )}
                          </div>
                        </div>

                        <div className="script-card-body">
                          <p className="script-action-summary">
                            <strong>Qué hace:</strong> {desc.summary || 'Instrucciones Duckyscript para Flipper Zero.'}
                          </p>
                          {desc.details && (
                            <div className="script-action-details">
                              <code>{desc.details}</code>
                            </div>
                          )}
                        </div>

                        <div className="script-card-footer">
                          <span className="script-file-path">{item.path}</span>
                          <div className="script-card-buttons">
                            <button
                              className="button secondary compact-btn"
                              disabled={Boolean(busy) || deleting || openingScriptPath === item.path}
                              onClick={() => handleLaunchFromManager(item.path)}
                              title="Abrir este script en la pantalla del Flipper listo para lanzar"
                            >
                              {openingScriptPath === item.path ? (
                                <LoaderCircle size={14} className="spin"/>
                              ) : (
                                <Play size={14}/>
                              )}
                              {openingScriptPath === item.path ? 'Abriendo…' : 'Abrir en Flipper'}
                            </button>
                            <button
                              className="button text-danger compact-btn"
                              disabled={Boolean(busy) || deleting}
                              onClick={() => requestDeleteSingle(item)}
                              title="Eliminar este script de la microSD"
                            >
                              <Trash2 size={14}/>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="panel usb-script-steps">
        <div className="panel-heading">
          <span className="section-index">GUÍA · FLUJO AUTOMÁTICO Y MANUAL</span>
          <h2>Del script al lanzamiento en el Flipper.</h2>
          <p>Flipper Lab transfiere el archivo y abre la aplicación Bad USB lista con tu payload.</p>
        </div>
        <div className="panel-body">
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Elige la acción y configura los campos</strong>
                <p>Selecciona si deseas abrir Bloc de notas y escribir, abrir YouTube y buscar un video, abrir la calculadora o escribir en el campo activo.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Guardado automático por USB</strong>
                <p>Pulsa <b>Guardar en el Flipper</b> para escribirlo directamente en <code>{fullPath}</code> y verificar su contenido por lectura en la microSD.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Lanzamiento directo</strong>
                <p>Pulsa <b>Abrir en el Flipper (Listo para lanzar)</b>: la aplicación Bad USB se abrirá en la pantalla del Flipper con tu script ya seleccionado.</p>
              </div>
            </li>
            <li>
              <span>4</span>
              <div>
                <strong>Ejecuta en tu equipo</strong>
                <p>Si la acción escribe texto en un editor (ej. Bloc de notas), asegúrate de que la ventana esté lista y pulsa <b>Run</b> en el Flipper.</p>
              </div>
            </li>
          </ol>
          <div className="note">
            <Usb size={17}/>
            <p>Este ejemplo no corre solo al conectar el cable; requiere tu confirmación manual en el Flipper. Úsalo exclusivamente en equipos propios autorizados.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
