// Orden por prioridad y mover a mano (arrastrar, Alt+flechas, ⋯ Subir/Bajar); correcciones del informe
const L=require('../lib/gh');const {sleep,ok,mock,device,makeGH,day,T,TZ,go}=L;
const fs=require('fs');
const iso=L.ago;
const DESK={viewport:{width:1000,height:900}},PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const titles=async(p,sel)=>p.$$eval(sel+' .task .ttext',els=>els.map(e=>e.textContent));
const noneTitles=p=>p.evaluate(()=>visibleIds.map(id=>tasks.find(t=>t.id===id)).filter(t=>!t.due&&!t.waiting).map(t=>t.title));
const toastText=p=>p.evaluate(()=>{const t=document.getElementById('toast');return t&&!t.classList.contains('hidden')?document.getElementById('toastMsg').textContent:''});
const stub=()=>{window.__copied=[];window.__printed=0;try{Object.defineProperty(navigator,'clipboard',{value:{writeText:t=>{window.__copied.push(t);return Promise.resolve()}},configurable:true})}catch{};window.print=()=>{window.__printed++}};
(async()=>{
const b=await L.launch();
// ===== Orden por prioridad =====
{
  const gh=makeGH([T('a','Uno media',{order:0}),T('b','Dos baja',{order:1,priority:'Baja'}),T('c','Tres alta',{order:2,priority:'Alta'}),T('d','Cuatro media',{order:3})]);
  let {ctx,p}=await device(b,gh,DESK);
  await go(p,'tareas');   // Sin fecha está en Tareas (la app abre en Hoy)
  ok((await noneTitles(p)).join('|')==='Tres alta|Uno media|Cuatro media|Dos baja','Sin fecha: Alta arriba, Baja abajo, Media en el orden elegido');
  // Cambiar a Baja la baja
  await p.locator('.task .ttext',{hasText:'Uno media'}).click();await sleep(150);
  await p.click('#ePrios .prio[data-p="Baja"]');await p.click('#eSave');await sleep(500);
  ok((await noneTitles(p)).join('|')==='Tres alta|Cuatro media|Dos baja|Uno media','set to Baja → goes to the end of the Bajas');
  // Subir en el borde: sugiere cambiar la prioridad
  await p.evaluate(()=>{document.activeElement&&document.activeElement.blur();sel=tasks.find(t=>t.title==='Cuatro media').id;renderList()});
  await p.keyboard.press('Alt+ArrowUp');await sleep(200);
  ok((await toastText(p))==='Ya es la primera de prioridad media. Para subirla más, ponele prioridad alta.','top of its priority: hint to raise it');
  // Alt+↑ entre las Baja
  await p.evaluate(()=>{sel=tasks.find(t=>t.title==='Uno media').id;renderList()});
  await p.keyboard.press('Alt+ArrowUp');await sleep(500);
  ok((await noneTitles(p)).join('|')==='Tres alta|Cuatro media|Uno media|Dos baja','Alt+↑ moves it up');
  const g=id=>gh.items.find(x=>x.id===id);
  ok(g('a').order<g('b').order,'order saved to GitHub');
  await p.click('#toastUndo');await sleep(500);
  ok((await noneTitles(p)).join('|')==='Tres alta|Cuatro media|Dos baja|Uno media','Deshacer');
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
}
// ===== Arrastrar en la compu =====
{
  const gh=makeGH([T('e','Mail ARCA',{order:0}),T('f','Vako envios',{order:1}),T('g','Probar costo de envío',{order:2}),T('h','Proyecto Overstock',{order:3,priority:'Alta'}),T('x','Para hoy',{due:day(0),order:4})]);
  let {ctx,p}=await device(b,gh,DESK);
  await go(p,'tareas');
  ok((await noneTitles(p)).join('|')==='Proyecto Overstock|Mail ARCA|Vako envios|Probar costo de envío','start');
  const row=t=>p.locator('.task',{has:p.locator('.ttext',{hasText:t})}).first();
  await p.click('.top h1');await sleep(200);   // clic en un lugar neutro: si el tip de arriba se ve, se oculta y la lista sube un poco (en (5,5) ahora está la barra de la izquierda)
  await row('Probar costo de envío').dragTo(row('Vako envios'),{targetPosition:{x:200,y:4}});await sleep(500);
  ok((await noneTitles(p)).join('|')==='Proyecto Overstock|Mail ARCA|Probar costo de envío|Vako envios','drag #4 to #3 (above Vako)');
  await row('Probar costo de envío').dragTo(row('Mail ARCA'),{targetPosition:{x:200,y:4}});await sleep(500);
  ok((await noneTitles(p)).join('|')==='Proyecto Overstock|Probar costo de envío|Mail ARCA|Vako envios','drag to #2 (right after the Alta)');
  ok((await toastText(p))==='Movida','toast Movida');
  // No se puede soltar en otro grupo ni sobre otra prioridad
  await row('Mail ARCA').dragTo(row('Proyecto Overstock'),{targetPosition:{x:200,y:4}});await sleep(400);
  await row('Mail ARCA').dragTo(row('Para hoy'),{targetPosition:{x:200,y:4}});await sleep(400);
  ok((await noneTitles(p)).join('|')==='Proyecto Overstock|Probar costo de envío|Mail ARCA|Vako envios'&&!gh.items.find(t=>t.id==='e').due,'cannot drop on another priority or another day');
  // ⋯ Subir
  await row('Vako envios').locator('.more').click();await sleep(150);
  await p.locator('#menu button',{hasText:'Subir'}).click();await sleep(500);
  ok((await noneTitles(p)).join('|')==='Proyecto Overstock|Probar costo de envío|Vako envios|Mail ARCA','⋯ Subir');
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
}
// ===== Celular: ⋯ Bajar =====
{
  const gh=makeGH([T('e','Primera',{order:0}),T('f','Segunda',{order:1})]);
  let {ctx,p}=await device(b,gh,PHONE);
  await go(p,'tareas');
  await p.locator('.task',{has:p.locator('.ttext',{hasText:'Primera'})}).locator('.more').tap();await sleep(150);
  await p.locator('#menu button',{hasText:'Bajar'}).tap();await sleep(500);
  ok((await titles(p,'#groups')).join('|')==='Segunda|Primera','phone: ⋯ Bajar');
  ok(await p.evaluate(()=>!document.querySelector('.task[draggable="true"]')),'phone: rows are not draggable (swipe stays)');
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
}
// ===== Informe: Esc, teclas, archivo cargando, imprimir, Excel =====
{
  const gh=makeGH([T('p1','Tarea uno',{due:day(0),requester:'German',createdAt:iso(2)}),T('p2','Tarea dos',{due:day(0),requester:'German',createdAt:iso(1),notes:'- llamar a Juan\n- mandar presupuesto'}),
    T('r1','Rep',{done:true,completedAt:iso(0.1),createdAt:iso(0.2),repeat:'daily'}),T('r2','Rep',{due:day(1),repeatOf:'r1',createdAt:iso(0.1)})]);
  gh.files['archivo/2026.json']={content:JSON.stringify([T('a1','Archivada',{done:true,createdAt:iso(60),completedAt:iso(50)})]),sha:1};
  let {ctx,p}=await device(b,gh,DESK,undefined,stub);
  await go(p,'tareas');   // el botón Informe está en Tareas
  let slow=true;
  await p.route('**/contents/archivo',async r=>{if(slow)await new Promise(res=>setTimeout(res,1500));return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{name:'2026.json',path:'archivo/2026.json',type:'file'}])})});
  await p.evaluate(()=>{sel=tasks.find(t=>t.title==='Tarea uno').id;renderList()});
  await p.click('#repBtn');await sleep(200);
  await p.keyboard.press('Space');await p.keyboard.press('Delete');await sleep(300);
  ok(!gh.items.find(t=>t.id==='p1').done&&!gh.items.find(t=>t.id==='p1').deletedAt,'report open: Space/Supr do not touch the hidden list');
  ok((await p.innerText('#repView .repsub')).includes('3 nuevas en el período'),'"nuevas" without the automatic repeat (p1, p2, r1; not r2): '+await p.innerText('#repView .repsub'));
  await p.keyboard.press('Escape');await sleep(150);
  ok(await p.isHidden('#repOv'),'Esc closes the report');
  // Archivo cargando
  await p.click('#repBtn');await sleep(150);
  await p.selectOption('#repPer','all');await sleep(200);
  ok((await p.innerText('#repNote'))==='Trayendo las terminadas del archivo…','"Trayendo…" while loading');
  await p.click('#repCopy');await sleep(150);
  ok(await p.evaluate(()=>window.__copied.length)===0&&(await toastText(p)).startsWith('Esperá un momento'),'no copy while the archive is loading');
  await sleep(1800);
  ok((await p.innerText('#repView')).includes('Archivada'),'then it includes the archive');
  // Imprimir: solo el informe, y después la página vuelve a imprimirse normal
  await p.click('#repPrint');await sleep(100);
  ok(await p.evaluate(()=>window.__printed===1&&document.body.classList.contains('printing')),'print from the report: printing mode');
  await p.emulateMedia({media:'print'});
  ok(await p.evaluate(()=>getComputedStyle(document.getElementById('wrap')).display==='none'&&getComputedStyle(document.getElementById('printArea')).display==='block'),'print shows only the report');
  await p.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  ok(await p.evaluate(()=>getComputedStyle(document.getElementById('wrap')).display!=='none'&&!document.body.classList.contains('printing')),'after printing, Ctrl+P prints the page again');
  await p.evaluate(()=>{document.documentElement.dataset.theme='dark'});
  ok(await p.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(255, 255, 255)','dark theme prints on white');
  await p.emulateMedia({media:'screen'});await p.evaluate(()=>{delete document.documentElement.dataset.theme});
  // Excel: un texto que empieza con "-" no se toma como fórmula
  await p.selectOption('#repPer','week');await sleep(100);
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#repCsv')]);
  const csv=fs.readFileSync(await dl.path(),'utf8');
  ok(csv.includes(';" - llamar a Juan\n- mandar presupuesto"'),'CSV: leading space before "-"');
  // Persona: "de German"
  await p.selectOption('#repWho',{label:'German'});await p.click('#repCopy');await sleep(150);
  ok((await p.evaluate(()=>window.__copied[0]||'')).split('\n')[0].endsWith(' · de German'),'title says "de German"');
  ok(p.errs.length===0,'no errors '+p.errs);
  await ctx.close();
}
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
