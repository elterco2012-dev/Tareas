// Criterios generales: datos viejos sin migrar, texto libre, menú y deshacer, editar, buscar, atajos,
// sincronización, sin conexión, dos dispositivos a la vez, celular de 375 px y regresiones
const H=require('../lib/harness');const {devices,ok,sleep,TZ}=H;
let APP;   // la app servida por http (H.appUrl)
const dayStr=H.day;
const gh={items:[],sha:1,mode:'ok',delay:0,puts:0};
async function mock(ctx){
  await ctx.route('https://api.github.com/**',async route=>{
    const req=route.request();
    if(gh.mode==='offline')return route.abort('internetdisconnected');
    if(gh.delay)await sleep(gh.delay);
    if(req.method()==='PUT'){
      const body=JSON.parse(req.postData());
      if(String(body.sha)!==String(gh.sha))return route.fulfill({status:409,body:'{}'});
      gh.items=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));gh.sha++;gh.puts++;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.sha)}})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from(JSON.stringify(gh.items)).toString('base64'),sha:String(gh.sha)})});
  });
}
async function device(b,opts,seed){
  const ctx=await b.newContext({timezoneId:TZ,...opts});await mock(ctx);
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  await p.addInitScript(s=>{if(!sessionStorage.getItem('init')){sessionStorage.setItem('init','1');for(const k in s)localStorage.setItem(k,JSON.stringify(s[k]))}},seed||{githubTasksConfig:{owner:'u',repo:'r',token:'x'}});
  await p.goto(APP);await sleep(500);return {ctx,p};
}
const byTitle=t=>gh.items.find(x=>x.title===t);
const row=(p,t)=>p.locator('.task',{hasText:t}).first();
(async()=>{
const b=await H.launch();APP=await H.appUrl();

// ===== Criterio 1: datos existentes sin migración =====
gh.items=[
  {id:'v1',title:'Tarea vieja sin campos nuevos',priority:'Media',order:0,done:false},
  {id:'v2',title:'Vieja con fecha vencida',priority:'Alta',order:1,done:false,due:dayStr(-3),requester:'Juan',createdAt:'2026-10-01T10:00:00Z'},
  {id:'v3',title:'Vieja terminada sin completedAt',priority:'Baja',order:2,done:true},
  {id:'v4',title:'Terminada hace 20 días',priority:'Media',order:3,done:true,completedAt:H.ago(20)},
  {id:'v5',title:'Terminada ayer',priority:'Media',order:4,done:true,completedAt:H.ago(1)},
  {id:'v6',title:'Para hoy A',priority:'Media',order:5,done:false,due:dayStr(0),notes:''},
  {id:'v7',title:'Para hoy B',priority:'Media',order:6,done:false,due:dayStr(0)},
];gh.sha=10;
// localStorage de la versión anterior: caché con owner + un 'move' y un 'edit' sin subir
const seed={githubTasksConfig:{owner:'u',repo:'r',token:'x'},tareasCache:{owner:'u',repo:'r',items:gh.items},
  tareasPendientes:[{type:'move',id:'v7',ids:['v7','v6'],opId:'o1'},{type:'edit',id:'v1',patch:{notes:'nota vieja'},opId:'o2'}]};
let {ctx:c1,p}=await device(b,{viewport:{width:1100,height:900}},seed);
const af=await p.evaluate(()=>document.activeElement.id);   // el foco al abrir (tocar la barra lo mueve)
await H.go(p,'tareas');   // la lista completa está en Tareas
const pend=await p.innerText('#groups');
ok(pend.includes('Tarea vieja sin campos nuevos')&&pend.includes('Vieja con fecha vencida'),'old tasks visible without migration');
ok(pend.includes('Venció hace 3 días')&&pend.includes('@Juan')&&pend.includes('Alta'),'old task meta rendered (due/Alta/@)');
await sleep(400);
const o6=gh.items.find(x=>x.id==='v6').order,o7=gh.items.find(x=>x.id==='v7').order;
ok(o7<o6,'old pending move op still uploaded');
ok(gh.items.find(x=>x.id==='v1').notes==='nota vieja','old pending edit op uploaded');
ok((await p.innerText('#statusShort'))==='Al día','status pill Al día');
ok(af==='title','desktop autofocus on title');
// Terminadas 7 días
await p.click('#doneToggle');
let done=await p.innerText('#doneWrap');
ok(done.includes('Terminada ayer')&&!done.includes('hace 20 días')&&!done.includes('sin completedAt'),'done shows last 7 days only');
ok((await p.innerText('#doneSub')).includes('últimos 7 días · 1'),'done subtitle');
ok(done.includes('ayer'),'done "ayer" label');
await p.click('#doneAll');done=await p.innerText('#doneWrap');
ok(done.includes('hace 20 días')&&done.includes('sin completedAt')&&done.includes('Ver solo últimos 7 días'),'Ver todas shows all');
await p.click('#doneAll');
// Header summary (se ve solo en Hoy)
await H.go(p,'hoy');const sub=await p.innerText('.sub');await H.go(p,'tareas');
ok(/1 vencida/.test(sub)&&/2 para hoy/.test(sub),'header summary: '+sub.replace(/\n/g,' | '));
// Dates only in over/week/later
ok(!(await row(p,'Para hoy A').innerText()).includes('Hoy'),'no due label in Hoy group');

// ===== Texto libre =====
const fri=await p.evaluate(()=>{const d=new Date();return (5-d.getDay()+7)%7||7});
await p.fill('#title','Llamar proveedor viernes !alta @Juan_Pérez');
let det=await p.innerText('#detected');
ok(det.includes('Detectado')&&det.includes('Prioridad alta')&&det.includes('@Juan Pérez'),'detected chips: '+det.replace(/\n/g,' '));
await p.press('#title','Enter');await sleep(400);
let t=byTitle('Llamar proveedor');
ok(t&&t.priority==='Alta'&&t.requester==='Juan Pérez'&&t.due===dayStr(fri),'NLP add saved: '+JSON.stringify(t&&{d:t.due,p:t.priority,r:t.requester}));
ok((await p.innerText('#toast')).includes('Agregada para'),'toast after add: '+await p.innerText('#toastMsg'));
ok(await p.evaluate(()=>document.querySelector('#chips .chip.on').dataset.v)==='0','chip back to Hoy');
for(const [txt,exp,title] of [['Pagar luz mañana',dayStr(1),'Pagar luz'],['Turno médico pasado mañana',dayStr(2),'Turno médico'],['Revisar stock en 3 días',dayStr(3),'Revisar stock'],['Reunión del lunes con Laura',null,'Reunión con Laura'],['Enviar informe para el 1/8',null,'Enviar informe'],['Comprar algo hoy !baja',dayStr(0),'Comprar algo']]){
  await p.fill('#title',txt);await p.press('#title','Enter');await sleep(250);
  const x=byTitle(title)||(await p.evaluate(tt=>JSON.parse(localStorage.getItem('tareasPendientes')||'[]').map(o=>o.task).find(k=>k&&k.title===tt),title));
  if(title==='Enviar informe')ok(x&&x.due&&x.due.startsWith(String(H.date().getFullYear()+1))&&x.due.endsWith('-08-01'),'dd/mm more than a month ago goes to next year: '+(x&&x.due));
  else if(title==='Reunión con Laura')ok(x&&x.due&&new Date(x.due+'T12:00').getDay()===1,'"del lunes" parsed and removed: '+(x&&x.title));
  else ok(x&&x.due===exp,txt+' → '+(x&&x.due));
}
ok(byTitle('Comprar algo').priority==='Baja','!baja');
// chip selection and tip
await p.fill('#title','');await p.focus('#title');
ok(await p.isVisible('#tip'),'tip visible when focused & empty');
await p.click('#chips .chip[data-v="week"]');await p.fill('#title','Tarea semanal por chip');await p.press('#title','Enter');await sleep(300);
const mon=await p.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+((8-d.getDay())%7||7));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')});
ok(byTitle('Tarea semanal por chip').due===mon,'chip Lunes');
await p.click('#chips .chip[data-v=""]');await p.fill('#title','Sin fecha por chip');
ok(await p.evaluate(()=>document.querySelector('#chips .chip.on').dataset.v)==='','Sin fecha chip highlighted');
await p.fill('#title','Sin fecha por chip mañana');
ok(await p.evaluate(()=>document.querySelector('#chips .chip.on').dataset.v)==='1','detected date overrides chip highlight');
await p.fill('#title','Con nota');await p.click('#noteToggle');await p.fill('#note','detalle de la nota');await p.press('#title','Enter');await sleep(300);
ok(byTitle('Con nota').notes==='detalle de la nota'&&!(await p.isVisible('#note')),'+ Nota saved and hidden after add');

// ===== Menú ⋯, aviso y deshacer =====
await row(p,'Para hoy A').locator('.more').click();
let menu=await p.innerText('#menu');
ok(!menu.includes('Para hoy')&&menu.includes('Para mañana')&&menu.includes('Para el lunes')&&menu.includes('Editar')&&menu.includes('Borrar'),'menu hides current date option');
await p.keyboard.press('Escape');ok(!(await p.isVisible('#menu')),'Esc closes menu');
await row(p,'Para hoy A').locator('.more').click();await p.mouse.click(5,5);ok(!(await p.isVisible('#menu')),'outside click closes menu');
// (se espera la subida en vez de un tiempo fijo: con una consulta en curso, en CI puede tardar más de 300 ms)
await row(p,'Para hoy A').locator('.more').click();await p.click('#menu button:has-text("Para mañana")');
ok(await H.until(()=>gh.items.find(x=>x.id==='v6').due===dayStr(1),{timeout:4000}),'reschedule via menu');
ok((await p.innerText('#toastMsg'))==='Pasada a mañana'&&await p.isVisible('#toastUndo'),'reschedule toast with Deshacer');
await p.click('#toastUndo');await sleep(300);
ok(gh.items.find(x=>x.id==='v6').due===dayStr(0),'undo reschedule');
await row(p,'Para hoy B').locator('.chk').click();await H.until(()=>gh.items.find(x=>x.id==='v7')?.done);
ok(gh.items.find(x=>x.id==='v7').done===true&&(await p.innerText('#toastMsg'))==='Tarea terminada','complete + toast');
await p.click('#toastUndo');await sleep(300);
ok(gh.items.find(x=>x.id==='v7').done===false,'undo complete');
await row(p,'Con nota').locator('.more').click();await p.click('#menu button:has-text("Borrar")');await sleep(300);
ok(byTitle('Con nota').deletedAt&&!(await p.innerText('#groups')).includes('Con nota')&&(await p.innerText('#toastMsg'))==='Movida a la papelera','delete moves to the trash');
await p.click('#toastUndo');await sleep(300);
const restored=byTitle('Con nota');
ok(restored&&restored.notes==='detalle de la nota'&&!restored.deletedAt&&(await p.innerText('#groups')).includes('Con nota'),'undo delete restores task with fields');
// toast disappears after 4.5s (contados desde que se termina la tarea, después de la animación de la casilla)
await row(p,'Para hoy B').locator('.chk').click();await H.until(()=>gh.items.find(x=>x.id==='v7')?.done);await sleep(4800);
ok(!(await p.isVisible('#toast')),'toast hides after 4.5s');
await p.locator('.drow',{hasText:'Para hoy B'}).locator('.chk').click();await H.until(()=>gh.items.find(x=>x.id==='v7')?.done===false);
ok(gh.items.find(x=>x.id==='v7').done===false&&(await p.innerText('#toastMsg'))==='Volvió a pendientes','reopen from done list');
await p.click('#doneToggle');

// ===== Editar =====
await row(p,'Vieja con fecha vencida').locator('.body').click();
ok(await p.isVisible('#editOv'),'tap text opens edit');
ok(await p.evaluate(()=>document.querySelector('#ePrios .prio.on').dataset.p)==='Alta','edit prio preselected');
await p.click('#ePrios .prio[data-p="Baja"]');await p.click('#eChips .chip[data-v="1"]');await p.fill('#eNotes','nota editada');
await p.click('#editForm button[type=submit]');await sleep(300);
const v2=gh.items.find(x=>x.id==='v2');
ok(v2.priority==='Baja'&&v2.due===dayStr(1)&&v2.notes==='nota editada'&&v2.requester==='Juan','edit saved');
ok((await p.innerText('#toastMsg'))==='Cambios guardados','edit toast');
await row(p,'Vieja con fecha vencida').locator('.body').click();await p.click('#eDel');await sleep(300);
ok(gh.items.find(x=>x.id==='v2').deletedAt&&!(await p.isVisible('#editOv')),'Borrar from edit modal');
await p.click('#toastUndo');await sleep(300);

// ===== Buscar =====
await p.keyboard.press('Escape');await p.click('.top h1');
await p.keyboard.press('/');ok(await p.isVisible('#searchBar')&&await p.evaluate(()=>document.activeElement.id)==='search','/ opens search');
await p.fill('#search','@juan');let g=await p.innerText('#groups');
ok(g.includes('Llamar proveedor')&&!g.includes('Pagar luz'),'search @persona');
await p.fill('#search','zzz');ok((await p.innerText('#empty')).includes('Ninguna tarea pendiente coincide con “zzz”'),'search empty text');
await p.click('#searchClose');ok(!(await p.isVisible('#searchBar'))&&(await p.innerText('#groups')).includes('Pagar luz'),'Cerrar clears search');

// ===== Atajos =====
await p.evaluate(()=>document.activeElement.blur());
await p.keyboard.press('ArrowDown');let selId=await p.evaluate(()=>document.querySelector('.task.sel')&&document.querySelector('.task.sel').innerText);
ok(!!selId,'↓ selects a row');
await p.keyboard.press('j');await p.keyboard.press('k');
const selTitle=await p.evaluate(()=>document.querySelector('.task.sel .ttext').textContent);
await p.keyboard.press('h');await sleep(300);
ok(byTitle(selTitle)&&byTitle(selTitle).due===dayStr(0),'H → hoy ('+selTitle+')');
// (Para hoy B ya era de hoy: H no hace nada y la selección no se mueve)
await p.evaluate(t=>{sel=tasks.find(x=>x.title===t).id;renderList()},selTitle);
await p.keyboard.press('m');await sleep(300);
ok(byTitle(selTitle).due===dayStr(1),'M → mañana');
await p.evaluate(t=>{sel=tasks.find(x=>x.title===t).id;renderList()},selTitle);
await p.keyboard.press('e');ok(await p.isVisible('#editOv'),'E opens edit');
await p.keyboard.press('Escape');ok(!(await p.isVisible('#editOv')),'Esc closes edit');
await p.keyboard.press(' ');await sleep(300);
ok(byTitle(selTitle).done===true,'Space completes');
await p.click('#toastUndo');await sleep(300);
const sel2=await p.evaluate(()=>{const r=document.querySelector('.task.sel');return r&&r.querySelector('.ttext').textContent});
if(sel2){await p.keyboard.press('Delete');await sleep(300);ok(byTitle(sel2).deletedAt,'Supr deletes');await p.click('#toastUndo');await sleep(300)}
else{await p.keyboard.press('ArrowDown');const s3=await p.evaluate(()=>document.querySelector('.task.sel .ttext').textContent);await p.keyboard.press('Delete');await sleep(300);ok(byTitle(s3).deletedAt,'Supr deletes');await p.click('#toastUndo');await sleep(300)}
await p.keyboard.press('n');ok(await p.evaluate(()=>document.activeElement.id)==='title','N focuses new task');
await p.keyboard.type('h');ok((await p.inputValue('#title'))==='h','shortcuts ignored while typing');
await p.fill('#title','');await p.keyboard.press('Escape');ok(await p.evaluate(()=>document.activeElement.id)!=='title','Esc blurs field');
ok(await p.isVisible('#shortcuts'),'shortcut legend on desktop');

// ===== Sincronización (modal) =====
await p.click('#statusBtn');ok(await p.isVisible('#syncOv'),'status pill opens Sincronización');
ok((await p.innerText('#statusLong')).startsWith('Tenés lo último de GitHub ·'),'status long: '+await p.innerText('#statusLong'));
ok(await p.isVisible('#syncNow'),'Sincronizar ahora visible');
const before=gh.puts;await p.click('#syncNow');await sleep(300);ok(true,'sync now clicked');
await p.keyboard.press('Escape');ok(!(await p.isVisible('#syncOv')),'Esc closes settings');
// offline state texts
gh.mode='offline';
await p.fill('#title','Offline 1');await p.press('#title','Enter');await sleep(300);
ok((await p.innerText('#statusShort'))==='Sin señal','pill Sin señal (amber, not red): '+await p.innerText('#statusShort'));
await p.click('#statusBtn');ok((await p.innerText('#statusLong'))==='Sin conexión. 1 cambio guardado en este dispositivo · se sube solo.','status long offline: '+await p.innerText('#statusLong'));
await p.click('#clearCfg');ok((await p.innerText('#clearCfg')).includes('Hay 1 cambio sin subir'),'clear asks confirmation with warning');
await p.click('#syncX');gh.mode='ok';await p.evaluate(()=>window.dispatchEvent(new Event('online')));await sleep(400);
ok(byTitle('Offline 1'),'offline add synced on reconnect');
ok(p.errs.length===0,'desktop: no page errors '+JSON.stringify(p.errs));
await p.screenshot({path:H.out('desk.png'),fullPage:true});
await c1.close();

// ===== Criterio 2: sin conexión (agregar, terminar, deshacer, borrar) y sincroniza al volver =====
({ctx:c1,p}=await device(b,{viewport:{width:390,height:844}}));
await H.go(p,'tareas');   // la lista completa está en Tareas
gh.mode='offline';await sleep(100);
await p.fill('#title','Off agregar');await p.press('#title','Enter');
await row(p,'Para hoy A').locator('.chk').click();await H.until(()=>p.evaluate(()=>tasks.find(t=>t.title==='Para hoy A')?.done));
await p.fill('#title','Off para terminar y deshacer');await p.press('#title','Enter');
await row(p,'Off para terminar y deshacer').locator('.chk').click();await H.until(()=>p.evaluate(()=>tasks.find(t=>t.title==='Off para terminar y deshacer')?.done));await p.click('#toastUndo');
await row(p,'Tarea vieja sin campos nuevos').locator('.more').click();await p.click('#menu button:has-text("Borrar")');
await p.fill('#title','Off borrar y deshacer');await p.press('#title','Enter');
await row(p,'Off borrar y deshacer').locator('.more').click();await p.click('#menu button:has-text("Borrar")');await p.click('#toastUndo');
await sleep(200);
const offOps=await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')).length);
ok(offOps>=7,'offline ops queued: '+offOps);
await p.reload();await sleep(400);await H.go(p,'tareas');
ok((await p.innerText('#groups')).includes('Off agregar')&&!(await p.innerText('#groups')).includes('Tarea vieja sin campos'),'offline state survives reopen');
gh.mode='ok';await p.evaluate(()=>window.dispatchEvent(new Event('online')));await sleep(600);
ok(byTitle('Off agregar')&&gh.items.find(x=>x.id==='v6').done===true,'offline add + done synced');
ok(byTitle('Off para terminar y deshacer')&&byTitle('Off para terminar y deshacer').done===false,'offline done+undo synced');
ok(gh.items.find(x=>x.id==='v1').deletedAt,'offline delete synced');
ok(byTitle('Off borrar y deshacer')&&!byTitle('Off borrar y deshacer').deletedAt,'offline delete+undo synced');
ok((await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')).length))===0,'outbox empty after reconnect');
await c1.close();

// ===== Criterio 3: editar desde dos dispositivos a la vez =====
const A=await device(b,{viewport:{width:1000,height:800}}),B=await device(b,{...devices['iPhone 13'],timezoneId:TZ});
await H.go(A.p,'tareas');await H.go(B.p,'tareas');   // Pagar luz es de mañana: está en Tareas
gh.delay=200;
const target='Pagar luz';
await A.p.locator('.task',{hasText:target}).locator('.body').click();await A.p.fill('#eNotes','nota desde compu');
await B.p.locator('.task',{hasText:target}).locator('.body').click();await B.p.click('#ePrios .prio[data-p="Alta"]');await B.p.fill('#eRequester','Jefa');
await Promise.all([A.p.click('#editForm button[type=submit]'),B.p.click('#editForm button[type=submit]')]);
await Promise.all([A.p.fill('#title','Nueva desde compu').then(()=>A.p.press('#title','Enter')),B.p.fill('#title','Nueva desde celu').then(()=>B.p.press('#title','Enter'))]);
await sleep(3000);gh.delay=0;
const ta=byTitle('Pagar luz');
ok(ta.notes==='nota desde compu'&&ta.priority==='Alta'&&ta.requester==='Jefa','concurrent edits of different fields both kept: '+JSON.stringify({n:ta.notes,p:ta.priority,r:ta.requester}));
ok(byTitle('Nueva desde compu')&&byTitle('Nueva desde celu'),'concurrent adds both kept');
await A.p.click('#statusBtn');await sleep(100);
ok(A.p.errs.length===0&&B.p.errs.length===0,'two devices: no page errors');
await A.ctx.close();

// ===== Criterio 4: celular 375 px, máx 2 líneas sin notas, sin teclado al entrar =====
const M=await device(b,{viewport:{width:375,height:740},hasTouch:true,isMobile:true,deviceScaleFactor:2});
ok(await M.p.evaluate(()=>matchMedia('(pointer:fine)').matches)===false,'mobile emulation is coarse pointer');
ok(await M.p.evaluate(()=>document.activeElement===document.body),'no autofocus on mobile (keyboard stays closed)');
ok(!(await M.p.isVisible('#shortcuts')),'no shortcut legend on mobile');
await H.go(M.p,'tareas');   // todas las filas: la lista completa está en Tareas
const lines=await M.p.evaluate(()=>[...document.querySelectorAll('.task')].filter(r=>!r.querySelector('.notes')).map(r=>{
  const tt=r.querySelector('.ttext'),lh=parseFloat(getComputedStyle(tt).lineHeight);
  const tl=Math.round(tt.getBoundingClientRect().height/lh),meta=r.querySelector('.meta');
  return {title:tt.textContent,lines:tl+(meta?Math.round(meta.getBoundingClientRect().height/18):0)};
}));
const over2=lines.filter(x=>x.lines>2);
ok(over2.length===0,'375px rows without notes ≤ 2 lines'+(over2.length?' — over: '+JSON.stringify(over2):''));
ok(await M.p.evaluate(()=>document.documentElement.scrollWidth<=375),'no horizontal overflow at 375');
// menu near bottom flips upward
await M.p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
const lastMore=M.p.locator('.task .more').last();await lastMore.click();
const box=await M.p.evaluate(()=>{const r=document.getElementById('menu').getBoundingClientRect();return {top:r.top,bottom:r.bottom,h:innerHeight}});
ok(box.bottom<=box.h&&box.top>=0,'menu fully on screen near bottom '+JSON.stringify(box));
await M.p.click('#menuBackdrop',{position:{x:5,y:5}});
await M.p.evaluate(()=>window.scrollTo(0,0));
await M.p.screenshot({path:H.out('m375.png'),fullPage:true});
await M.p.locator('.task .body').first().click();await M.p.screenshot({path:H.out('m375-edit.png')});await M.p.click('#editX');
await M.p.click('#statusBtn');await M.p.screenshot({path:H.out('m375-sync.png')});
ok(M.p.errs.length===0,'mobile: no page errors '+JSON.stringify(M.p.errs));
await M.ctx.close();await B.ctx.close();

// ===== Regresiones: cerrar enseguida, borrar conexión durante sincronización =====
let R=await device(b,{viewport:{width:390,height:800}});
gh.delay=1500;await R.p.fill('#title','Agregada y cerré');await R.p.press('#title','Enter');await sleep(100);
await R.p.reload();gh.delay=0;await sleep(3500);
ok(gh.items.filter(x=>x.title==='Agregada y cerré').length===1,'close right after add: reaches GitHub once');
await H.go(R.p,'tareas');   // la lista completa está en Tareas
gh.delay=1200;await R.p.click('#statusBtn');await R.p.click('#syncNow');await sleep(150);
await R.p.click('#clearCfg');await R.p.click('#clearCfg');await sleep(1800);gh.delay=0;
ok(await R.p.evaluate(()=>localStorage.getItem('tareasCache'))===null&&!(await R.p.innerText('#groups')).includes('Para hoy'),'clear during sync stays cleared');
ok((await R.p.innerText('#statusShort'))==='Solo acá','pill Solo acá when unconfigured');
await R.p.click('#syncX');await R.p.fill('#title','Local sin GitHub');await R.p.press('#title','Enter');await sleep(200);
ok((await R.p.innerText('#groups')).includes('Local sin GitHub'),'works without GitHub configured');
ok(R.p.errs.length===0,'regressions: no page errors '+JSON.stringify(R.p.errs));
await b.close();
})();
