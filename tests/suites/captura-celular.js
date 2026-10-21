// Tanda 1: captura en el celular
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
let APP;   // la app servida por http (L.appUrl)
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const FAKE=()=>{class FakeSR{constructor(){window.__rec=this}
  start(){const say=window.__say||[],fail=window.__fail;
    if(fail){setTimeout(()=>{this.onerror&&this.onerror({error:fail});this.onend&&this.onend()},50);return}
    say.forEach((txt,i)=>setTimeout(()=>{const r=[[{transcript:txt}]];r[0].isFinal=i===say.length-1;this.onresult&&this.onresult({results:r})},80+i*100));
    setTimeout(()=>this.onend&&this.onend(),120+say.length*100)}
  stop(){setTimeout(()=>this.onend&&this.onend(),10)} abort(){setTimeout(()=>this.onend&&this.onend(),10)}}
  window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR};
const STANDALONE=()=>{const mm=window.matchMedia.bind(window);window.matchMedia=q=>/display-mode:\s*standalone/.test(q)?{matches:true,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}:mm(q)};
const row=(p,t)=>p.locator('.task').filter({has:p.locator('.ttext',{hasText:t})}).first();
(async()=>{
const b=await L.launch();APP=await L.appUrl();
let gh=makeGH([T('p1','Mandar remitos',{requester:'Laura',createdAt:L.ago(1),done:true,completedAt:L.date().toISOString()}),
  T('p2','Revisar stock',{requester:'Juan',createdAt:L.date().toISOString()}),T('p3','Otra',{requester:'Marcela',createdAt:L.ago(5)}),
  T('p4','Vieja',{requester:'Pedro',createdAt:L.ago(9)})]);
// ===== Intérprete: ¿? ¡! =====
let {ctx,p}=await device(b,gh,{viewport:{width:1000,height:800}});
const P=await p.evaluate(()=>{const f=t=>{const q=parse(t);return {title:q.title,due:q.due||null,time:q.time?timeLabel(q.time):null,pr:q.priority||null}};
  return {a:f('Mandame el remito mañana!'),b:f('¿Me llamás mañana a las 3?'),c:f('Pasame el presupuesto el viernes?'),d:f('Urgente! revisar caja'),e:f('Llamar !alta'),
    g:f('leer https://x.com/a?b=1 mañana'),h:f('¡Hola!'),i:f('¿Revisar stock?'),tom:addDays(1),fri:addDays((5-new Date().getDay()+7)%7||7)}});
ok(P.a.title==='Mandame el remito'&&P.a.due===P.tom,'"mañana!" → date: '+JSON.stringify(P.a));
ok(P.b.title==='Me llamás'&&P.b.due===P.tom&&P.b.time==='15:00','"¿… mañana a las 3?" → date and time: '+JSON.stringify(P.b));
ok(P.c.due===P.fri&&P.c.title==='Pasame el presupuesto','"el viernes?" → date: '+JSON.stringify(P.c));
ok(P.d.pr==='Alta'&&P.d.title==='Revisar caja','"Urgente!" → priority: '+JSON.stringify(P.d));
ok(P.e.pr==='Alta'&&P.e.title==='Llamar','"!alta" still works');
ok(P.g.title==='leer https://x.com/a?b=1'&&P.g.due===P.tom,'URL with ? kept: '+JSON.stringify(P.g));
ok(P.h.title==='Hola','¡Hola! → Hola: '+JSON.stringify(P.h));
ok(P.i.title==='Revisar stock','"¿Revisar stock?" → clean title: '+JSON.stringify(P.i));
await ctx.close();
// ===== Compartir desde WhatsApp =====
({ctx,p}=await device(b,gh,PHONE,APP+'?text='+encodeURIComponent('Che, ¿me mandás el remito de Ferretería López mañana? Gracias!')));
ok(await p.inputValue('#title')==='Me mandás el remito de Ferretería López mañana','share cleaned: '+await p.inputValue('#title'));
ok((await p.innerText('#detected')).includes('Mañana'),'date detected after cleaning');
await ctx.close();
const long='Hola Juan, necesito que me mandes el informe de ventas de octubre. Tiene que incluir las sucursales del norte y el detalle por vendedor, porque lo presento en la reunión de gerencia. Gracias!';
({ctx,p}=await device(b,gh,PHONE,APP+'?text='+encodeURIComponent(long)));
ok(await p.inputValue('#title')==='Necesito que me mandes el informe de ventas de octubre.'&&(await p.inputValue('#note')).startsWith('Tiene que incluir')&&await p.isVisible('#note'),'long message: first sentence title, rest in note');
ok((await p.innerText('#toastMsg')).includes('nota'),'toast mentions the note');
await ctx.close();
// Si el resto trae la fecha, queda todo en el título para que se detecte
const longDate='Hola Juan, necesito que me mandes el informe de ventas de octubre. Tiene que incluir las sucursales del norte y el detalle por vendedor, porque lo presento el lunes en la reunión de gerencia. Gracias!';
({ctx,p}=await device(b,gh,PHONE,APP+'?text='+encodeURIComponent(longDate)));
ok((await p.inputValue('#title')).includes('lo presento el lunes')&&!await p.isVisible('#note')&&(await p.innerText('#detected')).includes('Lun'),'long message with a date in the rest: kept whole, date detected');
await ctx.close();
// ===== Abrir listo para anotar (app instalada en el celular, con la opción de Sincronización › Este dispositivo) =====
const KBD=()=>{localStorage.setItem('abrirConTeclado','true')};
({ctx,p}=await device(b,gh,PHONE,APP,STANDALONE));
ok(await p.evaluate(()=>document.activeElement.id)!=='title','standalone phone: opens without the keyboard by default');
await p.addInitScript(KBD);await p.reload();await sleep(500);
ok(await p.evaluate(()=>document.activeElement.id)==='title','standalone phone with the option on: field focused on open');
await ctx.close();
({ctx,p}=await device(b,gh,PHONE));
ok(await p.evaluate(()=>document.activeElement.id)!=='title','browser tab on phone: not focused');
await ctx.close();
// Volver después de un rato: arriba, sin menú, lista para anotar
gh.items=gh.items.concat(Array.from({length:25},(_,i)=>T('x'+i,'Tarea '+i,{due:day(0)})));gh.sha++;
({ctx,p}=await device(b,gh,PHONE,APP,STANDALONE));
await p.addInitScript(KBD);await p.reload();await sleep(500);
await p.evaluate(()=>document.activeElement.blur());
await row(p,'Tarea 20').locator('.more').tap();await sleep(100);
ok(await p.isVisible('#menu'),'menu open');
// Salir de la app y volver ms después: el reloj se adelanta (fastForward), sin esperar de verdad
const setVis=v=>p.evaluate(v=>{window.__vis=v;Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true});document.dispatchEvent(new Event('visibilitychange'))},v);
const back=async ms=>{await setVis('hidden');await p.clock.fastForward(ms);await setVis('visible')};
await back(30000);
ok(await p.isVisible('#menu'),'short absence: nothing changes');
await back(200000);
ok(await L.until(async()=>!(await p.isVisible('#menu'))&&await p.evaluate(()=>scrollY)===0&&await p.evaluate(()=>document.activeElement.id)==='title',{timeout:8000}),'after 2+ min: menu closed, top, field focused');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
gh.items=gh.items.filter(x=>!/^x/.test(x.id));gh.sha++;
// Tip: solo las primeras 5 aperturas
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:800}},APP,()=>{if(!sessionStorage.getItem('t')){sessionStorage.setItem('t',1);localStorage.setItem('tipVisto','5')}}));
ok(!(await p.isVisible('#tip')),'tip hidden after 5 opens');
await ctx.close();
// ===== Dictado que se guarda solo =====
({ctx,p}=await device(b,gh,PHONE,APP,FAKE));
await p.evaluate(()=>{window.__say=['recordame mañana a las 3 llamar al banco']});
await p.locator('#addBtn').tap();await sleep(500);
ok(await p.evaluate(()=>document.getElementById('addBtn').dataset.mode)==='saving'&&await p.isVisible('#saveHint'),'countdown after dictation');
ok(!gh.items.some(x=>/banco/.test(x.title)),'not saved yet');
await sleep(3300);
let t=gh.items.find(x=>x.title==='Llamar al banco');
ok(t&&t.due===day(1)&&t.time==='15:00','saved by itself after 3 s');
ok((await p.innerText('#toastMsg'))==='Agregada para mañana · 15:00'&&(await p.innerText('#toastUndo'))==='Deshacer'&&(await p.innerText('#toastB2'))==='Cambiar','toast: Deshacer + Cambiar');
await p.locator('#toastB2').tap();await sleep(200);
ok(await p.isVisible('#editOv')&&await p.inputValue('#eTitle')==='Llamar al banco','Cambiar opens Editar');
await p.locator('#eCancel').tap();
// Deshacer borra
await p.evaluate(()=>{window.__say=['comprar pan']});await p.locator('#addBtn').tap();await sleep(500);
await p.locator('#addBtn').tap();await sleep(400);   // tocar "Guardar · 3" guarda ya
ok(gh.items.some(x=>x.title==='Comprar pan'),'tap during countdown saves now');
await p.locator('#toastUndo').tap();await sleep(500);
ok(!gh.items.some(x=>x.title==='Comprar pan'),'Deshacer removes it');
// tocar el texto cancela
await p.evaluate(()=>{window.__say=['pagar la luz']});await p.locator('#addBtn').tap();await sleep(500);
await p.locator('#title').tap();await sleep(3500);
ok(!gh.items.some(x=>/luz/i.test(x.title))&&await p.inputValue('#title')==='pagar la luz','tapping the text cancels the countdown');
await p.fill('#title','');
// solo "recordame mañana": no se guarda
await p.evaluate(()=>{window.__say=['recordame mañana']});await p.locator('#addBtn').tap();await sleep(3800);
ok(!(await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')||'[]').some(o=>o.type==='add'&&/recordame/i.test(o.task.title))))&&(await p.innerText('#toastMsg')).includes('Decí también'),'bare command not saved');
await p.fill('#title','');
// salir de la app durante la cuenta → se guarda ya
await p.evaluate(()=>{window.__say=['llamar a Pedro']});await p.locator('#addBtn').tap();await sleep(500);
await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{get:()=>'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')||'[]').some(o=>o.type==='add'&&o.task.title==='Llamar a Pedro'))||gh.items.some(x=>x.title==='Llamar a Pedro'),'leaving the app during countdown saves it');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
// ===== Fila "De:" =====
({ctx,p}=await device(b,gh,PHONE));
await p.locator('#title').tap();await p.keyboard.type('pagar impuestos');await sleep(100);
let who=await p.$$eval('#whoRow button',bs=>bs.map(x=>x.innerText));
ok(JSON.stringify(who)===JSON.stringify(['Juan','Laura','Marcela','@…']),'who row: recent first: '+JSON.stringify(who));
await p.locator('#whoRow button',{hasText:'Laura'}).tap();await sleep(100);
ok(await p.inputValue('#title')==='pagar impuestos @Laura '&&await p.evaluate(()=>document.activeElement.id)==='title'&&!(await p.isVisible('#whoRow')),'tap adds @Laura, keeps keyboard, row hides');
await p.fill('#title','reunión con Juan pedido por Pedro');await sleep(100);
ok(!(await p.isVisible('#whoRow')),'hidden when the text says who');
await p.fill('#title','');await p.keyboard.type('pagar luz');await sleep(100);
ok((await p.$$eval('#whoRow button',bs=>bs.length))===4&&await p.isVisible('#whoRow'),'row comes back after being hidden');
await ctx.close();
// ===== Borrador =====
({ctx,p}=await device(b,gh,PHONE));
await p.locator('#title').tap();await p.keyboard.type('mandar el remito a Ferre');
await p.reload();await sleep(500);
ok(await p.inputValue('#title')==='mandar el remito a Ferre','draft restored after reload');
await p.locator('#title').tap();await p.keyboard.type('tería');await p.keyboard.press('Enter');await sleep(300);
await p.reload();await sleep(500);
ok(await p.inputValue('#title')==='','draft cleared after adding');
// El borrador dura 12 h (reloj adelantado, sin esperar)
await p.locator('#title').tap();await p.keyboard.type('borrador de anoche');
await p.clock.fastForward(11*3600e3);await p.reload();await sleep(500);
ok(await p.inputValue('#title')==='borrador de anoche','draft 11 h old: still restored');
await p.clock.fastForward(61*60e3);await p.reload();await sleep(500);
ok(await p.inputValue('#title')==='','draft older than 12 h: not restored');
await ctx.close();
// ===== Atajo "Dictar tarea" =====
({ctx,p}=await device(b,gh,PHONE,APP+'?voz=1',FAKE));
ok(await p.isVisible('#voiceDock')&&(await p.innerText('#dockMic')).includes('Tocá y hablá')&&await p.evaluate(()=>document.activeElement.id)!=='title','?voz=1 shows the big mic, no keyboard');
ok(await p.evaluate(()=>location.search)==='','param removed from the URL');
await p.screenshot({path:L.out('dock-384.png')});
await p.evaluate(()=>{window.__say=['revisar la caja chica']});
// "Escuchando" lo pone el toque mismo: se lee enseguida (con una espera, el reconocimiento de mentira ya terminó)
await p.locator('#dockMic').tap();
ok((await p.innerText('#dockMic')).includes('Escuchando'),'listening label');
ok(await L.until(async()=>(await p.innerText('#dockMic')).includes('Guardando')),'countdown label');
await sleep(3300);
ok(gh.items.some(x=>x.title==='Revisar la caja chica')&&await p.isVisible('#voiceDock'),'saved, dock stays for another');
await p.locator('#dockClose').tap();ok(!(await p.isVisible('#voiceDock')),'Ver lista closes it');
await ctx.close();
// Sin señal
// (por http hace falta el service worker para abrir sin señal, como la app instalada)
gh.mode='offline';
({ctx,p}=await device(b,gh,{...PHONE,serviceWorkers:'allow'},APP,FAKE));
await p.evaluate(()=>navigator.serviceWorker.ready);await sleep(300);
await ctx.setOffline(true);await p.goto(APP+'?voz=1').catch(()=>{});await sleep(400);
ok(!(await p.isVisible('#voiceDock'))&&await p.evaluate(()=>document.activeElement.id)==='title'&&(await p.innerText('#toastMsg')).includes('micrófono del teclado'),'offline: no dock, keyboard mic hint');
await ctx.close();gh.mode='ok';
// ===== Manifest =====
const fs=require('fs');const man=JSON.parse(L.readRepo('manifest.webmanifest'));
ok(man.shortcuts.length===2&&man.shortcuts[1].url==='./?voz=1'&&man.shortcuts.every(s=>fs.existsSync(L.repoFile(s.icons[0].src))),'two shortcuts with their own icons');
await b.close();console.log('fails',L.fails)})();
