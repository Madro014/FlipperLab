export const FLIPPER_FILTER = {usbVendorId:0x0483,usbProductId:0x5740};
export function isFlipperCandidate(info) {return info.usbVendorId===FLIPPER_FILTER.usbVendorId && info.usbProductId===FLIPPER_FILTER.usbProductId;}
export class FlipperSerial {
  constructor(onData,onClose) {this.onData=onData;this.onClose=onClose;this.port=null;this.reader=null;this.loop=null;this.closing=false;}
  async connect() {
    if(!navigator.serial) throw new Error('Web Serial requiere Chrome o Edge en localhost o HTTPS.');
    if(this.port) throw new Error('Ya existe una conexión USB.');
    const port=await navigator.serial.requestPort({filters:[FLIPPER_FILTER]});
    await port.open({baudRate:230400});
    this.port=port;this.closing=false;
    this.loop=this.read();
    return port.getInfo();
  }
  async read() {
    const decoder=new TextDecoder();
    try {
      this.reader=this.port.readable.getReader();
      while(!this.closing){const {value,done}=await this.reader.read();if(done)break;if(value)this.onData(decoder.decode(value,{stream:true}));}
    } catch(error) {if(!this.closing)this.onData(`\nUSB: ${error.message}\n`);}
    finally {this.reader?.releaseLock();this.reader=null;if(!this.closing) {try{await this.port?.close();}catch{}this.port=null;this.onClose();}}
  }
  async deviceInfo() {
    if(!this.port?.writable || this.closing)throw new Error('Conecta el dispositivo primero.');
    const writer=this.port.writable.getWriter();
    try {await writer.write(new TextEncoder().encode('info device\r\n'));} finally {writer.releaseLock();}
  }
  async disconnect() {
    this.closing=true;try{await this.reader?.cancel();await this.loop;await this.port?.close();}finally{this.port=null;this.onClose();}
  }
}
