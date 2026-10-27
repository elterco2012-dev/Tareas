// Búsqueda sin tildes y con varias palabras (también en la papelera), lo agregado en la compu sin fecha queda para
// procesar y la fila seleccionada se ve en los dos temas
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
const iso=L.ago;
const DESK={viewport:{width:1000,height:900}};
// Lo que se ve en la lista de pendientes (las dos columnas)
const shown=p=>p.$$eval('#groups .task .ttext,#waitingSec .task .ttext,#side .task .ttext',es=>es.map(e=>e.textContent).sort());
const same=(a,b)=>JSON.stringify(a)===JSON.stringify([...b].sort());
const search=async(p,q)=>{await p.fill('#search',q);await sleep(80)};
const visible=(p,s)=>p.isVisible(s);
(async()=>{
const b=await L.launch();
// ===== Buscar =====
let gh=makeGH([
  T('c1','Llevar el camión al taller',{due:day(0),order:0}),
  T('c2','Comprar CAMION de juguete',{due:day(1),order:1}),
  T('b1','Llamar al banco',{due:day(0),order:2}),
  T('n1','Revisar factura',{due:day(2),notes:'Pedir el número de cuenta del proveedor',order:3}),
  T('r1','Mandar presupuesto',{requester:'Martín Gómez',order:4}),
  T('w1','Respuesta del contador',{waiting:true,waitingOn:'Ana',waitingSince:iso(1)}),
  T('x1','Cosa borrada del galpón',{due:day(0),deletedAt:iso(2)}),
  T('x2','Otra en la papelera',{deletedAt:iso(1)}),
]);
let {ctx,p}=await device(b,gh,DESK);
const g=id=>gh.items.find(x=>x.id===id);
await L.go(p,'tareas');   // la papelera está en Tareas (la app abre en Hoy)
ok(await visible(p,'#trashSec')&&!(await visible(p,'#trashWrap'))&&(await p.innerText('#trashSub'))==='2','before searching: trash collapsed, with its count');
await p.click('#searchBtn');
await search(p,'camion');
let s=await shown(p);
ok(same(s,['Llevar el camión al taller','Comprar CAMION de juguete']),'"camion" finds "camión" and "CAMION": '+JSON.stringify(s));
await search(p,'CAMIÓN');s=await shown(p);
ok(same(s,['Llevar el camión al taller','Comprar CAMION de juguete']),'"CAMIÓN" finds "camion" too: '+JSON.stringify(s));
await search(p,'banco llamar');s=await shown(p);
ok(same(s,['Llamar al banco']),'"banco llamar" finds "Llamar al banco" (all words, any order): '+JSON.stringify(s));
await search(p,'llamar taller');s=await shown(p);
ok(s.length===0,'every word has to be there ("llamar taller" finds nothing): '+JSON.stringify(s));
await search(p,'numero proveedor');s=await shown(p);
ok(same(s,['Revisar factura']),'words only in the notes, without accents: '+JSON.stringify(s));
await search(p,'martin');s=await shown(p);
ok(same(s,['Mandar presupuesto']),'"martin" finds the one asked by "Martín Gómez": '+JSON.stringify(s));
await search(p,'presupuesto @gomez');s=await shown(p);
ok(same(s,['Mandar presupuesto']),'"presupuesto @gomez": the @ is ignored, requester + title: '+JSON.stringify(s));
await search(p,'contador ana');s=await shown(p);
ok(same(s,['Respuesta del contador']),'waiting on someone: title + waitingOn: '+JSON.stringify(s));
await search(p,'zapallo');s=await shown(p);
ok(s.length===0&&await visible(p,'#empty')&&(await p.innerText('#empty'))==='Ninguna tarea pendiente coincide con “zapallo”.','no matches: empty message, without mentioning the trash: '+await p.innerText('#empty'));
ok(!(await visible(p,'#trashSec')),'no matches in the trash: trash section hidden while searching');
// La papelera mientras se busca
await search(p,'galpon');s=await shown(p);
ok(s.length===0&&!(await p.innerText('#groups')).includes('galpón'),'deleted tasks are not in the pending list');
ok((await p.innerText('#empty')).includes('coincide con “galpon”.')&&(await p.innerText('#empty')).includes('Hay 1 en la papelera'),'empty message points to the trash: '+await p.innerText('#empty'));
ok(await visible(p,'#trashSec')&&await visible(p,'#trashWrap')&&(await p.textContent('#trashTitle'))==='En la papelera'&&(await p.innerText('#trashSub'))==='1','trash shown open as "En la papelera", with the count of matches');
let trows=await p.$$eval('#trashList .trow .tt>div:first-child',es=>es.map(e=>e.textContent));
ok(same(trows,['Cosa borrada del galpón']),'only the matching deleted task: '+JSON.stringify(trows));
ok(!(await visible(p,'#trashEmpty'))&&await p.evaluate(()=>showTrash)===false,'no "Vaciar papelera" while searching, and the trash toggle stays off');
// Plegarla y desplegarla mientras se busca
await p.click('#trashToggle');
ok(await visible(p,'#trashSec')&&!(await visible(p,'#trashWrap'))&&await p.evaluate(()=>showTrash)===false,'the toggle folds it while searching');
await p.click('#trashToggle');
ok(await visible(p,'#trashWrap'),'and unfolds it');
await p.locator('#trashList .trow',{hasText:'galpón'}).locator('button',{hasText:'Recuperar'}).click();await sleep(500);
ok(!g('x1').deletedAt&&(await p.innerText('#toastMsg'))==='Tarea recuperada','Recuperar from the search restores it: '+JSON.stringify(g('x1')));
s=await shown(p);
ok(same(s,['Cosa borrada del galpón'])&&!(await visible(p,'#empty'))&&!(await visible(p,'#trashSec')),'back in the list (it matches), trash section gone (no more matches): '+JSON.stringify(s));
// Al borrar la búsqueda, la papelera vuelve a ser la de siempre
await search(p,'otra');
ok(await visible(p,'#trashWrap')&&(await p.innerText('#trashSub'))==='1','"otra": the other deleted one shows');
await search(p,'');
// Con el campo vacío Buscar muestra las personas y no la lista: la papelera vuelve a ser la de siempre por dentro
ok(await visible(p,'#searchHome')&&!(await visible(p,'#trashSec'))&&await p.evaluate(()=>$('trashWrap').classList.contains('hidden')&&showTrash===false)&&(await p.textContent('#trashTitle'))==='Papelera'&&(await p.textContent('#trashSub'))==='1','search cleared: trash collapsed again (showTrash off), plain "Papelera" (Buscar shows the people, not the list)');
await search(p,'otra');await p.click('#searchClose');await sleep(100);
ok(!(await visible(p,'#trashWrap'))&&(await p.textContent('#trashTitle'))==='Papelera','closing the search also folds it back');
// Con la papelera abierta, la búsqueda la filtra igual
await p.click('#trashToggle');
ok(await visible(p,'#trashWrap')&&(await visible(p,'#trashEmpty')),'trash opened by hand: with "Vaciar papelera"');
await p.click('#searchBtn');await search(p,'llamar');
ok(!(await visible(p,'#trashSec')),'opened by hand and searching for something not in it: hidden');
await search(p,'');
ok(await visible(p,'#searchHome')&&!(await visible(p,'#trashSec'))&&await p.evaluate(()=>!$('trashWrap').classList.contains('hidden')&&!$('trashEmpty').classList.contains('hidden')&&showTrash===true)&&(await p.$$('#trashList .trow')).length===1,'search cleared: open again, as it was (Buscar shows the people, not the list)');
await p.click('#searchClose');await sleep(100);
ok(await visible(p,'#trashWrap')&&(await visible(p,'#trashEmpty'))&&(await p.$$('#trashList .trow')).length===1,'back in Tareas: the trash is open, as it was');
ok(p.errs.length===0,'search: no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== En la compu: agregar sin fecha → para procesar =====
gh=makeGH([]);
({ctx,p}=await device(b,gh,DESK));
const byTitle=t=>gh.items.find(x=>x.title===t);
// Se agrega en la pantalla Hoy (la de inicio): la tarea va a "Para hoy"
const inToday=(t)=>p.evaluate(t=>{const grp=[...document.querySelectorAll('#hoyList .grp')].find(x=>/^Para hoy/.test(x.querySelector('.ghead').textContent));return !!grp&&[...grp.querySelectorAll('.task')].some(r=>r.querySelector('.ttext').textContent===t&&!!r.querySelector('.inboxdot'))},t);
ok(await p.evaluate(()=>FINE&&!COARSE&&!document.querySelector('#chips .chip.on')),'desktop: no date chip marked at first (without choosing, it stays in Hoy as anotada al pasar)');
await p.fill('#title','Comprar tóner');await p.press('#title','Enter');await sleep(500);
let t=byTitle('Comprar tóner');
ok(t&&t.inbox===true&&t.due===day(0),'desktop add without a date → saved with inbox:true, due today: '+JSON.stringify(t&&{inbox:t.inbox,due:t.due}));
ok(await inToday('Comprar tóner'),'shown in Hoy with the inbox dot');
ok(await visible(p,'#procBtn')&&(await p.innerText('#procCount'))==='1','Ordenar row on Hoy with 1');
await p.fill('#title','Llamar a Pedro mañana');await p.press('#title','Enter');await sleep(500);
t=byTitle('Llamar a Pedro');
ok(t&&!t.inbox&&t.due===day(1),'"mañana" in the text → not inbox: '+JSON.stringify(t&&{inbox:t.inbox,due:t.due}));
await p.click('#chips .chip[data-v="0"]');await p.fill('#title','Pagar la luz');await p.press('#title','Enter');await sleep(500);
t=byTitle('Pagar la luz');
ok(t&&!t.inbox&&t.due===day(0),'"Hoy" chip clicked → not inbox: '+JSON.stringify(t&&{inbox:t.inbox,due:t.due}));
await p.click('#chips .chip[data-v=""]');await p.fill('#title','Ordenar el escritorio');await p.press('#title','Enter');await sleep(500);
t=byTitle('Ordenar el escritorio');
ok(t&&!t.inbox&&t.due===null,'"Sin fecha" chip → not inbox, no date: '+JSON.stringify(t&&{inbox:t.inbox,due:t.due}));
await p.fill('#title','Presupuesto de la obra #esperando @Juan');await p.press('#title','Enter');await sleep(500);
t=gh.items.find(x=>x.waiting);
ok(t&&!t.inbox,'waiting → not inbox: '+JSON.stringify(t&&{title:t.title,waiting:t.waiting,inbox:t.inbox}));
ok((await p.innerText('#procCount'))==='1','"Ordenar" still counts only the one without a date');
// ===== La fila seleccionada, con una barra a la izquierda =====
await p.evaluate(()=>document.activeElement.blur());await p.focus('#title');await p.keyboard.press('ArrowDown');
const selStyle=()=>p.evaluate(()=>{const r=document.querySelector('.task.sel');if(!r)return null;const c=getComputedStyle(r);return {shadow:c.boxShadow,bg:c.backgroundColor}});
let st=await selStyle();
ok(st&&/inset/.test(st.shadow)&&st.shadow.includes('rgb(79, 70, 229) 3px 0px 0px 0px'),'light: selected row has the inset accent bar: '+JSON.stringify(st));
ok(st&&st.bg==='rgb(238, 241, 255)','light: keeps the selected background');
await p.evaluate(()=>{document.documentElement.dataset.theme='dark'});
st=await selStyle();
ok(st&&/inset/.test(st.shadow)&&st.shadow.includes('rgb(139, 147, 255) 3px 0px 0px 0px')&&st.bg==='rgb(30, 35, 66)','dark theme chosen in the app: bar in the dark accent: '+JSON.stringify(st));
const other=await p.evaluate(()=>{const r=[...document.querySelectorAll('.task')].find(x=>!x.classList.contains('sel'));return r?getComputedStyle(r).boxShadow:null});
ok(other==='none','rows that are not selected have no bar: '+other);
ok(p.errs.length===0,'desktop add: no page errors '+JSON.stringify(p.errs));
await ctx.close();
// Tema oscuro del sistema
gh=makeGH([T('a','Primera',{due:day(0),order:0}),T('b2','Segunda',{due:day(0),order:1})]);
({ctx,p}=await device(b,gh,{...DESK,colorScheme:'dark'}));
await p.focus('#title');await p.keyboard.press('ArrowDown');
st=await selStyle();
ok(st&&/inset/.test(st.shadow)&&st.shadow.includes('rgb(139, 147, 255) 3px 0px 0px 0px')&&st.bg==='rgb(30, 35, 66)','dark system theme: selected row has the bar: '+JSON.stringify(st));
ok(p.errs.length===0,'dark: no page errors '+JSON.stringify(p.errs));
await ctx.close();
// En el celular (filas para deslizar) la seleccionada también lleva la barra
({ctx,p}=await device(b,gh,{viewport:{width:384,height:832},isMobile:true,hasTouch:true}));
await p.evaluate(()=>{sel=tasks.find(x=>x.title==='Primera').id;renderList()});
st=await p.evaluate(()=>{const r=document.querySelector('.swipe .task.sel');if(!r)return null;const c=getComputedStyle(r);return {shadow:c.boxShadow,bg:c.backgroundColor}});
ok(st&&st.shadow.includes('rgb(79, 70, 229) 3px 0px 0px 0px')&&st.bg==='rgb(238, 241, 255)','phone: selected swipe row has the bar too: '+JSON.stringify(st));
await ctx.close();
await b.close();console.log('fails',L.fails)})();
