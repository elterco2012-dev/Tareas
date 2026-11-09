// Filtros de Tareas (rediseño 1a, lo que faltaba): chips Todas · Con hora · Alta · Esperando, con cuántas hay. Solo
// cambian lo que se ve: con un filtro se esconden Terminadas y la Papelera, la columna derecha también se filtra y con
// Esperando esa lista va al centro. No se recuerda al reabrir la app; vuelve a Todas al pasar por Hoy o Notas y con los
// accesos que llevan a un grupo de Tareas. Buscar con el campo vacío: "Quién te lo pidió" (personas con su inicial) y
// "Atajos" (Con hora · Prioridad alta · Esperando) que abren Tareas con ese filtro.
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
let APP;
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}};
const ago=n=>new Date(L.date().getTime()-n*86400000).toISOString();
const items=()=>[
  T('o1','Pagar el seguro',{due:day(-2),priority:'Alta'}),
  T('h1','Turno dentista',{due:day(0),time:'15:00',requester:'Laura'}),
  T('h2','Comprar pilas',{due:day(0)}),
  T('m1','Llamar al banco',{due:day(1),time:'10:30',priority:'Alta',requester:'Laura'}),
  T('s1','Ordenar el placard',{priority:'Alta'}),
  T('s2','Buscar plomero'),
  T('w1','Presupuesto techo',{waiting:true,waitingOn:'Martín',waitingSince:ago(1)}),
  T('d1','Mandar remitos',{done:true,completedAt:ago(1)}),
  T('x1','Borrada',{deletedAt:ago(1)})];
// Los chips (texto sin el número, número, elegido, etiqueta, alto) y lo que se ve en la pantalla
const chips=p=>p.evaluate(()=>{const r=document.getElementById('taskFilter');if(!r||!r.getBoundingClientRect().height)return null;
  return [...r.querySelectorAll('.chip')].map(b=>({t:b.firstChild.textContent,n:(b.querySelector('.n')||{}).textContent,on:b.getAttribute('aria-pressed')==='true',label:b.getAttribute('aria-label'),h:Math.round(b.getBoundingClientRect().height)}))});
const view=p=>p.evaluate(()=>{const vis=e=>!!e&&e.getBoundingClientRect().height>0;
  const rows=sel=>[...document.querySelectorAll(sel)].filter(vis).map(r=>r.querySelector('.ttext').textContent);
  return {main:rows('#groups .task,#waitingSec .task'),side:rows('#side .task'),done:vis(document.getElementById('doneToggle')),trash:vis(document.getElementById('trashSec')),
    empty:vis(document.getElementById('empty'))?document.getElementById('empty').textContent:null}});
const label=async p=>((await chips(p))||[]).map(c=>c.t+' '+c.n);
const chosen=async p=>(((await chips(p))||[]).find(c=>c.on)||{}).t;
const screen=p=>p.evaluate(()=>document.body.dataset.screen);
(async()=>{
const b=await L.launch();APP=await L.appUrl();

// ===== Celular =====
let gh=makeGH(items());
let {ctx,p}=await device(b,gh,{viewport:{width:390,height:844},isMobile:true,hasTouch:true},APP,SEEN);
const tap=(s,o)=>p.locator(s,o).first().tap();
ok(await chips(p)===null,'Hoy: no filter chips');
await go(p,'tareas');
let c=await chips(p),v=await view(p);
ok(JSON.stringify(c&&c.map(x=>[x.t,x.n,x.label]))===JSON.stringify([['Todas','6','Todas, 6'],['Con hora','2','Con hora, 2'],['Alta','3','Alta, 3'],['Esperando','1','Esperando, 1']])&&c[0].on,'Tareas: Todas 6 · Con hora 2 · Alta 3 · Esperando 1, Todas chosen '+JSON.stringify(c));
ok(c.every(x=>x.h>=44),'phone: the chips are 44 px tall '+JSON.stringify(c.map(x=>x.h)));
ok(v.done&&v.trash&&v.main.includes('Presupuesto techo')&&v.main.length===7,'Todas: everything as before (groups, Esperando, Terminadas, Papelera) '+JSON.stringify(v));
await tap('#taskFilter .chip',{hasText:'Con hora'});await sleep(200);v=await view(p);
ok(await chosen(p)==='Con hora'&&JSON.stringify(v.main)==='["Turno dentista","Llamar al banco"]'&&!v.done&&!v.trash,'Con hora: only the tasks with a time, in their groups; no Terminadas or Papelera '+JSON.stringify(v));
await tap('#taskFilter .chip',{hasText:'Alta'});await sleep(200);v=await view(p);
ok(JSON.stringify(v.main)==='["Pagar el seguro","Llamar al banco","Ordenar el placard"]','Alta: only Alta, in their groups '+JSON.stringify(v.main));
await tap('#taskFilter .chip',{hasText:'Esperando'});await sleep(200);v=await view(p);
ok(JSON.stringify(v.main)==='["Presupuesto techo"]'&&!v.done&&!v.trash,'Esperando: only what is waiting '+JSON.stringify(v));
// Con el filtro por persona: se combinan (y los números son de lo que se ve)
await tap('#taskFilter .chip',{hasText:'Todas'});await sleep(200);
await p.locator('.task',{has:p.locator('.ttext',{hasText:'Turno dentista'})}).first().locator('.meta .person').tap();await sleep(300);
ok(JSON.stringify(await label(p))==='["Todas 2","Con hora 2","Alta 1","Esperando 0"]','with the person filter (Laura): the numbers are hers '+JSON.stringify(await label(p)));
await tap('#taskFilter .chip',{hasText:'Alta'});await sleep(200);v=await view(p);
ok(JSON.stringify(v.main)==='["Llamar al banco"]','person filter + Alta: both apply '+JSON.stringify(v.main));
await tap('#taskFilter .chip',{hasText:'Esperando'});await sleep(200);v=await view(p);
ok(v.main.length===0&&v.empty==='No hay tareas con este filtro.'&&(await chips(p))!==null,'nothing left: "No hay tareas con este filtro." and the chips stay to go back '+JSON.stringify(v));
await tap('#filterX');await sleep(200);
// Se mantiene al ir a Buscar y volver; vuelve a Todas al pasar por Hoy
await tap('#taskFilter .chip',{hasText:'Alta'});await sleep(200);
await go(p,'buscar');await p.click('#searchClose');await sleep(300);
ok(await screen(p)==='tareas'&&await chosen(p)==='Alta','Buscar and back: still Alta');
await go(p,'hoy');await go(p,'tareas');
ok(await chosen(p)==='Todas','through Hoy and back: Todas again');
// Desde Ajustes › Papelera (con un filtro puesto): Todas, así se ve la Papelera
await tap('#taskFilter .chip',{hasText:'Con hora'});await sleep(200);
await p.evaluate(()=>openSettings());await sleep(300);await p.locator('#setTrash').tap();await sleep(500);
v=await view(p);
ok(await screen(p)==='tareas'&&await chosen(p)==='Todas'&&v.trash,'Ajustes › Papelera with a filter on: Todas, and the Papelera is there '+JSON.stringify({f:await chosen(p),trash:v.trash}));
// No se recuerda al reabrir la app
await tap('#taskFilter .chip',{hasText:'Alta'});await sleep(200);
await p.reload();await sleep(800);await go(p,'tareas');
ok(await chosen(p)==='Todas','reopening the app: Todas (the filter is not remembered)');
// Buscar con el campo vacío: Quién te lo pidió (con la inicial) y Atajos
await go(p,'buscar');await sleep(200);
const sh=await p.evaluate(()=>{const h=document.getElementById('searchHome');return {lbls:[...h.querySelectorAll('.lbl')].filter(x=>x.getBoundingClientRect().height).map(x=>x.textContent),
  people:[...document.querySelectorAll('#searchPeople .chip')].map(x=>({t:x.textContent,ini:!!x.querySelector('.pini')})),
  quick:[...document.querySelectorAll('#searchQuick .chip')].filter(x=>x.getBoundingClientRect().height).map(x=>x.textContent)}});
ok(JSON.stringify(sh.lbls)==='["Quién te lo pidió","Atajos"]','Buscar, empty field: "Quién te lo pidió" and "Atajos" '+JSON.stringify(sh.lbls));
ok(sh.people.length===2&&sh.people.every(x=>x.ini),'people chips carry the circle with the initial '+JSON.stringify(sh.people));
ok(JSON.stringify(sh.quick)==='["Con hora","Prioridad alta","Esperando"]','Atajos: Con hora · Prioridad alta · Esperando '+JSON.stringify(sh.quick));
await tap('#searchQuick .chip',{hasText:'Prioridad alta'});await sleep(400);v=await view(p);
ok(await screen(p)==='tareas'&&await chosen(p)==='Alta'&&JSON.stringify(v.main)==='["Pagar el seguro","Llamar al banco","Ordenar el placard"]','"Prioridad alta" opens Tareas filtered by Alta');
await p.goBack();await sleep(400);
ok(await screen(p)==='hoy','Atrás from there: Hoy');
await go(p,'buscar');await tap('#searchPeople .chip',{hasText:'Laura'});await sleep(300);
ok(await p.inputValue('#search')==='@Laura','a person chip still searches "@Laura"');
await go(p,'notas');
ok(await chips(p)===null,'Notas: no task filter chips');
ok(p.errs.length===0,'phone: no page errors '+JSON.stringify(p.errs));
await ctx.close();

// Buscar: solo los atajos que tienen algo
gh=makeGH([T('a','Algo sin hora'),T('b','Otra')]);
({ctx,p}=await device(b,gh,{viewport:{width:390,height:844},isMobile:true,hasTouch:true},APP,SEEN));
await go(p,'buscar');await sleep(200);
const q2=await p.evaluate(()=>({row:document.getElementById('searchQuickRow').getBoundingClientRect().height>0,n:[...document.querySelectorAll('#searchQuick .chip')].filter(x=>x.getBoundingClientRect().height).length}));
ok(!q2.row&&q2.n===0,'Buscar: no Atajos when there is nothing with a time, Alta or waiting '+JSON.stringify(q2));
await ctx.close();

// ===== Compu ancha: la columna derecha también se filtra; con Esperando, esa lista va al centro =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,{viewport:{width:1280,height:800}},APP,SEEN));
await go(p,'tareas');v=await view(p);
ok(JSON.stringify(v.side)==='["Presupuesto techo","Ordenar el placard","Buscar plomero"]','wide, Todas: the right column has Esperando and Sin fecha '+JSON.stringify(v.side));
await p.click('#taskFilter .chip >> text=Con hora');await sleep(200);v=await view(p);
ok(v.side.length===0&&JSON.stringify(v.main)==='["Turno dentista","Llamar al banco"]','wide, Con hora: nothing in the right column '+JSON.stringify(v));
await p.click('#taskFilter .chip >> text=Alta');await sleep(200);v=await view(p);
ok(JSON.stringify(v.side)==='["Ordenar el placard"]'&&JSON.stringify(v.main)==='["Pagar el seguro","Llamar al banco"]','wide, Alta: the right column only has the Alta without a date '+JSON.stringify(v));
await p.click('#taskFilter .chip >> text=Esperando');await sleep(200);v=await view(p);
ok(JSON.stringify(v.main)==='["Presupuesto techo"]'&&v.side.length===0,'wide, Esperando: the list goes to the center, the right column is empty '+JSON.stringify(v));
await p.click('#taskFilter .chip >> text=Todas');await sleep(200);v=await view(p);
ok(v.side.length===3&&v.done,'wide, Todas again: everything back');
ok(p.errs.length===0,'computer: no page errors '+JSON.stringify(p.errs));
await ctx.close();

// Sin nada pendiente: sin chips ("Nada pendiente. Buen trabajo.")
gh=makeGH([T('d1','Mandar remitos',{done:true,completedAt:ago(1)})]);
({ctx,p}=await device(b,gh,{viewport:{width:1280,height:800}},APP,SEEN));
await go(p,'tareas');
ok(await chips(p)===null&&(await view(p)).empty==='Nada pendiente. Buen trabajo.','nothing pending: no chips, the usual message');
await ctx.close();

await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
