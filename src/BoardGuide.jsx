import React from 'react';
import {Cpu,ExternalLink} from 'lucide-react';

export default function BoardGuide() {
  return <section className="board-guide" aria-label="Guía de AIO Board V1.4">
    <div className="board-guide-heading"><Cpu size={22}/><div><strong>AIO Board V1.4</strong><small>Modelo indicado por ti · Componente Wi-Fi: ESP32-S2 según el manual</small></div></div>
    <p><b>ESP32 WiFi Marauder</b> es el nombre de la aplicación del Flipper. Puede controlar el módulo Wi-Fi de tu AIO si este tiene un firmware Marauder compatible. El estado «Aplicación en microSD» comprueba el archivo del Flipper; la respuesta de la AIO se confirma en su pantalla.</p>
    <ol>
      <li><strong>Prepara la AIO.</strong> Apaga el Flipper antes de conectar o retirar la placa. Si necesitas cambiar el selector, prepara la conexión con el equipo apagado.</li>
      <li><strong>Selecciona Wi-Fi / ESP32.</strong> En la AIO V1.4 del manual corresponde al selector frontal en posición central. Enciende el Flipper y comprueba el indicador verde. El selector trasero RX/TX pertenece al CC1101.</li>
      <li><strong>Comprueba la comunicación.</strong> Conecta el cable USB al Flipper, pulsa Abrir Marauder y revisa la pantalla del Flipper. Confirma una respuesta o versión del ESP32 antes de continuar. Para este recorrido no se necesita el modo BOOT/BT.</li>
    </ol>
    <details><summary>Si Marauder abre pero la placa no responde</summary><p>Apaga el Flipper, revisa la conexión GPIO y el modo Wi-Fi de la AIO, y vuelve a encenderlo. Si sigue sin responder, queda por confirmar el firmware instalado en el ESP32-S2 y su compatibilidad con la aplicación. Momentum identifica el firmware del Flipper; no identifica el de la placa.</p></details>
    <p className="field-help">El ESP32-S2 trabaja en Wi-Fi de 2,4 GHz; esta placa no permite comprobar redes de 5 o 6 GHz con ese módulo.</p>
    <a href="https://myosuploads3.banggood.com/products/20240711/20240711041413AIO.pdf" target="_blank" rel="noreferrer">Manual de AIO V1.4 <ExternalLink size={12}/></a>
  </section>;
}
