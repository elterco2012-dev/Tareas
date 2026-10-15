// Correcciones de la revisión: "1 hora y 20", Borrar conexión, token nuevo
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
(async()=>{
const b=await L.launch();
let gh=makeGH([]);
let {ctx,p}=await device(b,gh,{viewport:{width:375,height:740},isMobile:true,hasTouch:true});
const R=await p.evaluate(()=>{
  const at=m=>{const d=new Date(Date.now()+m*60000);return ymd(d)+' '+timeLabel({h:d.getHours(),m:d.getMinutes()})};
  const f=t=>{const q=parse(t),w=whenFields(q,q.due!==undefined?q.due:addDays(0));return [q.title,w.time?w.due+' '+w.time:null]};
  const cases=[['recordame en 1 hora y 30 minutos llamar al médico','Llamar al médico',90],['llamar a Juan en 1 hora y 45 minutos','llamar a Juan',105],
    ['en 2 horas y 30 minutos sale el vuelo','sale el vuelo',150],['en una hora y veinte llamar','llamar',80],['en 2 hs y 10 llamar','llamar',130],
    ['en 1 hora 30 minutos llamar','llamar',90],['en 1 hora y 5 min. llamar','llamar',65],['en una hora y media salir','salir',90],['en dos horas y cuarto pagar','pagar',135],
    ['comprar pan en 30 minutos y 2 litros de leche','comprar pan y 2 litros de leche',30],['comprar pan en 1 hora y 2 litros','comprar pan y 2 litros',60],
    ['recordame en 30 minutos llamar a Juan','Llamar a Juan',30],['en media hora','en media hora',30]];
  const res=cases.map(([t,ti,m])=>{const g=f(t);return {t,ok:g[0]===ti&&g[1]===at(m),g,e:[ti,at(m)]}});
  const neg=[f('en 1 h 30 llamar'),f('estar en 3 minutos y media'),f('llamar en 1 hora y 75')];
  return {res,neg};
});
R.res.forEach(r=>ok(r.ok,r.t+' → '+JSON.stringify(r.g)+(r.ok?'':' exp '+JSON.stringify(r.e))));
ok(R.neg[0][1]===null&&R.neg[0][0]==='en 1 h 30 llamar','"en 1 h 30" left alone: '+JSON.stringify(R.neg[0]));
ok(R.neg[1][1]===null,'"minutos y media" ignored');
ok(R.neg[2][1]!==null&&R.neg[2][0].includes('75'),'"y 75" not taken as minutes: '+JSON.stringify(R.neg[2]));
// Borrar conexión limpia la fecha
await p.locator('#statusBtn').tap();await p.evaluate(()=>document.getElementById('acct').open=true);await p.fill('#tokenExp',day(4));await p.locator('#saveCfg').tap();await sleep(400);
await p.locator('#statusBtn').tap();await p.evaluate(()=>document.getElementById('acct').open=true);await p.locator('#clearCfg').tap();await p.locator('#clearCfg').tap();
ok(await p.inputValue('#tokenExp')==='','clear connection empties the date');
await p.fill('#owner','u');await p.fill('#repo','r');await p.fill('#token','nuevo');await p.locator('#saveCfg').tap();await sleep(400);
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('githubTasksConfig')).tokenExp===undefined)&&!(await p.isVisible('#tokenBar')),'reconnect: no stale date, no notice');
// Token nuevo: se borra la fecha vieja en el formulario y se pide la nueva
await p.locator('#statusBtn').tap();await p.evaluate(()=>document.getElementById('acct').open=true);await p.fill('#tokenExp',day(3));await p.locator('#saveCfg').tap();await sleep(400);
await p.locator('#tokenFix').tap();await p.fill('#token','otro');
ok(await p.inputValue('#tokenExp')===''&&(await p.innerText('#cfgMsg')).includes('fecha de vencimiento'),'new token clears the date field and asks for the new one');
await p.fill('#tokenExp',day(90));await p.locator('#saveCfg').tap();await sleep(400);
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('githubTasksConfig')).tokenExp)===day(90)&&!(await p.isVisible('#tokenBar')),'new date saved, notice gone');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();await b.close();console.log('fails',L.fails)})();
