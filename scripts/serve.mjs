import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../dist',import.meta.url));
const port=Number(process.env.PORT || 5180);
const url=`http://127.0.0.1:${port}`;
function openBrowser(){
 const browser=[`${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,`${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,`${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`].find(existsSync);
 if(!browser){console.log(`Abre Chrome o Edge en ${url}`);return;}
 const child=spawn(browser,[url],{detached:true,stdio:'ignore',windowsHide:false});
 child.on('error',()=>console.log(`Abre Chrome o Edge en ${url}`));child.unref();
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  if(pathname==='/__semillero_health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({application:'semillero-flipper-lab',version:'0.2.0'}));return;}
  const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end('No encontrado');}
});
server.on('error',async error=>{
 if(error.code==='EADDRINUSE' && process.argv.includes('--open')){
  try{
   const response=await fetch(`${url}/__semillero_health`,{signal:AbortSignal.timeout(2000)});
   const info=await response.json();
   if(info.application==='semillero-flipper-lab' && info.version==='0.2.0'){console.log(`Semillero ya está abierto: ${url}`);openBrowser();return;}
  }catch{}
 }
 console.error(error.code==='EADDRINUSE'?`El puerto ${port} está ocupado por otra aplicación. Cierra esa instancia o elige otro PORT.`:error.message);process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>{
 console.log(`Semillero: ${url}\nMantén esta ventana abierta. Ctrl+C para detener el servidor.`);
 if(process.argv.includes('--open'))openBrowser();
});
