// Rediseño 1a: las cuatro pantallas (Hoy · Tareas · Notas · Buscar), la barra de abajo (celular) o de la izquierda
// (compu, desde 900 px), Hoy como inicio (fila Ordenar, Vencidas, Para reclamar, Para hoy, Próximos avisos, links) y
// el botón Atrás (desde Tareas, Notas o Buscar vuelve a Hoy; desde Hoy sale de la app)
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go,ago}=L;
let APP;
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}))}};
const onApp=p=>p.url().startsWith(APP);
const screen=p=>p.evaluate(()=>document.body.dataset.screen);
const row=(p,t)=>p.locator('#wrap .task').filter({has:p.locator('.ttext',{hasText:t})}).first();
const box=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return r.width&&r.height?{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),b:Math.round(r.bottom),r:Math.round(r.right)}:null},s);
const heads=p=>p.evaluate(()=>[...document.querySelectorAll('#hoyList .ghead')].map(h=>h.querySelector('.gfold span,span').textContent));
const inSec=(p,title)=>p.evaluate(t=>{const g=[...document.querySelectorAll('#hoyList .grp')].find(x=>x.querySelector('.ghead span').textContent===t);return g?[...g.querySelectorAll('.task .ttext')].map(x=>x.textContent):null},title);
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
await p.locator('#title').tap();await sleep(200);
ok(!(await box(p,'#nav'))&&await p.evaluate(()=>document.body.classList.contains('typing')),'typing: the bar steps aside');
await p.evaluate(()=>document.activeElement.blur());await sleep(200);
ok(!!(await box(p,'#nav')),'done typing: the bar is back');
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
await p.goBack();await sleep(400);
ok(!onApp(p),'Back from Hoy: leaves the app ('+p.url()+')');
ok(p.errs.filter(e=>!/sessionStorage/.test(e)).length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Celular: Notas, Buscar y Atrás =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await go(p,'notas');
ok(await row(p,'Clave del wifi').isVisible()&&!(await row(p,'Pagar el seguro').count()),'Notas: only the notes');
ok(await p.getAttribute('#title','placeholder')==='Escribí una nota…','Notas: the field proposes a note');
await p.locator('#title').tap();await p.keyboard.type('Talle de Juan 42');await p.keyboard.press('Enter');await sleep(400);
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
await p.goBack();await sleep(400);
ok(!onApp(p),'then Back leaves the app');
await ctx.close();

// ===== Celular: el + desde Buscar, @persona desde Hoy, volver después de un rato, recargar =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await go(p,'buscar');await p.evaluate(()=>document.activeElement.blur());await sleep(150);
await p.locator('#fabAdd').tap();await sleep(300);
ok(await screen(p)==='hoy'&&await p.evaluate(()=>document.activeElement.id)==='title','+ on Buscar: goes to Hoy, ready to write');
await p.evaluate(()=>document.activeElement.blur());await sleep(150);
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
await ctx.close();
// Abierta desde un acceso del ícono: en Hoy
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP+'?nueva=1',SEEN));
ok(await screen(p)==='hoy'&&await p.evaluate(()=>document.activeElement.id)==='title','?nueva=1: Hoy, ready to write');
await ctx.close();

// ===== Sin nada para hoy =====
gh=makeGH([T('m1','Pagar la luz',{due:day(1)})]);
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
ok(await p.innerText('#empty')==='Nada para hoy.'&&await p.isHidden('#procBtn'),'nothing for today: "Nada para hoy.", no Ordenar row');
await ctx.close();
gh=makeGH([]);
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
ok(await p.innerText('#empty')==='Nada pendiente. Buen trabajo.','nothing at all: "Nada pendiente. Buen trabajo."');
await go(p,'notas');
ok(/Todavía no hay notas/.test(await p.innerText('#empty')),'Notas empty: how to save one');
await ctx.close();

// ===== Compu: la barra de la izquierda, los cortes de 900 y 1200 =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:800}},APP,SEEN));
const side=await box(p,'#nav');
ok(side&&side.x===0&&side.y===0&&side.w===232&&side.h===800,'1000 px: sidebar of 232 px '+JSON.stringify(side));
const counts=await p.evaluate(()=>['navHoyN','navTareasN','navNotasN'].map(id=>document.getElementById(id).textContent));
ok(JSON.stringify(counts)===JSON.stringify(['6','13','1']),'counts: Hoy (vencidas + para hoy), Tareas (pending, without the waiting ones), Notas '+JSON.stringify(counts));
ok(await p.evaluate(()=>document.getElementById('navFoot').contains(document.getElementById('statusBtn'))&&document.getElementById('navFoot').contains(document.getElementById('setBtn'))),'status and Ajustes at the foot of the sidebar');
ok(await p.innerText('#statusShort')==='Al día'&&(await box(p,'#statusShort')).w>20,'computer: the status with its text');
ok(await p.isVisible('#shortcuts')&&!(await p.isVisible('#shortcuts .more'))&&/nueva/.test(await p.innerText('#shortcuts')),'shortcuts line: N, / and . (the rest folded)');
await p.click('#shortcuts .scbtn');await sleep(100);
ok(await p.isVisible('#shortcuts .more')&&/ordenar/.test(await p.innerText('#shortcuts')),'"Todos los atajos" shows the rest');
ok(!(await box(p,'#side')),'900–1199: no right column');
ok(await p.isVisible('#hoyLinks button:has-text("Esperando respuesta")'),'900–1199: the Esperando link is there');
const h1=await p.evaluate(()=>({t:document.querySelector('.top h1').textContent,fs:getComputedStyle(document.querySelector('.top h1')).fontSize}));
ok(h1.t==='Hoy'&&h1.fs==='30px','computer: "Hoy" as the title (30 px)');
// Ordenar desde la fila; la ventana se llama Ordenar
await p.click('#procBtn');await sleep(200);
ok(await p.isVisible('#procOv')&&await p.textContent('#procH')==='Ordenar'&&await p.textContent('#procN')==='1 de 5','Ordenar row opens Ordenar (1 de 5)');
await p.keyboard.press('h');await sleep(300);
await p.click('#toastUndo');await sleep(300);
ok(await p.textContent('#procN')==='1 de 5','"Deshacer" in the toast goes back to that card');
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
await ctx.close();
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
