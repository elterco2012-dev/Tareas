// Botón Atrás: cierra lo que esté abierto y vuelve a la lista (no sale de la app)
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
let APP;   // la app servida por http (L.appUrl)
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true},DESK={viewport:{width:1000,height:900}};
const onApp=p=>p.url().startsWith(APP);
(async()=>{
const b=await L.launch();APP=await L.appUrl();
{
  const gh=makeGH([T('a','Probar tickets Jira',{due:day(1),requester:'Baldino'}),T('b','Otra',{due:day(0)})]);
  let {ctx,p}=await device(b,gh,PHONE);
  // Editar → Atrás
  await p.locator('.task .ttext',{hasText:'Probar tickets Jira'}).tap();await sleep(200);
  ok(await p.isVisible('#editOv'),'edit open');
  await p.goBack();await sleep(300);
  ok(await p.isHidden('#editOv')&&onApp(p)&&await p.isVisible('#title'),'Back closes the task and stays in the app');
  // Cerrar con ✕ no deja una entrada de más: el siguiente Atrás sale
  await p.locator('.task .ttext',{hasText:'Probar tickets Jira'}).tap();await sleep(200);
  await p.click('#editX');await sleep(300);
  ok(await p.evaluate(()=>backGuard===false),'closing with ✕ clears the guard');
  // Menú ⋯, búsqueda, Sincronización, informe
  await p.locator('.task',{has:p.locator('.ttext',{hasText:'Otra'})}).locator('.more').tap();await sleep(200);
  await p.goBack();await sleep(300);ok(await p.isHidden('#menu')&&onApp(p),'Back closes the ⋯ menu');
  await p.click('#searchBtn');await sleep(150);await p.goBack();await sleep(300);ok(await p.isHidden('#searchBar')&&onApp(p),'Back closes the search');
  await p.click('#statusBtn');await sleep(150);await p.goBack();await sleep(300);ok(await p.isHidden('#syncOv')&&onApp(p),'Back closes Sincronización');
  await p.click('#doneToggle');await p.click('#repBtn');await sleep(150);await p.goBack();await sleep(300);ok(await p.isHidden('#repOv')&&onApp(p),'Back closes the report');
  ok(p.errs.length===0,'no errors '+p.errs);
  // Con todo cerrado, Atrás sale de la app (no queda trabado). (El error de sessionStorage en about:blank es de la prueba.)
  await p.goBack();await sleep(300);
  ok(!onApp(p),'nothing open: Back leaves the app ('+p.url()+')');
  await ctx.close();
}
// Procesar con una tarea abierta encima: Atrás cierra de a una
{
  const gh=makeGH([T('a','Vencida',{due:day(-1)}),T('b','Otra vencida',{due:day(-2)})]);
  let {ctx,p}=await device(b,gh,DESK);
  await p.evaluate(()=>document.activeElement&&document.activeElement.blur());
  await p.keyboard.press('p');await sleep(200);await p.keyboard.press('e');await sleep(200);
  ok(await p.isVisible('#editOv')&&await p.isVisible('#procOv'),'Procesar + edit open');
  await p.goBack();await sleep(300);
  ok(await p.isHidden('#editOv')&&await p.isVisible('#procOv'),'Back closes the task, Procesar stays');
  await p.goBack();await sleep(300);
  ok(await p.isHidden('#procOv')&&onApp(p),'Back again closes Procesar');
  // Esc también deja el historial bien
  await p.keyboard.press('p');await sleep(200);await p.keyboard.press('Escape');await sleep(300);
  ok(await p.evaluate(()=>backGuard===false)&&onApp(p),'Esc closes and clears the guard');
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
}
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
