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
// (en index.html también se recalculan los hashes de la CSP, como hace npm run nueva-version: si no, no corre)
function rewrite(p,from,to){let s=fs.readFileSync(p,'utf8').split(from).join(to);if(p.endsWith('index.html'))s=s.replace(/(script-src 'self')((?: 'sha256-[A-Za-z0-9+\/=]+')*)/,(m,a)=>a+' '+V.cspNeeded(s).join(' '));fs.writeFileSync(p,s)}
function publish(d,from,to){for(const f of ['index.html','sw.js','sync-core.js'])rewrite(path.join(d,f),from,to)}
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
// Correcciones de la revisión: lo compartido y la fecha elegida sobreviven a la actualización sola; con
// Sincronización abierta no se recarga sola; "Dictar" con texto en el campo lo guarda aparte; compartir con algo
// abierto espera a "Cargar"; después de una recarga forzada igual se avisa; una página vieja no se instala.
{
  const d=copyApp(),s3=await S.start(d);let ver=v1;
  const bump=to=>{publish(d,ver,to);ver=to};
  const c3=await b.newContext({serviceWorkers:'allow',viewport:{width:384,height:832},isMobile:true,hasTouch:true});
  await c3.route('https://api.github.com/**',r=>r.abort());
  const q=await c3.newPage();const e3=[];q.on('pageerror',e=>e3.push(e.message));
  await q.goto(s3.url);
  await until(()=>q.evaluate(()=>!!navigator.serviceWorker.controller),{timeout:8000});
  const away=async()=>{await setVis(q,'hidden');await q.clock.fastForward(3*60e3);await Promise.all([q.waitForEvent('load'),setVis(q,'visible')]);await sleep(400)};
  // Compartido + chip "Mañana" + versión nueva → al volver se actualiza sola y todo sigue en el campo
  await q.goto(s3.url+'?text='+encodeURIComponent('me mandás el remito 4471'));
  await until(async()=>(await q.inputValue('#title')).includes('remito'));
  await q.locator('#chips .chip[data-v="1"]').tap();
  bump('2099.2.1-1');await q.evaluate(()=>checkForUpdate(true));
  await until(()=>q.evaluate(()=>newVersion),{timeout:8000});
  await away();
  ok(await q.evaluate(()=>APP_VERSION)==='2099.2.1-1','updated by itself on return');
  ok((await q.inputValue('#title')).includes('remito')&&await q.evaluate(()=>chip==='1'&&chipTouched&&sharedFill),'shared text and the chosen date chip survive the update reload');
  await q.fill('#title','');await q.evaluate(()=>{chip='0';chipTouched=false;sharedFill=false;saveDraft();renderAdd()});
  // Con Sincronización abierta no se recarga sola
  bump('2099.2.1-2');await q.evaluate(()=>checkForUpdate(true));
  await until(()=>q.evaluate(()=>newVersion==='2099.2.1-2'),{timeout:8000});
  await q.click('#statusBtn');await q.fill('#owner','escribiendo');
  await setVis(q,'hidden');await q.clock.fastForward(3*60e3);await setVis(q,'visible');await sleep(800);
  ok(await q.evaluate(()=>APP_VERSION)==='2099.2.1-1'&&await q.isVisible('#syncOv')&&await q.inputValue('#owner')==='escribiendo','no automatic reload with Sincronización open');
  await Promise.all([q.waitForEvent('load'),q.click('#appUpdate')]);await sleep(400);
  ok(await q.evaluate(()=>APP_VERSION)==='2099.2.1-2','Actualizar inside Sincronización still works');
  // "Dictar" con la app abierta y algo escrito: lo escrito queda aparte (no se mezcla con lo dictado)
  await q.fill('#title','llamar a Marta por');
  await q.evaluate(()=>handleLaunch(new URLSearchParams('voz=1'),false));
  ok(await q.isVisible('#voiceDock')&&await q.inputValue('#title')===''&&await q.evaluate(()=>heldDraft&&heldDraft.t==='llamar a Marta por'),'Dictar on the open app keeps the typed text aside');
  await q.click('#dockClose');await q.evaluate(()=>{heldDraft=null;$('title').value='';saveDraft()});
  // Compartir con una tarea abierta: espera a "Cargar"
  await q.fill('#title','Revisar stock');await q.press('#title','Enter');await sleep(200);
  await q.locator('.task .ttext',{hasText:'Revisar stock'}).tap();await sleep(200);
  await q.evaluate(()=>handleLaunch(new URLSearchParams('text=pasame el presupuesto'),false));
  ok(await q.isVisible('#editOv')&&(await q.innerText('#toastMsg'))==='Llegó un texto compartido'&&(await q.innerText('#toastUndo'))==='Cargar','share with a task open waits for Cargar');
  await q.click('#editX');await sleep(200);
  await q.evaluate(()=>loadPendingShare());
  ok((await q.inputValue('#title')).toLowerCase().includes('presupuesto'),'Cargar puts the shared text in the field');
  await q.fill('#title','');await q.evaluate(()=>{sharedFill=false;saveDraft()});
  // Después de una recarga forzada (sin service worker) igual se avisa la versión siguiente
  const cdp=await c3.newCDPSession(q);
  await Promise.all([q.waitForEvent('load'),cdp.send('Page.reload',{ignoreCache:true})]);await sleep(500);
  ok(await q.evaluate(()=>!navigator.serviceWorker.controller),'hard reload: page not controlled');
  bump('2099.2.1-3');await q.evaluate(()=>checkForUpdate(true));
  ok(await until(()=>q.evaluate(()=>newVersion==='2099.2.1-3'),{timeout:8000}),'after a hard reload the next version is still offered');
  await Promise.all([q.waitForEvent('load'),q.evaluate(()=>reloadApp())]);await sleep(400);
  // Una página vieja no se instala con un service worker nuevo: queda la versión anterior hasta que llegue la buena
  const sw=path.join(d,'sw.js');fs.writeFileSync(sw,fs.readFileSync(sw,'utf8').split('2099.2.1-3').join('2099.2.1-4'));
  await q.evaluate(()=>checkForUpdate(true));await sleep(2000);
  const st=await q.evaluate(async()=>({keys:await caches.keys(),nv:newVersion,v:APP_VERSION}));
  ok(JSON.stringify(st.keys)===JSON.stringify(['tareas-2099.2.1-3'])&&!st.nv,'sw.js new but page old: not installed '+JSON.stringify(st));
  for(const f of ['index.html','sync-core.js'])rewrite(path.join(d,f),'2099.2.1-3','2099.2.1-4');ver='2099.2.1-4';
  await q.evaluate(()=>{lastSwCheck=0;checkForUpdate(true)});
  ok(await until(()=>q.evaluate(()=>newVersion==='2099.2.1-4'),{timeout:8000}),'once the page is new too, it installs');
  // Si otro sitio de github.io borra las cachés, la app se vuelve a guardar sola (página y núcleo juntos)
  await Promise.all([q.waitForEvent('load'),q.evaluate(()=>reloadApp())]);await sleep(400);
  await q.evaluate(async()=>{for(const k of await caches.keys())await caches.delete(k)});
  await q.reload();await sleep(800);
  const again=await q.evaluate(async()=>{const k=await caches.keys();if(k.length!==1)return k;const c=await caches.open(k[0]);return (await c.keys()).map(r=>r.url.replace(location.origin,''))});
  ok(Array.isArray(again)&&again.includes('/Tareas/')&&again.includes('/Tareas/sync-core.js?v=2099.2.1-4'),'after the caches are wiped, page and core are cached again: '+JSON.stringify(again));
  await c3.setOffline(true);await q.reload({waitUntil:'domcontentloaded'});await sleep(500);
  ok(await q.evaluate(()=>typeof applyAll==='function'&&APP_VERSION==='2099.2.1-4'),'and it opens offline with its core');
  await c3.setOffline(false);
  ok(e3.length===0,'no page errors '+e3);
  await c3.close();
}
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
