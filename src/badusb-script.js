const MIN_DELAY = 1000, MAX_DELAY = 10000, MAX_MESSAGE_LENGTH = 160, MAX_URL_LENGTH = 500;

export const SCRIPT_TEMPLATES = [
  {
    id: 'notepad',
    label: 'Abrir Bloc de notas y escribir en este',
    description: 'Presiona Win+R, abre notepad.exe y escribe el texto automáticamente.',
    requiresText: true,
    requiresUrl: false,
    textLabel: 'Texto que escribirá en el Bloc de notas',
    defaultMessage: 'Hola, este Flipper está escribiendo en el Bloc de notas.',
    suggestedName: 'demo_notepad',
  },
  {
    id: 'youtube',
    label: 'Abrir YouTube y buscar / reproducir video',
    description: 'Abre el navegador en el video o término de búsqueda de YouTube indicado.',
    requiresText: false,
    requiresUrl: true,
    urlLabel: 'Enlace de YouTube o término de búsqueda',
    urlPlaceholder: 'https://www.youtube.com/watch?v=... o nombre del video',
    defaultUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    suggestedName: 'demo_youtube',
  },
  {
    id: 'text_only',
    label: 'Escribir solo en el campo activo (modo básico)',
    description: 'Escribe una línea directamente donde esté el cursor (sin abrir aplicaciones).',
    requiresText: true,
    requiresUrl: false,
    textLabel: 'Texto que escribirá el Flipper',
    defaultMessage: 'Hola, este Flipper está escribiendo una prueba autorizada.',
    suggestedName: 'mensaje_demo',
  },
  {
    id: 'calc',
    label: 'Abrir la Calculadora (demostración PoC clásica)',
    description: 'Abre calc.exe sin escribir texto ni alterar ningún archivo del sistema.',
    requiresText: false,
    requiresUrl: false,
    suggestedName: 'demo_calc',
  },
  {
    id: 'custom_url',
    label: 'Abrir página web en el navegador',
    description: 'Abre la dirección web que indiques en el navegador predeterminado.',
    requiresText: false,
    requiresUrl: true,
    urlLabel: 'Dirección web (URL)',
    urlPlaceholder: 'https://www.compensar.com',
    defaultUrl: 'https://www.compensar.com',
    suggestedName: 'demo_web',
  },
  {
    id: 'terminal_greeting',
    label: 'Abrir PowerShell con saludo seguro',
    description: 'Abre PowerShell y muestra un mensaje informativo en color verde.',
    requiresText: true,
    requiresUrl: false,
    textLabel: 'Mensaje para mostrar en la terminal',
    defaultMessage: 'Semillero Flipper Lab - Demostración autorizada',
    suggestedName: 'demo_terminal',
  },
];

// Flipper Lab exports benign authorized demonstrations.
export function createSafeBadUsbScript(optionsOrMessage, delayArg = 1500) {
  let template = 'text_only';
  let message = '';
  let url = '';
  let delay = 1500;

  if (typeof optionsOrMessage === 'string') {
    message = optionsOrMessage;
    delay = delayArg;
  } else if (optionsOrMessage && typeof optionsOrMessage === 'object') {
    template = optionsOrMessage.template || 'text_only';
    message = optionsOrMessage.message || '';
    url = optionsOrMessage.url || '';
    delay = optionsOrMessage.delay ?? 1500;
  }

  if (!Number.isInteger(delay) || delay < MIN_DELAY || delay > MAX_DELAY) {
    throw new Error('El retardo debe estar entre 1000 y 10000 ms.');
  }

  if (template === 'text_only') {
    if (typeof message !== 'string' || !message.trim()) throw new Error('Escribe el texto de demostración.');
    if (message.length > MAX_MESSAGE_LENGTH || /[\r\n\x00-\x1f\x7f]/.test(message)) {
      throw new Error('Usa una sola línea de texto, sin controles, de hasta 160 caracteres.');
    }
    return [
      'REM Flipper Lab - demostración de escritura autorizada',
      'REM Escribe una línea en el campo activo; no pulsa Enter ni ejecuta comandos.',
      `DELAY ${delay}`,
      `STRING ${message.trim()}`,
      ''
    ].join('\n');
  }

  if (template === 'notepad') {
    if (typeof message !== 'string' || !message.trim()) throw new Error('Escribe el texto para el Bloc de notas.');
    if (message.length > MAX_MESSAGE_LENGTH || /[\r\n\x00-\x1f\x7f]/.test(message)) {
      throw new Error('Usa una sola línea de texto, sin controles, de hasta 160 caracteres.');
    }
    return [
      'REM Flipper Lab - Abrir Bloc de notas y escribir',
      'REM Abre el Bloc de notas con Win+R y escribe el texto.',
      `DELAY ${delay}`,
      'GUI r',
      'DELAY 500',
      'STRING notepad',
      'ENTER',
      'DELAY 1000',
      `STRING ${message.trim()}`,
      ''
    ].join('\n');
  }

  if (template === 'youtube') {
    if (typeof url !== 'string' || !url.trim()) throw new Error('Ingresa un enlace de YouTube o término de búsqueda.');
    const cleanUrl = url.trim();
    if (cleanUrl.length > MAX_URL_LENGTH || /[\r\n\x00-\x1f\x7f"|]/.test(cleanUrl)) {
      throw new Error('El enlace o búsqueda no debe contener saltos de línea ni comillas.');
    }
    let target = cleanUrl;
    if (!/^https?:\/\//i.test(target)) {
      if (/^([a-z0-9-]+\.)?youtube\.com|youtu\.be/i.test(target)) {
        target = 'https://' + target;
      } else {
        target = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanUrl)}`;
      }
    }
    return [
      'REM Flipper Lab - Abrir YouTube en navegador',
      'REM Abre el navegador predeterminado mediante el diálogo Ejecutar.',
      `DELAY ${delay}`,
      'GUI r',
      'DELAY 500',
      `STRING ${target}`,
      'ENTER',
      ''
    ].join('\n');
  }

  if (template === 'calc') {
    return [
      'REM Flipper Lab - Demostración PoC Calculadora',
      'REM Ejecuta calc.exe sin modificar archivos ni escribir texto.',
      `DELAY ${delay}`,
      'GUI r',
      'DELAY 500',
      'STRING calc',
      'ENTER',
      ''
    ].join('\n');
  }

  if (template === 'custom_url') {
    if (typeof url !== 'string' || !url.trim()) throw new Error('Ingresa la dirección web URL.');
    let cleanUrl = url.trim();
    if (cleanUrl.length > MAX_URL_LENGTH || /[\r\n\x00-\x1f\x7f"|]/.test(cleanUrl)) {
      throw new Error('La URL no debe contener saltos de línea ni comillas.');
    }
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }
    return [
      'REM Flipper Lab - Abrir enlace web',
      'REM Abre la dirección web en el navegador predeterminado.',
      `DELAY ${delay}`,
      'GUI r',
      'DELAY 500',
      `STRING ${cleanUrl}`,
      'ENTER',
      ''
    ].join('\n');
  }

  if (template === 'terminal_greeting') {
    if (typeof message !== 'string' || !message.trim()) throw new Error('Escribe el mensaje para la terminal.');
    if (message.length > MAX_MESSAGE_LENGTH || /[\r\n\x00-\x1f\x7f"&|;`]/.test(message)) {
      throw new Error('Usa un mensaje seguro de una sola línea sin comillas ni caracteres de control.');
    }
    const safeText = message.trim().replace(/'/g, "''").replace(/\$/g, '');
    return [
      'REM Flipper Lab - Saludo en PowerShell',
      'REM Abre PowerShell y muestra un mensaje informativo en pantalla.',
      `DELAY ${delay}`,
      'GUI r',
      'DELAY 500',
      `STRING powershell -NoExit -Command "Write-Host '${safeText}' -ForegroundColor Green"`,
      'ENTER',
      ''
    ].join('\n');
  }

  throw new Error('Plantilla de script no reconocida.');
}

export function describeBadUsbScript(content, fileName = '') {
  if (!content || typeof content !== 'string' || !content.trim()) {
    if (fileName) {
      const lower = fileName.toLowerCase();
      if (lower.includes('youtube')) return {action: 'Abrir YouTube en navegador', badge: 'YouTube', summary: 'Abre YouTube en el navegador para reproducir o buscar un video.', details: fileName};
      if (lower.includes('notepad')) return {action: 'Abrir Bloc de notas', badge: 'Bloc de notas', summary: 'Abre notepad.exe mediante Win+R y escribe texto.', details: fileName};
      if (lower.includes('calc')) return {action: 'Abrir Calculadora (PoC)', badge: 'Calculadora', summary: 'Abre calc.exe como demostración PoC.', details: 'Ejecuta calc.exe vía Win+R'};
      if (lower.includes('power') || lower.includes('term')) return {action: 'Abrir PowerShell', badge: 'PowerShell', summary: 'Abre PowerShell y muestra un mensaje en pantalla.', details: fileName};
      if (lower.includes('web')) return {action: 'Abrir enlace web', badge: 'Enlace Web', summary: 'Abre el navegador predeterminado en una dirección web.', details: fileName};
    }
    return {
      action: fileName ? 'Archivo de script' : 'Archivo vacío',
      badge: fileName ? 'Script' : 'Vacío',
      summary: fileName ? 'Script BadUSB almacenado en la tarjeta microSD.' : 'El script está vacío o no contiene instrucciones legibles.',
      details: fileName || '',
    };
  }

  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const cmdLines = lines.filter(l => !l.toUpperCase().startsWith('REM'));

  // Check YouTube
  const ytMatch = cmdLines.find(l => /youtube\.com|youtu\.be/i.test(l));
  if (ytMatch) {
    const urlMatch = ytMatch.match(/https?:\/\/[^\s]+/i);
    const targetUrl = urlMatch ? urlMatch[0] : ytMatch.replace(/^STRING\s+/i, '');
    let searchDetail = targetUrl;
    if (targetUrl.includes('search_query=')) {
      try {
        const u = new URL(targetUrl);
        const query = u.searchParams.get('search_query');
        if (query) searchDetail = `Búsqueda: "${query}"`;
      } catch {}
    }
    return {
      action: 'Abrir YouTube y reproducir / buscar video',
      badge: 'YouTube',
      summary: 'Abre el navegador predeterminado en YouTube y carga el video o la búsqueda configurada.',
      details: searchDetail,
    };
  }

  // Check Notepad
  const notepadMatch = cmdLines.find(l => /^STRING\s+notepad(?:\.exe)?$/i.test(l));
  if (notepadMatch) {
    const stringLines = cmdLines.filter(l => l.toUpperCase().startsWith('STRING') && !/^STRING\s+notepad(?:\.exe)?$/i.test(l));
    const typedText = stringLines.map(l => l.replace(/^STRING\s+/i, '')).join(' ');
    return {
      action: 'Abrir Bloc de notas y escribir texto',
      badge: 'Bloc de notas',
      summary: 'Abre notepad.exe mediante el diálogo Ejecutar (Win+R) y escribe el texto.',
      details: typedText ? `Escribe: "${typedText}"` : 'Sin texto especificado',
    };
  }

  // Check Calculator
  const calcMatch = cmdLines.find(l => /^STRING\s+calc(?:\.exe)?$/i.test(l));
  if (calcMatch) {
    return {
      action: 'Abrir Calculadora (PoC clásica)',
      badge: 'Calculadora',
      summary: 'Abre la Calculadora de Windows (calc.exe) sin modificar archivos ni alterar el sistema.',
      details: 'Ejecuta calc.exe vía Win+R',
    };
  }

  // Check PowerShell
  const psMatch = cmdLines.find(l => /powershell/i.test(l));
  if (psMatch) {
    const msgMatch = psMatch.match(/Write-Host\s+['"]([^'"]+)['"]/i);
    const msg = msgMatch ? msgMatch[1] : '';
    return {
      action: 'Abrir PowerShell con mensaje',
      badge: 'PowerShell',
      summary: 'Inicia la consola PowerShell y muestra un mensaje informativo en pantalla.',
      details: msg ? `Mensaje: "${msg}"` : psMatch.replace(/^STRING\s+/i, ''),
    };
  }

  // Check Custom Web URL
  const httpMatch = cmdLines.find(l => /^STRING\s+https?:\/\//i.test(l));
  if (httpMatch) {
    const url = httpMatch.replace(/^STRING\s+/i, '');
    return {
      action: 'Abrir enlace web en el navegador',
      badge: 'Enlace Web',
      summary: 'Abre la dirección web configurada en el navegador predeterminado del sistema.',
      details: url,
    };
  }

  // Check Text Only (no GUI r, just STRING)
  const stringOnly = cmdLines.filter(l => l.toUpperCase().startsWith('STRING'));
  if (stringOnly.length > 0 && !cmdLines.some(l => /GUI\s+r/i.test(l))) {
    const text = stringOnly.map(l => l.replace(/^STRING\s+/i, '')).join(' ');
    return {
      action: 'Escribir texto en el campo activo',
      badge: 'Texto directo',
      summary: 'Simula pulsaciones de teclado directamente en el campo donde se encuentre el cursor.',
      details: `Escribe: "${text.slice(0, 100)}${text.length > 100 ? '…' : ''}"`,
    };
  }

  // Fallback: Check REM header if available
  const remLines = lines.filter(l => l.toUpperCase().startsWith('REM'));
  const headerRem = remLines.find(l => /flipper lab\s*-\s*/i.test(l));
  let labLabel = '';
  if (headerRem) {
    labLabel = headerRem.replace(/^REM\s+flipper lab\s*-\s*/i, '').trim();
  }

  return {
    action: labLabel || 'Script Duckyscript personalizado',
    badge: 'BadUSB',
    summary: labLabel ? `Demostración: ${labLabel}` : `Script con ${lines.length} líneas de instrucciones Duckyscript.`,
    details: `${lines.filter(l => !l.startsWith('REM')).length} comandos ejecutables`,
  };
}

