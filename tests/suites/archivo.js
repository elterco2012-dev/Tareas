// Archivo anual: las terminadas viejas pasan a archivo/AAAA.json
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
(async()=>{
const b=await L.launch();
const ago=L.ago;
const yr=n=>new Date(L.now()-n*86400000).getFullYear();
const gh=makeGH([
  T('o1','Vieja 100 días',{done:true,completedAt:ago(100)}),
  T('o2','Vieja 400 días',{done:true,completedAt:ago(400)}),
  T('o3','Vieja 95 días ya archivada',{done:true,completedAt:ago(95)}),
  T('r1','Reciente 20 días',{done:true,completedAt:ago(20)}),
  T('s1','Terminada sin fecha',{done:true}),
  T('p1','Pendiente',{due:day(0)}),
]);
// archivo existente con o3 (no se duplica)
gh.files['archivo/'+yr(95)+'.json']={content:JSON.stringify([{id:'o3',title:'Vieja 95 días ya archivada',done:true,completedAt:ago(95)},{id:'zz',title:'otra',done:true}]),sha:7};
let {ctx,p}=await device(b,gh,{viewport:{width:1100,height:900}});
await sleep(1500);
const ids=gh.items.map(x=>x.id).sort().join(',');
ok(ids==='p1,r1,s1','old done tasks removed from tareas.json: '+ids);
const f1=JSON.parse(gh.files['archivo/'+yr(100)+'.json'].content),f2=JSON.parse(gh.files['archivo/'+yr(400)+'.json'].content);
ok(f1.filter(x=>x.id==='o3').length===1&&f1.some(x=>x.id==='o1')&&f1.some(x=>x.id==='zz'),'year file merged without duplicates: '+f1.map(x=>x.id).join(','));
ok(f2.some(x=>x.id==='o2'),'other year in its own file');
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('ultimoArchivo')))===await p.evaluate(()=>ymd(new Date())),'ultimoArchivo = today');
await go(p,'tareas');await p.click('#doneToggle');ok(await p.isVisible('#archiveNote'),'note shown in Terminadas');
// no se vuelve a archivar el mismo día
gh.items.push(T('o4','Otra vieja',{done:true,completedAt:ago(200)}));gh.sha++;
await p.evaluate(()=>sync());await sleep(800);
ok(gh.items.some(x=>x.id==='o4'),'only once per day per device');
await ctx.close();
// Si falla la escritura del archivo, no se borra nada
const gh2=makeGH([T('a1','Vieja',{done:true,completedAt:ago(120)}),T('p','Pendiente',{due:day(0)})]);
const {mock,TZ}=L;
ctx=await b.newContext({timezoneId:TZ,viewport:{width:1100,height:900}});
await mock(ctx,gh2);
await ctx.route('https://api.github.com/**',async route=>{const u=route.request().url();if(u.includes('/contents/archivo/')){return route.fulfill({status:route.request().method()==='PUT'?500:404,body:'{}'})}return route.fallback()});
p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
await p.addInitScript(()=>localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'})));
await p.goto(await L.appUrl());await sleep(1500);
ok(gh2.items.some(x=>x.id==='a1'),'archive write failure → task kept in tareas.json');
ok(await p.evaluate(()=>localStorage.getItem('ultimoArchivo'))===null,'failure → retried later (ultimoArchivo not set)');
ok(p.errs.length===0,'errors '+JSON.stringify(p.errs));
await ctx.close();
// delete onlyDone: si la reabrieron en otro dispositivo, no se borra
({ctx,p}=await device(b,makeGH([]),{viewport:{width:900,height:700}}));
const r=await p.evaluate(()=>{const a=[{id:'x',done:false},{id:'y',done:true}];applyOp(a,{type:'delete',id:'x',onlyDone:true});applyOp(a,{type:'delete',id:'y',onlyDone:true});return a.map(t=>t.id).join(',')});
ok(r==='x','delete onlyDone keeps reopened task');
await ctx.close();await b.close();})();
