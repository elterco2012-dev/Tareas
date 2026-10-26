// Editar guarda al cerrar con Atrás, afuera o Esc (con Deshacer); la ✕ descarta; lista pegada recuperable;
// Atrás con dos capas vuelve a la guarda que existe (sin pushState sin un toque); recargar con la guarda puesta;
// Vaciar papelera: un doble clic no la vacía y hay Deshacer.
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true},DESK={viewport:{width:1000,height:900}};
let APP;const onApp=p=>p.url().startsWith(APP);
const spy=()=>{window.__push=[];const o=history.pushState.bind(history);history.pushState=(...a)=>{window.__push.push(navigator.userActivation?navigator.userActivation.isActive:null);return o(...a)}};
(async()=>{
const b=await L.launch();APP=await L.appUrl();
// 1) Atrás con cambios en Editar: guarda y ofrece Deshacer
{
  const gh=makeGH([T('a','Llamar al banco',{due:day(1)}),T('b','Otra',{due:day(0)})]);
  let {ctx,p}=await device(b,gh,PHONE,undefined,spy);
  await go(p,'tareas');   // la de mañana está en Tareas (la app abre en Hoy)
  await p.locator('.task .ttext',{hasText:'Llamar al banco'}).tap();await sleep(200);
  await p.fill('#eNotes','Cuenta 4471');
  await p.goBack();await sleep(400);
  ok(await p.isHidden('#editOv')&&onApp(p),'Back closes edit and stays');
  ok((await p.textContent('#toastMsg')).includes('Cambios guardados')&&await p.isVisible('#toastUndo'),'toast Cambios guardados + Deshacer');
  await sleep(1500);
  ok(gh.items.find(x=>x.id==='a').notes==='Cuenta 4471','note saved to GitHub');
  await p.click('#toastUndo');await sleep(1500);
  ok(gh.items.find(x=>x.id==='a').notes==='','Deshacer restores the note');
  // Tocar afuera con cambios
  await p.locator('.task .ttext',{hasText:'Llamar al banco'}).tap();await sleep(200);
  await p.fill('#eTitle','Llamar al banco Galicia');
  await p.mouse.click(190,30);await sleep(400);
  ok(await p.isHidden('#editOv'),'tap outside closes');
  await sleep(1300);ok(gh.items.find(x=>x.id==='a').title==='Llamar al banco Galicia','tap outside saved title');
  // ✕ descarta
  await p.locator('.task .ttext',{hasText:'Galicia'}).tap();await sleep(200);
  await p.fill('#eNotes','no va');await p.click('#editX');await sleep(1300);
  ok(gh.items.find(x=>x.id==='a').notes==='','✕ discards');
  // Título vacío: Atrás no cierra
  await p.locator('.task .ttext',{hasText:'Galicia'}).tap();await sleep(200);
  await p.fill('#eTitle','');await p.goBack();await sleep(400);
  ok(await p.isVisible('#editOv')&&onApp(p),'empty title: Back keeps it open');
  ok((await p.textContent('#toastMsg')).includes('Falta el título'),'tells why');
  ok(await p.evaluate(()=>history.state&&history.state.tareas==='atras'),'guard restored after refused Back');
  await p.click('#eCancel');await sleep(400);
  ok(await p.evaluate(()=>!(history.state&&history.state.tareas)),'Cancel clears the guard');
  ok(await p.evaluate(()=>window.__push.every(x=>x!==false)),'no pushState without user activation: '+JSON.stringify(await p.evaluate(()=>window.__push)));
  ok(p.errs.length===0,'no errors '+p.errs);await ctx.close();
}
// 2) Dos capas: búsqueda + tarea. Atrás cierra la tarea, vuelve a la guarda existente (sin pushState), Atrás cierra la búsqueda
{
  const gh=makeGH([T('a','Probar tickets',{due:day(1)}),T('b','Otra',{due:day(0)})]);
  let {ctx,p}=await device(b,gh,PHONE,undefined,spy);
  await p.click('#searchBtn');await sleep(200);
  await p.fill('#search','Probar');await sleep(200);   // con el campo vacío Buscar no muestra la lista
  await p.locator('.task .ttext',{hasText:'Probar tickets'}).tap();await sleep(300);
  const pushes0=await p.evaluate(()=>window.__push.length);
  const len0=await p.evaluate(()=>history.length);
  await p.goBack();await sleep(500);
  ok(await p.isHidden('#editOv')&&await p.isVisible('#searchBar')&&onApp(p),'first Back closes the task, search stays');
  ok(await p.evaluate(()=>history.state&&history.state.tareas==='atras'),'back on the guard entry');
  ok(await p.evaluate(()=>window.__push.length)===pushes0,'no new pushState after Back (used forward)');
  ok(await p.evaluate(()=>history.length)===len0,'history did not grow');
  await p.goBack();await sleep(500);
  ok(await p.isHidden('#searchBar')&&onApp(p),'second Back closes the search');
  ok(await p.evaluate(()=>!(history.state&&history.state.tareas)),'on base entry');
  ok(await p.evaluate(()=>window.__push.every(x=>x!==false)),'all pushState had activation '+JSON.stringify(await p.evaluate(()=>window.__push)));
  ok(p.errs.length===0,'no errors '+p.errs);
  // (al salir, el script de la prueba falla en about:blank por sessionStorage: no es de la app)
  await p.goBack();await sleep(300);ok(!onApp(p),'nothing open: Back leaves');
  await ctx.close();
}
// 3) Recargar con la guarda puesta: vuelve a la entrada de la app sola
{
  const gh=makeGH([T('a','Una',{due:day(1)})]);
  let {ctx,p}=await device(b,gh,PHONE);
  await p.click('#searchBtn');await sleep(200);
  ok(await p.evaluate(()=>history.state&&history.state.tareas==='atras'),'guard set');
  await p.reload();await sleep(1200);
  ok(await p.evaluate(()=>!(history.state&&history.state.tareas)),'after reload: off the stale guard');
  await p.goBack();await sleep(300);ok(!onApp(p),'then one Back leaves the app ('+p.url()+')');
  await ctx.close();
}
// 4) Esc en la compu guarda; lista pegada: Esc y Recuperar; papelera con doble clic y Deshacer
{
  const gh=makeGH([T('a','Primera',{due:day(0)}),T('t1','Vieja',{deletedAt:new Date().toISOString()}),T('t2','Otra vieja',{deletedAt:new Date().toISOString()})]);
  let {ctx,p}=await device(b,gh,DESK);
  await p.locator('.task .ttext',{hasText:'Primera'}).click();await sleep(200);
  await p.fill('#eNotes','con Esc');await p.keyboard.press('Escape');await sleep(1500);
  ok(await p.isHidden('#editOv')&&gh.items.find(x=>x.id==='a').notes==='con Esc','Esc saves changes');
  await p.focus('#title');
  await p.evaluate(()=>{const dt=new DataTransfer();dt.setData('text/plain','comprar pan\nllamar a Juan\npagar luz');$('title').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))});await sleep(200);
  ok(await p.isVisible('#bulkOv'),'bulk open');
  await p.locator('#bulkList .bulkrow').nth(1).locator('input[type=checkbox]').uncheck();
  await p.keyboard.press('Escape');await sleep(200);
  ok(await p.isHidden('#bulkOv')&&(await p.textContent('#toastUndo'))==='Recuperar','Esc closes the list with Recuperar');
  await p.click('#toastUndo');await sleep(200);
  ok(await p.isVisible('#bulkOv')&&await p.evaluate(()=>bulkItems().join('|'))==='comprar pan|pagar luz','Recuperar brings it back with the unchecked line');
  await p.click('#bulkX');await sleep(200);ok(await p.isHidden('#bulkOv')&&await p.isHidden('#toast'),'✕ discards silently');
  // papelera (está en Tareas)
  await go(p,'tareas');await p.click('#trashToggle');await sleep(150);
  await p.dblclick('#trashEmpty');await sleep(300);
  ok(await p.isVisible('#trashSec')&&await p.evaluate(()=>trash.length)===2,'double click does not empty');
  await sleep(800);await p.click('#trashEmpty');await sleep(1500);
  ok(await p.evaluate(()=>trash.length)===0&&!gh.items.some(x=>x.id==='t1'),'second deliberate click empties');
  ok(await p.isVisible('#toastUndo'),'with Deshacer');
  await p.click('#toastUndo');await sleep(1500);
  ok(await p.evaluate(()=>trash.length)===2&&gh.items.filter(x=>x.deletedAt).length===2,'Deshacer puts them back in the trash');
  ok(p.errs.length===0,'no errors '+p.errs);await ctx.close();
}
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
