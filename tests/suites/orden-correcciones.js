// Correcciones de la revisión del orden: dónde cae al cambiar de grupo, filtro, repetidas, error del archivo
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
const DESK={viewport:{width:1000,height:900}};
const order=(p,f)=>p.evaluate(fs=>visibleIds.map(id=>tasks.find(t=>t.id===id)).filter(new Function('t','return '+fs)).map(t=>t.title).join('|'),f);
const pick=(p,title)=>p.evaluate(tt=>{if(document.activeElement)document.activeElement.blur();sel=tasks.find(t=>t.title===tt).id;renderList()},title);
(async()=>{
const b=await L.launch();
{
  const gh=makeGH([T('p','P alta',{priority:'Alta',order:5}),T('q','Q alta',{priority:'Alta',order:7}),T('n','N media',{order:6}),T('m','M media',{order:8}),
    T('d','D hoy',{due:day(0),order:0}),T('a','A hoy',{due:day(0),order:1}),T('w','W mañana',{due:day(1),order:0}),T('x','X mañana',{due:day(1),order:1})]);
  let {ctx,p}=await device(b,gh,DESK);
  await go(p,'tareas');   // el orden se ve en la lista completa (la app abre en Hoy)
  // "!" después del aviso: queda al final de las Alta (justo arriba de las Media), no arriba de todo
  await pick(p,'M media');await p.keyboard.press('Alt+ArrowUp');await sleep(400);await p.keyboard.press('Alt+ArrowUp');await sleep(200);
  await p.keyboard.press('!');await sleep(500);
  ok(await order(p,'!t.due')==='P alta|Q alta|M media|N media','"!" → last of the Altas: '+await order(p,'!t.due'));
  await p.click('#toastUndo');await sleep(500);
  ok(await order(p,'!t.due')==='P alta|Q alta|M media|N media'&&gh.items.find(t=>t.id==='m').priority==='Media','Deshacer puts it back where it was: '+await order(p,'!t.due'));
  // Pasar a mañana: va al final de Mañana
  await pick(p,'D hoy');await p.keyboard.press('m');await sleep(500);
  ok(await order(p,"t.due==='"+day(1)+"'")==='W mañana|X mañana|D hoy','rescheduled → end of the new day');
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
}
// Con filtro por persona, mover entre las que se ven
{
  const gh=makeGH([T('a','A laura',{due:day(0),order:0,requester:'Laura'}),T('b','B juan',{due:day(0),order:1,requester:'Juan'}),T('c','C laura',{due:day(0),order:2,requester:'Laura'})]);
  let {ctx,p}=await device(b,gh,DESK);
  await go(p,'tareas');   // el filtro por persona es de Tareas
  await p.evaluate(()=>setPersonFilter('Laura'));await sleep(200);
  await pick(p,'C laura');await p.keyboard.press('Alt+ArrowUp');await sleep(500);
  ok(await order(p,'true')==='C laura|A laura','filtered: moves past the visible one');
  await p.evaluate(()=>setPersonFilter(null));await sleep(200);
  ok(await order(p,'true')==='C laura|A laura|B juan','hidden ones keep their place: '+await order(p,'true'));
  await pick(p,'C laura');await p.evaluate(()=>setPersonFilter('Laura'));await p.keyboard.press('Alt+ArrowUp');await sleep(200);
  ok((await p.innerText('#toastMsg'))==='Ya está primera','edge message based on what is visible');
  await ctx.close();
}
// La que se repite, si estaba primera, sigue primera
{
  const gh=makeGH([T('r','Revisar mails',{due:day(0),order:5,repeat:'daily'}),T('o','Otra hoy',{due:day(0),order:6}),T('x','X mañana',{due:day(1),order:0}),T('y','Y mañana',{due:day(1),order:1})]);
  let {ctx,p}=await device(b,gh,DESK);
  await go(p,'tareas');
  await p.locator('.task',{has:p.locator('.ttext',{hasText:'Revisar mails'})}).locator('.chk').click();await L.until(()=>gh.items.some(x=>x.repeatOf==='r'));
  ok(await order(p,"t.due==='"+day(1)+"'")==='Revisar mails|X mañana|Y mañana','daily task kept first: '+await order(p,"t.due==='"+day(1)+"'"));
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
}
// Archivo que falla: no se reintenta en bucle
{
  const gh=makeGH([T('p','Una',{due:day(0)})]);
  let {ctx,p}=await device(b,gh,DESK);
  await go(p,'tareas');   // el botón Informe está en Tareas
  let n=0;await p.route('**/contents/archivo',r=>{n++;return r.fulfill({status:500,body:'{}'})});
  await p.click('#repBtn');await sleep(100);await p.selectOption('#repPer','all');await sleep(2500);
  ok(n<=2&&(await p.innerText('#repNote')).startsWith('No se pudo leer el archivo'),'archive error: stops trying ('+n+' requests)');
  await p.selectOption('#repPer','lastmonth');await sleep(800);
  ok(n>=2&&n<=4,'changing the period retries once ('+n+')');
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
}
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
