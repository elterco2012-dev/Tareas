// Correcciones de la revisión de las tandas 2 y 3
const L=require('../lib/gh');const {sleep,ok,mock,device,makeGH,day,T,TZ,go}=L;
let APP;   // la app servida por http (L.appUrl)
const crypto=require('crypto');
const iso=L.ago;
const DESK={viewport:{width:1000,height:900}},PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const row=(p,t)=>p.locator('.task').filter({has:p.locator('.ttext',{hasText:t})}).first();
const toastText=p=>p.evaluate(()=>{const t=document.getElementById('toast');return t&&!t.classList.contains('hidden')?t.innerText:''});
// Contexto con una demora en los GET (antes de abrir la página)
async function slowDevice(b,gh,opts,url,delay,init){
  const ctx=await b.newContext({timezoneId:TZ,colorScheme:'light',...opts});await mock(ctx,gh);
  await ctx.route('https://api.github.com/**',async r=>{if(r.request().method()==='GET'&&gh.getDelay)await sleep(gh.getDelay);return r.fallback()});
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  await p.addInitScript(init||(()=>{if(!sessionStorage.getItem('i')){sessionStorage.setItem('i','1');localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'}))}}));
  await p.goto(url);return {ctx,p};
}
(async()=>{
const b=await L.launch();APP=await L.appUrl();
// ===== 0/4: lo que subió el service worker no desaparece sin señal ni vuelve como "nueva" =====
{
  const gh=makeGH([T('a','Uno',{due:day(0)})]);
  let {ctx,p}=await device(b,gh,PHONE);
  ok(await p.evaluate(()=>'indexedDB' in window),'indexedDB available');
  // Como si el celular hubiera anotado sin señal y el service worker ya lo hubiera subido
  const task=T('n1','Anotada en el subte',{due:day(0),src:'cel'});
  gh.items=[...gh.items,{...task,order:1}];gh.sha++;
  await p.evaluate(async t=>{
    localStorage.setItem('tareasPendientes',JSON.stringify([{type:'add',task:t,opId:'op1',ts:Date.now()-60000}]));
    await idbSet('enviadas',['op1']);
  },task);
  gh.mode='offline';
  await p.reload();await sleep(900);
  ok(await row(p,'Anotada en el subte').isVisible(),'offline on open: the task the service worker uploaded is still listed');
  ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')||'[]').length)===0,'its op left the queue');
  gh.mode='ok';await p.evaluate(()=>sync());await sleep(800);
  ok(!/nueva/.test(await toastText(p))&&await p.locator('.task.llego').count()===0,'back online: not announced as "nueva" ('+await toastText(p)+')');
  ok(gh.items.filter(t=>t.id==='n1').length===1&&p.errs.length===0,'no duplicate, no errors '+p.errs);
  // Con la app abierta: el service worker gana y avisa
  const t2=T('n2','Comprar pan',{due:day(0),src:'cel'});
  gh.items=[...gh.items,{...t2,order:2}];gh.sha++;
  await p.evaluate(async t=>{localStorage.setItem('tareasPendientes',JSON.stringify([{type:'add',task:t,opId:'op2',ts:Date.now()}]));await idbSet('enviadas',['op2']);bgCheck=true;bgRegistered=true;await sync()},t2);
  await sleep(500);
  ok(await p.locator('.task.llego').count()===0&&!/nueva/.test(await toastText(p)),'app open, service worker uploaded: own task not highlighted');
  await ctx.close();
}
// ===== 1/6: sin rojo al abrir antes de intentar subir =====
{
  const gh=makeGH([T('a','Uno',{due:day(0)})]);
  let {ctx,p}=await device(b,gh,DESK);
  await p.evaluate(()=>localStorage.setItem('tareasPendientes',JSON.stringify([{type:'edit',id:'a',patch:{title:'Uno editada'},opId:'o1',ts:Date.now()-40*60000}])));
  gh.putDelay=2500;
  await p.reload();await sleep(700);
  const s1=await p.evaluate(()=>status().short);
  ok(s1!=='Sin subir (1)'&&s1==='Subiendo…','old queued change on open: amber while uploading ('+s1+')');
  await sleep(2600);
  ok(await p.evaluate(()=>status().short)==='Al día'&&gh.items[0].title==='Uno editada','then green');
  // Después de una falla real sí se pone rojo
  gh.putDelay=0;
  await p.evaluate(()=>localStorage.setItem('tareasPendientes',JSON.stringify([{type:'edit',id:'a',patch:{title:'Otra'},opId:'o2',ts:Date.now()-40*60000}])));
  await p.route('https://api.github.com/**',r=>r.request().method()==='PUT'?r.fulfill({status:500,body:'{}'}):r.fallback());
  await p.evaluate(()=>sync());await sleep(600);
  ok(await p.evaluate(()=>status().short)==='Sin subir (1)','after a failed upload, old queue → red');
  await p.unroute('https://api.github.com/**');
  // 7: 403 no repite el consejo
  await p.route('https://api.github.com/**',r=>r.fulfill({status:403,body:'{}'}));
  await p.evaluate(()=>sync());await sleep(500);
  const long=await p.evaluate(()=>status().long);
  ok(long.startsWith('Sin acceso al repositorio. Revisá usuario, repositorio y permisos del token. Están abajo, en "Cuenta de GitHub".')&&long.split('Revisá').length===2,'403: advice once: '+long);
  await p.unroute('https://api.github.com/**');
  await ctx.close();
}
// ===== 2: la próxima de una tarea que se repite no es "nueva" =====
{
  const gh=makeGH([T('r1','Pagar alquiler',{due:day(0),repeat:'weekly'})]);
  let {ctx,p}=await device(b,gh,DESK);
  gh.items=[{...gh.items[0],done:true,completedAt:L.date().toISOString()},T('r2','Pagar alquiler',{due:day(7),repeat:'weekly',repeatOf:'r1',order:1}),T('x1','Otra del celu',{due:day(0),src:'cel',order:2})];gh.sha++;
  await p.evaluate(()=>sync());await sleep(600);
  const tt=await toastText(p);
  ok(/1 nueva desde el celular/.test(tt)&&await p.locator('.task.llego').count()===1,'only the really new one is announced: '+tt);
  await ctx.close();
}
// ===== 3: zonas de toque en el celular sin romper el diseño =====
{
  const gh=makeGH([T('a','Pedir factura',{due:day(0),requester:'Laura',notes:'Que manden la factura también'})]);
  let {ctx,p}=await device(b,gh,PHONE);
  const st=await p.evaluate(()=>{const e=document.querySelector('.meta .person'),c=getComputedStyle(e);return {pad:c.padding,mar:c.margin}});
  ok(st.pad==='4px 8px'&&st.mar==='-4px -8px','.person on phone: padding '+st.pad+' margin '+st.mar);
  const noOverlap=await p.evaluate(()=>{const a=document.querySelector('.meta').getBoundingClientRect(),n=document.querySelector('.task .tnotes,.task .note,.task .notes');return {h:a.height,ok:!n||n.getBoundingClientRect().top>=a.bottom-1}});
  ok(noOverlap.h>0&&noOverlap.ok,'meta line keeps its height and does not overlap the note ('+JSON.stringify(noOverlap)+')');
  await p.click('#statusBtn');await sleep(200);
  ok(await p.evaluate(()=>{const r=document.getElementById('syncX').getBoundingClientRect();return r.width>=44&&r.height>=44}),'close button at least 44 px on phone');
  await ctx.close();
}
// ===== 5/20: token renovado sin fecha borra la del anterior =====
{
  const gh=makeGH([T('a','Uno',{due:day(0)})]);
  const key=t=>crypto.createHash('sha256').update(t).digest('hex').slice(0,12);
  gh.files['ajustes.json']={content:JSON.stringify({tokens:{[key('x')]:'2026-10-15'}}),sha:1};
  let {ctx,p}=await device(b,gh,DESK);
  await sleep(800);
  ok(await p.evaluate(()=>cfg.tokenExp)==='2026-10-15','date brought from ajustes.json');
  // Guardar sin cambiar el token: no toca ajustes.json
  await p.click('#statusBtn');await sleep(200);
  if(!await p.isVisible('#token'))await p.click('#acct summary');
  await p.fill('#tokenExp','');await p.click('#saveCfg');await sleep(800);
  ok(JSON.parse(gh.files['ajustes.json'].content).tokens[key('x')]==='2026-10-15','same token, no date: ajustes.json untouched');
  await p.click('#statusBtn');await sleep(200);
  if(!await p.isVisible('#token'))await p.click('#acct summary');
  await p.fill('#token','nuevo');await p.fill('#tokenExp','');await p.click('#saveCfg');await sleep(1200);
  const tok=JSON.parse(gh.files['ajustes.json'].content).tokens;
  ok(JSON.stringify(tok)==='{}','new token without a date: old date removed ('+JSON.stringify(tok)+')');
  // Si el otro dispositivo ya cargó la fecha del token nuevo, se mantiene y se trae
  gh.files['ajustes.json']={content:JSON.stringify({tokens:{[key('nuevo2')]:'2027-01-10'}}),sha:9};
  await p.click('#statusBtn');await sleep(200);
  if(!await p.isVisible('#token'))await p.click('#acct summary');
  await p.fill('#token','nuevo2');await p.fill('#tokenExp','');await p.click('#saveCfg');await sleep(1200);
  ok(JSON.parse(gh.files['ajustes.json'].content).tokens[key('nuevo2')]==='2027-01-10'&&await p.evaluate(()=>cfg.tokenExp)==='2027-01-10','other device\'s date for the new token kept and brought');
  await ctx.close();
}
// ===== 8, 9, 12, 14, 15, 16, 17: organización =====
{
  const gh=makeGH([T('i1','Anotada al pasar',{due:day(0),inbox:true,order:0}),T('w1','Presupuesto',{due:null,lastNudge:iso(15),nudges:2,order:1}),
    T('w2','Respuesta banco',{waiting:true,waitingOn:'Banco',waitingSince:iso(5),followUp:day(-1),order:2}),T('s1','Algún día',{due:null,order:3,createdAt:iso(40)})]);
  let {ctx,p}=await device(b,gh,DESK);
  const g=id=>gh.items.find(x=>x.id===id);
  // 8: la primera fecha de lo anotado al pasar no es pateada
  await p.click('#procBtn');await sleep(200);
  ok((await p.innerText('#procCard')).includes('Anotada al pasar'),'Procesar starts with the inbox task');
  await p.keyboard.press('m');await sleep(500);
  ok(g('i1').due===day(1)&&!g('i1').postponed&&g('i1').inbox===false,'inbox → M: not counted as postponed ('+g('i1').postponed+')');
  // 12: Reclamar con fecha para mirar ya pasada → deja de estar tarde
  ok((await p.innerText('#procCard')).includes('Respuesta banco'),'next: late waiting task');
  await p.keyboard.press('n');await sleep(500);
  ok(g('w2').nudges===1&&g('w2').followUp==null,'Reclamar clears a past follow-up date');
  ok(await p.evaluate(()=>!waitingLate(tasks.find(t=>t.id==='w2'))),'no longer late after Reclamar');
  await p.keyboard.press('Escape');await sleep(200);
  // 9: esperando de nuevo arranca de cero (y Deshacer lo devuelve)
  await p.evaluate(()=>setWaiting(tasks.find(t=>t.id==='w1'),true,'Ana'));await sleep(500);
  ok(g('w1').waiting&&g('w1').lastNudge==null&&g('w1').nudges===0,'waiting again: old nudges cleared');
  ok(await p.evaluate(()=>!waitingLate(tasks.find(t=>t.id==='w1'))),'not late right away');
  await p.click('#toastUndo');await sleep(500);
  ok(!g('w1').waiting&&g('w1').lastNudge&&g('w1').nudges===2,'Deshacer restores the nudges');
  // (la lista completa y el botón Revisión de la semana están en Tareas)
  await go(p,'tareas');
  // 16: en pantalla ancha, ↓ sigue el orden de la pantalla
  await p.setViewportSize({width:1366,height:900});await sleep(300);
  const ids=await p.evaluate(()=>visibleIds.map(id=>tasks.find(t=>t.id===id).title));
  ok(ids.join('|')==='Anotada al pasar|Respuesta banco|Presupuesto|Algún día'||ids.indexOf('Respuesta banco')<ids.indexOf('Algún día'),'wide: Esperando before Sin fecha in key order: '+ids.join('|'));
  await p.setViewportSize({width:1000,height:900});await sleep(200);
  // 14: botón "Revisión de la semana" y Shift+P
  await p.click('#revBtn');await sleep(200);
  ok(await p.isVisible('#procOv')&&(await p.innerText('#procH'))==='Revisión de la semana','"Revisión de la semana" button opens the weekly review');
  // 17: S en una sin fecha = "Sigue así"
  let card=await p.innerText('#procCard');
  while(!card.includes('Algún día')&&!card.includes('Nada para')){await p.keyboard.press('ArrowRight');await sleep(150);card=await p.innerText('#procCard')}
  ok(card.includes('Algún día'),'weekly reaches the undated task');
  await p.keyboard.press('s');await sleep(500);
  ok(!!g('s1').reviewedAt,'weekly S on an undated task marks it reviewed');
  await p.keyboard.press('Escape');await sleep(200);
  await p.keyboard.press('Shift+P');await sleep(200);
  ok(await p.isVisible('#procOv')&&(await p.innerText('#procH'))==='Revisión de la semana','Shift+P opens the weekly review');
  await p.keyboard.press('Escape');await sleep(200);
  // 15: Enter sobre un botón con foco en Procesar ejecuta ese botón
  gh.items.push(T('d1','Para borrar',{due:day(-1),order:9}));gh.sha++;await p.evaluate(()=>sync());await sleep(500);
  await p.keyboard.press('p');await sleep(200);
  let c2=await p.innerText('#procCard');
  while(!c2.includes('Para borrar')&&!c2.includes('Nada para')){await p.keyboard.press('ArrowRight');await sleep(150);c2=await p.innerText('#procCard')}
  await p.locator('#procBtns button',{hasText:'Borrar'}).focus();await p.keyboard.press('Enter');await sleep(500);
  ok(!!g('d1').deletedAt,'Enter on focused "Borrar" deletes (not "Siguiente")');
  ok(p.errs.length===0,'no page errors '+p.errs);
  await ctx.close();
}
// ===== 14: en el celular también está el botón =====
{
  const gh=makeGH([T('s1','Algún día',{due:null})]);
  let {ctx,p}=await device(b,gh,PHONE);
  await go(p,'tareas');
  ok(await p.isVisible('#revBtn'),'phone: "Revisión de la semana" visible');
  const box=await p.evaluate(()=>{const r=document.getElementById('revBtn').getBoundingClientRect();return {r:r.right,w:innerWidth,h:r.height}});
  ok(box.r<=box.w&&box.h>=44,'phone: button fits and is 44 px tall '+JSON.stringify(box));
  await p.click('#revBtn');await sleep(200);
  ok((await p.innerText('#procCard')).includes('Algún día'),'phone: weekly review opens');
  await ctx.close();
}
// ===== 13: ?revisar=1 espera la primera sincronización =====
{
  const gh=makeGH([T('a','Sin fecha a',{due:null,createdAt:iso(3)}),T('b','Sin fecha b',{due:null,createdAt:iso(2)}),T('c','Esperando c',{waiting:true,waitingOn:'Leo',waitingSince:iso(1)})]);
  const init=()=>{if(!sessionStorage.getItem('i')){sessionStorage.setItem('i','1');localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'}));
    localStorage.setItem('tareasCache',JSON.stringify({owner:'u',repo:'r',items:[{id:'a',title:'Sin fecha a',due:null,done:false,priority:'Media',order:0}],sha:'0'}))}};
  gh.getDelay=1500;
  let {ctx,p}=await slowDevice(b,gh,DESK,APP+'?revisar=1',1500,init);
  await sleep(2600);
  ok(await p.isVisible('#procOv')&&(await p.innerText('#procN'))==='1 de 3','weekly review built after the first sync: '+await p.innerText('#procN').catch(()=>''));
  await ctx.close();
  // Muy lento: abre igual a los 4 s con lo guardado
  gh.getDelay=8000;
  ({ctx,p}=await slowDevice(b,gh,DESK,APP+'?revisar=1',8000,init));
  await sleep(4600);
  ok(await p.isVisible('#procOv'),'GitHub very slow: opens after 4 s anyway');
  await ctx.close();
  // Navegador sin conectar (el de Telegram)
  const ctx2=await b.newContext({timezoneId:TZ});const p2=await ctx2.newPage();await p2.goto(APP+'?revisar=1');await sleep(600);
  ok((await p2.innerText('#procCard')).includes('Este navegador no está conectado'),'unconnected browser: says so');
  // Sin GitHub ("Solo acá"), abriendo la revisión desde el botón: sin ese aviso
  await p2.goto(APP);await sleep(400);await go(p2,'tareas');await p2.click('#revBtn');await sleep(200);
  ok(!(await p2.innerText('#procCard')).includes('no está conectado'),'local-only user via the button: no link message');
  await ctx2.close();
}
await b.close();
console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
