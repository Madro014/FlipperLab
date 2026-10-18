# Semillero · Flipper Lab

Aplicación React + Vite en español para prácticas académicas. Funciona localmente; no necesita cuentas ni backend.

## Iniciar en Windows

Requiere Node.js 20.19+ o 22.12+.

```powershell
cd C:\Users\Sebastian\.codex\semillero
npm.cmd install
npm.cmd run dev
```

Abrir http://localhost:5173 en Chrome o Edge. Para compilar: `npm.cmd run build`. Para ver la compilación: `npm.cmd run preview`.

## Funciones

- Conexión explícita con el selector Web Serial (USB 0483:5740, 230400 baudios). Un identificador USB compatible no prueba por sí mismo la identidad. Consultar la respuesta de `info device` en Dispositivo.
- Detecta conexiones de puertos previamente autorizados y permite leer información del dispositivo. La primera autorización y cada apertura requieren acción del usuario.
- Lectura USB limitada a información; no hay consola de comandos arbitrarios.
- Carga de HTML/HTM hasta 1 MB, vista móvil/escritorio y consulta del código.
- Vista estática aislada: sandbox sin permisos, CSP restrictiva, sin scripts, solicitudes externas, enlaces activos ni formularios. Campos desactivados; contenido solo en memoria.
- Simulación temporal con eventos prefijados y exportación JSON. Los eventos del simulador se distinguen de las lecturas USB.
- Guía de conexión y demostración sin hardware.

## Alcance de Evil Portal

Es un simulador visual académico. No ejecuta Evil Portal en el Flipper/ESP32, no crea puntos de acceso, no transmite señales, no sirve portales a otros equipos y no captura credenciales. No sube HTML al Flipper. Los scripts y recursos externos del HTML cargado no se ejecutan. Incluir estilos dentro del HTML; imágenes de datos PNG/JPEG/GIF/WebP se admiten.

## Conexión

Cierra qFlipper, Flipper Lab u otras terminales antes de conectar. Usa un cable USB de datos y Flipper encendido. Web Serial requiere localhost o HTTPS y un navegador compatible. Momentum puede exponer una CLI diferente; si `info device` no responde, verifica su documentación. Una placa ESP32 conectada al Flipper no es identificada automáticamente por esta interfaz.

## Estructura y migración a escritorio

`src/serial.js` separa el transporte USB de la interfaz. `src/portal.js` contiene la preparación de HTML y eventos simulados. `src/main.jsx` contiene la UI. Una futura aplicación Electron/Tauri puede reutilizar React y sustituir el adaptador serial por un puente nativo con permisos explícitos. La versión actual es web local, no un ejecutable.

## Comprobaciones

`npm.cmd test` verifica eventos y validación de puertos. `npm.cmd run build` compila producción. Las pruebas Playwright en `tests/browser.spec.js` verifican la carga de HTML hostil, aislamiento y simulación: ejecutar con `npx playwright test` mientras `npm run dev` está activo. Requieren un navegador instalado.

## Referencias

- https://docs.flipper.net/zero/development/cli
- https://developer.chrome.com/docs/capabilities/serial

No hay telemetría. La tipografía usa Google Fonts cuando hay conexión; se utiliza sans-serif local cuando no está disponible. Los HTML cargados nunca se envían a ese servicio.
