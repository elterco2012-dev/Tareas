// Pruebas: vencidas a hoy, aviso del token, "en 30 minutos"
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
const row=(p,t)=>p.locator('.task').filter({has:p.locator('.ttext',{hasText:t})}).first();
(async()=>{
const b=await L.launch();
// ===== 1) Vencidas → hoy =====
let gh=makeGH([T('o1','Vieja uno',{due:day(-3)}),T('o2','Vieja dos',{due:day(-1),requester:'Ana'}),T('o3','Vieja tres',{due:day(-1),repeat:'weekly'}),T('h','Hoy normal',{due:day(0)})]);
let {ctx,p}=await device(b,gh,{viewport:{width:375,height:740},isMobile:true,hasTouch:true});
const btn=p.locator('.ghead.over .gbtn');
ok(await btn.isVisible()&&(await btn.innerText())==='Todas a hoy','button in Vencidas header');
await p.screenshot({path:L.out('over-375.png')});
// con búsqueda, solo las que se ven
await p.click('#searchBtn');await p.fill('#search','Ana');await sleep(100);
ok(!(await btn.isVisible()),'hidden when only one overdue is visible');
await p.click('#searchClose');
await btn.tap();await sleep(500);
ok(['o1','o2','o3'].every(id=>gh.items.find(x=>x.id===id).due===day(0))&&(await p.innerText('#toastMsg'))==='3 pasadas a hoy','all overdue moved to today');
ok(!(await p.locator('.ghead.over').count()),'Vencidas group gone');
await p.locator('#toastUndo').tap();await sleep(500);
ok(gh.items.find(x=>x.id==='o1').due===day(-3)&&gh.items.find(x=>x.id==='o2').due===day(-1),'undo restores each date');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== 2) Token =====
gh=makeGH([T('a','Algo',{due:day(0)})]);
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:900}}));
ok(!(await p.isVisible('#tokenBar')),'no notice without a date');
await p.click('#statusBtn');await p.evaluate(()=>document.getElementById('acct').open=true);await p.fill('#tokenExp',day(5));await p.click('#saveCfg');await sleep(500);
let msg=await p.innerText('#tokenMsg');
ok(await p.isVisible('#tokenBar')&&msg.includes('vence en 5 días')&&await p.isVisible('#tokenX'),'notice 5 days before: '+msg);
await p.click('#tokenX');ok(!(await p.isVisible('#tokenBar')),'✕ hides it');
await p.reload();await sleep(500);ok(!(await p.isVisible('#tokenBar')),'stays hidden today after reload');
await p.click('#statusBtn');await p.evaluate(()=>document.getElementById('acct').open=true);ok(await p.inputValue('#tokenExp')===day(5),'date shown in Sincronización');
await p.fill('#tokenExp',day(1));await p.click('#saveCfg');await sleep(400);
ok((await p.innerText('#tokenMsg')).includes('vence mañana'),'changing the date shows it again');
await p.click('#statusBtn');await p.evaluate(()=>document.getElementById('acct').open=true);await p.fill('#tokenExp',day(30));await p.click('#saveCfg');await sleep(400);
ok(!(await p.isVisible('#tokenBar')),'30 days: no notice');
// token nuevo sin cambiar la fecha → la fecha vieja se borra
await p.click('#statusBtn');await p.evaluate(()=>document.getElementById('acct').open=true);await p.fill('#token','nuevo');await p.click('#saveCfg');await sleep(400);
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('githubTasksConfig')).tokenExp===undefined),'new token clears the old date');
// fecha pasada pero GitHub lo acepta
await p.click('#statusBtn');await p.evaluate(()=>document.getElementById('acct').open=true);await p.fill('#tokenExp',day(-2));await p.click('#saveCfg');await sleep(600);
ok((await p.innerText('#tokenMsg')).includes('sigue andando'),'past date but token works: soft notice');
// 401
await ctx.route('https://api.github.com/**',r=>r.fulfill({status:401,body:'{}'}));
await p.evaluate(()=>sync());await sleep(500);
msg=await p.innerText('#tokenMsg');
ok(msg.startsWith('GitHub no acepta el token')&&!(await p.isVisible('#tokenX')),'401: hard notice without ✕: '+msg);
await p.click('#tokenFix');await sleep(100);
ok(await p.isVisible('#syncOv')&&await p.evaluate(()=>document.activeElement.id)==='token','Renovar opens Sincronización on the token');
await p.keyboard.press('Escape');
await ctx.unroute('https://api.github.com/**');await L.mock(ctx,gh);
await p.evaluate(()=>sync());await sleep(500);
ok(!(await p.innerText('#tokenMsg')).startsWith('GitHub no acepta'),'notice clears after a good sync');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
// Ocultado "hasta mañana": al otro día vuelve, con un día menos (reloj adelantado, sin esperar)
gh=makeGH([T('a','Algo',{due:day(0)})]);
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:900}}));
await p.click('#statusBtn');await p.evaluate(()=>document.getElementById('acct').open=true);await p.fill('#tokenExp',day(5));await p.click('#saveCfg');await sleep(500);
await p.click('#tokenX');await p.reload();await sleep(500);ok(!(await p.isVisible('#tokenBar')),'hidden for the rest of the day');
await p.clock.fastForward(24*3600e3);await p.reload();await sleep(500);
msg=await p.innerText('#tokenMsg');
ok(await p.isVisible('#tokenBar')&&msg.includes('vence en 4 días'),'next day: notice back, one day less: '+msg);
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
// (La fecha ya no se lee de GitHub: no deja leerla desde el navegador. Ver ajustes.json en sincronizacion.js.)

// ===== 3) "en 30 minutos" =====
gh=makeGH([]);
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:900}}));
const R=await p.evaluate(()=>{
  const at=m=>{const d=new Date(Date.now()+m*60000);return {due:ymd(d),time:timeLabel({h:d.getHours(),m:d.getMinutes()})}};
  const cases=[['recordame en 30 minutos llamar a Juan','Llamar a Juan',30],['revisar el horno en media hora','revisar el horno',30],['dentro de 2 horas mandar el mail','mandar el mail',120],
    ['sacar la ropa en una hora y media','sacar la ropa',90],['llamar en 1 h','llamar',60],['volver a llamar en 5 min.','volver a llamar',5],['pagar en dos horas y cuarto','pagar',135],['en 45 minutos reunión','reunión',45]];
  const out=cases.map(([t,title,m])=>{const p=parse(t),w=whenFields(p,p.due!==undefined?p.due:addDays(0)),e=at(m);return {t,ok:p.title===title&&w.due===e.due&&w.time===e.time,got:[p.title,w.due,w.time],exp:[title,e.due,e.time]}});
  const neg=[parse('llamar al proveedor en dos semanas'),parse('terminar en 100 horas'),parse('reunión de 2 horas'),parse('estar en 3 minutos y media')];
  return {out,neg:neg.map(p=>({title:p.title,due:p.due||null,time:p.time?timeLabel(p.time):null})),two:addDays(14)};
});
R.out.forEach(r=>ok(r.ok,'relative: '+r.t+' → '+JSON.stringify(r.got)+(r.ok?'':' exp '+JSON.stringify(r.exp))));
ok(R.neg[0].due===R.two&&!R.neg[0].time,'"en dos semanas" still a date');
ok(!R.neg[1].time&&R.neg[1].title==='terminar en 100 horas','more than 72 h ignored');
ok(!R.neg[2].time,'"reunión de 2 horas" is not a time');
ok(!R.neg[3].time,'"minutos y media" ignored');
await p.fill('#title','llamar al banco en 45 minutos');
ok((await p.innerText('#detected')).match(/\d\d:\d\d/),'Detectado shows the time');
await p.press('#title','Enter');await sleep(400);
const t=gh.items.find(x=>x.title==='llamar al banco');
const e45=await p.evaluate(()=>{const d=new Date(Date.now()+45*60000);return [ymd(d),timeLabel({h:d.getHours(),m:d.getMinutes()})]});
ok(t&&t.due===e45[0]&&(t.time===e45[1]||t.time<=e45[1]),'saved with today/time: '+JSON.stringify(t&&[t.due,t.time])+' ~ '+e45);
ok((await p.innerText('#toastB3'))==='Al calendario','calendar offered');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
await b.close();console.log('fails',L.fails)})();
