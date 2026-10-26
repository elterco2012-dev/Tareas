// Terminadas: ver la tarea (notas y links) sin volver a pendientes; buscar en terminadas y en el archivo
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
const iso=L.ago;
const DESK={viewport:{width:1000,height:900}},PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const J1='https://logicteam.atlassian.net/browse/WB-3438',J2='https://logicteam.atlassian.net/browse/WB-3439';
const drow=(p,t)=>p.locator('#doneList .drow').filter({has:p.locator('.dt',{hasText:t})}).first();
(async()=>{
const b=await L.launch();
{
  const gh=makeGH([T('d1','Tickets de Julian',{done:true,completedAt:iso(0.01),requester:'Julian',notes:J1+'\n'+J2}),
    T('d2','Vieja con ticket',{done:true,completedAt:iso(20),notes:'Resuelto con WB-2000 '+'https://logicteam.atlassian.net/browse/WB-2000.'}),
    T('p1','Pendiente con link',{due:day(0),notes:'ver '+J1}),T('p2','Con link común',{due:day(0),notes:'https://www.google.com/search?q=hola'})]);
  gh.files['archivo/2026.json']={content:JSON.stringify([T('a1','Archivada con ticket',{done:true,completedAt:'2026-08-01T15:00:00Z',requester:'Ana',notes:'https://logicteam.atlassian.net/browse/WB-1000'})]),sha:1};
  let {ctx,p}=await device(b,gh,DESK);
  await p.route('**/contents/archivo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{name:'2026.json',path:'archivo/2026.json',type:'file'},{name:'README.md',path:'archivo/README.md',type:'file'}])}));
  const g=id=>gh.items.find(x=>x.id===id);
  // Fila pendiente: el link se ve corto
  const pn=await p.locator('.task',{has:p.locator('.ttext',{hasText:'Pendiente con link'})}).locator('.notes').innerText();
  ok(pn==='ver WB-3438','pending row: link shown short: '+pn);
  ok(await p.locator('.task',{has:p.locator('.ttext',{hasText:'Con link común'})}).locator('.notes a').innerText()==='google.com','non-ticket link → site name');
  // Terminadas (están en Tareas; la app abre en Hoy)
  await L.go(p,'tareas');
  await p.click('#doneToggle');await sleep(150);
  const meta=await drow(p,'Tickets de Julian').locator('.dmeta').innerText();
  ok(meta==='@Julian · WB-3438 · WB-3439','done row shows who and the tickets: '+meta);
  ok(await drow(p,'Tickets de Julian').locator('.dmeta a').count()===2,'two links in the done row');
  // Tocar el link abre el ticket, no la tarea
  await ctx.route('https://logicteam.atlassian.net/**',r=>r.fulfill({status:200,body:'ok'}));
  const [pop]=await Promise.all([p.waitForEvent('popup',{timeout:3000}).catch(()=>null),drow(p,'Tickets de Julian').locator('.dmeta a').first().click()]);
  if(pop)await pop.waitForLoadState().catch(()=>{});
  ok(pop&&pop.url().startsWith(J1)&&await p.isHidden('#editOv'),'tapping a link opens the ticket, not the task');
  if(pop)await pop.close();
  // Tocar la fila: se ve la tarea, sigue terminada
  await drow(p,'Tickets de Julian').locator('.dt').click();await sleep(150);
  ok(await p.isVisible('#editOv')&&(await p.innerText('#editH'))==='Tarea terminada','tapping a done task opens it');
  ok(/^Terminada el \S+ \d+\/\d+ a las \d\d:\d\d$/.test(await p.innerText('#eDoneTxt')),'shows when it was done: '+await p.innerText('#eDoneTxt'));
  ok((await p.inputValue('#eNotes'))===J1+'\n'+J2,'notes visible');
  const lk=await p.locator('#eLinks a').allInnerTexts();
  ok(lk.join('|')==='WB-3438 ↗|WB-3439 ↗','links under the notes: '+lk.join('|'));
  ok(g('d1').done===true,'still done');
  // Editar la nota de una terminada y guardar
  await p.fill('#eNotes',J1+'\n'+J2+'\nhttps://logicteam.atlassian.net/browse/WB-3440');await sleep(50);
  ok((await p.locator('#eLinks a').count())===3,'links update while typing');
  await p.click('#eSave');await sleep(500);
  ok(g('d1').notes.endsWith('WB-3440')&&g('d1').done===true&&g('d1').postponed===undefined,'notes saved on a done task, still done');
  // Volver a pendientes desde la tarea
  await drow(p,'Tickets de Julian').locator('.dt').click();await sleep(150);
  await p.click('#eReopen');await sleep(500);
  ok(g('d1').done===false&&await p.isHidden('#editOv'),'"Volver a pendientes" from the task');
  await p.click('#toastUndo');await sleep(500);ok(g('d1').done===true,'Deshacer');
  // Teclado: Enter sobre la fila abre la tarea
  await drow(p,'Tickets de Julian').locator('.dbody').focus();await p.keyboard.press('Enter');await sleep(150);
  ok(await p.isVisible('#editOv')&&(await p.innerText('#editH'))==='Tarea terminada','Enter on a done row opens it');
  await p.keyboard.press('Escape');await sleep(150);
  // Buscar: encuentra terminadas viejas (más de 7 días) por el ticket
  await p.click('#doneToggle');await sleep(100);   // plegada
  await p.keyboard.press('/');await p.keyboard.type('WB-2000');await sleep(200);
  ok(await p.isVisible('#doneWrap')&&await drow(p,'Vieja con ticket').isVisible()&&(await p.innerText('#doneSub'))==='1 coincide','search: finds a done task from 20 days ago, list opened');
  ok(await p.locator('#doneList .drow').count()===1,'only the matching one');
  // Archivo
  await p.fill('#search','WB-1000');await sleep(200);
  ok(await p.isVisible('#archBtn')&&await p.locator('#doneList .nodone').isVisible(),'not in the last done → button to search the archive');
  await p.click('#archBtn');await sleep(600);
  ok(await p.locator('#archList .drow').count()===1&&(await p.locator('#archList .dt').innerText())==='Archivada con ticket','archive: found');
  ok(await p.isHidden('#archBtn'),'button gone once loaded');
  await p.locator('#archList .dt').click();await sleep(150);
  ok((await p.innerText('#editH'))==='En el archivo'&&(await p.innerText('#eDoneTxt')).includes('archivo/2026.json'),'archived task opens read-only view');
  ok(await p.isHidden('#eSave')&&await p.isHidden('#eDel')&&await p.isHidden('#eReopen')&&(await p.innerText('#eCancel'))==='Cerrar'&&await p.evaluate(()=>$('eNotes').readOnly&&$('eDue').disabled),'read-only: no save, delete or reopen');
  ok((await p.locator('#eLinks a').innerText())==='WB-1000 ↗','archived: link usable');
  await p.click('#eCancel');await sleep(100);
  await p.fill('#search','nada que ver xyz');await sleep(200);
  ok((await p.innerText('#archMsg'))==='En el archivo no hay ninguna que coincida.','archive already loaded: filters as you type');
  // Después de ver una del archivo, una tarea normal se edita normal
  await p.click('#searchClose');await sleep(150);
  ok(await p.isHidden('#archSec'),'archive section hidden without a search');
  await p.locator('.task .ttext',{hasText:'Pendiente con link'}).click();await sleep(150);
  ok((await p.innerText('#editH'))==='Editar tarea'&&await p.isVisible('#eSave')&&await p.evaluate(()=>!$('eNotes').readOnly&&!$('eDue').disabled)&&await p.isHidden('#eDone'),'normal edit restored after the read-only view');
  await p.keyboard.press('Escape');
  ok(p.errs.length===0,'no page errors '+p.errs);
  await ctx.close();
}
// Celular: tocar una terminada la abre
{
  const gh=makeGH([T('d1','Tickets de Julian',{done:true,completedAt:iso(0.01),requester:'Julian',notes:J1})]);
  let {ctx,p}=await device(b,gh,PHONE);
  await L.go(p,'tareas');
  await p.click('#doneToggle');await sleep(150);
  await drow(p,'Tickets de Julian').locator('.dt').tap();await sleep(200);
  ok(await p.isVisible('#editOv')&&(await p.innerText('#editH'))==='Tarea terminada','phone: tap opens the done task');
  ok(p.errs.length===0,'no page errors '+p.errs);
  await ctx.close();
}
// Fechas: "7/10" pasada hace poco es de este año; hace más de un mes, del año que viene
{
  const gh=makeGH([]);let {ctx,p}=await device(b,gh,DESK);
  const dmOf=n=>{const d=day(n);return Number(d.slice(8,10))+'/'+Number(d.slice(5,7))};
  const due=async txt=>p.evaluate(t=>parse(t).due,txt);
  ok(await due('Tickets '+dmOf(-7))===day(-7),'dd/mm a week ago → this year ('+await due('x '+dmOf(-7))+')');
  const far=day(-40),farNext=String(Number(far.slice(0,4))+1)+far.slice(4);
  ok(await due('Algo '+dmOf(-40))===farNext,'dd/mm 40 days ago → next year');
  ok(await due('Algo '+dmOf(5))===day(5),'future dd/mm unchanged');
  await ctx.close();
}
await b.close();
console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
