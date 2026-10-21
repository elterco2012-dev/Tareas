// Apariencia manual y contraste; Informe (texto, Excel, impresión, archivo)
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
const fs=require('fs');
const iso=L.ago;
const DESK={viewport:{width:1100,height:900}},PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const bg=p=>p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
const stub=()=>{window.__copied=[];window.__printed=0;try{Object.defineProperty(navigator,'clipboard',{value:{writeText:t=>{window.__copied.push(t);return Promise.resolve()}},configurable:true})}catch{};window.print=()=>{window.__printed++}};
(async()=>{
const b=await L.launch();
// ===== Apariencia =====
{
  const gh=makeGH([T('a','Uno',{due:day(0)})]);
  let {ctx,p}=await device(b,gh,{...DESK,colorScheme:'light'});
  ok(await bg(p)==='rgb(244, 246, 249)'&&await p.evaluate(()=>!document.documentElement.dataset.theme),'auto + light system: light');
  ok(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--circle').trim())==='#7f8b9d','task circle with 3:1 contrast');
  await p.click('#statusBtn');await sleep(150);
  ok((await p.locator('#themeSeg button[aria-pressed="true"]').innerText())==='Automática','"Automática" selected by default');
  await p.click('#themeSeg button[data-t="dark"]');await sleep(150);
  ok(await bg(p)==='rgb(15, 21, 32)'&&await p.evaluate(()=>[...document.querySelectorAll('meta[name="theme-color"]')].every(m=>m.content==='#0f1520')),'"Oscura": dark page and dark title bar');
  await p.reload();await sleep(400);
  ok(await bg(p)==='rgb(15, 21, 32)'&&await p.evaluate(()=>document.documentElement.dataset.theme)==='dark','remembered after reopening');
  await p.click('#statusBtn');await sleep(150);await p.click('#themeSeg button[data-t="auto"]');await sleep(150);
  ok(await bg(p)==='rgb(244, 246, 249)'&&await p.evaluate(()=>localStorage.getItem('tema'))===null,'"Automática" back to the system');
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
  ({ctx,p}=await device(b,gh,{...DESK,colorScheme:'dark'}));
  ok(await bg(p)==='rgb(15, 21, 32)','auto + dark system: dark');
  await p.click('#statusBtn');await sleep(150);await p.click('#themeSeg button[data-t="light"]');await sleep(150);
  ok(await bg(p)==='rgb(244, 246, 249)'&&await p.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)==='light','"Clara" with a dark system: light (and light form controls)');
  await ctx.close();
}
// ===== Informe =====
{
  const gh=makeGH([
    T('d1','Tickets de Julian',{done:true,createdAt:iso(3),completedAt:iso(0.01),requester:'German',notes:'https://x.atlassian.net/browse/WB-3438'}),
    T('d2','Hecha la semana pasada',{done:true,createdAt:iso(12),completedAt:iso(8),requester:'Laura'}),
    T('p1','Vencida pateada',{due:day(-2),postponed:3,requester:'German',createdAt:iso(10)}),
    T('p2','Para hoy',{due:day(0),time:'15:00',requester:'Laura',createdAt:iso(1)}),
    T('p3','Sin fecha',{requester:'German',createdAt:iso(5),notes:'ver; con "comillas"'}),
    T('w1','En espera',{waiting:true,waitingOn:'Rau',requester:'German',waitingSince:iso(2),createdAt:iso(4),followUp:day(6)}),
    T('x1','Borrada',{done:true,completedAt:iso(0.02),deletedAt:iso(0.01),requester:'German'})]);
  gh.files['archivo/2026.json']={content:JSON.stringify([T('a1','Archivada vieja',{done:true,createdAt:iso(50),completedAt:iso(45),requester:'German'})]),sha:1};
  let {ctx,p}=await device(b,gh,DESK,undefined,stub);
  await p.route('**/contents/archivo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{name:'2026.json',path:'archivo/2026.json',type:'file'}])}));
  await p.click('#repBtn');await sleep(200);
  ok(await p.isVisible('#repOv'),'"Informe" opens');
  const sum=await p.innerText('#repView .repsum');
  ok(sum==='1 terminada · 3 pendientes (1 vencida) · 1 en espera','summary (this week, everyone): '+sum);
  const view=await p.innerText('#repView');
  ok(view.includes('Tickets de Julian · @German')&&view.includes('WB-3438')&&!view.includes('Hecha la semana pasada')&&!view.includes('Borrada'),'this week: done of this week, with ticket; no trash');
  ok(/Vencida hace 2 días · creada \S+ · pospuesta 3 veces/.test(view)&&view.includes('Para hoy 15:00')&&/Sin fecha · creada/.test(view),'pending with state, created date and postponed');
  ok(/esperando a Rau desde el \S+ · volver a mirar el/.test(view),'waiting line');
  // Solo German
  await p.selectOption('#repWho',{label:'German'});await sleep(150);
  ok((await p.innerText('#repView .repsum'))==='1 terminada · 2 pendientes (1 vencida) · 1 en espera'&&!(await p.innerText('#repView')).includes('Para hoy'),'filter by person');
  // Semana pasada
  await p.selectOption('#repPer','lastweek');await sleep(150);
  ok((await p.innerText('#repView')).includes('Ninguna en el período.'),'last week, German: none done');
  await p.selectOption('#repWho','');await sleep(150);
  ok((await p.innerText('#repView')).includes('Hecha la semana pasada'),'last week, everyone: Laura\'s');
  // Copiar texto
  await p.selectOption('#repPer','week');await p.selectOption('#repWho',{label:'German'});await sleep(100);
  await p.click('#repCopy');await sleep(200);
  const txt=await p.evaluate(()=>window.__copied[0]||'');
  ok(txt.startsWith('Informe de tareas · semana del ')&&txt.includes('· de German\n1 terminada · 2 pendientes (1 vencida) · 1 en espera · 0 nuevas en el período')&&txt.includes('\nTERMINADAS (1)\n• Tickets de Julian — creada ')&&txt.includes('(3 días) · WB-3438')&&txt.includes('\nEN ESPERA (1)\n• En espera — esperando a Rau'),'copied text: '+JSON.stringify(txt.slice(0,160)));
  // Quitar pendientes
  await p.click('.repinc .chip[data-k="pend"]');await sleep(100);
  ok(!(await p.innerText('#repView')).includes('Pendientes')&&(await p.innerText('#repView .repsum'))==='1 terminada · 1 en espera','toggle off Pendientes');
  await p.click('.repinc .chip[data-k="pend"]');await sleep(100);
  // Excel
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#repCsv')]);
  const csv=fs.readFileSync(await dl.path(),'utf8');
  const lines=csv.replace(/^﻿/,'').split('\r\n');
  ok(csv.charCodeAt(0)===0xfeff&&lines[0]==='Estado;Tarea;Pedida por;Creada;Fecha;Hora;Terminada;Días;Prioridad;Pospuesta;Esperando a;Tickets;Detalle','CSV for Excel: BOM, ";" and header');
  ok(lines.length===5&&lines[1].startsWith('Terminada;Tickets de Julian;German;')&&/\d+\/\d+\/\d{4}/.test(lines[1])&&lines.some(l=>l.includes('"ver; con ""comillas"""'))&&lines.some(l=>l.startsWith('En espera;En espera;German;')&&l.includes(';Rau;')),'CSV rows, dates and quoting: '+lines.length);
  ok(dl.suggestedFilename().startsWith('informe-tareas-')&&dl.suggestedFilename().endsWith('.csv'),'file name');
  // Imprimir
  await p.click('#repPrint');await sleep(150);
  ok(await p.evaluate(()=>window.__printed)===1&&await p.locator('#printArea table').count()===3&&(await p.innerText('#printArea h1')).startsWith('Informe de tareas'),'print: three tables');
  // Todo: trae el archivo
  await p.selectOption('#repPer','all');await sleep(900);
  ok((await p.innerText('#repView')).includes('Archivada vieja')&&(await p.innerText('#repNote'))==='Incluye las terminadas del archivo.','"Todo" includes the archive');
  await p.click('#repX');await sleep(100);
  ok(await p.isHidden('#repOv'),'closes');
  // Desde la revisión semanal
  await p.click('#revBtn');await sleep(150);
  for(let i=0;i<10&&!(await p.innerText('#procCard')).match(/Listo|Nada para/);i++){await p.keyboard.press('ArrowRight');await sleep(120)}
  await p.locator('#procBtns button',{hasText:'Informe de la semana'}).click();await sleep(200);
  ok(await p.isVisible('#repOv')&&await p.isHidden('#procOv')&&await p.inputValue('#repPer')==='week','weekly review → "Informe de la semana"');
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
}
// Celular: el informe entra en la pantalla
{
  const gh=makeGH([T('p1','Una tarea pendiente con un título bastante largo para ver cómo corta',{due:day(0),requester:'German'})]);
  let {ctx,p}=await device(b,gh,PHONE,undefined,stub);
  await p.click('#repBtn');await sleep(200);
  const m=await p.evaluate(()=>({w:document.documentElement.scrollWidth,iw:innerWidth,copy:document.getElementById('repCopy').getBoundingClientRect().width}));
  ok(m.w<=m.iw&&m.copy>300,'phone: no horizontal scroll, "Copiar texto" full width '+JSON.stringify(m));
  await p.screenshot({path:L.out('rep-phone.png')});
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
}
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
