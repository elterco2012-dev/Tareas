// Pruebas de las correcciones de la revisión
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
const row=(p,t)=>p.locator('.task').filter({has:p.locator('.ttext',{hasText:t})}).first();
(async()=>{
const b=await L.launch();
// 1) Migración de la hora de las viejas
let gh=makeGH([T('m1','Llamar al banco a las 3',{due:day(0)}),T('m2','Tomar remedio a las 9',{due:day(0),repeat:'daily'}),
  T('m3','Hecha a las 5',{done:true,completedAt:L.date().toISOString()}),T('m4','Sin hora',{due:day(0)}),T('m5','Quitada a las 8',{due:day(0),time:null})]);
let {ctx,p}=await device(b,gh,{viewport:{width:1000,height:900}});await sleep(800);
const g=id=>gh.items.find(x=>x.id===id);
ok(g('m1').time==='15:00'&&g('m2').time==='09:00','legacy pending tasks get their time field: '+g('m1').time+' '+g('m2').time);
ok(g('m3').time===undefined&&g('m4').time===undefined&&g('m5').time===null,'done, untimed and cleared tasks untouched');
ok(g('m1').title==='Llamar al banco a las 3','title untouched');
const ops=await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')).length);
await p.evaluate(()=>sync());await sleep(500);
ok(gh.items.filter(x=>x.time!==undefined).length===3&&ops===0,'migration runs once (outbox empty)');
// time:null y se repite: la próxima sigue sin hora
gh.items.push(T('r1','Regar a las 8',{due:day(0),time:null,repeat:'daily'}));gh.sha++;await p.evaluate(()=>sync());await sleep(500);
await row(p,'Regar a las 8').locator('.chk').click();await sleep(400);await sleep(500);
let n=gh.items.find(x=>x.repeatOf==='r1');ok(n&&n.time===null,'cleared time stays cleared in the next instance: '+JSON.stringify(n&&n.time));
// 3) La próxima que quedó en la papelera no corta la serie
gh.items.push(T('d1','Diaria',{due:day(0),repeat:'daily',time:'08:00'}));gh.sha++;await p.evaluate(()=>sync());await sleep(500);
await row(p,/^Diaria$/).locator('.chk').click();await sleep(400);await sleep(500);
const n1=gh.items.find(x=>x.repeatOf==='d1');
await row(p,/^Diaria$/).locator('.more').click();await p.click('#menu button:has-text("Borrar")');await sleep(500);
ok(g(n1.id).deletedAt,'next instance trashed');
await p.click('#doneToggle');await p.locator('.drow',{hasText:'Diaria'}).locator('.chk').click();await sleep(400);await sleep(500);
ok(!g('d1').done,'reopened');
await row(p,/^Diaria$/).locator('.chk').click();await sleep(400);await sleep(500);
const nexts=gh.items.filter(x=>x.repeatOf==='d1'&&!x.deletedAt);
ok(nexts.length===1&&nexts[0].due===day(1)&&nexts[0].time==='08:00'&&(await p.innerText('#toastMsg')).includes('la próxima'),'re-completing creates a new next instance: '+nexts.length);
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
// 2) Editar: quitar la hora de una vieja (sin conexión, para que la migración no corra)
gh=makeGH([T('e1','Pagar luz a las 10',{due:day(0)}),T('e2','Sin hora',{due:day(0)})]);gh.mode='offline';
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:900}},undefined,()=>{localStorage.setItem('tareasCache',JSON.stringify({owner:'u',repo:'r',items:[
  {id:'e1',title:'Pagar luz a las 10',priority:'Media',order:0,done:false,due:new Date().toISOString().slice(0,10)},{id:'e2',title:'Sin hora',priority:'Media',order:1,done:false,due:null}]}))}));
await row(p,'Pagar luz').locator('.body').click();
ok(await p.inputValue('#eTime')==='10:00','legacy edit shows 10:00');
await p.fill('#eTime','');await p.click('#editForm button[type=submit]');await sleep(300);
let outb=await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')));
ok(outb.length===1&&outb[0].patch.time===null&&!(await row(p,'Pagar luz').innerText()).includes('10:00'),'clearing the time on a legacy task removes it: '+JSON.stringify(outb.map(o=>o.patch)));
await row(p,'Sin hora').locator('.body').click();await p.click('#editForm button[type=submit]');await sleep(300);
outb=await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')));
ok(outb.length===1,'saving an untimed task unchanged queues nothing');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
// 4) Sugerencias debajo de los chips (celular)
gh=makeGH([T('s1','Mandar mail a proveedor',{done:true,completedAt:L.date().toISOString(),requester:'Lautaro'})]);
({ctx,p}=await device(b,gh,{viewport:{width:375,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:2}));
await p.locator('#title').tap();await p.keyboard.type('Mandar');await sleep(100);
const pos=await p.evaluate(()=>({chips:document.querySelector('.chiprow').getBoundingClientRect().bottom,sug:document.getElementById('suggest').getBoundingClientRect().top,vis:!document.getElementById('suggest').classList.contains('hidden')}));
ok(pos.vis&&pos.sug>=pos.chips,'dropdown below the chips '+JSON.stringify(pos));
await p.screenshot({path:L.out('suggest2-375.png')});
await p.locator('#chips .chip[data-v="1"]').tap();await sleep(100);
ok(await p.inputValue('#title')==='Mandar'&&await p.evaluate(()=>document.querySelector('#chips .chip.on').dataset.v)==='1','tapping Mañana selects the chip, title unchanged');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
await b.close();console.log('fails',L.fails)})();
