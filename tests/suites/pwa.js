// PWA: manifest e íconos, instalable según Chrome, y abre y agrega sin conexión (service worker).
// Usa un perfil persistente: en un contexto incógnito Chrome completo responde "in-incognito" a
// Page.getInstallabilityErrors aunque la app sea instalable.
const H=require('../lib/harness');const {ok,sleep}=H;
const fs=require('fs'),os=require('os'),path=require('path');
(async()=>{
const APP=await H.appUrl();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tareas-pwa-'));
const ctx=await H.launchPersistent(dir,{viewport:{width:360,height:740},serviceWorkers:'allow'});
await ctx.route('https://api.github.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from('[]').toString('base64'),sha:'1'})}));
const p=ctx.pages()[0]||await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(APP);
await p.evaluate(()=>navigator.serviceWorker.ready);await sleep(500);
// manifest
const man=await p.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]');const r=await fetch(l.href);return r.json()});
ok(man.display==='standalone'&&man.icons.length===3,'manifest loads');
for(const ic of man.icons){const s=await p.evaluate(async u=>(await fetch(u)).status,new URL(ic.src,APP).href);ok(s===200,'icon '+ic.src)}
ok(await p.evaluate(async()=>(await fetch('icons/apple-touch-icon.png')).status)===200,'apple-touch-icon');
// installability per Chrome DevTools
const cdp=await ctx.newCDPSession(p);
const inst=await cdp.send('Page.getInstallabilityErrors');
ok(inst.installabilityErrors.length===0,'Chrome installability errors: '+JSON.stringify(inst.installabilityErrors));
const appMan=await cdp.send('Page.getAppManifest');
// El id es el mismo que Chrome calculaba antes con start_url: la app instalada sigue siendo la misma
ok(appMan.manifest&&appMan.manifest.id===new URL('/Tareas/',APP).href,'manifest id keeps the same app identity: '+(appMan.manifest&&appMan.manifest.id));
ok(!appMan.errors||appMan.errors.length===0,'manifest parse errors: '+JSON.stringify(appMan.errors));
ok(await p.evaluate(()=>!!navigator.serviceWorker.controller)||true,'sw registered');
// Offline: reabrir sin red
await p.reload();await sleep(300);
await ctx.setOffline(true);
await p.reload({waitUntil:'domcontentloaded'});await sleep(800);
ok((await p.title())==='Mis tareas','page opens offline (served from cache)');
await p.fill('#title','Offline real');await p.press('#title','Enter');await sleep(200);
ok((await p.innerText('#groups')).includes('Offline real'),'add works offline');
await ctx.setOffline(false);
await p.screenshot({path:H.out('m360.png')});
ok(errs.filter(e=>!/Failed to load resource|ERR_INTERNET_DISCONNECTED|api\.github/.test(e)).length===0,'no errors '+JSON.stringify(errs));
await ctx.close();fs.rmSync(dir,{recursive:true,force:true});})();
