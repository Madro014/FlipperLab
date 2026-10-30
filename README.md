# Semillero · Flipper Lab 0.2

Interfaz local en español para preparar una prueba de portal cautivo, revisar tu red Wi-Fi con una guía para Flipper Zero + ESP32, analizar HTML y guardar prácticas en informes PDF.

## Abrir

### Juegos con el Flipper como mando

En **Juegos**, Flipper Run muestra una carrera de obstáculos en el computador. El Flipper envía la tecla de salto mediante **Remote**, por USB o Bluetooth. No requiere la placa ESP32 ni carga archivos al dispositivo.

1. Si el laboratorio tiene abierta la conexión de diagnóstico, pulsa **Liberar conexión USB**. Si usas Marauder, desconéctalo en **Auditar red** y sal del puente USB-UART.
2. En el Flipper abre **Apps → USB → Remote** con el cable conectado, o **Apps → Bluetooth → Remote** y empareja «Control …» desde el computador. Momentum puede usar nombres o carpetas distintos. Selecciona **Keynote**; también sirve **Keyboard**.
3. En la página pulsa **Asignar botón** y pulsa brevemente el botón físico que quieras usar. La página muestra la tecla recibida; no puede distinguir si provino del Flipper o del teclado del computador.
4. Pulsa **Empezar partida**. Cada pulsación salta; suelta el botón entre saltos. Espacio permite probar desde el teclado. Esc pausa. Al cambiar de ventana, sección o salir del foco de la pista, el juego se pausa. Pulsa tu botón de nuevo con la pista enfocada para continuar.

La mejor marca se conserva durante esta sesión de página. Recargar la borra. La asignación, los saltos, las colisiones y la pausa se verifican con entradas de teclado en el navegador; la conexión física de Remote debe comprobarse en tu equipo.

Referencia: [controladores Remote de Flipper](https://docs.flipper.net/zero/apps/controllers).

En **Juegos → En el Flipper · Games** hay una guía para jugar en la pantalla del dispositivo, con pasos para T-Rex Runner, Flappy Bird y Tetris. La colección buscable contiene los 42 archivos observados por USB en `/ext/apps/Games` el 29 de octubre de 2026, con Momentum mntm-dev. Es una lista fija de esa lectura, no un inventario en vivo ni una comprobación de ejecución. Los controles se consultaron en el código público de Momentum y pueden variar con la versión. Cambiar a la guía pausa Flipper Run.

### Diagnóstico directo con Flipper y AIO V1.4

**Auditar red** abre ahora el modo **Diagnóstico con Flipper**. La revisión manual del router queda en una pestaña opcional.

1. Libera la conexión USB de portal desde la página y sal de la aplicación Marauder en el Flipper. Abre **GPIO → USB-UART Bridge**, con canal USB 0, 115200 baudios y los pines UART que usa la AIO (habitualmente 13/14). Mantén la placa en modo Wi-Fi y el cable conectado al Flipper. No se cambia ningún firmware.
2. Pulsa **Conectar Marauder**. La página solicita el puerto y verifica `info` y `help` del ESP32. Rechaza la CLI normal del Flipper si no está activo el puente. El modo de portal y este modo no pueden ocupar el puerto simultáneamente.
3. Pulsa **Escanear redes**. Se ejecuta `scanap` o `scanall`, según lo que anuncie el firmware, durante 18 segundos; después se envía `stopscan` y se consulta `list -a`.
4. **Elige una red:** el paso 2 comienza automáticamente. La página reutiliza la lista recién obtenida para validar el índice y recibe `info -a` del AP: SSID, BSSID, canal, señal y seguridad. Evita repetir `list -a`, que puede dejar una respuesta serial incompleta en la AIO. Si una consulta de solo lectura se corta, se intenta una vez más; una conexión Wi-Fi no se repite automáticamente. Los datos que el firmware no informa quedan pendientes. WPA2 sin información de AES/CCMP no se convierte automáticamente en WPA2/AES. La lectura termina en el paso 3, con el diagnóstico disponible.
5. Para tu propia red, pulsa una vez **Es mi red y autorizo revisar sus equipos**. Se guarda únicamente SSID, BSSID y la declaración de autorización en `semillero.authorized-networks.v1`. El reconocimiento posterior exige ambos identificadores; no verifica propiedad y un BSSID distinto requiere otra autorización. Sin coincidencia se hace solo lectura del AP. Puedes **Olvidar autorización de esta red**. Si el almacenamiento falla, la nueva autorización no se habilita.
6. **Equipos y puertos se incluyen automáticamente** cuando coinciden el perfil autorizado y los comandos del firmware. Para una red protegida, introduce su clave válida y pulsa **Conectar y continuar automáticamente**; una red abierta autorizada puede continuar sin clave. El ESP32 solicita `join -a` y después sondea equipos y puertos asociados a Telnet, HTTP, HTTPS, SSH y RDP mediante `pingscan` y `portscan -s`, con ventanas de 18 segundos por comprobación. Se aceptan subredes privadas de hasta 254 direcciones; se descartan respuestas de otras subredes. La conexión del firmware usa SSID y no confirma el BSSID de la asociación. No se fuerzan conexiones ni se prueban claves alternativas.
7. **Validación de conexión y diagnóstico** distingue conexión observada, no ejecutada, firmware incompatible y resultado no concluyente. Si Marauder responde «Could not connect to WiFi network», el paso final queda pendiente y los equipos y puertos aparecen como no evaluados; el firmware no identifica la causa exacta. Comprueba que elegiste tu red de 2,4 GHz, que la clave corresponde al SSID y que el modo de seguridad admite el ESP32-S2; vuelve a escanear antes de reintentar. Conectar con una clave válida no demuestra una vulnerabilidad; un rechazo tampoco certifica seguridad. La cobertura de puertos es parcial. El historial y el PDF conservan esta evidencia, la autorización declarada y los límites. Continuar la misma práctica actualiza su registro; **Repetir comprobaciones** crea otra. Los apartados del PDF siguen siendo seleccionables. **Detener** solicita `stopscan` durante un escaneo; una consulta o conexión espera a que termine su comando.

La clave se limpia del formulario al iniciar y no se guarda en registros, historial ni PDF de la página. El firmware del ESP32 puede conservarla conforme a sus propios ajustes. Las comillas se codifican con fragmentos adyacentes según el parser de Marauder; se rechazan saltos de línea y caracteres de control. No hay una consola de comandos arbitrarios ni operaciones de interrupción de redes. Un puerto abierto o un anuncio inalámbrico no confirma una explotación o una CVE; los hallazgos explican qué se observó y qué requiere comprobación.

La integración está probada con una simulación del protocolo serial y en el navegador. En una comprobación física anterior, la AIO respondió con Marauder v1.5.0, que no anunciaba las funciones de LAN. En la comprobación física más reciente, el puente a 115200 respondió con **Marauder v1.18.0**, anunció `join`, `pingscan` y `portscan`, y encontró el SSID y BSSID autorizados en el canal 8 con señal de −40 dBm. La conexión Wi-Fi y los sondeos posteriores aún no se han verificado físicamente en esta ejecución. El diagnóstico anterior por CLI ya verificó Flipper Momentum, microSD y aplicaciones.

Referencias: [CLI de Marauder](https://github.com/justcallmekoko/ESP32Marauder/wiki/CLI), [menú GPIO de Flipper](https://docs.flipper.net/zero/gpio-and-modules).

Haz doble clic en **Abrir-Semillero.cmd** en `D:\semillero`. Inicia el servidor local y abre Microsoft Edge en **http://127.0.0.1:5180**. Mantén abierta la ventana del servidor mientras usas la aplicación; Ctrl+C la detiene. La carpeta `dist` ya contiene la compilación. Todo el proyecto activo está directamente en `D:\semillero`. La carpeta anidada `D:\semillero\semillero` es una copia antigua 0.1.0 que el lanzador no utiliza; se puede eliminar desde el Explorador de archivos.

También puedes ejecutar:

```powershell
cd D:\semillero
npm.cmd start
```

Requiere Node.js 20.19+ o 22.12+. La conexión Web Serial requiere Chrome o Edge, localhost o HTTPS, y que selecciones el puerto USB. Cierra qFlipper y otras terminales antes de conectarlo. El navegador solicita seleccionar el puerto; la aplicación no puede evitar ese permiso.

## Prueba con el equipo

1. **Conecta tu equipo.** Conecta el Flipper por USB con el ESP32 en GPIO. Pulsa Conectar Flipper. Consulta `info device`, disponibilidad de microSD y estas rutas de Evil Portal: `/ext/apps/GPIO/ESP/evil_portal.fap` y `/ext/apps/GPIO/evil_portal.fap`. El VID/PID es un filtro de selección, no una confirmación de identidad.
2. **Prepara el portal.** Personaliza la bienvenida, el sufijo de la red `Semillero-LAB` y el código de prueba. Mantén cerradas las aplicaciones del Flipper y pulsa Cargar prueba al Flipper. Se escriben `index.html` y `ap.config.txt` en `/ext/apps_data/evil_portal/` y se leen de vuelta para comprobar su contenido.
3. **Prueba desde tu móvil.** Pulsa Abrir en el Flipper o navega a Apps → GPIO → ESP → Evil Portal. En el Flipper pulsa **Start portal**. Conecta tu teléfono a la red indicada y permanece conectado aunque no tenga Internet. Si no se abre el portal automáticamente, utiliza HTTP y la IP que muestra el ESP32; la habitual es `http://192.168.4.1`. Compara el código de la página con el de la prueba y registra tu observación. Al terminar pulsa **Stop portal**, olvida la red del teléfono y exporta el registro.

La comprobación desde el teléfono es manual. El modo portal no recibe la consola UART de Evil Portal ni puede contar visitantes, medir tráfico o confirmar que está emitiendo. Abrir la aplicación en el Flipper no implica que la red haya iniciado. En Auditar red, el nuevo modo directo utiliza el puente USB-UART para consultar la identidad y los resultados de Marauder en el ESP32.

## Firmware de la placa

Momentum es el firmware del Flipper. La placa ESP32 lleva su propio firmware: debe ser compatible con la aplicación Evil Portal independiente. Marauder, GhostESP y Evil Portal tienen flujos distintos. Esta interfaz no cambia ni flashea firmware. Si el portal queda esperando la placa, identifica su modelo y firmware antes de modificarla. Consulta la documentación enlazada abajo.

## Carga y recuperación

- Solo se carga la plantilla generada por esta interfaz. Es una página autónoma, sin formularios de credenciales, scripts ni recursos externos. Se limita a 3.900 bytes UTF-8, por debajo del límite conservador de la aplicación.
- Los archivos se escriben primero en una carpeta única `/ext/apps_data/evil_portal/semillero-<id>/`, se verifican y luego se trasladan a sus rutas activas. Los archivos anteriores se conservan en esa misma carpeta. No se leen ni exportan los registros anteriores del portal.
- Ante un error con el USB aún disponible, se intenta recuperar los archivos anteriores. Ante una interrupción del puerto o de alimentación, revisa las rutas y el respaldo indicado en el aviso antes de volver a iniciar el portal.
- Para restaurar manualmente: detén el portal, cierra la conexión USB en la web, abre qFlipper y copia `index.html` y `ap.config.txt` de la carpeta de respaldo a `/ext/apps_data/evil_portal/`. Los respaldos no se borran automáticamente. Guarda el reporte JSON para conservar la ruta de la sesión.
- No cierres ni recargues la página durante la carga.

## Vista previa y simulación

Puedes inspeccionar HTML/HTM de hasta 1 MB en una vista aislada. El archivo importado se usa solo en la vista previa. Se desactivan campos y formularios, se retiran scripts, recursos externos y CSS que solicite recursos; se aplica CSP y un iframe sin permisos. Las imágenes de datos PNG/JPEG/GIF/WebP son admitidas.

La simulación se encuentra en su propia pestaña. Sus eventos prefijados están identificados como Simulación; no requieren hardware ni modifican el dispositivo. El reporte distingue USB, Archivo, Usuario, Sistema y Simulación. El registro de sesión está en memoria; las prácticas guardadas se conservan en el historial local. La interfaz usa tipografías del sistema y no necesita servicios externos.

## Analizar HTML

Abre **Analizar HTML**. Carga un archivo HTML/HTM, pega su código o utiliza el portal actual. Opcionalmente indica la URL completa donde se sirve la página; no se visita esa dirección. Pulsa **Analizar HTML**.

- **Formularios:** destinos `action`, método, cantidad de campos y destinos alternativos `formaction` de botones. Tiene en cuenta `<base>` y la página actual. Sin URL de origen, los destinos relativos quedan pendientes de resolver.
- **Recursos y enlaces:** scripts, imágenes, `srcset`, enlaces, estilos con referencias URL, iframes y multimedia. Distingue otro origen, mismo origen, URLs absolutas cuyo origen falta confirmar y recursos locales.
- **HTTP:** identifica referencias HTTP declaradas. Una URL literal dentro de JavaScript se etiqueta como uso no confirmado; no se ejecuta código ni se realizan solicitudes externas.
- **Hallazgos:** nivel de revisión, explicación, recomendación y botón para señalar la línea del elemento en el código original. Si editas el HTML o su origen, debes volver a analizar para actualizar los resultados.

El analizador utiliza parse5 con posiciones de origen. Es una revisión estática del HTML, no una confirmación de vulnerabilidades ni de solicitudes reales. No interpreta destinos construidos dinámicamente ni inspecciona las cabeceras del servidor. No almacena valores de los campos; los fragmentos guardados se limitan a la evidencia del elemento, con atributos `value` omitidos.

## Historial y PDF a elección

Las revisiones de red se guardan desde **Auditar red → Guardar revisión en historial**. En el PDF puedes elegir **Datos y configuración de red**, **Hallazgos y explicación**, **Recomendaciones** y **Plan de corrección de red** por separado.

Los análisis, las simulaciones completadas y las pruebas de portal confirmadas se guardan automáticamente. Para conservar una práctica de dispositivo todavía en curso, abre **Registro de sesión → Guardar práctica actual**. Reiniciar una prueba conserva los registros anteriores y empieza una práctica nueva.

En **Historial y PDF**:

1. Busca o filtra por tipo y marca las prácticas que deseas incluir. Puedes seleccionar las visibles o quitar la selección.
2. Elige los apartados: resumen, equipo, eventos, formularios, recursos, HTTP, hallazgos, recomendaciones y fragmentos de código. Los fragmentos están desmarcados por defecto.
3. Personaliza título, autor/equipo y notas. Revisa las prácticas y los recuentos de la vista previa.
4. Pulsa **Descargar PDF seleccionado**. El informe se genera con jsPDF en el navegador; no utiliza la ventana de impresión ni envía el historial a un servidor.

Solo se incluyen las prácticas y los apartados marcados. El historial permite eliminar las seleccionadas y deshacer esa eliminación mientras permanezcas en la pestaña. Se almacena en `localStorage` bajo `semillero.practice-history.v1`, en el mismo navegador y origen (incluido el puerto). No se comparte automáticamente entre Edge y Chrome ni entre 5173 y 5180. Borrar los datos del navegador borra este historial. Si el almacenamiento está bloqueado o lleno, aparece un aviso; los resultados siguen disponibles en memoria para exportarlos antes de cerrar.

## Desarrollo y comprobaciones

### Auditar una red propia

La guía está adaptada a la **AIO Board V1.4** indicada por el usuario. El modelo es una declaración del laboratorio, no una identificación por USB. Según el manual de esta revisión de placa, Wi-Fi utiliza ESP32-S2 y se selecciona con el conmutador frontal en posición central, con indicador verde; el conmutador posterior RX/TX corresponde al CC1101. Apaga el Flipper antes de conectar o retirar la AIO. Para usar Marauder desde el Flipper no necesitas poner la placa en BOOT/BT ni conectarla al PC por su propio USB. El ESP32-S2 solo observa Wi-Fi de 2,4 GHz. Encontrar la aplicación en la microSD del Flipper no confirma que el ESP32 lleve Marauder: comprueba su respuesta en la pantalla.

Referencia de hardware: [manual AIO V1.4 suministrado por el distribuidor](https://myosuploads3.banggood.com/products/20240711/20240711041413AIO.pdf) y [especificaciones de ESP32-S2 de Espressif](https://documentation.espressif.com/esp32-s2_datasheet_en.html).

1. Abre **Auditar red** y conecta el Flipper. El diagnóstico comprueba la existencia de ESP32 WiFi Marauder y WiFi Scanner en `GPIO/ESP` o `GPIO`. Los botones abren la aplicación mediante la CLI USB y verifican su apertura; no inician escaneos. Cierra cualquier aplicación que esté abierta en el Flipper antes de usar otro botón.
2. Confirma el firmware del **ESP32** y que responde; Momentum identifica al Flipper. Marauder y WiFi Scanner necesitan firmware compatible en la placa. Si usas otro firmware o un registro previo, selecciona el método manual. La página no flashea la placa.
3. En Marauder escanea puntos de acceso, detén el escaneo y consulta tu AP. Los nombres del menú del Flipper dependen de la versión; la interfaz nativa de Marauder documenta `WiFi → Sniffers → Scan APs` y `WiFi → General → View AP Info`. Registra SSID, BSSID, seguridad y los datos opcionales visibles. Las bandas que puede detectar dependen del ESP32.
4. Puedes importar un CSV con `SSID,BSSID,Channel,RSSI,Security` (también CSV WiGLE) o texto `RSSI: -57 Ch: 3 BSSID: AA:BB:CC:DD:EE:FF ESSID: Mi red`. Solo se conserva la observación elegida, sin coordenadas ni otras redes. Los registros sin modo de cifrado lo dejan sin confirmar. Un valor genérico WPA2 no permite inferir AES/CCMP. Límite: 1 MB y 2000 observaciones.
5. En **Comparar identidad e historial**, introduce los BSSID que confirmaste en tu router o selecciona una práctica anterior del mismo SSID. Una diferencia de BSSID puede deberse a bandas, malla o repetidores y no demuestra suplantación. Un cambio de señal o canal no se considera por sí solo una vulnerabilidad.
6. Consulta el panel del router y registra WPS, actualizaciones, contraseñas declaradas, administración remota, UPnP y separación de invitados/IoT. **No escribas contraseñas**. Los valores desconocidos quedan pendientes.
7. Revisa los hallazgos por prioridad y despliega sus instrucciones para el router, el Flipper y la página. Marcar una acción registra avance declarado; no la da por corregida. Guarda la revisión, aplica los cambios y usa **Nueva revisión** para comprobar y comparar después.

La evaluación aplica reglas orientativas a observaciones importadas/transcritas y ajustes declarados. No detecta puertos abiertos, contraseñas, tráfico, CVE ni todos los fallos de una red. Las pruebas automatizadas de USB usan una CLI ficticia; el diagnóstico en el equipo real verifica identidad, microSD y aplicaciones, sin modificar archivos ni iniciar radio.

Referencias: [Marauder scanap](https://github.com/justcallmekoko/ESP32Marauder/wiki/scanap), [View AP Info](https://github.com/justcallmekoko/ESP32Marauder/wiki/View-AP-Info), [buenas prácticas de red doméstica de NSA](https://www.nsa.gov/Press-Room/News-Highlights/Article/Article/3304674/nsa-releases-best-practices-for-securing-your-home-network/).

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
```

El servidor de desarrollo usa 5173. La compilación, el lanzador y las pruebas de navegador usan 5180 para convivir con una instancia anterior. Para las pruebas de navegador, deja `npm.cmd start` activo en otra terminal. Playwright utiliza Edge. Las pruebas de navegador usan una CLI ficticia por bytes: no acceden a tu hardware. Las pruebas de protocolo verifican lectura UTF-8, carga por bloques y recuperación de originales ante un fallo de promoción. `node scripts/build-portable.mjs` es la alternativa de compilación sin subprocesos.

## Referencias

- [Evil Portal de Momentum y compatibilidad del ESP32](https://github.com/Next-Flip/Momentum-Apps/tree/dev/evil_portal)
- [Almacenamiento CLI de Flipper](https://github.com/flipperdevices/flipperzero-firmware/blob/dev/applications/services/storage/storage_cli.c)
- [Loader de Momentum](https://github.com/Next-Flip/Momentum-Firmware/blob/dev/applications/services/loader/loader_cli.c)
- [Web Serial en Chrome](https://developer.chrome.com/docs/capabilities/serial)
