// Actualizaciones: la versión a la vista, una caché por versión (la página y sync-core.js juntos), solo la app
// sale de la copia (otra página del sitio no la pisa), lo compartido no viaja a la red, el aviso "Hay una
// versión nueva", que no recargue con algo abierto, que se actualice sola al volver después de un rato, y
// que una página con un núcleo de otra versión recargue una sola vez.
const H=require('../lib/harness');const {ok,sleep,until}=H;
const S=require('../lib/server');const V=require('../lib/huella');
const fs=require('fs'),os=require('os'),path=require('path');
const FILES=['index.html','sw.js','sync-core.js','manifest.webmanifest',...V.FILES.filter(f=>f.startsWith('icons/'))];
const v1=V.versions().sw,v2='2099.1.1-1',v3='2099.1.1-2';
// Una copia de la app en una carpeta aparte, para poder "publicar" versiones nuevas durante la prueba
function copyApp(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'tareas-upd-'));fs.mkdirSync(path.join(d,'icons'));for(const f of FILES)fs.copyFileSync(path.join(H.ROOT,f),path.join(d,f));return d}
function publish(d,from,to){for(const f of ['index.html','sw.js','sync-core.js']){const p=path.join(d,f);fs.writeFileSync(p,fs.readFileSync(p,'utf8').split(from).join(to))}}
const setVis=(p,v)=>p.evaluate(v=>{window.__vis=v;Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true});document.dispatchEvent(new Event('visibilitychange'))},v);
(async()=>{
const b=await H.launch();
const dir=copyApp(),srv=await S.start(dir),log=[];srv.server.on('request',r=>log.push(r.url));
const APP=srv.url;
const ctx=await b.newContext({serviceWorkers:'allow',viewport:{width:384,height:832},isMobile:true,hasTouch:true});
await ctx.route('https://api.github.com/**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(APP);
ok(await until(()=>p.evaluate(()=>!!navigator.serviceWorker.controller),{timeout:8000}),'service worker controls the page');
const keys=await p.evaluate(()=>caches.keys());
ok(keys.length===1&&keys[0]==='tareas-'+v1,'one cache, for this version: '+keys);
const cached=await p.evaluate(async v=>{const c=await caches.open('tareas-'+v);return (await c.keys()).map(r=>r.url.replace(location.origin,''))},v1);
ok(cached.includes('/Tareas/')&&cached.includes('/Tareas/sync-core.js?v='+v1)&&!cached.some(u=>u.includes('manifest')),'page and core of the same version cached, manifest not: '+cached.join(' '));
await p.click('#statusBtn');
ok((await p.innerText('#appVer')).startsWith('Versión '+v1),'version shown in Sincronización: '+await p.innerText('#appVer'));
ok(await p.isHidden('#appUpdate'),'no Actualizar while up to date');
await p.click('#syncX');
// (al cerrar, la app vuelve atrás en el historial: se espera, así no corta la navegación de la prueba)
await until(()=>p.evaluate(()=>!(history.state&&history.state.tareas)&&!navPending));await sleep(200);
// Lo compartido no viaja a la red
log.length=0;
await p.goto(APP+'?text='+encodeURIComponent('dato secreto del cliente'));
ok(await until(async()=>(await p.inputValue('#title')).toLowerCase().includes('dato secreto')),'shared text reaches the field: '+JSON.stringify(await p.inputValue('#title')));
ok(!log.some(u=>u.includes('secreto')),'shared text never sent to the server: '+JSON.stringify(log));
// Otra página del sitio no pisa la copia de la app
await p.goto(APP+'manifest.webmanifest');await sleep(200);
const shell=await p.evaluate(async v=>{const c=await caches.open('tareas-'+v);const r=await c.match(new URL('./',location.href).href.replace(/manifest\.webmanifest$/,''));return r?await r.text():''},v1);
ok(shell.includes('<title>Mis tareas</title>'),'app copy intact after opening another file of the site');
await ctx.setOffline(true);
await p.goto(APP,{waitUntil:'domcontentloaded'});await sleep(300);
ok((await p.title())==='Mis tareas'&&await p.evaluate(()=>APP_VERSION)===v1,'opens offline from the copy');
await ctx.setOffline(false);
// Se publica una versión nueva: aviso con Actualizar
publish(dir,v1,v2);
await p.evaluate(()=>checkForUpdate(true));
ok(await until(async()=>(await p.isVisible('#toast'))&&(await p.innerText('#toastMsg'))==='Hay una versión nueva de la app',{timeout:8000}),'new version toast');
ok((await p.innerText('#toastUndo'))==='Actualizar','with Actualizar');
await p.click('#statusBtn');
ok((await p.innerText('#appVer')).includes('hay una nueva ('+v2+')')&&await p.isVisible('#appUpdate'),'Sincronización shows the new version and Actualizar');
await Promise.all([p.waitForEvent('load'),p.click('#appUpdate')]);await sleep(300);
ok(await p.evaluate(()=>APP_VERSION)===v2,'after Actualizar: running '+await p.evaluate(()=>APP_VERSION));
ok((await p.innerText('#toastMsg')).startsWith('App actualizada'),'tells it was updated');
ok(JSON.stringify(await p.evaluate(()=>caches.keys()))===JSON.stringify(['tareas-'+v2]),'old cache removed');
// Con una tarea abierta no recarga; al volver después de un rato, sin nada abierto, se actualiza sola
await p.fill('#title','Llamar al banco');await p.press('#title','Enter');await sleep(200);
await p.locator('.task .ttext',{hasText:'Llamar al banco'}).tap();await sleep(200);
publish(dir,v2,v3);
await p.evaluate(()=>checkForUpdate(true));
ok(await until(()=>p.evaluate(()=>newVersion)),'new version detected with a task open');
await p.evaluate(()=>reloadApp());await sleep(300);
ok(await p.evaluate(()=>APP_VERSION)===v2&&await p.isVisible('#editOv'),'does not reload with a task open');
ok((await p.innerText('#toastMsg')).includes('cerrá lo que tenés abierto'),'says to close it first');
await p.click('#editX');await sleep(200);
await setVis(p,'hidden');await p.clock.fastForward(3*60e3);
await Promise.all([p.waitForEvent('load'),setVis(p,'visible')]);await sleep(300);
ok(await p.evaluate(()=>APP_VERSION)===v3,'back after a while with nothing open: updated by itself ('+await p.evaluate(()=>APP_VERSION)+')');
ok((await p.innerText('#groups')).includes('Llamar al banco'),'tasks still there');
// Con la app abierta, "Nueva tarea" del ícono (launch_handler) enfoca el campo; con algo abierto, no hace nada
await p.evaluate(()=>{document.activeElement.blur();handleLaunch(new URLSearchParams('nueva=1'),false)});
ok(await p.evaluate(()=>document.activeElement.id)==='title','launch ?nueva=1 on the open app focuses the field');
ok(errs.length===0,'no page errors '+errs);
await ctx.close();
// Página de una versión y núcleo de otra (sin service worker): recarga una sola vez y sigue
{
  const d=copyApp();const sc=path.join(d,'sync-core.js');fs.writeFileSync(sc,fs.readFileSync(sc,'utf8').replace("CORE_VERSION='"+v1+"'","CORE_VERSION='1999.1.1-1'"));
  const s2=await S.start(d),l2=[];s2.server.on('request',r=>{if(new URL(r.url,'http://x').pathname==='/Tareas/')l2.push(r.url)});
  const c2=await b.newContext();const p2=await c2.newPage();const e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto(s2.url);await sleep(1200);
  ok(l2.length===2,'reloads exactly once on a version mismatch ('+l2.length+' loads)');
  ok(await p2.isVisible('#title')&&await p2.evaluate(()=>typeof render)==='function','then the app runs');
  ok(e2.filter(m=>!/Versiones distintas/.test(m)).length===0,'no other errors '+e2);
  await c2.close();
}
await b.close();console.log('fails',H.fails);
})().catch(e=>{console.error(e);process.exit(1)});
