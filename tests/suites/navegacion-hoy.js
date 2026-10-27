// Rediseño 1a: las cuatro pantallas (Hoy · Tareas · Notas · Buscar), la barra de abajo (celular) o de la izquierda
// (compu, desde 900 px), Hoy como inicio (fila Ordenar, Vencidas, Para reclamar, Para hoy, Próximos avisos, links) y
// el botón Atrás (desde Tareas, Notas o Buscar vuelve a Hoy; desde Hoy sale de la app)
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go,ago}=L;
let APP;
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
// Sin la pista de la primera vez; y cada pushState anota si venía de un toque (Chrome saltea con Atrás las entradas
// creadas sin uno, y page.goBack() de las pruebas no las saltea: hay que mirarlo aparte)
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}))}
  window.__push=[];const o=history.pushState.bind(history);history.pushState=(...a)=>{window.__push.push(navigator.userActivation?navigator.userActivation.isActive:null);return o(...a)}};
const ENV='recordatorios-enviados.json';
const AVISOS_ON=()=>{if(!sessionStorage.getItem('av')){sessionStorage.setItem('av','1');localStorage.setItem('avisosTelegram',JSON.stringify({repo:'u/r',last:'2026-10-13T23:50:00.000Z'}))}
  if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}))}};
const onApp=p=>p.url().startsWith(APP);
const screen=p=>p.evaluate(()=>document.body.dataset.screen);
const row=(p,t)=>p.locator('#wrap .task').filter({has:p.locator('.ttext',{hasText:t})}).first();
const box=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return r.width&&r.height?{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),b:Math.round(r.bottom),r:Math.round(r.right)}:null},s);
const heads=p=>p.evaluate(()=>[...document.querySelectorAll('#hoyList .ghead')].map(h=>h.querySelector('.gfold span,span').textContent));
const inSec=(p,title)=>p.evaluate(t=>{const g=[...document.querySelectorAll('#hoyList .grp')].find(x=>x.querySelector('.ghead span').textContent===t);return g?[...g.querySelectorAll('.task .ttext')].map(x=>x.textContent):null},title);
const taps=async(p,l)=>{const pu=await p.evaluate(()=>window.__push||[]);ok(pu.every(x=>x!==false),'every new history entry came from a tap ('+l+') '+JSON.stringify(pu))};
const noErr=(p,l)=>ok(p.errs.filter(e=>!/sessionStorage/.test(e)).length===0,'no page errors ('+l+') '+JSON.stringify(p.errs));
const noDup=p=>p.evaluate(()=>{const ids=[...document.querySelectorAll('#wrap .task[data-id]')].map(r=>r.dataset.id);return ids.length===new Set(ids).size});
(async()=>{
const b=await L.launch();APP=await L.appUrl();
// Miércoles 14/10, 10:00
const items=()=>[
  T('o1','Pagar el seguro',{due:day(-3),priority:'Alta',requester:'Laura'}),
  T('o2','Llamar al banco',{due:day(-1),inbox:true}),                 // anotada al pasar ayer: vencida (una sola vez en Ordenar)
  T('t1','Revisar presupuesto',{due:day(0)}),
  T('t2','Reunión con proveedores',{due:day(0),time:'15:00'}),
  T('t3','Comprar cartuchos',{due:day(0),inbox:true}),
  T('t4','Mandar remitos',{due:day(0),time:'09:00'}),
  T('m1','Pagar la luz',{due:day(1)}),
  T('m2','Turno médico',{due:day(1),time:'11:00'}),
  T('s1','Dentista',{due:day(3),time:'16:00'}),
  T('s2','Cena',{due:day(5),time:'21:00'}),
  T('s3','Vacuna',{due:day(7),time:'08:00'}),
  T('s4','Muy lejos',{due:day(9),time:'10:00'}),
  T('n1','Ordenar el escritorio'),
  T('w1','Respuesta de Juan',{waiting:true,waitingOn:'Juan',waitingSince:ago(4)}),          // 4 días: reclamar
  T('w2','Presupuesto de Marcela',{waiting:true,waitingOn:'Marcela',waitingSince:ago(1)}),  // 1 día: todavía no
  T('w3','Firma de Pedro',{waiting:true,waitingOn:'Pedro',waitingSince:ago(1),followUp:day(0)}),   // hoy toca mirarla
  T('w4','Remito de Ana',{waiting:true,waitingOn:'Ana',waitingSince:ago(10),followUp:day(2)}),     // la fecha manda: todavía no
  T('w5','Pago de Luis',{waiting:true,waitingOn:'Luis',waitingSince:ago(10),lastNudge:ago(1)}),    // reclamado ayer: todavía no
  T('nt','Clave del wifi en la heladera',{kind:'nota'}),
];

// ===== Celular: la barra de abajo y Hoy =====
let gh=makeGH(items());
let {ctx,p}=await device(b,gh,PHONE,APP,SEEN);
ok(await screen(p)==='hoy'&&await p.getAttribute('#navHoy','aria-current')==='page','opens on Hoy');
const nav=await box(p,'#nav');
ok(nav&&nav.h===76&&nav.b===832&&nav.x===0&&nav.w===384,'bottom bar: 76 px, across the bottom '+JSON.stringify(nav));
const items4=await p.evaluate(()=>[...document.querySelectorAll('#nav .nb')].map(x=>{const r=x.getBoundingClientRect();return {t:x.querySelector('.nl').textContent,x:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}}).sort((a,b)=>a.x-b.x));
ok(items4.map(x=>x.t).join(',')==='Hoy,Tareas,Notas,Buscar'&&items4.every(x=>x.w>=44&&x.h>=44),'Hoy · Tareas · Notas · Buscar, each at least 44 px '+JSON.stringify(items4));
const pill=await box(p,'#navHoy .ic');
ok(pill&&pill.w===60&&pill.h===32&&await p.evaluate(()=>getComputedStyle(document.querySelector('#navHoy .ic')).backgroundColor)!=='rgba(0, 0, 0, 0)','the active one has a 60×32 pill');
// Encabezado en una línea, con el resumen y el próximo aviso (la hora de la tarea)
const hd=await p.evaluate(()=>({h:Math.round(document.querySelector('.top').getBoundingClientRect().height),sum:document.getElementById('summary').innerText.replace(/\s+/g,' ')}));
ok(hd.h<=56&&/2 vencidas/.test(hd.sum)&&/4 para hoy/.test(hd.sum)&&/próxima 15:00/.test(hd.sum),'phone header: one line with the summary and the next one with a time '+JSON.stringify(hd));
// La fila Ordenar: lo mismo que recorre Ordenar (la anotada de ayer cuenta como vencida, una sola vez)
const ord=await p.evaluate(()=>({txt:document.getElementById('procTxt').textContent,n:document.getElementById('procCount').textContent,q:procQueue(false).length}));
ok(ord.txt==='1 anotada al pasar · 2 vencidas · 2 para reclamar'&&ord.n==='5'&&ord.q===5,'Ordenar row: "1 anotada al pasar · 2 vencidas · 2 para reclamar", same total as Ordenar '+JSON.stringify(ord));
ok(JSON.stringify(await heads(p))===JSON.stringify(['Vencidas','Para reclamar','Para hoy','Próximas con hora']),'sections in order (without Telegram: "Próximas con hora") '+JSON.stringify(await heads(p)));
ok(JSON.stringify(await inSec(p,'Para reclamar'))===JSON.stringify(['Respuesta de Juan','Firma de Pedro']),'Para reclamar: 3 days without an answer, or the "mirar" date reached (a later date or a recent nudge waits) '+JSON.stringify(await inSec(p,'Para reclamar')));
const today=await inSec(p,'Para hoy');
ok(JSON.stringify(today)===JSON.stringify(['Mandar remitos','Reunión con proveedores','Revisar presupuesto','Comprar cartuchos']),'Para hoy: the ones with a time first, in order '+JSON.stringify(today));
ok(await row(p,'Comprar cartuchos').locator('.inboxdot').count()===1,'anotada al pasar: the blue dot');
ok(JSON.stringify(await inSec(p,'Próximas con hora'))===JSON.stringify(['Turno médico','Dentista','Cena']),'Próximos avisos: up to 3 with a time, from tomorrow on '+JSON.stringify(await inSec(p,'Próximas con hora')));
ok(await p.locator('#hoyList .ghead.over .gbtn',{hasText:'Todas a hoy'}).count()===1,'Vencidas: "Todas a hoy"');
ok(!(await row(p,'Pagar la luz').count())&&!(await row(p,'Ordenar el escritorio').count())&&!(await row(p,'Clave del wifi').count()),'tomorrow, undated and notes are not on Hoy');
ok(await noDup(p),'no task has two rows');
// El + y el micrófono, encima de la barra; la barra se va mientras escribís
const fab=await box(p,'#fabAdd');
ok(fab&&fab.b<=nav.y-8&&fab.b>=nav.y-30,'the + sits just above the bar '+JSON.stringify(fab));
await L.alta(p);await sleep(200);
ok(!!(await box(p,'#nav')),'field chosen, keyboard not open: the bar stays (it is the way to change screens)');
await p.setViewportSize({width:384,height:500});await sleep(300);   // como cuando sube el teclado
ok(!(await box(p,'#nav'))&&await p.evaluate(()=>document.body.classList.contains('typing')),'keyboard open: the bar steps aside');
await p.setViewportSize({width:384,height:832});await sleep(300);
ok(!!(await box(p,'#nav')),'keyboard closed with the field still chosen: the bar is back');
await p.goBack();await sleep(300);   // cierra la hoja
// El estado: con todo bien, solo el punto (el texto sigue para el lector de pantalla)
const st=await p.evaluate(()=>({q:document.getElementById('statusBtn').classList.contains('quiet'),w:Math.round(document.getElementById('statusBtn').getBoundingClientRect().width),t:document.getElementById('statusShort').textContent,a:document.getElementById('statusBtn').getAttribute('aria-label')}));
ok(st.q&&st.w===40&&st.t==='Al día'&&st.a==='Sincronización: Al día','phone status: only the dot when up to date '+JSON.stringify(st));
// Links: Mañana y Esperando llevan a Tareas, con el grupo abierto
const links=await p.evaluate(()=>[...document.querySelectorAll('#hoyLinks button')].map(x=>x.textContent));
ok(JSON.stringify(links)===JSON.stringify(['Mañana · 2 ›','Esperando respuesta · 5 ›']),'links at the end: '+JSON.stringify(links));
await p.evaluate(()=>{const f=new Set(JSON.parse(localStorage.getItem('gruposPlegados')||'[]'));f.add('tomorrow');localStorage.setItem('gruposPlegados',JSON.stringify([...f]))});
await p.locator('#hoyLinks button',{hasText:'Mañana'}).tap();await sleep(400);
const tom=await p.evaluate(()=>{const g=document.querySelector('.gfold[data-g="tomorrow"]');const r=g&&g.getBoundingClientRect();return g&&{open:g.getAttribute('aria-expanded'),top:Math.round(r.top)}});
ok(await screen(p)==='tareas'&&tom&&tom.open==='true'&&tom.top>=0&&tom.top<300,'"Mañana" goes to Tareas with the group open and in view '+JSON.stringify(tom));
ok(await row(p,'Pagar la luz').isVisible()&&await p.isVisible('#doneToggle'),'Tareas: the full list (Terminadas too)');
// Atrás: Tareas → Hoy → afuera
await p.goBack();await sleep(400);
ok(await screen(p)==='hoy'&&onApp(p),'Back from Tareas: Hoy');
await taps(p,'before leaving');
await p.goBack();await sleep(400);
ok(!onApp(p),'Back from Hoy: leaves the app ('+p.url()+')');
ok(p.errs.filter(e=>!/sessionStorage/.test(e)).length===0,'no page errors '+JSON.stringify(p.errs));
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();

// ===== Celular: Notas, Buscar y Atrás =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await go(p,'notas');
ok(await row(p,'Clave del wifi').isVisible()&&!(await row(p,'Pagar el seguro').count()),'Notas: only the notes');
ok(await p.getAttribute('#title','placeholder')==='Escribí una nota…','Notas: the field proposes a note');
await L.alta(p);await p.keyboard.type('Talle de Juan 42');await p.keyboard.press('Enter');await sleep(400);
ok(gh.items.some(x=>x.title==='Talle de Juan 42'&&x.kind==='nota'),'added on Notas: saved as a note');
await p.evaluate(()=>document.activeElement.blur());await sleep(150);
ok(await p.getAttribute('#noteChip','aria-pressed')==='true','after adding, the next one is a note too');
// Atrás desde Notas: Hoy (y lo que anotás vuelve a ser una tarea)
await p.goBack();await sleep(400);
ok(await screen(p)==='hoy'&&onApp(p)&&await p.getAttribute('#noteChip','aria-pressed')==='false','Back from Notas: Hoy, and the field is for tasks again');
// Buscar: vacío, las personas; un toque busca
await go(p,'tareas');await go(p,'buscar');
ok(await p.isVisible('#searchHome')&&!(await p.isVisible('#addForm'))&&await p.locator('#searchPeople .chip').count()>=3,'empty Buscar: people chips, no add field');
await p.locator('#searchPeople .chip',{hasText:'@Juan'}).tap();await sleep(300);
ok(await p.inputValue('#search')==='@Juan'&&await row(p,'Respuesta de Juan').isVisible()&&!(await p.isVisible('#searchHome')),'a person chip searches their tasks');
await p.click('#searchClose');await sleep(300);
ok(await screen(p)==='tareas'&&await p.inputValue('#search')==='','Cerrar: back to the screen before (Tareas), search cleared');
await go(p,'buscar');await p.evaluate(()=>document.activeElement.blur());await sleep(100);
await p.goBack();await sleep(400);
ok(await screen(p)==='hoy'&&onApp(p),'Back from Buscar: Hoy');
await taps(p,'before leaving');
await p.goBack();await sleep(400);
ok(!onApp(p),'then Back leaves the app');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();

// ===== Celular: el + desde Buscar, @persona desde Hoy, volver después de un rato, recargar =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await go(p,'buscar');await p.evaluate(()=>document.activeElement.blur());await sleep(150);
await p.locator('#fabAdd').tap();await sleep(300);
ok(await screen(p)==='hoy'&&await p.evaluate(()=>document.activeElement.id)==='title','+ on Buscar: goes to Hoy, ready to write');
await p.goBack();await sleep(300);   // cierra la hoja
await row(p,'Pagar el seguro').locator('.person').tap();await sleep(300);
ok(await screen(p)==='tareas'&&await p.isVisible('#filterBar')&&await p.textContent('#filterName')==='Laura','@Laura on Hoy: Tareas, only hers');
await p.goBack();await sleep(400);
ok(await screen(p)==='tareas'&&!(await p.isVisible('#filterBar')),'Back clears the filter first');
await p.goBack();await sleep(400);
ok(await screen(p)==='hoy'&&onApp(p),'and then goes to Hoy');
await go(p,'notas');
const setVis=v=>p.evaluate(v=>{window.__vis=v;Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true});document.dispatchEvent(new Event('visibilitychange'))},v);
await setVis('hidden');await p.clock.fastForward(200000);await setVis('visible');
ok(await L.until(async()=>await screen(p)==='hoy'),'back after 2+ min: on Hoy');
await go(p,'tareas');await p.reload();await sleep(600);
ok(await screen(p)==='tareas','reloading keeps Tareas');
await p.goBack();await sleep(400);
ok(await screen(p)==='hoy'&&onApp(p),'and Back still goes to Hoy');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
// Salir de Buscar con la pestaña de la pantalla de antes no deja entradas de más: un Atrás va a Hoy
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
for(let i=0;i<2;i++){await go(p,'tareas');await go(p,'buscar');await p.evaluate(()=>document.activeElement.blur());await sleep(100)}
await go(p,'tareas');
await p.goBack();await sleep(400);
ok(await screen(p)==='hoy'&&onApp(p),'Tareas → Buscar → Tareas (twice): one Back goes to Hoy');
await taps(p,'before leaving');
await p.goBack();await sleep(400);
ok(!onApp(p),'and the next one leaves the app');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
// El filtro puesto en Buscar sigue en Tareas: Atrás lo saca, después va a Hoy y recién ahí sale
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await go(p,'buscar');await p.fill('#search','seguro');await sleep(200);await p.evaluate(()=>document.activeElement.blur());await sleep(100);
await row(p,'Pagar el seguro').locator('.person').tap();await sleep(200);
ok(await screen(p)==='buscar'&&await p.isVisible('#filterBar'),'@Laura in a search result: filters right there');
await go(p,'tareas');
ok(await p.isVisible('#filterBar'),'to Tareas: still filtered');
await p.goBack();await sleep(400);
ok(await screen(p)==='tareas'&&!(await p.isVisible('#filterBar')),'Back: the filter goes, still on Tareas');
await p.goBack();await sleep(400);
ok(await screen(p)==='hoy'&&onApp(p),'Back: Hoy');
await taps(p,'before leaving');
await p.goBack();await sleep(400);
ok(!onApp(p),'Back: leaves the app');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
// Filtro puesto en Buscar y de ahí a Notas: el filtro se va y Atrás vuelve a Hoy
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await go(p,'buscar');await p.fill('#search','seguro');await sleep(200);await p.evaluate(()=>document.activeElement.blur());await sleep(100);
await row(p,'Pagar el seguro').locator('.person').tap();await sleep(200);
await go(p,'notas');await sleep(300);
ok(!(await p.isVisible('#filterBar'))&&await p.evaluate(()=>history.state&&history.state.pantalla==='notas'&&!history.state.tareas),'Buscar (filtered) → Notas: no filter, one Notas entry');
await p.goBack();await sleep(400);
ok(await screen(p)==='hoy'&&onApp(p),'Back from Notas: Hoy');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
// Lo escrito en Notas que se lleva a otra pantalla sigue como nota; borrado, el campo vuelve a ser para tareas
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await go(p,'notas');await L.alta(p);await p.keyboard.type('Comprar');await p.goBack();await sleep(300);   // la hoja se cierra con lo escrito
await go(p,'hoy');
ok(await p.inputValue('#title')==='Comprar'&&await p.getAttribute('#noteChip','aria-pressed')==='true','Notas → Hoy with text: still a note draft');
await L.alta(p);await p.fill('#title','');await p.keyboard.type('Llamar a Pedro');await sleep(150);
ok(await p.getAttribute('#noteChip','aria-pressed')==='false','cleared on Hoy: the field is for tasks again');
await p.keyboard.press('Enter');await sleep(300);
ok(gh.items.some(x=>x.title==='Llamar a Pedro'&&!x.kind),'saved as a task');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
// Cambiar de pestaña con algo abierto encima (el filtro, Buscar) y volver: un Atrás va a Hoy
for(const [lbl,start] of [['@Laura on Hoy → Notas → Tareas',async p=>{await row(p,'Pagar el seguro').locator('.person').tap();await sleep(200)}],
  ['Tareas → Buscar → Notas → Tareas',async p=>{await go(p,'tareas');await go(p,'buscar');await p.evaluate(()=>document.activeElement.blur());await sleep(100)}]]){
  gh=makeGH(items());
  ({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
  await start(p);await go(p,'notas');await go(p,'tareas');
  await p.goBack();await sleep(400);
  ok(await screen(p)==='hoy'&&onApp(p),lbl+': one Back goes to Hoy');
  await taps(p,lbl);
  await p.goBack();await sleep(400);
  ok(!onApp(p),lbl+': the next one leaves the app');
  await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
}
// Buscar con el filtro puesto y el campo vacío: la lista de esa persona (como antes), no la pantalla de inicio
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await go(p,'tareas');await row(p,'Pagar el seguro').locator('.person').tap();await sleep(200);
await go(p,'buscar');await p.evaluate(()=>document.activeElement.blur());await sleep(150);
ok(await p.isVisible('#filterBar')&&!(await p.isVisible('#searchHome'))&&await row(p,'Pagar el seguro').isVisible()&&!(await row(p,'Revisar presupuesto').count()),'Buscar with the filter and an empty field: that person list');
// El aviso de abajo no tapa los botones de Ordenar (con una ventana abierta baja, como antes)
await go(p,'hoy');await p.locator('#procBtn').tap();await sleep(250);
await p.locator('#procBtns button',{hasText:'Mañana'}).tap();await sleep(250);
const tb=await box(p,'#toast'),last=await p.evaluate(()=>{const r=[...document.querySelectorAll('#procBtns button')].pop().getBoundingClientRect();return Math.round(r.bottom)});
ok(tb&&tb.b>=832-22&&(tb.y>=last||tb.b<=last-60),'toast inside Ordenar: down at the bottom, not over its buttons '+JSON.stringify({tb,last}));
await p.locator('#procBtns button',{hasText:'Siguiente'}).tap();await sleep(250);
ok(/^3 de /.test(await p.textContent('#procN')),'"Siguiente" still takes the tap ('+await p.textContent('#procN')+')');
await p.locator('#procX').tap();await sleep(200);
// Las secciones de Hoy se pliegan aparte de los grupos de Tareas
await p.locator('#hoyList .gfold[data-g="hoy-today"]').tap();await sleep(200);
const fold=await p.evaluate(()=>JSON.parse(localStorage.getItem('gruposPlegados')||'[]'));
ok(fold.includes('hoy-today')&&!fold.includes('today'),'folding Para hoy on Hoy stores hoy-today '+JSON.stringify(fold));
await go(p,'tareas');
ok(await p.getAttribute('#groups .gfold[data-g="today"]','aria-expanded')==='true','Hoy in Tareas stays open');
await p.locator('#groups .gfold[data-g="today"]').tap();await sleep(150);await p.locator('#groups .gfold[data-g="today"]').tap();await sleep(150);
await go(p,'hoy');
ok(await p.getAttribute('#hoyList .gfold[data-g="hoy-today"]','aria-expanded')==='false'&&!(await row(p,'Revisar presupuesto').count()),'folding and unfolding it in Tareas leaves Hoy folded');
await p.reload();await sleep(600);
ok(await screen(p)==='hoy'&&await p.getAttribute('#hoyList .gfold[data-g="hoy-today"]','aria-expanded')==='false','still folded after reopening');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
// El estado con un problema (sin señal): con texto también en el celular; Ajustes y Revisión de la semana
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
gh.mode='offline';await p.evaluate(()=>sync());
ok(await L.until(async()=>await p.textContent('#statusShort')==='Sin señal'),'offline: "Sin señal"');
const sp=await p.evaluate(()=>({q:document.getElementById('statusBtn').classList.contains('quiet'),w:Math.round(document.getElementById('statusShort').getBoundingClientRect().width)}));
ok(!sp.q&&sp.w>20,'phone: a problem shows its text '+JSON.stringify(sp));
gh.mode='ok';
await p.locator('#setBtn').tap();await sleep(200);
ok(await p.isVisible('#syncOv'),'phone: the gear opens Ajustes (Sincronización)');
await p.locator('#setRev').tap();await sleep(250);
ok(await p.isVisible('#procOv')&&await p.textContent('#procH')==='Revisión de la semana'&&await p.isHidden('#syncOv'),'Revisión de la semana from Ajustes');
await p.locator('#procX').tap();await sleep(200);
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
// Abierta desde un acceso del ícono o desde un aviso, aunque el historial diga que estaba en Tareas: en Hoy
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await go(p,'tareas');
await p.evaluate(()=>history.replaceState({pantalla:'tareas'},'',location.pathname+'?nueva=1'));await p.reload();await sleep(600);
ok(await screen(p)==='hoy'&&await p.evaluate(()=>document.activeElement.id)==='title','?nueva=1 with Tareas in the history: Hoy, ready to write');
await p.evaluate(()=>document.activeElement.blur());await go(p,'tareas');
await p.evaluate(()=>history.replaceState({pantalla:'tareas'},'',location.pathname+'?revisar=1'));await p.reload();
ok(await L.until(()=>p.isVisible('#procOv'),{timeout:7000})&&await screen(p)==='hoy'&&await p.textContent('#procH')==='Revisión de la semana','?revisar=1 with Tareas in the history: the review, over Hoy');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
// Abierta desde un acceso del ícono: en Hoy
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP+'?nueva=1',SEEN));
ok(await screen(p)==='hoy'&&await p.evaluate(()=>document.activeElement.id)==='title','?nueva=1: Hoy, ready to write');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();

// ===== Sin nada para hoy =====
gh=makeGH([T('m1','Pagar la luz',{due:day(1)})]);
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
ok(await p.innerText('#empty')==='Nada para hoy.'&&await p.isHidden('#procBtn'),'nothing for today: "Nada para hoy.", no Ordenar row');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
gh=makeGH([]);
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
ok(await p.innerText('#empty')==='Nada pendiente. Buen trabajo.','nothing at all: "Nada pendiente. Buen trabajo."');
await go(p,'notas');
ok(/Todavía no hay notas/.test(await p.innerText('#empty')),'Notas empty: how to save one');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();

// ===== Lo que entra en Hoy: hasta 7 días; las notas terminadas no cuentan como hechas; con Telegram, "avisos" =====
gh=makeGH([T('a','Algo de hoy',{due:day(0)}),T('f','Lejos',{due:day(8),time:'10:00'}),T('d','Hecha hoy',{due:day(0),done:true,completedAt:L.date(-36e5).toISOString()}),
  T('dn','Nota tildada',{kind:'nota',done:true,completedAt:L.date(-36e5).toISOString()})]);
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
ok(!(await inSec(p,'Próximas con hora'))&&!(await inSec(p,'Próximos avisos')),'a timed task 8 days away is not in Próximos avisos');
ok(/1 hecha hoy/.test(await p.textContent('#summary')),'"1 hecha hoy": the ticked note does not count ('+await p.textContent('#summary')+')');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
gh=makeGH(items());gh.files[ENV]={content:JSON.stringify({['x|'+day(-1)+'|09:00']:'2026-10-13T11:50:31.000Z'}),sha:1};
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:800}},APP,AVISOS_ON));await sleep(500);
ok(await p.evaluate(()=>avisosOn())&&!!(await inSec(p,'Próximos avisos'))&&/próximo aviso 15:00/.test(await p.innerText('#summary')),'with Telegram avisos: "Próximos avisos" and "próximo aviso 15:00" ('+(await p.innerText('#summary')).replace(/\s+/g,' ')+')');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
({ctx,p}=await device(b,gh,PHONE,APP,AVISOS_ON));await sleep(500);
ok(/aviso 15:00/.test(await p.innerText('#summary')),'phone with Telegram avisos: "aviso 15:00"');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();

// ===== Compu: la barra de la izquierda, los cortes de 900 y 1200 =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:800}},APP,SEEN));
const side=await box(p,'#nav');
ok(side&&side.x===0&&side.y===0&&side.w===232&&side.h===800,'1000 px: sidebar of 232 px '+JSON.stringify(side));
const counts=await p.evaluate(()=>['navHoyN','navTareasN','navNotasN'].map(id=>document.getElementById(id).textContent));
ok(JSON.stringify(counts)===JSON.stringify(['6','13','1']),'counts: Hoy (vencidas + para hoy), Tareas (pending, without the waiting ones), Notas '+JSON.stringify(counts));
ok(await p.evaluate(()=>document.getElementById('navFoot').contains(document.getElementById('statusBtn'))&&document.getElementById('navFoot').contains(document.getElementById('setBtn'))),'status and Ajustes at the foot of the sidebar');
ok(await p.innerText('#statusShort')==='Al día'&&(await box(p,'#statusShort')).w>20,'computer: the status with its text');
ok(await p.isVisible('#shortcuts')&&!(await p.isVisible('#shortcuts .scx'))&&/nueva/.test(await p.innerText('#shortcuts')),'shortcuts line: N, / and . (the rest folded)');
await p.click('#shortcuts .scbtn');await sleep(100);
ok(await p.isVisible('#shortcuts .scx')&&/ordenar/.test(await p.innerText('#shortcuts')),'"Todos los atajos" shows the rest');
ok(!(await box(p,'#side')),'900–1199: no right column');
// Buscar va arriba de todo en la barra lateral, también con Tab; en Buscar se ve elegido
ok(await p.evaluate(()=>document.getElementById('nav').firstElementChild.id)==='searchBtn','sidebar: Buscar first (also with Tab)');
await go(p,'buscar');
ok(await p.evaluate(()=>getComputedStyle(document.getElementById('searchBtn')).backgroundColor)==='rgb(235, 236, 253)','on Buscar, Buscar shows as the current one (--accent-soft)');
await p.keyboard.press('Escape');await sleep(150);
ok(await p.isVisible('#hoyLinks button:has-text("Esperando respuesta")'),'900–1199: the Esperando link is there');
const h1=await p.evaluate(()=>({t:document.querySelector('.top h1').textContent,fs:getComputedStyle(document.querySelector('.top h1')).fontSize}));
ok(h1.t==='Hoy'&&h1.fs==='30px','computer: "Hoy" as the title (30 px)');
// Ordenar desde la fila; la ventana se llama Ordenar
await p.click('#procBtn');await sleep(200);
ok(await p.isVisible('#procOv')&&await p.textContent('#procH')==='Ordenar'&&await p.textContent('#procN')==='1 de 5','Ordenar row opens Ordenar (1 de 5)');
await p.keyboard.press('h');await sleep(300);
await p.click('#toastUndo');await sleep(300);
ok(await p.textContent('#procN')==='1 de 5','"Deshacer" in the toast goes back to that card');
// Un aviso que no es un Deshacer (por ejemplo "1 nueva · Ver") no hace volver la tarjeta
await p.keyboard.press('ArrowRight');await sleep(200);
const before=await p.textContent('#procN');
await p.evaluate(()=>toast('1 nueva',()=>{window.__ver=1},'Ver',6000,null,'llegaron'));await sleep(100);
await p.click('#toastUndo');await sleep(200);
ok(await p.evaluate(()=>window.__ver===1)&&await p.textContent('#procN')===before,'"Ver" in Ordenar runs its action and stays on the card ('+before+')');
await p.keyboard.press('Escape');await sleep(200);
// / abre Buscar; Esc vuelve; N desde Buscar va a Hoy
await go(p,'notas');
await p.keyboard.press('/');await sleep(200);
ok(await screen(p)==='buscar'&&await p.evaluate(()=>document.activeElement.id)==='search','/ opens Buscar');
await p.keyboard.press('Escape');await sleep(200);
ok(await screen(p)==='notas','Esc: back to Notas');
await p.keyboard.press('/');await sleep(200);await p.evaluate(()=>document.activeElement.blur());
await p.keyboard.press('n');await sleep(200);
ok(await screen(p)==='hoy'&&await p.evaluate(()=>document.activeElement.id)==='title','N on Buscar: Hoy, ready to write');
// Ajustes: Informe y Revisión de la semana
await p.evaluate(()=>document.activeElement.blur());
await p.click('#setBtn');await sleep(200);
ok(await p.isVisible('#syncOv')&&await p.isVisible('#setRep')&&await p.isVisible('#setRev'),'Ajustes: Sincronización, with Informe and Revisión de la semana');
await p.click('#setRep');await sleep(200);
ok(await p.isVisible('#repOv')&&await p.isHidden('#syncOv'),'Informe from Ajustes');
await p.keyboard.press('Escape');await sleep(200);
// Los cortes
await p.setViewportSize({width:899,height:800});await sleep(200);
ok((await box(p,'#nav')).h===76&&await p.evaluate(()=>document.querySelector('.top').contains(document.getElementById('statusBtn'))),'899 px: bottom bar, status back in the header');
await p.setViewportSize({width:900,height:800});await sleep(200);
ok((await box(p,'#nav')).w===232,'900 px: sidebar');
await p.setViewportSize({width:1199,height:800});await sleep(200);
ok(!(await box(p,'#side')),'1199 px: no right column');
await p.setViewportSize({width:1200,height:800});await sleep(300);
ok(!!(await box(p,'#side'))&&!(await p.isVisible('#hoyLinks button:has-text("Esperando respuesta")')),'1200 px: right column (and no Esperando link)');
// En Hoy, la columna derecha no repite las de Para reclamar
const sw=await p.evaluate(()=>[...document.querySelectorAll('#sideWait .ttext')].map(x=>x.textContent));
ok(!sw.includes('Respuesta de Juan')&&sw.includes('Presupuesto de Marcela')&&await noDup(p),'Hoy at 1200+: Esperando without the ones in Para reclamar '+JSON.stringify(sw));
await go(p,'tareas');
const sw2=await p.evaluate(()=>[...document.querySelectorAll('#sideWait .ttext')].map(x=>x.textContent));
ok(sw2.includes('Respuesta de Juan')&&!(await p.evaluate(()=>[...document.querySelectorAll('#groups .ttext')].some(x=>x.textContent==='Ordenar el escritorio')))&&await noDup(p),'Tareas at 1200+: all of Esperando at the right, Sin fecha not repeated in the center');
// Nada se corta a 360 px
await p.setViewportSize({width:360,height:740});await sleep(200);
for(const s of ['hoy','tareas','notas','buscar']){
  await go(p,s);if(s==='buscar')await p.evaluate(()=>document.activeElement.blur());
  const w=await p.evaluate(()=>document.documentElement.scrollWidth);
  ok(w<=360,'360 px, '+s+': no horizontal scroll ('+w+')');
}
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
// Compu: recargar en Notas deja el alta como nota; en una ventana angosta los atajos siguen, completos, debajo
gh=makeGH(items());
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:800}},APP,SEEN));
await go(p,'notas');await p.reload();await sleep(600);
ok(await screen(p)==='notas'&&await p.getAttribute('#noteChip','aria-pressed')==='true'&&await p.getAttribute('#title','placeholder')==='Escribí una nota…','reload on Notas: the field still proposes a note');
await p.setViewportSize({width:820,height:800});await sleep(200);
await go(p,'hoy');
ok(await p.isVisible('#shortcuts')&&await p.isVisible('#shortcuts .scx')&&/ordenar/.test(await p.innerText('#shortcuts')),'computer window under 900 px: the full shortcut list under the list');
await noErr(p,'block');if(onApp(p))await taps(p,'block');await ctx.close();
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
