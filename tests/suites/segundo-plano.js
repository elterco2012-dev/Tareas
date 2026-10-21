// Subida en segundo plano: sin señal se agrega una tarea, se cierra la app, vuelve la conexión y el
// service worker la sube solo. Necesita servidor http (service worker) y que Playwright intercepte los
// pedidos del service worker (PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1, se pone acá mismo).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS='1';
const L=require('../lib/gh');const {sleep,ok,makeGH,day,T,TZ}=L;
(async()=>{
const b=await L.launch();const APPURL=await L.appUrl(),ORIGIN=await L.appOrigin();
const gh=makeGH([T('a','Uno',{due:day(0)})]);gh.messages=[];
const ctx=await b.newContext({timezoneId:TZ,viewport:{width:400,height:800},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
let swReqs=0;
await ctx.route('https://api.github.com/**',async route=>{
  const req=route.request();if(req.serviceWorker())swReqs++;
  if(gh.mode==='offline')return route.abort('internetdisconnected');
  // tareas.json borrado: GET 404 y un PUT con sha no vale
  if(gh.missing&&/tareas\.json$/.test(req.url())&&(req.method()==='GET'||JSON.parse(req.postData()||'{}').sha))return route.fulfill({status:req.method()==='GET'?404:422,body:'{}'});
  if(req.method()==='PUT'){const body=JSON.parse(req.postData());gh.messages.push(body.message+(req.serviceWorker()?' [sw]':''));if(String(body.sha)!==String(gh.sha))return route.fulfill({status:409,body:'{}'});
    gh.items=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));gh.sha++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.sha)}})})}
  // (el repositorio existe; otros archivos, no)
  const u=new URL(req.url());if(!/tareas\.json$/.test(u.pathname))return route.fulfill(/\/contents\//.test(u.pathname)?{status:404,body:'{}'}:{status:200,contentType:'application/json',body:JSON.stringify({private:!gh.publico})});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from(JSON.stringify(gh.items)).toString('base64'),sha:String(gh.sha)})});
});
let p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
await p.addInitScript(()=>{if(!localStorage.getItem('githubTasksConfig'))localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'}))});
await p.goto(APPURL);await p.evaluate(()=>navigator.serviceWorker.ready);await sleep(800);
await p.reload();await sleep(800);   // ya controlada por el service worker
ok(await p.evaluate(()=>!!navigator.serviceWorker.controller),'page controlled by the service worker');
// Sin señal: se agrega y se "cierra la app"
gh.mode='offline';
await p.fill('#title','Anotada en el ascensor');await p.press('#title','Enter');await sleep(1500);
await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{get:()=>'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
await sleep(800);
const snap=await p.evaluate(()=>idbGet('pendiente'));
ok(snap&&snap.ops.length===1&&snap.cfg.owner==='u','snapshot for the service worker in IndexedDB');
await p.close();
// Vuelve la conexión, con la app cerrada: Chrome dispara 'sync' en el service worker
gh.mode='ok';
const blank=await ctx.newPage();const cdp=await ctx.newCDPSession(blank);
const regs=[];cdp.on('ServiceWorker.workerRegistrationUpdated',e=>regs.push(...e.registrations));
await cdp.send('ServiceWorker.enable');await sleep(500);
const reg=regs.find(r=>r.scopeURL.startsWith(APPURL));
ok(!!reg,'service worker registration found');
await cdp.send('ServiceWorker.dispatchSyncEvent',{origin:ORIGIN,registrationId:reg.registrationId,tag:'subir',lastChance:false});
await sleep(2500);
ok(gh.items.some(x=>x.title==='Anotada en el ascensor'),'uploaded by the service worker with the app closed');
ok(gh.messages.some(m=>/\(segundo plano\) \[sw\]$/.test(m)),'commit marked as background: '+JSON.stringify(gh.messages));
// Al abrir la app, no se sube dos veces
const puts=gh.messages.length;
p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
await p.goto(APPURL);await sleep(2000);
ok(gh.messages.length===puts&&gh.items.filter(x=>x.title==='Anotada en el ascensor').length===1,'reopening does not upload it again');
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')||'[]').length)===0&&await p.innerText('#statusShort')==='Al día','outbox empty and "Al día" after reopening');
ok(!(await p.evaluate(()=>idbGet('pendiente'))),'snapshot cleared');
// Si tareas.json desapareció, el service worker no crea uno nuevo con solo lo pendiente (lo resuelve la página)
gh.mode='offline';await p.fill('#title','Sin señal y sin archivo');await p.press('#title','Enter');await sleep(1200);
await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{get:()=>'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))});await sleep(800);
const had=((await p.evaluate(()=>idbGet('pendiente')))||{}).had;
ok(had>=2,'the snapshot remembers how many tasks there were: '+had);
await p.close();
gh.mode='ok';gh.missing=true;const before=gh.messages.length;
await cdp.send('ServiceWorker.dispatchSyncEvent',{origin:ORIGIN,registrationId:reg.registrationId,tag:'subir',lastChance:false});
await sleep(2500);
ok(gh.messages.length===before,'tareas.json missing: the service worker does not create one with only the pending change');
p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
await p.goto(APPURL);await sleep(2000);
ok(await p.evaluate(()=>fileGuard&&fileGuard.kind)==='missing'&&await p.evaluate(()=>tasks.some(t=>t.title==='Sin señal y sin archivo')),'the page shows the missing-file warning and keeps the pending task');
gh.missing=false;
// Borrar la conexión borra la copia con el token
gh.mode='offline';await p.fill('#title','Otra sin señal');await p.press('#title','Enter');await sleep(1200);
ok(!!(await p.evaluate(()=>idbGet('pendiente'))),'snapshot written again when offline');
await p.click('#statusBtn');await p.click('#clearCfg');await p.click('#clearCfg');await sleep(500);
ok(!(await p.evaluate(()=>idbGet('pendiente'))),'clearing the connection removes the snapshot (token) from IndexedDB');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await p.close();
// El service worker tampoco sube sobre un tareas.json vaciado ni a un repositorio público
gh.mode='ok';gh.items=[T('a','Uno',{due:day(0)}),T('b','Dos',{due:day(0)}),T('c','Tres',{due:day(0)}),T('d','Cuatro')];gh.sha++;
p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
await p.addInitScript(()=>{if(!localStorage.getItem('githubTasksConfig'))localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'}))});   // (se borró la conexión)
await p.goto(APPURL);await sleep(1500);
gh.mode='offline';await p.fill('#title','Otra más sin señal');await p.press('#title','Enter');await sleep(1200);
await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{get:()=>'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))});await sleep(800);
ok(((await p.evaluate(()=>idbGet('pendiente')))||{}).live===5,'the snapshot remembers how many live tasks there are (4 + the new one)');
await p.close();
gh.mode='ok';const full=gh.items;gh.items=[];gh.sha++;
let before2=gh.messages.length,reqs=swReqs;
await cdp.send('ServiceWorker.dispatchSyncEvent',{origin:ORIGIN,registrationId:reg.registrationId,tag:'subir',lastChance:false});await sleep(2500);
ok(swReqs>reqs&&gh.messages.length===before2&&gh.items.length===0,'tareas.json emptied: the service worker looks but does not upload');
gh.items=full;gh.sha++;gh.publico=true;before2=gh.messages.length;reqs=swReqs;
await cdp.send('ServiceWorker.dispatchSyncEvent',{origin:ORIGIN,registrationId:reg.registrationId,tag:'subir',lastChance:false});await sleep(2500);
ok(swReqs>reqs&&gh.messages.length===before2,'public repository: the service worker does not upload');
gh.publico=false;
await cdp.send('ServiceWorker.dispatchSyncEvent',{origin:ORIGIN,registrationId:reg.registrationId,tag:'subir',lastChance:false});await sleep(2500);
ok(gh.items.some(x=>x.title==='Otra más sin señal'),'private again: the service worker uploads it');
await b.close();console.log('fails',L.fails)})();
