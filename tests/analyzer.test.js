import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeHtml} from '../src/analyzer.js';
import {HISTORY_KEY,readHistory,writeHistory,upsertRecord,selectReport} from '../src/history.js';

test('resuelve base, acción vacía y destinos alternativos con líneas originales',()=>{
 const source=`<!doctype html>
<base href="https://assets.example.test/carpeta/">
<form id="login"
 action="http://forms.example.test/enviar" method="get">
<input type="password" name="clave" value="NO-GUARDAR">
</form>
<button form="login" formaction="/alternativa" formmethod="post">Enviar</button>
<form action=""></form>`;
 const result=analyzeHtml(source,{documentUrl:'https://lab.example.test/pagina.html'});
 assert.equal(result.forms.length,3);
 assert.equal(result.forms[0].line,4);assert.equal(result.forms[0].sensitive,true);
 assert.equal(result.forms.find(item=>item.kind.startsWith('Botón')).url,'https://assets.example.test/alternativa');
 assert.equal(result.forms[1].url,'https://lab.example.test/pagina.html');
 assert.ok(result.findings.some(item=>item.title.includes('GET')&&item.severity==='high'));
 assert.ok(!JSON.stringify(result).includes('NO-GUARDAR'));
});
test('no inventa orígenes y distingue recursos, HTTP y literales de JavaScript',()=>{
 const source=`<!-- <script src="http://ignorar.example/"></script> -->
<img src="foto.png"><a href="https://otra.example.test/">Salir</a>
<script>const destino="http://literal.example.test/";</script>
<img srcset="data:image/png;base64,AAAA 1x, https://img.example.test/a.png 2x">
<style>body{background:url("http://css.example.test/fondo.png")}</style>`;
 const result=analyzeHtml(source);
 assert.equal(result.resources[0].relation,'sin-base');
 assert.equal(result.resources[1].relation,'origen-por-confirmar');
 assert.equal(result.http.length,2);assert.ok(result.http.find(item=>item.literal&&item.line===3));
 assert.ok(result.resources.some(item=>item.raw==='https://img.example.test/a.png'));
 assert.ok(!JSON.stringify(result).includes('ignorar.example'));
});
test('rechaza origen inválido y tamaño excesivo; dialog no se cuenta como conexión',()=>{
 assert.throws(()=>analyzeHtml('<p>Prueba</p>',{documentUrl:'javascript:alert(1)'}));
 assert.throws(()=>analyzeHtml('x'.repeat(1048577)),/1 MB/);
 const result=analyzeHtml('<form method="dialog" action="http://local.test/"></form>');
 assert.equal(result.forms[0].relation,'sin-envio');assert.equal(result.http.length,0);
 const inactive=analyzeHtml('<form method="get"><input type="password" disabled name="clave"><input type="email"><button type="button" formaction="http://ignorar.example/">Botón</button></form>');
 assert.equal(inactive.forms.length,1);assert.ok(!inactive.findings.some(item=>item.title.includes('GET')));
});
const record=(id)=>({id,kind:'analysis',title:id,savedAt:'2026-10-16T20:00:00Z',status:'Revisión estática',summary:'RESUMEN',device:{model:'NO-INCLUIR-EQUIPO'},events:[{message:'NO-INCLUIR-EVENTO'}],analysis:{fileName:id,scope:'Estático',documentUrl:'',forms:[{line:1,url:'https://forms.example',evidence:'NO-INCLUIR-CODIGO'}],resources:[{url:'NO-INCLUIR-RECURSO'}],http:[],findings:[{title:'Formulario',line:1,severity:'medium',why:'NO-INCLUIR-EXPLICACION',fix:'CORRECCION-ELEGIDA',evidence:'NO-INCLUIR-CODIGO'}]}});
test('selección de informe excluye prácticas y apartados desmarcados',()=>{
 const report=selectReport([record('ELEGIDA'),record('EXCLUIDA')],['ELEGIDA'],['forms','recommendations'],{title:'Selección'});
 const serialized=JSON.stringify(report);
 for(const excluded of ['EXCLUIDA','NO-INCLUIR-EQUIPO','NO-INCLUIR-EVENTO','NO-INCLUIR-CODIGO','NO-INCLUIR-RECURSO','NO-INCLUIR-EXPLICACION']) assert.ok(!serialized.includes(excluded),excluded);
 assert.ok(serialized.includes('CORRECCION-ELEGIDA'));assert.equal(report.items.length,1);
 assert.throws(()=>selectReport([],[],['forms']),/práctica/);assert.throws(()=>selectReport([record('A')],['A'],[]),/apartado/);
});
test('historial persiste por ID y comunica almacenamiento corrupto',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 writeHistory(storage,[record('A')]);assert.equal(readHistory(storage).length,1);
 const next=upsertRecord(readHistory(storage),{...record('A'),title:'Actualizada'});
 assert.equal(next.length,1);assert.equal(next[0].title,'Actualizada');
 values.set(HISTORY_KEY,'{}');assert.throws(()=>readHistory(storage));
});
