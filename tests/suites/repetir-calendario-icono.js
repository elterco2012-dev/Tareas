// Tareas que se repiten, calendario (.ics), número en el ícono, compartir hacia la app
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,TZ}=L;
const fs=require('fs');
(async()=>{
const b=await L.launch();const APP=await L.appUrl();
// ===== 8. Repetición: texto libre =====
let gh=makeGH([T('r','Informe semanal',{due:day(-2),repeat:'weekly',requester:'Laura',priority:'Alta',notes:'con gráficos'}),T('n','Normal',{due:day(0)})]);
let {ctx,p}=await device(b,gh,{viewport:{width:1100,height:900}});
const P=await p.evaluate(()=>{const nm=nextMonday();const nf=(()=>{const d=new Date();d.setDate(d.getDate()+((5-d.getDay()+7)%7||7));return ymd(d)})();return {nm,nf,cases:[
 'Revisar mail todos los días','Informe de ventas cada lunes','Pagar alquiler cada mes','Backup de lunes a viernes','cada semana regar plantas','todos los viernes reunión de equipo','reunión de equipo los lunes','cada mañana revisar el stock','Llamar a mamá cada domingos','Revisar caja todos los días hábiles'].map(x=>{const r=parse(x);return {x,title:r.title,repeat:r.repeat||null,due:r.due||null}})}});
const exp={'Revisar mail todos los días':['Revisar mail','daily',null],'Informe de ventas cada lunes':['Informe de ventas','weekly',P.nm],'Pagar alquiler cada mes':['Pagar alquiler','monthly',null],'Backup de lunes a viernes':['Backup','weekdays',null],'cada semana regar plantas':['regar plantas','weekly',null],'todos los viernes reunión de equipo':['reunión de equipo','weekly',P.nf],'reunión de equipo los lunes':['reunión de equipo los lunes',null,null],'cada mañana revisar el stock':['revisar el stock','daily',null],'Revisar caja todos los días hábiles':['Revisar caja','weekdays',null]};
for(const c of P.cases){const e=exp[c.x];if(!e){ok(c.repeat==='weekly'&&c.due,'"'+c.x+'" → '+JSON.stringify(c));continue}
  ok(c.title===e[0]&&c.repeat===e[1]&&c.due===e[2],'"'+c.x+'" → '+JSON.stringify(c))}
// fila con ↻
ok((await p.innerText('#groups')).includes('↻ semanal'),'row shows ↻ semanal');
// Terminar una que se repite → crea la próxima
await p.locator('.task',{hasText:'Informe semanal'}).locator('.chk').click();await L.until(()=>gh.items.find(x=>x.id==='r')?.done);
const nxt=gh.items.filter(x=>x.title==='Informe semanal'&&!x.done);
const expDue=day(5);// due -2 + 7 = +5
ok(gh.items.find(x=>x.id==='r').done===true,'original done');
ok(nxt.length===1&&nxt[0].due===expDue&&nxt[0].repeat==='weekly'&&nxt[0].requester==='Laura'&&nxt[0].priority==='Alta'&&nxt[0].notes==='con gráficos'&&nxt[0].id!=='r','next occurrence created: '+JSON.stringify(nxt[0]&&{due:nxt[0].due,rep:nxt[0].repeat}));
ok((await p.innerText('#toastMsg')).startsWith('Tarea terminada · la próxima'),'toast: '+await p.innerText('#toastMsg'));
await p.click('#toastUndo');await sleep(400);
ok(gh.items.find(x=>x.id==='r').done===false&&gh.items.filter(x=>x.title==='Informe semanal').length===1,'undo reverts done and removes next');
// texto libre al agregar
await p.fill('#title','Pagar alquiler cada mes');ok((await p.innerText('#detected')).includes('↻ Mensual'),'Detectado ↻ Mensual');
await p.press('#title','Enter');await sleep(300);
ok(gh.items.find(x=>x.title==='Pagar alquiler').repeat==='monthly','saved repeat monthly');
// Editar: Se repite
await p.locator('.task',{hasText:'Normal'}).locator('.body').click();
ok((await p.inputValue('#eRepeat'))==='','edit select shows No');
await p.selectOption('#eRepeat','weekdays');await p.click('#editForm button[type=submit]');await sleep(300);
ok(gh.items.find(x=>x.id==='n').repeat==='weekdays','edit sets repeat');
await p.locator('.task',{hasText:'Normal'}).locator('.body').click();await p.selectOption('#eRepeat','');await p.click('#editForm button[type=submit]');await sleep(300);
ok(gh.items.find(x=>x.id==='n').repeat===null,'edit clears repeat');
// ===== Calendario (.ics) =====
const getIcs=async(fn)=>{const [dl]=await Promise.all([p.waitForEvent('download'),fn()]);const path=await dl.path();return {name:dl.suggestedFilename(),txt:fs.readFileSync(path,'utf8')}};
await p.fill('#title','Llamar al banco; Juan, urgente, mañana a las 3');await p.press('#title','Enter');await sleep(300);
ok((await p.innerText('#toastB3'))==='Al calendario','toast offers Al calendario');
let ics=await getIcs(()=>p.click('#toastB3'));
const d1=day(1).replace(/-/g,'');
ok(ics.txt.includes('DTSTART:'+d1+'T150000')&&ics.txt.includes('DTEND:'+d1+'T153000'),'ics timed 15:00-15:30');
ok(/BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:.*\r\nTRIGGER:-PT0M\r\nEND:VALARM/.test(ics.txt),'ics has alarm at start');
ok((ics.txt.match(/SUMMARY:.*/)||[])[0]==='SUMMARY:Llamar al banco\\; Juan','summary escaped exactly: '+(ics.txt.match(/SUMMARY:.*/)||[])[0]);
ok(ics.txt.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0')&&ics.txt.trim().endsWith('END:VCALENDAR'),'valid calendar wrapper with CRLF');
ok(ics.name==='Llamar al banco; Juan.ics','file name '+ics.name);
ok((await p.innerText('#toastMsg')).includes('Abrí el archivo descargado'),'toast explains to open the file');
// sin hora → 9:00 (tarea futura)
gh.items.push(T('x','Pedir presupuesto, materiales; varios',{due:day(3),notes:'línea 1\nlínea 2'}));gh.sha++;
await p.evaluate(()=>sync());await sleep(400);
await p.locator('.task',{hasText:'Pedir presupuesto'}).locator('.more').click();
ics=await getIcs(()=>p.click('#menu button:has-text("Agregar al calendario")'));
const d3=day(3).replace(/-/g,'');
ok(ics.txt.includes('DTSTART:'+d3+'T090000'),'no time → 9:00');
ok(ics.txt.includes('SUMMARY:Pedir presupuesto\\, materiales\\; varios')&&ics.txt.includes('DESCRIPTION:línea 1\\nlínea 2'),'escaping of , ; and newlines');
// vencida → hoy
gh.items.push(T('v','Vencida a las 10',{due:day(-3)}));gh.sha++;await p.evaluate(()=>sync());await sleep(400);
await p.locator('.task',{hasText:'Vencida a las 10'}).locator('.more').click();
ics=await getIcs(()=>p.click('#menu button:has-text("Agregar al calendario")'));
ok(ics.txt.includes('DTSTART:'+day(0).replace(/-/g,'')+'T100000'),'overdue → today 10:00');
// líneas largas plegadas a 75 bytes
const long=await p.evaluate(()=>icsText({id:'z',title:'Título muy largo con acentos áéíóú '.repeat(5),due:addDays(2),notes:''}));
ok(long.split('\r\n').every(l=>new TextEncoder().encode(l).length<=75),'lines folded to ≤75 bytes');
ok(p.errs.length===0,'errors '+JSON.stringify(p.errs));
await ctx.close();
// ===== nextDue con fechas difíciles (reloj fijo: viernes 30/1/2026) =====
const ctxc=await b.newContext({timezoneId:TZ,clock:false});await ctxc.route('https://api.github.com/**',r=>r.abort());
const pc=await ctxc.newPage();await pc.clock.install({time:new Date('2026-01-30T12:00:00-03:00')});
await pc.goto(APP);await sleep(300);
const nd=await pc.evaluate(()=>[['2026-01-31','monthly'],['2026-01-30','weekdays'],['2026-01-25','daily'],['2026-01-12','weekly'],['2025-12-15','monthly'],['2026-02-10','daily'],['2026-01-29','weekdays'],[null,'daily'],['2025-11-30','monthly']].map(([d,r])=>nextDue({due:d,repeat:r})));
ok(JSON.stringify(nd)===JSON.stringify(['2026-02-28','2026-02-02','2026-01-30','2026-02-02','2026-02-15','2026-02-11','2026-01-30','2026-01-31','2026-01-30']),'nextDue cases: '+JSON.stringify(nd));
await ctxc.close();
// ===== 9. Número en el ícono =====
gh=makeGH([T('o','Vencida',{due:day(-1)}),T('h','Hoy',{due:day(0)}),T('w','Esperando',{due:day(0),waiting:true}),T('m','Mañana',{due:day(1)})]);
({ctx,p}=await device(b,gh,{viewport:{width:1100,height:900}},undefined,()=>{window.__badge=[];navigator.setAppBadge=n=>{window.__badge.push(n);return Promise.resolve()};navigator.clearAppBadge=()=>{window.__badge.push(0);return Promise.resolve()}}));
ok((await p.evaluate(()=>window.__badge)).slice(-1)[0]===2,'badge = vencidas + hoy (sin esperando): '+JSON.stringify(await p.evaluate(()=>window.__badge)));
await p.click('#statusBtn');ok(await p.isVisible('#badgeRow')&&await p.isChecked('#badgeSw'),'switch visible and on by default');
await p.click('#badgeSw');ok((await p.evaluate(()=>window.__badge)).slice(-1)[0]===0,'switch off clears badge');
await p.click('#badgeSw');ok((await p.evaluate(()=>window.__badge)).slice(-1)[0]===2,'switch on sets badge again');
await p.click('#syncX');await p.locator('.task',{hasText:'Hoy'}).first().locator('.chk').click();await L.until(async()=>(await p.evaluate(()=>window.__badge)).slice(-1)[0]===1);
ok((await p.evaluate(()=>window.__badge)).slice(-1)[0]===1,'badge updates on recompute');
await ctx.close();
({ctx,p}=await device(b,gh,{viewport:{width:1100,height:900}},undefined,()=>{delete Navigator.prototype.setAppBadge;delete Navigator.prototype.clearAppBadge}));
await p.click('#statusBtn');ok(!(await p.isVisible('#badgeRow')),'no switch when unsupported');ok(p.errs.length===0,'no errors without badge API');
await ctx.close();
// ===== 1. Compartir =====
const share=async(q,mobile=true)=>device(b,makeGH([]),mobile?{viewport:{width:375,height:740},isMobile:true,hasTouch:true}:{viewport:{width:1100,height:900}},APP+'?share=1&'+q);
({ctx,p}=await share('text='+encodeURIComponent('Llamar a Juan mañana por el presupuesto')));
ok((await p.inputValue('#title'))==='Llamar a Juan mañana por el presupuesto','shared text prefilled');
ok(await p.evaluate(()=>document.activeElement.id)==='title','focus in field');
ok(await p.evaluate(()=>location.search)==='','URL cleaned');
ok((await p.innerText('#detected')).includes('Mañana'),'Detectado works for shared text');
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')||'[]').length)===0,'nothing added until Agregar');
await ctx.close();
({ctx,p}=await share('title='+encodeURIComponent('Nota de pedido')+'&text='+encodeURIComponent('Mirá esto https://ejemplo.com/x')+'&url='+encodeURIComponent('https://ejemplo.com/x')));
ok((await p.inputValue('#title'))==='Nota de pedido Mirá esto https://ejemplo.com/x','title+text joined, url not duplicated: '+await p.inputValue('#title'));
await ctx.close();
({ctx,p}=await share('title='+encodeURIComponent('Pedidos')+'&text='+encodeURIComponent('- Comprar toner\n- Llamar a Laura\n- Pagar luz')));
ok(await p.isVisible('#bulkOv')&&(await p.$$eval('#bulkList .inp',x=>x.map(y=>y.value))).join('|')==='Pedidos|Comprar toner|Llamar a Laura|Pagar luz','multi-line share opens the bulk modal');
await ctx.close();
// manifest
const man=JSON.parse(L.readRepo('manifest.webmanifest'));
ok(man.share_target&&man.share_target.action==='./'&&man.share_target.method==='GET'&&man.share_target.params.text==='text','manifest share_target');
ok(man.shortcuts&&man.shortcuts[0].url==='./?nueva=1','manifest shortcuts');
await b.close();})();
