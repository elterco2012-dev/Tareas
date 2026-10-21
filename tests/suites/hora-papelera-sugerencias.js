// Pruebas: hora como dato propio, papelera y sugerencias
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
const row=(p,t)=>p.locator('.task',{hasText:t}).first();
const iso=L.ago;
(async()=>{
const b=await L.launch();
// ===== Hora =====
let gh=makeGH([
  T('h1','Sin hora hoy',{due:day(0),order:0}),
  T('h2','Reunión tarde',{due:day(0),time:'18:00',order:1}),
  T('h3','Pagar luz a las 10',{due:day(0),order:2}),           // vieja: la hora en el título
  T('h4','Temprano',{due:day(0),time:'00:00',order:3}),
  T('h5','Diaria',{due:day(0),time:'08:00',repeat:'daily',order:4}),
]);
let {ctx,p}=await device(b,gh,{viewport:{width:1000,height:900}});
const hoy=await p.evaluate(()=>[...document.querySelectorAll('#groups .grp')].find(g=>/Hoy/.test(g.querySelector('.ghead').textContent))).catch(()=>null);
const order=await p.evaluate(()=>{const g=[...document.querySelectorAll('#groups .grp')].find(g=>/^Hoy/.test(g.querySelector('.ghead').textContent));return [...g.querySelectorAll('.task')].map(r=>r.querySelector('.ttext').textContent+'|'+((r.querySelector('.time')||{}).textContent||''))});
ok(JSON.stringify(order)===JSON.stringify(['Temprano|00:00','Diaria|08:00','Pagar luz a las 10|10:00','Reunión tarde|18:00','Sin hora hoy|']),'Hoy sorted by time, untimed last: '+JSON.stringify(order));
ok(await row(p,'Temprano').locator('.time.past').count()===1,'past time shown in red');
await p.fill('#title','Llamar al banco mañana a las 3 @Laura');
ok((await p.innerText('#detected')).includes('15:00'),'Detectado shows 15:00');
await p.press('#title','Enter');await sleep(400);
let t=gh.items.find(x=>x.title==='Llamar al banco');
ok(t&&t.time==='15:00'&&t.due===day(1)&&t.requester==='Laura','time saved apart from title: '+JSON.stringify(t&&{ti:t.title,tm:t.time,d:t.due}));
ok((await row(p,'Llamar al banco').innerText()).includes('15:00'),'row shows 15:00 chip');
await p.fill('#title','cerrar caja hoy a las 12 de la noche');await p.press('#title','Enter');await sleep(400);
t=gh.items.find(x=>x.title==='cerrar caja');
ok(t&&t.time==='00:00'&&t.due===day(1),'12 de la noche → 00:00 next day: '+JSON.stringify(t&&{tm:t.time,d:t.due}));
await p.fill('#title','sin fecha a las 9 de la mañana');await p.click('#chips .chip[data-v=""]');await p.press('#title','Enter');await sleep(400);
t=gh.items.find(x=>x.title==='sin fecha');ok(t&&t.time==='09:00'&&t.due===null,'time without date kept');
// Editar
await row(p,'Llamar al banco').locator('.body').click();
ok(await p.inputValue('#eTime')==='15:00','edit shows time');
await p.fill('#eTime','16:30');await p.click('#editForm button[type=submit]');await sleep(400);
ok(gh.items.find(x=>x.title==='Llamar al banco').time==='16:30','edit changes time');
await row(p,'Llamar al banco').locator('.body').click();await p.fill('#eTime','');await p.click('#editForm button[type=submit]');await sleep(400);
t=gh.items.find(x=>x.title==='Llamar al banco');
ok(t.time===null&&!(await row(p,'Llamar al banco').innerText()).match(/\d\d:\d\d/),'edit clears time');
await row(p,'Pagar luz a las 10').locator('.body').click();
ok(await p.inputValue('#eTime')==='10:00','old task: edit shows time from title');
await p.click('#editForm button[type=submit]');await sleep(400);
ok(gh.items.find(x=>x.id==='h3').time==='10:00','old task: saving makes the time a field');
await row(p,'Temprano').locator('.body').click();await p.click('#eCancel');
await row(p,'Diaria').locator('.chk').click();await L.until(()=>gh.items.some(x=>x.repeatOf==='h5'));
t=gh.items.find(x=>x.repeatOf==='h5');ok(t&&t.time==='08:00'&&t.due===day(1),'repeat keeps the time');
// Calendario con la hora del campo
const [dl]=await Promise.all([p.waitForEvent('download'),(async()=>{await row(p,'Reunión tarde').locator('.more').click();await p.click('#menu button:has-text("Agregar al calendario")')})()]);
const ics=require('fs').readFileSync(await dl.path(),'utf8');
ok(ics.includes('DTSTART:'+day(0).replace(/-/g,'')+'T180000'),'calendar uses time field');
ok(p.errs.length===0,'time: no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Papelera =====
gh=makeGH([
  T('d1','Borrar esta',{due:day(0)}),T('d2','Otra',{due:day(0)}),T('d3','Tercera',{due:day(1)}),
  T('old','Vieja en papelera',{deletedAt:iso(31)}),T('rec','Reciente en papelera',{deletedAt:iso(29)}),
  T('dd','Terminada y borrada vieja',{done:true,completedAt:iso(120),deletedAt:iso(2)}),
]);
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:900}}));
await sleep(600);
ok(!gh.items.find(x=>x.id==='old'),'purged after 30 days in the trash');
ok(gh.items.find(x=>x.id==='rec'),'29 days: still in the trash');
ok(!(await p.innerText('#groups')).includes('papelera'),'trash items not in list');
ok(await p.isVisible('#trashSec')&&(await p.innerText('#trashSub'))==='2','trash section with count');
await row(p,'Borrar esta').locator('.more').click();await p.click('#menu button:has-text("Borrar")');await sleep(400);
ok(gh.items.find(x=>x.id==='d1').deletedAt&&(await p.innerText('#toastMsg'))==='Movida a la papelera','delete → trash');
ok(!(await p.innerText('#groups')).includes('Borrar esta')&&(await p.innerText('#trashSub'))==='3','row gone, trash 3');
ok(!(await p.innerText('.sub')).includes('2 para hoy'),'header count excludes trash: '+(await p.innerText('.sub')));
await p.click('#trashToggle');
const trows=await p.$$eval('#trashList .trow',rs=>rs.map(r=>r.innerText.replace(/\n/g,' | ')));
ok(trows[0].startsWith('Borrar esta | Borrada hoy · se elimina en 30 días'),'trash row text: '+trows[0]);
ok(trows.some(x=>x.includes('Reciente en papelera | Borrada hace 29 días · se elimina mañana')),'29 days label: '+JSON.stringify(trows));
await p.locator('#trashList .trow',{hasText:'Borrar esta'}).locator('button').click();await sleep(400);
ok(!gh.items.find(x=>x.id==='d1').deletedAt&&(await p.innerText('#groups')).includes('Borrar esta')&&(await p.innerText('#toastMsg'))==='Tarea recuperada','Recuperar restores');
await p.click('#toastUndo');await sleep(400);
ok(gh.items.find(x=>x.id==='d1').deletedAt,'undo Recuperar puts it back in the trash');
ok(!Object.keys(gh.files).length&&gh.items.find(x=>x.id==='dd'),'deleted done task not archived');
await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('/');await p.keyboard.type('Borrar');await sleep(100);
ok(!(await p.innerText('#groups')).includes('Borrar esta'),'search: trash items stay out of the pending list (they show under "En la papelera")');
await p.click('#searchClose');
await p.click('#trashEmpty');ok((await p.innerText('#trashEmpty')).includes('Tocá de nuevo'),'empty asks to confirm');
await sleep(700);await p.click('#trashEmpty');await sleep(500);   // el segundo toque, a propósito (un doble clic no la vacía)
ok(!gh.items.some(x=>x.deletedAt)&&gh.items.length===2&&!(await p.isVisible('#trashSec')),'empty trash deletes for good: '+gh.items.map(x=>x.id));
ok((await p.innerText('#toastMsg'))==='3 tareas eliminadas','empty toast');
// Supr y borrar desde Editar
await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('ArrowDown');await p.keyboard.press('Delete');await sleep(400);
ok(gh.items.filter(x=>x.deletedAt).length===1,'Supr → trash');
ok(p.errs.length===0,'trash: no page errors '+JSON.stringify(p.errs));
await ctx.close();
// Sin GitHub: borrar y recuperar
{const c=await b.newContext({timezoneId:L.TZ});const q=await c.newPage();const errs=[];q.on('pageerror',e=>errs.push(e.message));
await q.goto(await L.appUrl());await sleep(300);
await q.fill('#title','Local uno');await q.press('#title','Enter');
await q.locator('.task',{hasText:'Local uno'}).locator('.more').click();await q.click('#menu button:has-text("Borrar")');
ok(await q.isVisible('#trashSec'),'local: trash visible');
await q.click('#trashToggle');await q.click('#trashList .trow button');
ok((await q.innerText('#groups')).includes('Local uno')&&!(await q.isVisible('#trashSec')),'local: restore');
ok(errs.length===0,'local: no errors '+JSON.stringify(errs));await c.close()}

// ===== Sugerencias =====
gh=makeGH([
  T('s1','Mandar remitos',{done:true,completedAt:iso(3),requester:'Laura',createdAt:iso(5)}),
  T('s2','Mandar remitos',{done:true,completedAt:iso(10),requester:'Laura',createdAt:iso(12)}),
  T('s3','Mandar presupuesto',{done:true,completedAt:iso(1),requester:'Juan Pérez',createdAt:iso(2)}),
  T('s4','Revisar stock',{requester:'Lautaro'}),
]);
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:900}}));
await p.click('#title');await p.keyboard.type('man');await sleep(100);
let sg=await p.$$eval('#suggest button',bs=>bs.map(b=>b.innerText.replace(/\n/g,' ')));
ok(JSON.stringify(sg)===JSON.stringify(['Mandar remitos @Laura','Mandar presupuesto @Juan Pérez']),'title suggestions by frequency: '+JSON.stringify(sg));
await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await sleep(100);
ok(await p.inputValue('#title')==='Mandar remitos @Laura '&&!(await p.isVisible('#suggest')),'Enter picks: '+await p.inputValue('#title'));
ok((await p.innerText('#detected')).includes('@Laura'),'requester detected');
gh.items.length;await p.keyboard.press('Enter');await sleep(400);
t=gh.items.find(x=>x.title==='Mandar remitos'&&!x.done);ok(t&&t.requester==='Laura','saved with requester');
await p.keyboard.type('presu');await sleep(100);
sg=await p.$$eval('#suggest button',bs=>bs.map(b=>b.innerText.replace(/\n/g,' ')));
ok(sg.length===1&&sg[0].startsWith('Mandar presupuesto'),'word-start match: '+JSON.stringify(sg));
await p.click('#suggest button');await sleep(100);
ok(await p.inputValue('#title')==='Mandar presupuesto @Juan_Pérez '&&await p.evaluate(()=>document.activeElement.id)==='title','click picks, keeps focus');
ok(await p.evaluate(()=>parse(document.getElementById('title').value).requester)==='Juan Pérez','name with space round-trips');
await p.fill('#title','');await p.keyboard.type('Llamar @la');await sleep(100);
sg=await p.$$eval('#suggest button',bs=>bs.map(b=>b.innerText));
ok(JSON.stringify(sg)===JSON.stringify(['@Laura','@Lautaro']),'@ suggests people: '+JSON.stringify(sg));
await p.keyboard.press('ArrowUp');await p.keyboard.press('Enter');
ok(await p.inputValue('#title')==='Llamar @Lautaro ','ArrowUp wraps to last: '+await p.inputValue('#title'));
await p.keyboard.type('mañana');await sleep(50);
ok(!(await p.isVisible('#suggest')),'no suggestions after a full phrase');
await p.fill('#title','');await p.keyboard.type('Mandar remitos');await sleep(100);
ok(!(await p.isVisible('#suggest'))||!(await p.innerText('#suggest')).includes('Mandar remitos @'),'exact match not suggested');
await p.fill('#title','');await p.keyboard.type('ma');await sleep(50);
ok(await p.isVisible('#suggest'),'shown with 2 letters');
await p.keyboard.press('Escape');await sleep(50);
ok(!(await p.isVisible('#suggest'))&&await p.evaluate(()=>document.activeElement.id)==='title','Esc hides, keeps focus');
await p.keyboard.press('Enter');await sleep(400);
ok(gh.items.some(x=>x.title==='ma'),'Enter without highlight adds as typed');
await p.keyboard.type('ma');await sleep(50);await p.click('h1');await sleep(250);
ok(!(await p.isVisible('#suggest')),'blur hides');
ok(p.errs.length===0,'suggest: no page errors '+JSON.stringify(p.errs));
await ctx.close();
// Celular: tocar una sugerencia no cierra el teclado
({ctx,p}=await device(b,gh,{viewport:{width:375,height:740},isMobile:true,hasTouch:true}));
await p.locator('#title').tap();await p.keyboard.type('rev');await sleep(100);
await p.screenshot({path:L.out('suggest-375.png')});
await p.locator('#suggest button').first().tap();await sleep(100);
ok(await p.inputValue('#title')==='Revisar stock @Lautaro '&&await p.evaluate(()=>document.activeElement.id)==='title','mobile tap picks and keeps focus');
ok(p.errs.length===0,'mobile: no page errors '+JSON.stringify(p.errs));
await ctx.close();
await b.close();console.log('fails',L.fails)})();
