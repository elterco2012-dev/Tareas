// Correcciones de la revisión de la fase 1: Deshacer vuelve la tarea a su lugar; abrir una vieja con la hora en el
// título y cerrar no guarda; tarea borrada en otro dispositivo; Z en Procesar; Deshacer de Vaciar papelera con
// repetidas; fecha u hora a medio escribir; el aviso de nuevas no tapa Recuperar; mensaje compartido largo.
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
const H=L;
(async()=>{
// ---- r1-order.js ----
{
// saveEdit computes the undo patch before placeMoved adds `order` to the patch -> undo puts the task at the end
const DESK={viewport:{width:1000,height:900}};
await (async()=>{
const b=await L.launch();
for(const mode of ['edit-esc','edit-save','menu-prio']){
  const gh=makeGH([T('a','Alfa',{due:day(0),order:0}),T('b','Beta',{due:day(0),order:1}),T('c','Gamma',{due:day(0),order:2})]);
  const {ctx,p}=await device(b,gh,DESK);
  const ord=()=>p.evaluate(()=>tasks.filter(t=>!t.done).sort(cmpPending).map(t=>t.title+':'+t.priority+':'+t.order).join(' | '));
  console.log(mode,'before :',await ord());
  if(mode==='menu-prio'){
    await p.evaluate(()=>togglePrio(tasks.find(t=>t.id==='a')));
  }else{
    await p.locator('.task .ttext',{hasText:'Alfa'}).click();await sleep(200);
    await p.click('#ePrios .prio[data-p="Alta"]');
    if(mode==='edit-esc')await p.keyboard.press('Escape');else await p.click('#eSave');
  }
  await sleep(800);
  console.log(mode,'after  :',await ord(),'| toast:',await p.textContent('#toastMsg'));
  await p.click('#toastUndo');await sleep(1200);
  const after=await ord();
  console.log(mode,'undone :',after);
  console.log(mode,'github :',gh.items.map(t=>t.title+':'+t.priority+':'+t.order).join(' | '));
  ok(after.startsWith('Alfa:Media'),mode+': undo returns Alfa to its original first position');
  await ctx.close();
}
await b.close();
})();
}
// ---- r2-legacy.js ----
{
// Done task from before 11/10 with the time in the title (migrateTimes skips done ones): just opening it and
// pressing Back/Esc "saves"; Deshacer then writes time:null (the title time is lost)
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true},DESK={viewport:{width:1000,height:900}};
await (async()=>{
const b=await L.launch();
{
  const gh=makeGH([T('d','Turno dentista a las 16',{done:true,completedAt:L.ago(5),due:day(-5)}),T('p','Pendiente',{due:day(0)})]);
  const {ctx,p}=await device(b,gh,PHONE);await sleep(1500);
  const puts0=gh.sha;
  console.log('remote d before:',JSON.stringify(gh.items.find(x=>x.id==='d')));
  await go(p,'tareas');   // Terminadas está en Tareas
  await p.click('#doneToggle');await sleep(200);
  await p.locator('#doneList .drow .dt',{hasText:'Turno dentista'}).tap();await sleep(300);
  console.log('editH:',await p.innerText('#editH'),'eTime:',await p.inputValue('#eTime'),'patch:',JSON.stringify(await p.evaluate(()=>editPatch())));
  await p.goBack();await sleep(1500);
  const msg=await p.isVisible('#toast')?await p.textContent('#toastMsg'):'(no toast)';
  console.log('after Back toast:',msg,'| commits:',gh.sha-puts0,'| remote d:',JSON.stringify(gh.items.find(x=>x.id==='d')));
  ok(msg!=='Cambios guardados'&&gh.sha===puts0,'only viewing a done legacy task and pressing Back does not save anything');
  if(await p.isVisible('#toastUndo')){
    await p.click('#toastUndo');await sleep(1500);
    const d=gh.items.find(x=>x.id==='d');
    console.log('after Deshacer remote d:',JSON.stringify(d),'taskTime:',await p.evaluate(()=>taskTime(tasks.find(t=>t.id==='d'))));
    ok(d.time===undefined||d.time==='16:00','Deshacer keeps the 16:00 the task had (time='+JSON.stringify(d.time)+')');
  }
  // readyToCapture: never auto-closes this one
  await p.locator('#doneList .drow .dt',{hasText:'Turno dentista'}).tap().catch(()=>{});await sleep(300);
  await p.evaluate(()=>readyToCapture());await sleep(100);
  ok(await p.isHidden('#editOv'),'readyToCapture closes an untouched task (editOv visible='+await p.isVisible('#editOv')+')');
  await ctx.close();
}
await b.close();
})();
}
// ---- r3-deleted.js ----
{
// Edit open on the phone; the PC moves the task to the trash (or empties the trash). The phone keeps the modal
// open with no sign; Back says "Cambios guardados" though the task is gone / in the trash.
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
await (async()=>{
const b=await L.launch();
for(const how of ['trash','hard']){
  const gh=makeGH([T('a','Llamar al banco',{due:day(0)}),T('b','Otra',{due:day(0)})]);
  const {ctx,p}=await device(b,gh,PHONE);await sleep(800);
  await p.locator('.task .ttext',{hasText:'Llamar al banco'}).tap();await sleep(300);
  // the PC acts on GitHub
  if(how==='trash')gh.items=gh.items.map(x=>x.id==='a'?{...x,deletedAt:new Date(L.now()).toISOString()}:x);
  else gh.items=gh.items.filter(x=>x.id!=='a');
  gh.sha++;
  await p.clock.fastForward(6000);await sleep(1500);   // next poll
  console.log(how,'tasks has a:',await p.evaluate(()=>tasks.some(t=>t.id==='a')),'editOv visible:',await p.isVisible('#editOv'));
  await p.fill('#eNotes','Cuenta 4471, preguntar por Marta');
  await p.goBack();await sleep(1500);
  const msg=await p.isVisible('#toast')?await p.textContent('#toastMsg'):'(no toast)';
  const a=gh.items.find(x=>x.id==='a');
  console.log(how,'toast:',msg,'| remote a:',JSON.stringify(a&&{notes:a.notes,deletedAt:a.deletedAt}));
  ok(!(msg==='Cambios guardados'&&(!a||a.deletedAt)),how+': app does not claim "Cambios guardados" for a task that is gone/in trash');
  await ctx.close();
}
await b.close();
})();
}
// ---- r4-proc-z.js ----
{
// Procesar: E (Editar) + Esc now leaves a Deshacer in the toast. Z undoes it but also steps the queue back one,
// showing the previously processed task again.
const DESK={viewport:{width:1000,height:900}};
await (async()=>{
const b=await L.launch();
const gh=makeGH([T('a','Primera vencida',{due:day(-2)}),T('b','Segunda vencida',{due:day(-1)})]);
const {ctx,p}=await device(b,gh,DESK);await sleep(800);
await p.evaluate(()=>{document.activeElement.blur();openProc(false)});await sleep(300);
console.log('card:',await p.innerText('#procCard .pt'),await p.innerText('#procN'));
await p.keyboard.press('m');await sleep(400);   // Mañana -> next
console.log('card:',await p.innerText('#procCard .pt'),await p.innerText('#procN'));
await p.keyboard.press('e');await sleep(300);
await p.fill('#eNotes','dato para la segunda');
await p.keyboard.press('Escape');await sleep(400);
console.log('toast:',await p.textContent('#toastMsg'),'undo visible:',await p.isVisible('#toastUndo'));
await p.locator('#procCard').click();   // focus out of inputs
await p.keyboard.press('z');await sleep(400);
const card=await p.innerText('#procCard .pt');
console.log('after Z card:',card,await p.innerText('#procN'),'notes b:',await p.evaluate(()=>tasks.find(t=>t.id==='b').notes),'a due:',await p.evaluate(()=>tasks.find(t=>t.id==='a').due));
ok(card==='Segunda vencida','Z after an edit keeps the same card (shows '+card+')');
await ctx.close();await b.close();
})();
}
// ---- r5-trash.js ----
{
// Vaciar papelera + Deshacer vs sync-core applyOp('add') rules
const DESK={viewport:{width:1000,height:900}};
await (async()=>{
const b=await L.launch();
const del=new Date(L.now()-86400000).toISOString();
// A weekly routine; its next occurrence B was trashed; C (repeatOf A) is the live one
const gh=makeGH([T('A','Pagar sueldos',{repeat:'weekly',done:true,completedAt:L.ago(1),due:day(-1)}),
  T('B','Pagar sueldos',{repeatOf:'A',repeat:'weekly',due:day(6),deletedAt:del}),
  T('C','Pagar sueldos',{repeatOf:'A',repeat:'weekly',due:day(6)}),
  T('X','Nota borrada',{deletedAt:del})]);
const {ctx,p}=await device(b,gh,DESK);await sleep(1000);
console.log('trash before:',await p.evaluate(()=>trash.map(t=>t.id).join()));
await go(p,'tareas');   // la papelera está en Tareas
await p.click('#trashToggle');await sleep(150);
await p.click('#trashEmpty');await sleep(800);await p.click('#trashEmpty');await sleep(1500);
console.log('trash after empty:',await p.evaluate(()=>trash.map(t=>t.id).join()),'remote:',gh.items.map(t=>t.id).join());
await p.click('#toastUndo');await sleep(1500);
const tr=await p.evaluate(()=>trash.map(t=>t.id).join());
console.log('trash after Deshacer:',tr,'remote:',gh.items.map(t=>t.id+(t.deletedAt?'(trash)':'')).join());
ok(tr.split(',').sort().join()==='B,X','Deshacer brings back every task that was in the trash (got '+tr+')');
await ctx.close();await b.close();
})();
}
// ---- r6-time-partial.js ----
{
// PC: half-retyping the time (one segment cleared) makes eTime.value '' -> Esc / click outside saves time:null
const DESK={viewport:{width:1000,height:900}};
await (async()=>{
const b=await L.launch();
const gh=makeGH([T('a','Turno médico',{due:day(1),time:'15:00'})]);
const {ctx,p}=await device(b,gh,DESK);await sleep(800);
await p.locator('.task .ttext',{hasText:'Turno médico'}).click();await sleep(200);
await p.click('#eTime');   // focuses a segment
await p.keyboard.press('Backspace');await sleep(100);
console.log('badInput:',await p.evaluate(()=>$('eTime').validity.badInput));console.log('eTime value after Backspace:',JSON.stringify(await p.inputValue('#eTime')),'patch:',JSON.stringify(await p.evaluate(()=>editPatch())));
await p.keyboard.press('Escape');await sleep(1500);
console.log('editOv hidden:',await p.isHidden('#editOv'),'toast:',await p.isVisible('#toast')?await p.textContent('#toastMsg'):'-','remote time:',JSON.stringify(gh.items[0].time));
ok(gh.items[0].time==='15:00','Esc with a half-typed time keeps 15:00 (got '+JSON.stringify(gh.items[0].time)+')');
await ctx.close();await b.close();
})();
}
// ---- r7-date-partial.js ----
{
// PC: half-retyping the time (one segment cleared) makes eDue.value '' -> Esc / click outside saves time:null
const DESK={viewport:{width:1000,height:900}};
await (async()=>{
const b=await L.launch();
const gh=makeGH([T('a','Turno médico',{due:'2026-10-20',time:'15:00'})]);
const {ctx,p}=await device(b,gh,DESK);await sleep(800);
await p.locator('.task .ttext',{hasText:'Turno médico'}).click();await sleep(200);
await p.evaluate(()=>{window.__ch=[];$('eDue').addEventListener('change',()=>window.__ch.push($('eDue').validity.badInput),true)});await p.click('#eDue');
await p.keyboard.press('Backspace');await sleep(100);
console.log('badInput at change:',await p.evaluate(()=>JSON.stringify(window.__ch)));console.log('badInput:',await p.evaluate(()=>$('eDue').validity.badInput));console.log('eDue value after Backspace:',JSON.stringify(await p.inputValue('#eDue')),'patch:',JSON.stringify(await p.evaluate(()=>editPatch())));
await p.keyboard.press('Escape');await sleep(1500);
console.log('editOv hidden:',await p.isHidden('#editOv'),'toast:',await p.isVisible('#toast')?await p.textContent('#toastMsg'):'-','remote time:',JSON.stringify(gh.items[0].due));
ok(gh.items[0].due==='2026-10-20','Esc with a half-typed date keeps the due (got '+JSON.stringify(gh.items[0].due)+')');
await ctx.close();await b.close();
})();
}
// ---- r8-share.js ----
{
// Shared multi-line text at startup: bulk opens; is the Back guard pushed with/without user activation?
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const spy=()=>{window.__push=[];const o=history.pushState.bind(history);history.pushState=(...a)=>{window.__push.push({active:navigator.userActivation.isActive,been:navigator.userActivation.hasBeenActive});return o(...a)}};
await (async()=>{
const b=await L.launch();
const gh=makeGH([T('a','Una',{due:day(0)})]);
const url=(await L.appUrl())+'?text='+encodeURIComponent('comprar pan\nllamar a Juan\npagar luz');
const {ctx,p}=await device(b,gh,PHONE,url,spy);await sleep(800);
console.log('bulk visible:',await p.isVisible('#bulkOv'),'history.length:',await p.evaluate(()=>history.length),'state:',JSON.stringify(await p.evaluate(()=>history.state)));
console.log('pushState calls:',JSON.stringify(await p.evaluate(()=>window.__push)));
// add a task on the other device -> arrivals toast while Recuperar is showing
await p.goBack();await sleep(400);
console.log('after Back: bulk hidden',await p.isHidden('#bulkOv'),'toast:',await p.textContent('#toastMsg'),await p.textContent('#toastUndo'));
gh.items=[...gh.items,T('n','Nueva desde la compu',{due:day(0),src:'pc'})];gh.sha++;
await p.clock.fastForward(5500);await sleep(1500);
console.log('2s later toast:',await p.textContent('#toastMsg'),'/',await p.textContent('#toastUndo'));
ok((await p.textContent('#toastUndo'))==='Recuperar','Recuperar still offered within its 8 s');
await ctx.close();await b.close();
})();
}
// ---- mensaje compartido largo ----
{
const msgs=[
 ['Hola, te escribo por el tema del cable que pidió el cliente la semana pasada. Son 2.50 m de cable unipolar y 3 cajas de borneras para la obra.','Son 2.50 m'],
 ['Buen día, te reenvío el reclamo de Ferretería López por el pedido 4471. La transferencia la hicieron el 10 y todavía no figura en el sistema, fijate por favor.','La transferencia la hicieron el 10'],
 ['Por favor revisá la cotización para Construcciones del Sur. Saludos, Juan Pérez - Ventas - Tel 4512-3344 - Lun a Vie 9:00 a 18:00 hs de atención al público','Saludos'],
];
const b=await L.launch();
for(const [m,noteStart] of msgs){
  const ctx=await b.newContext({...L.devices['Galaxy S9+']});await ctx.route('https://api.github.com/**',r=>r.abort());
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto((await L.appUrl())+'?text='+encodeURIComponent(m));await p.waitForTimeout(500);
  const note=await p.evaluate(()=>document.getElementById('note').value);
  ok(note.startsWith(noteStart),'long share: the rest goes to the note ('+note.slice(0,40)+')');
  await p.evaluate(()=>document.getElementById('addBtn').click());await p.waitForTimeout(300);
  const t=await p.evaluate(()=>tasks.map(t=>({time:t.time||null,inbox:!!t.inbox,due:t.due})));
  ok(t.length===1&&!t[0].time&&t[0].inbox&&t[0].due==='2026-10-14','long share: no made-up time or date, stays in the inbox '+JSON.stringify(t));
  ok(errs.length===0,'no errors '+errs);
  await ctx.close();
}
await b.close();
}
console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
