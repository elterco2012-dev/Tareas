// Hoy nunca queda vacío (mejora de Claude Design, sin el acceso "Todas las tareas", que repetía la barra): sin nada
// vencido, para reclamar ni para hoy, "Nada para hoy." es un renglón con un ✓; debajo, "Lo que sigue" (las próximas con
// fecha: 2 en el celular, 3 en la compu, en lugar de Próximos avisos) con "Ver todas ›", y una tarjeta de accesos
// a Sin fecha y Esperando respuesta (sin la columna derecha). Con algo para hoy, Hoy queda como estaba.
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
let APP;
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}};
const INIT_BIG=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='html{font-size:130%}';document.head.append(s)})};
const PHONE={viewport:{width:390,height:844},isMobile:true,hasTouch:true};
const ago=n=>new Date(L.date().getTime()-n*86400000).toISOString();
// Nada para hoy: mañana, el sábado (con hora: antes iba en Próximos avisos), el lunes, más adelante, dos sin fecha y una esperando
const items=()=>[
  T('m1','Pagar la luz',{due:day(1)}),T('m2','Turno dentista',{due:day(3),time:'10:30'}),T('m3','Mandar remitos',{due:day(5)}),T('m4','Renovar seguro',{due:day(20)}),
  T('s1','Ordenar el placard'),T('s2','Buscar un plomero'),
  T('w1','Presupuesto techo',{waiting:true,waitingOn:'Martín',waitingSince:ago(1)})];
const state=p=>p.evaluate(()=>{
  const e=document.getElementById('empty'),before=getComputedStyle(e,'::before').content;
  const heads=[...document.querySelectorAll('#hoyList .ghead')].map(h=>h.textContent.replace(/\s+/g,' ').trim());
  const next=[...document.querySelectorAll('#hoyList .grp')].find(g=>/Lo que sigue/.test(g.querySelector('.ghead').textContent));
  const links=document.getElementById('hoyLinks'),lr=links.getBoundingClientRect();
  return {empty:!e.classList.contains('hidden')&&e.innerText,clear:e.classList.contains('clear'),check:/✓/.test(before),
    heads,next:next?[...next.querySelectorAll('.task')].map(r=>r.querySelector('.ttext').textContent+' · '+((r.querySelector('.meta')||{}).innerText||'').replace(/\s+/g,' ').trim()):null,
    seeAll:next?(next.querySelector('.ghead .gbtn')||{}).textContent||null:null,foldable:!!(next&&next.querySelector('.gfold')),
    entries:links.classList.contains('entries'),shown:lr.height>0,
    rows:[...links.querySelectorAll('button')].map(b=>({t:(b.children.length?[...b.children].map(c=>c.textContent).join(' '):b.textContent).replace(/\s+/g,' ').trim(),label:b.getAttribute('aria-label'),h:Math.round(b.getBoundingClientRect().height)}))};
});
const screen=p=>p.evaluate(()=>document.body.dataset.screen);
const openGroup=(p,g)=>p.evaluate(g=>{const b=document.querySelector('.gfold[data-g="'+g+'"]');if(!b)return null;const r=b.getBoundingClientRect();return {open:b.getAttribute('aria-expanded'),top:Math.round(r.top)}},g);
(async()=>{
const b=await L.launch();APP=await L.appUrl();

// ===== Celular =====
let gh=makeGH(items());
let {ctx,p}=await device(b,gh,PHONE,APP,SEEN);
let s=await state(p);
ok(s.empty==='Nada para hoy.'&&s.clear&&s.check,'phone, nothing for today: "Nada para hoy." is a row with a ✓ '+JSON.stringify({empty:s.empty,clear:s.clear,check:s.check}));
ok(JSON.stringify(s.next)===JSON.stringify(['Pagar la luz · Mañana','Turno dentista · Sáb 17/10']),'phone: "Lo que sigue" shows the next 2 with a date, in order, with their date '+JSON.stringify(s.next));
ok(s.seeAll==='Ver todas ›'&&!s.foldable,'phone: "Lo que sigue" has "Ver todas ›" and does not fold '+JSON.stringify({seeAll:s.seeAll,foldable:s.foldable}));
ok(!s.heads.some(h=>/Próximos avisos|Próximas con hora/.test(h)),'phone: no "Próximos avisos" while Hoy is empty (no row twice) '+JSON.stringify(s.heads));
ok(s.entries&&JSON.stringify(s.rows.map(r=>r.t))===JSON.stringify(['Sin fecha 2 ›','Esperando respuesta 1 ›']),'phone: the access card: Sin fecha and Esperando respuesta, with their number '+JSON.stringify(s.rows));
ok(s.rows.every(r=>r.h>=48)&&s.rows[0].label==='Sin fecha, 2 tareas'&&s.rows[1].label==='Esperando respuesta, 1 tarea','phone: access rows are 48 px tall, with a full label '+JSON.stringify(s.rows));
// "Ver todas ›": Tareas, con el grupo de la primera abierto y a la vista (aunque estuviera plegado)
await p.evaluate(()=>localStorage.setItem('gruposPlegados',JSON.stringify(['tomorrow'])));
await p.locator('#hoyList .ghead .gbtn').tap();await sleep(400);
let g=await openGroup(p,'tomorrow');
ok(await screen(p)==='tareas'&&g&&g.open==='true'&&g.top>=0&&g.top<300,'"Ver todas ›" goes to Tareas with the group of the first one open and in view '+JSON.stringify(g));
await p.goBack();await sleep(400);
ok(await screen(p)==='hoy','Atrás: back to Hoy');
await p.locator('#hoyLinks button',{hasText:'Sin fecha'}).tap();await sleep(400);
g=await openGroup(p,'none');
ok(await screen(p)==='tareas'&&g&&g.open==='true','"Sin fecha" goes to Tareas with Sin fecha open '+JSON.stringify(g));
await p.goBack();await sleep(400);
await p.locator('#hoyLinks button',{hasText:'Esperando'}).tap();await sleep(400);
g=await openGroup(p,'waiting');
ok(await screen(p)==='tareas'&&g&&g.open==='true','"Esperando respuesta" goes to Tareas with Esperando open '+JSON.stringify(g));
await p.goBack();await sleep(400);
// Las filas de Lo que sigue son filas de siempre: se terminan y se abren
await p.locator('#hoyList .task',{hasText:'Pagar la luz'}).locator('.body').tap();await sleep(300);
ok(await p.isVisible('#editOv')&&(await p.inputValue('#eTitle'))==='Pagar la luz','a "Lo que sigue" row opens its detail');
await p.keyboard.press('Escape');await sleep(300);
await p.locator('#hoyList .task',{hasText:'Pagar la luz'}).locator('.chk').tap();await sleep(1200);
s=await state(p);
ok(gh.items.find(x=>x.id==='m1').done&&JSON.stringify(s.next)===JSON.stringify(['Turno dentista · Sáb 17/10','Mandar remitos · Lun 19/10']),'finishing one: it is done and the next one comes up '+JSON.stringify(s.next));
ok(p.errs.length===0,'phone: no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Celular al 130 %: todo se ve, por encima del "+" y del micrófono =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,INIT_BIG));
await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await sleep(300);
const fit=await p.evaluate(()=>{const c=document.getElementById('hoyLinks').getBoundingClientRect(),f=document.getElementById('fabs').getBoundingClientRect(),n=document.getElementById('nav').getBoundingClientRect();
  return {card:Math.round(c.bottom),fabs:Math.round(f.top),fabsShown:f.height>0,nav:Math.round(n.top),hscroll:document.documentElement.scrollWidth>innerWidth+1}});
ok(fit.card<=Math.min(fit.fabsShown?fit.fabs:9e9,fit.nav)&&!fit.hscroll,'phone at 130%: scrolled down, the access card ends above the "+" and the bar, nothing to the side '+JSON.stringify(fit));
ok(p.errs.length===0,'130%: no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Compu =====
for(const [name,w,entries] of [['wide computer (1280)',1280,[]],['narrow computer (1000)',1000,['Sin fecha 2 ›','Esperando respuesta 1 ›']]]){
  gh=makeGH(items());
  ({ctx,p}=await device(b,gh,{viewport:{width:w,height:800}},APP,SEEN));
  s=await state(p);
  ok(s.next&&s.next.length===3&&/^Mandar remitos/.test(s.next[2]),name+': "Lo que sigue" shows the next 3 '+JSON.stringify(s.next));
  ok(JSON.stringify(s.rows.map(r=>r.t))===JSON.stringify(entries)&&s.shown===entries.length>0,name+(entries.length?': the access card has Sin fecha and Esperando respuesta':': no access card (Sin fecha and Esperando are in the right column)')+' '+JSON.stringify({rows:s.rows,shown:s.shown}));
  ok(p.errs.length===0,name+': no page errors '+JSON.stringify(p.errs));
  await ctx.close();
}

// ===== Con algo para hoy, Hoy queda como estaba =====
gh=makeGH([T('h1','Llamar al banco',{due:day(0)}),...items()]);
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
s=await state(p);
ok(s.empty===false&&!s.clear&&!s.next&&!s.entries,'something for today: no empty row, no "Lo que sigue", no access card '+JSON.stringify({empty:s.empty,next:s.next,entries:s.entries}));
ok(JSON.stringify(s.rows.map(r=>r.t))===JSON.stringify(['Mañana · 1 ›','Esperando respuesta · 1 ›'])&&s.heads.some(h=>/Próximos avisos|Próximas con hora/.test(h)),'something for today: the links and Próximos avisos as before '+JSON.stringify({rows:s.rows,heads:s.heads}));
await ctx.close();

// ===== Solo algo esperando respuesta: "Nada para hoy." (esperar cuenta como pendiente, como antes) =====
gh=makeGH([T('w1','Presupuesto techo',{waiting:true,waitingOn:'Martín',waitingSince:ago(1)})]);
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
s=await state(p);
ok(s.empty==='Nada para hoy.'&&s.clear&&!s.next,'only something waiting: "Nada para hoy." with the ✓, no "Lo que sigue" '+JSON.stringify({empty:s.empty,next:s.next}));
ok(JSON.stringify(s.rows.map(r=>r.t))===JSON.stringify(['Esperando respuesta 1 ›']),'only something waiting: only Esperando respuesta in the access card '+JSON.stringify(s.rows));
await ctx.close();
// ===== Nada pendiente =====
gh=makeGH([]);
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
s=await state(p);
ok(s.empty==='Nada pendiente. Buen trabajo.'&&s.clear&&!s.next&&!s.shown,'nothing pending: "Nada pendiente. Buen trabajo." with the ✓, no "Lo que sigue", no access card '+JSON.stringify({empty:s.empty,next:s.next,shown:s.shown}));
// Las otras pantallas vacías no cambian (sin el ✓)
await go(p,'notas');
s=await state(p);
ok(/Todavía no hay notas/.test(s.empty||'')&&!s.clear,'Notas empty: the same message as before, without the ✓ row');
await ctx.close();

await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
