// Correcciones de la revisión: reabrir guarda la nota, archivo al día, links (Jira, paréntesis), fechas pasadas
const L=require('../lib/gh');const {sleep,ok,mock,device,makeGH,day,T,TZ}=L;
let APP;   // la app servida por http (L.appUrl)
const iso=L.ago;
const DESK={viewport:{width:1000,height:900}},PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const J1='https://logicteam.atlassian.net/browse/WB-3438';
const drow=(p,t)=>p.locator('#doneList .drow').filter({has:p.locator('.dt',{hasText:t})}).first();
const toastText=p=>p.evaluate(()=>{const t=document.getElementById('toast');return t&&!t.classList.contains('hidden')?t.innerText:''});
(async()=>{
const b=await L.launch();APP=await L.appUrl();
{
  const many=Array.from({length:60},(_,i)=>T('z'+i,'Archivada '+i,{done:true,completedAt:'2026-0'+(1+i%8)+'-1'+(i%9)+'T12:00:00Z',notes:'WB-9'+i}));
  const gh=makeGH([T('d1','Tickets de Julian',{done:true,completedAt:iso(0.01),notes:'nada'}),T('d2','Vieja',{done:true,completedAt:iso(29.9),notes:'WB-5000'})]);
  gh.files['archivo/2026.json']={content:JSON.stringify(many),sha:1};
  let {ctx,p}=await device(b,gh,DESK);
  await p.route('**/contents/archivo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{name:'2026.json',path:'archivo/2026.json',type:'file'}])}));
  const g=id=>gh.items.find(x=>x.id===id);
  // Reabrir guarda lo escrito
  await p.click('#doneToggle');await sleep(150);
  await drow(p,'Tickets de Julian').locator('.dt').click();await sleep(150);
  await p.fill('#eNotes','volvió a fallar, WB-5555');await p.click('#eReopen');await sleep(600);
  ok(g('d1').done===false&&g('d1').notes==='volvió a fallar, WB-5555','"Volver a pendientes" keeps the edited note');
  await p.click('#toastUndo');await sleep(500);
  ok(g('d1').done===true&&g('d1').notes==='volvió a fallar, WB-5555','Deshacer only undoes the reopen');
  // Buscando: el encabezado pliega y despliega sin cambiar lo guardado
  await p.click('#doneToggle');await sleep(100);   // plegada (showDone=false)
  await p.keyboard.press('/');await p.keyboard.type('WB');await sleep(200);
  ok(await p.isVisible('#doneWrap'),'searching opens Terminadas');
  await p.click('#doneToggle');await sleep(100);
  ok(await p.isHidden('#doneWrap'),'header collapses it while searching');
  await p.click('#doneToggle');await sleep(100);await p.click('#doneToggle');await sleep(100);
  await p.click('#searchClose');await sleep(150);
  ok(await p.isHidden('#doneWrap')&&await p.evaluate(()=>showDone===false),'closing the search: back to collapsed as before');
  // Archivo con más de 50
  await p.keyboard.press('/');await p.keyboard.type('Archivada');await sleep(150);
  await p.click('#archBtn');await sleep(800);
  ok(await p.locator('#archList .drow').count()===50&&(await p.innerText('#archMsg')).startsWith('Se ven las 50 más recientes de 60'),'archive: says when the list is cut');
  // Se archiva una más (en este dispositivo): la copia del archivo se descarta y vuelve el botón
  await p.fill('#search','WB-5000');await sleep(150);
  ok(await drow(p,'Vieja').isVisible(),'still in tareas.json: found in Terminadas');
  gh.items=gh.items.filter(t=>t.id!=='d2');gh.sha++;   // como si el celular la hubiera archivado
  gh.files['archivo/2026.json']={content:JSON.stringify([...many,T('d2','Vieja',{done:true,completedAt:iso(30.1),notes:'WB-5000'})]),sha:2};
  await p.evaluate(()=>sync());await sleep(700);
  ok(await p.isVisible('#archBtn'),'after the other device archived: the archive button is back');
  await p.click('#archBtn');await sleep(800);
  ok(await p.locator('#archList .dt',{hasText:'Vieja'}).count()===1,'and the reloaded archive finds it');
  await p.click('#searchClose');await sleep(100);
  // Links
  const lab=await p.evaluate(()=>[linkLabel('https://x.atlassian.net/jira/software/projects/WB/boards/12?selectedIssue=WB-3438'),linkLabel('https://x.atlassian.net/browse/WB-1'),noteUrls('ver https://learn.microsoft.com/en-us/previous-versions/cc771049(v=ws.11).')[0],noteUrls('(ver https://x/browse/WB-1)')[0]]);
  ok(lab[0]==='WB-3438'&&lab[1]==='WB-1','Jira board link → ticket: '+lab.slice(0,2));
  ok(lab[2].endsWith('cc771049(v=ws.11)')&&lab[3]==='https://x/browse/WB-1','closing parenthesis kept only when it belongs to the link: '+lab.slice(2));
  // Fecha pasada: el aviso tiene sentido
  const dmOf=n=>{const d=day(n);return Number(d.slice(8,10))+'/'+Number(d.slice(5,7))};
  await p.fill('#title','Revisar VPN '+dmOf(-7));await p.press('#title','Enter');await sleep(300);
  const tt=await toastText(p);
  ok(/^Agregada como vencida, del \S+ \d+\/\d+/.test(tt),'past date toast: '+tt.split('\n')[0]);
  ok(p.errs.length===0,'no page errors '+p.errs);
  await ctx.close();
}
// Celular: en la lista el ticket se ve corto pero no es un link (un toque abre la tarea)
{
  const gh=makeGH([T('p1','Revisar impresora',{due:day(0),notes:J1}),T('d1','Cambiar toner',{done:true,completedAt:iso(0.01),notes:J1})]);
  let {ctx,p}=await device(b,gh,PHONE);
  const row=p.locator('.task',{has:p.locator('.ttext',{hasText:'Revisar impresora'})});
  ok(await row.locator('.notes a').count()===0&&(await row.locator('.notes .nlink').innerText())==='WB-3438','phone row: short label, not a link');
  await row.locator('.notes .nlink').tap();await sleep(200);
  ok(await p.isVisible('#editOv')&&(await p.locator('#eLinks a').innerText())==='WB-3438 ↗','tap on the label opens the task, with the link as a button');
  await p.click('#editX');await sleep(100);
  await p.click('#doneToggle');await sleep(150);
  ok(await drow(p,'Cambiar toner').locator('.dmeta a').count()===0,'phone done row: no link in the row');
  ok(p.errs.length===0,'no page errors '+p.errs);
  await ctx.close();
}
// Cambio de año: "28/12" el 3 de enero es el diciembre que pasó
{
  const ctx=await b.newContext({timezoneId:TZ,clock:false});const p=await ctx.newPage();
  await p.clock.install({time:new Date('2027-01-03T12:00:00-03:00')});
  await p.goto(APP);await sleep(300);
  const r=await p.evaluate(()=>[parse('Cerrar ticket 28/12').due,parse('Algo 5/1').due,parse('Algo 15/11').due]);
  ok(r[0]==='2026-12-28'&&r[1]==='2027-01-05'&&r[2]==='2027-11-15','year change: '+r);
  await ctx.close();
}
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
