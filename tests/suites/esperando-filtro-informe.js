// Esperando respuesta, filtrar por persona, copiar el informe
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
(async()=>{
const b=await L.launch();
const ago=L.ago;
// lunes de esta semana y de la pasada (hora local AR)
const gh=makeGH([
  T('a','Revisar stock de anclajes',{due:day(0),requester:'Laura'}),
  T('b','Cargar pedidos',{due:day(0),requester:'laura'}),
  T('c','Llamar proveedor',{due:day(-1),requester:'Juan'}),
  T('d','Ordenar carpeta de reclamos',{due:null}),
  T('e','Mandar cotización',{due:day(2),requester:'Martín',waiting:true,waitingOn:'Martín',waitingSince:ago(5)}),
]);
let {ctx,p}=await device(b,gh,{viewport:{width:1100,height:900}});
await go(p,'tareas');   // Esperando, el filtro y el informe están en Tareas (la app abre en Hoy)
const g=id=>gh.items.find(x=>x.id===id);
// ===== 4. Esperando =====
ok((await p.innerText('#waitingSec')).includes('ESPERANDO')||(await p.innerText('#waitingSec')).toUpperCase().includes('ESPERANDO'),'Esperando section shown');
ok(!(await p.innerText('#groups')).includes('Mandar cotización'),'waiting task not in date groups');
const wtxt=await p.innerText('#waitingSec');
ok(wtxt.includes('Martín · hace 5 días'),'row shows "Martín · hace 5 días": '+wtxt.replace(/\n/g,' | '));
ok(await p.evaluate(()=>!!document.querySelector('#waitingSec .late')),'≥3 days shown in amber');
ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#waitingSec .late')).color)==='rgb(161, 92, 7)','amber color #a15c07');
await go(p,'hoy');const sub=await p.innerText('.sub');await go(p,'tareas');   // el resumen se ve en Hoy
ok(/1 vencida/.test(sub)&&/2 para hoy/.test(sub)&&!/3/.test(sub.split('\n').slice(1).join(' ')),'header summary excludes waiting: '+sub.replace(/\n/g,' | '));
// Marcar como esperando desde el menú
await p.locator('#groups .task',{hasText:'Llamar proveedor'}).locator('.more').click();
const menu=await p.innerText('#menu');ok(menu.includes('Esperando respuesta…'),'menu has Esperando respuesta…');
await p.click('#menu button:has-text("Esperando respuesta")');
ok(await p.isVisible('#waitOv')&&(await p.inputValue('#waitName'))==='Juan','mini dialog prefilled with requester');
await p.click('#waitForm button[type=submit]');await sleep(400);
const c=g('c');ok(c.waiting===true&&c.waitingOn==='Juan'&&c.waitingSince,'saved waiting/waitingOn/waitingSince');
ok((await p.innerText('#toastMsg'))==='En espera de Juan'&&await p.isVisible('#toastUndo'),'toast with Deshacer');
ok((await p.innerText('#waitingSec')).includes('Juan · desde hoy'),'moved to Esperando (desde hoy)');
await p.click('#toastUndo');await sleep(400);
ok(g('c').waiting===false&&(await p.innerText('#groups')).includes('Llamar proveedor'),'undo esperando');
// Menú de una tarea en espera: Ya respondió
await p.locator('#waitingSec .task .more').first().click();
const m2=await p.innerText('#menu');
ok(m2.includes('Ya respondió')&&m2.includes('Terminar')&&m2.includes('Editar')&&m2.includes('Borrar')&&!m2.includes('Para hoy'),'waiting menu: Ya respondió/Terminar/Editar/Borrar');
await p.click('#menu button:has-text("Ya respondió")');await sleep(400);
ok(g('e').waiting===false&&(await p.innerText('#groups')).includes('Mandar cotización'),'Ya respondió → back to pending');
await p.click('#toastUndo');await sleep(400);ok(g('e').waiting===true,'undo Ya respondió');
// #esperando en el texto libre
await p.fill('#title','Confirmar entrega #esperando @Pedro mañana');
ok((await p.innerText('#detected')).includes('Esperando a Pedro'),'Detectado shows Esperando a Pedro');
await p.press('#title','Enter');await sleep(400);
const ce=gh.items.find(x=>x.title==='Confirmar entrega');
ok(ce&&ce.waiting&&ce.waitingOn==='Pedro'&&ce.requester==='Pedro'&&ce.due===day(1),'#esperando + @Pedro saved: '+JSON.stringify(ce&&{w:ce.waiting,o:ce.waitingOn,d:ce.due}));
await p.fill('#title','Pedir muestras esperando respuesta de Laura');await p.press('#title','Enter');await sleep(400);
const pm=gh.items.find(x=>x.title==='Pedir muestras');
ok(pm&&pm.waiting&&pm.waitingOn==='Laura','spoken "esperando respuesta de Laura"');
// Terminar desde Esperando con la casilla
await p.locator('#waitingSec .task',{hasText:'Pedir muestras'}).locator('.chk').click();await L.until(()=>gh.items.find(x=>x.title==='Pedir muestras')?.done);
ok(gh.items.find(x=>x.title==='Pedir muestras').done===true,'complete from Esperando');

// ===== 6. Filtrar por persona =====
await p.locator('#groups .person',{hasText:'@Laura'}).first().click();await sleep(200);
ok(!(await p.isVisible('#editOv')),'tapping @Laura does not open edit');
ok(await p.isVisible('#filterBar')&&(await p.innerText('#filterBar')).includes('Pedidas por Laura'),'filter bar "Pedidas por Laura"');
let gt=await p.innerText('#groups');
ok(gt.includes('Revisar stock')&&gt.includes('Cargar pedidos')&&!gt.includes('Llamar proveedor')&&!gt.includes('Ordenar carpeta'),'filter (case-insensitive) on pending');
ok(!(await p.innerText('#waitingSec')).includes('Mandar cotización'),'filter applies to Esperando');
// El filtro sigue en Buscar: se busca adentro de lo de esa persona; Cerrar vuelve a Tareas con el filtro puesto
await p.click('#searchBtn');await p.fill('#search','stock');gt=await p.innerText('#groups');
ok(await p.isVisible('#filterBar')&&gt.includes('Revisar stock')&&!gt.includes('Cargar pedidos'),'filter combines with search');
await p.click('#searchClose');
ok(await p.evaluate(()=>document.body.dataset.screen)==='tareas'&&await p.isVisible('#filterBar'),'Cerrar: back to Tareas, still filtered');
await p.keyboard.press('Escape');ok(!(await p.isVisible('#filterBar')),'Esc removes the filter');
await p.locator('#waitingSec .person',{hasText:'Martín'}).first().click();
ok((await p.innerText('#waitingSec')).includes('Mandar cotización')&&!(await p.innerText('#groups')).includes('Revisar stock'),'filter by waitingOn name');
await p.click('#filterX');ok(!(await p.isVisible('#filterBar')),'✕ removes the filter');

// ===== 5. Copiar resumen =====
// completar algunas esta semana
for(const t of ['Revisar stock de anclajes','Cargar pedidos','Ordenar carpeta de reclamos']){await p.locator('#groups .task',{hasText:t}).locator('.chk').click();await L.until(()=>gh.items.find(x=>x.title===t)?.done)}
await p.evaluate(()=>{window.__clip=null;navigator.clipboard.writeText=t=>{window.__clip=t;return Promise.resolve()}});
await p.click('#repBtn');await sleep(200);await p.click('#repCopy');await sleep(200);
let clip=await p.evaluate(()=>window.__clip);
const mon=await p.evaluate(()=>{const n=new Date();const m=new Date(n.getFullYear(),n.getMonth(),n.getDate()-(n.getDay()+6)%7);return m.getDate()+'/'+(m.getMonth()+1)+' al '+n.getDate()+'/'+(n.getMonth()+1)});
ok(clip&&clip.startsWith('Informe de tareas · semana del '+mon+'\n')&&/• Revisar stock de anclajes \(@Laura\) — creada .*, terminada /.test(clip)&&clip.includes('• Pedir muestras — creada')&&clip.includes('\nEN ESPERA (2)\n')&&clip.includes('Mandar cotización')&&clip.includes('esperando a Martín'),'report text:\n'+clip);
ok((await p.innerText('#toastMsg')).startsWith('Informe copiado'),'toast Informe copiado');
// semana pasada sin terminadas
await p.selectOption('#repPer','lastweek');await sleep(100);
ok((await p.innerText('#repView')).includes('Ninguna en el período.'),'last week: none done');
// falla el portapapeles → modal con el texto
await p.selectOption('#repPer','week');
await p.evaluate(()=>{navigator.clipboard.writeText=()=>Promise.reject(new Error('x'))});
await p.click('#repCopy');await sleep(200);
ok(await p.isVisible('#textOv')&&(await p.inputValue('#textBox')).startsWith('Informe de tareas')&&await p.isHidden('#repOv'),'clipboard failure shows text modal');
await p.keyboard.press('Escape');ok(!(await p.isVisible('#textOv')),'Esc closes text modal');
// con filtro por persona, el informe arranca con esa persona
await p.evaluate(()=>{navigator.clipboard.writeText=t=>{window.__clip=t;return Promise.resolve()}});
await p.evaluate(()=>setPersonFilter('Laura'));await p.click('#repBtn');await sleep(150);await p.click('#repCopy');await sleep(150);
clip=await p.evaluate(()=>window.__clip);
ok(clip&&clip.includes('· de Laura')&&clip.includes('Revisar stock')&&!clip.includes('Pedir muestras'),'report starts with the person filter: '+JSON.stringify(clip));
await p.evaluate(()=>setPersonFilter(null));
ok(p.errs.length===0,'desktop errors '+JSON.stringify(p.errs));
await ctx.close();
// 375 px: sin desbordes con todo visible (filtro, esperando, terminadas + herramientas) en claro y oscuro
for(const cs of ['light','dark']){
  ({ctx,p}=await device(b,gh,{viewport:{width:375,height:800},isMobile:true,hasTouch:true,colorScheme:cs}));
  await go(p,'tareas');await p.locator('#doneToggle').tap();await p.evaluate(()=>setPersonFilter('Martín'));await sleep(100);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),cs+' 375: no overflow');
  await p.evaluate(()=>setPersonFilter(null));await sleep(100);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),cs+' 375: no overflow (no filter)');
  await p.screenshot({path:L.out('B-'+cs+'.png'),fullPage:true});
  ok(p.errs.length===0,cs+' errors '+JSON.stringify(p.errs));await ctx.close();
}
await b.close();})();
