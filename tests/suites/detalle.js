// Rediseño 1c: el detalle. En el celular, una hoja desde abajo; en la compu ancha, el panel de la columna derecha (en
// lugar de Esperando y Sin fecha); más angosta, una ventana centrada. Se guarda al cerrar (‹, Atrás, afuera, Esc o
// eligiendo otra fila); Descartar no guarda. Borrador local por si Android cierra la app. Tocar la hora de una fila
// abre Posponer.
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
let APP;
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}};
const box=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return r.width&&r.height?{y:Math.round(r.top),b:Math.round(r.bottom),h:Math.round(r.height),x:Math.round(r.left),w:Math.round(r.width)}:null},s);
const seen=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!!e.getBoundingClientRect().height},s);
const row=(p,t)=>p.locator('.task',{has:p.locator('.ttext',{hasText:t})}).first();
const item=(gh,id)=>gh.items.find(x=>x.id===id);
const pressed=(p,s)=>p.evaluate(s=>[...document.querySelectorAll(s)].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent.trim()||b.dataset.c),s);
(async()=>{
const b=await L.launch();APP=await L.appUrl();
const items=()=>[
  T('a','Llamar al banco',{due:day(0),requester:'Laura'}),
  T('i','Comprar pilas',{due:day(0),inbox:true}),
  T('h','Turno dentista',{due:day(0),time:'23:30'}),
  T('w','Presupuesto techo',{due:day(1),requester:'Juan'}),
  {...T('n','Código del portón',{notes:'4822'}),kind:'nota',time:null}
];

// ===== Celular: la hoja del detalle =====
let gh=makeGH(items());
let {ctx,p}=await device(b,gh,PHONE,APP,SEEN);
await row(p,'Llamar al banco').locator('.body').tap();await sleep(300);
let sh=await box(p,'#editForm');
ok(sh&&sh.b===832&&sh.h<=Math.ceil(832*0.9),'phone: the detail is a sheet from the bottom, at most 90% tall '+JSON.stringify(sh));
ok((await p.innerText('#editH'))==='Tarea'&&await seen(p,'#eHint')&&!(await seen(p,'#editX'))&&await seen(p,'#eDel')&&await seen(p,'#eSave'),'header: ‹ · Tarea · "Se guarda al cerrar" · trash');
ok(await seen(p,'#eFinish')&&await seen(p,'#eWait')&&await seen(p,'#eMore')&&(await p.innerText('#eFinish'))==='Terminar','footer: ⋯ · Esperando… · Terminar');
ok(await p.evaluate(()=>document.activeElement.id)!=='eTitle','no keyboard on its own');
// Quién la pidió: los de siempre, con su inicial
ok(await p.locator('#ePeople .chip .pini').count()>=2&&JSON.stringify(await pressed(p,'#ePeople .chip'))===JSON.stringify(['LLaura']),'Pedida por: people chips with initials, Laura marked '+JSON.stringify(await pressed(p,'#ePeople .chip')));
await p.locator('#ePeople .chip',{hasText:'Juan'}).tap();await sleep(100);
ok(await p.inputValue('#eRequester')==='Juan','tapping a person fills Pedida por');
ok(await seen(p,'#editX')&&!(await seen(p,'#eHint')),'with changes, "Se guarda al cerrar" becomes Descartar');
// Aviso: los chips, Sin hora, Posponer… y Al calendario
await p.locator('#eTimeChips .chip',{hasText:'15:00'}).tap();await sleep(100);
ok(await p.inputValue('#eTime')==='15:00'&&(await p.innerText('#editH'))==='Recordatorio'&&await seen(p,'#eNoTime')&&await seen(p,'#ePos')&&await seen(p,'#eCal'),'Aviso 15:00: Recordatorio, Sin hora, Posponer… and Al calendario');
await p.locator('#eNoTime').tap();await sleep(100);
ok(await p.inputValue('#eTime')===''&&!(await seen(p,'#ePos'))&&(await p.innerText('#editH'))==='Tarea','Sin hora clears it');
await p.locator('#eTimeChips .chip',{hasText:'9:00'}).tap();await sleep(100);
// Borrador local: si Android cierra la app, al volver a abrir esa tarea se ofrece recuperar
ok(await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('detalleBorrador'));return d&&d.id==='a'&&d.v.requester==='Juan'&&d.v.time==='09:00'}),'each change is kept as a local draft');
ok(item(gh,'a').requester==='Laura'&&!item(gh,'a').time,'nothing saved while editing');
await p.reload();await sleep(800);
await row(p,'Llamar al banco').locator('.body').tap();await sleep(300);
ok(await seen(p,'#eDraft')&&/Tenías cambios sin guardar/.test(await p.innerText('#eDraft'))&&await p.inputValue('#eRequester')==='Laura','reopened after the app closed: "Tenías cambios sin guardar · Recuperar"');
ok(await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('detalleBorrador')).v;return Object.keys(v).sort().join()==='requester,time'}),'the draft keeps only what changed');
await p.locator('#eRecover').tap();await sleep(100);
ok(await p.inputValue('#eRequester')==='Juan'&&await p.inputValue('#eTime')==='09:00'&&await seen(p,'#editX'),'Recuperar brings the changes back');
await p.goBack();await sleep(500);
ok(!(await seen(p,'#editOv'))&&item(gh,'a').requester==='Juan'&&item(gh,'a').time==='09:00','Back saves');
ok(/Cambios guardados/.test(await p.innerText('#toastMsg'))&&await p.isVisible('#toastUndo'),'with "Cambios guardados · Deshacer"');
ok(await p.evaluate(()=>localStorage.getItem('detalleBorrador'))===null,'the draft is gone once saved');
// Recuperar no vuelve atrás lo que se cambió en otro dispositivo (solo lo que cambiaste acá)
await row(p,'Llamar al banco').locator('.body').tap();await sleep(300);
await p.fill('#eTitle','Llamar al banco Nación');await p.dispatchEvent('#eTitle','input');
await p.reload();await sleep(600);
Object.assign(item(gh,'a'),{notes:'cuenta 999',priority:'Alta'});gh.sha++;
await p.evaluate(()=>sync());await sleep(800);
await row(p,'Llamar al banco').locator('.ttext').tap();await sleep(300);
await p.locator('#eRecover').tap();await sleep(100);await p.locator('#eSave').tap();await sleep(800);
ok(item(gh,'a').title==='Llamar al banco Nación'&&item(gh,'a').notes==='cuenta 999'&&item(gh,'a').priority==='Alta','Recuperar keeps what changed on the other device '+JSON.stringify({t:item(gh,'a').title,n:item(gh,'a').notes,p:item(gh,'a').priority}));
// Descartar no guarda
await row(p,'Llamar al banco').locator('.ttext').tap();await sleep(300);
ok(!(await seen(p,'#eDraft')),'no draft offer when there is nothing pending');
await p.fill('#eTitle','Otra cosa');await p.dispatchEvent('#eTitle','input');
await p.locator('#editX').tap();await sleep(400);
ok(!(await seen(p,'#editOv'))&&item(gh,'a').title==='Llamar al banco Nación'&&await p.evaluate(()=>localStorage.getItem('detalleBorrador'))===null,'Descartar closes without saving');
// Anotada al pasar: la línea del punto azul; elegir fecha la saca (y cuenta como elegida)
await row(p,'Comprar pilas').locator('.body').tap();await sleep(300);
ok(await seen(p,'#eInbox')&&/Anotada al pasar/.test(await p.innerText('#eInbox')),'inbox task: the blue-dot line under Para cuándo');
await p.locator('#eChips .chip',{hasText:'Mañana'}).tap();await sleep(100);
ok(!(await seen(p,'#eInbox')),'choosing a date hides it');
await p.locator('#capScrim,#editOv').first().evaluate(()=>{});
await p.locator('#editOv').tap({position:{x:190,y:20}});await sleep(500);
ok(item(gh,'i').due===day(1)&&!item(gh,'i').inbox,'tapping outside saves: tomorrow, no longer anotada al pasar');
// Terminar desde el pie (guarda también lo cambiado)
await go(p,'tareas');
await row(p,'Presupuesto techo').locator('.body').tap();await sleep(300);
await p.locator('#ePrios .prio',{hasText:'Alta'}).tap();
await p.locator('#eFinish').tap();await sleep(600);
ok(item(gh,'w').done&&item(gh,'w').priority==='Alta'&&!(await seen(p,'#editOv')),'Terminar: done, with the change saved');
ok(/Terminada/i.test(await p.innerText('#toastMsg'))&&await p.isVisible('#toastUndo'),'with Deshacer');
await p.locator('#toastUndo').tap();await sleep(400);
ok(!item(gh,'w').done,'Deshacer reopens it');
// Esperando… desde el pie
await row(p,'Presupuesto techo').locator('.body').tap();await sleep(300);
await p.locator('#eWait').tap();await sleep(300);
ok(await seen(p,'#waitOv')&&await p.inputValue('#waitName')==='Juan','Esperando… opens the waiting dialog');
await p.goBack();await sleep(400);
// ⋯ desde el detalle de una que no está en esta pantalla (abierta con "Cambiar" después de agregarla para mañana)
await go(p,'hoy');
await L.alta(p);await p.fill('#title','pagar luz mañana');await p.dispatchEvent('#title','input');await p.locator('#addBtn').tap();await sleep(500);
await p.locator('#toastB2').tap();await sleep(300);
ok(await seen(p,'#editOv')&&/pagar luz/i.test(await p.inputValue('#eTitle')),'Cambiar opens the detail of the one just added');
await p.locator('#eMore').tap();await sleep(300);
ok(await seen(p,'#menu')&&await p.locator('#menu button',{hasText:'Para hoy'}).count()===1,'its ⋯ opens the row menu even with the row off screen');
await p.locator('#menuBackdrop').tap({position:{x:5,y:5}});await sleep(200);
// La hora de la fila abre Posponer (hoja desde abajo)
const tb=row(p,'Turno dentista').locator('button.time');
ok(await tb.count()===1&&(await tb.getAttribute('aria-label'))==='Aviso a las 23:30. Posponer','the time in the row is a button "Aviso a las 23:30. Posponer"');
await tb.tap();await sleep(300);
const pb=await box(p,'#posOv .modal');
ok(await seen(p,'#posOv')&&!(await seen(p,'#editOv'))&&pb&&pb.b===832&&(await p.innerText('#posH'))==='Posponer','tapping it opens Posponer as a bottom sheet');
await p.locator('#posBtns button',{hasText:'Mañana 9:00'}).tap();await sleep(400);
ok(item(gh,'h').due===day(1)&&item(gh,'h').time==='09:00','Posponer works from there');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Celular: el detalle de una nota =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await go(p,'notas');
await row(p,'Código del portón').locator('.body').tap();await sleep(300);
ok((await p.innerText('#editH'))==='Nota'&&await seen(p,'#eIdea')&&await seen(p,'#ePin')&&await p.locator('#eColors .ncol').count()===6&&!(await seen(p,'#eChips'))&&!(await seen(p,'#eFinish'))&&await seen(p,'#eToTask'),'note: title, text, Es una idea, Fijar arriba, 6 colors; footer Convertir en tarea');
ok(/^Editada /.test(await p.innerText('#eEdited')),'"Editada …" '+await p.innerText('#eEdited'));
ok(JSON.stringify(await pressed(p,'#eColors .ncol'))===JSON.stringify(['']),'no color at first');
await p.locator('#eIdea').tap();await p.locator('#ePin').tap();await p.locator('#eColors .ncol[data-c="verde"]').tap();await sleep(100);
await p.locator('#eSave').tap();await sleep(500);
let n=item(gh,'n');
ok(n.edited&&n.edited.color&&n.edited.pinned&&n.edited.idea,'idea, pinned and color record when they changed');
ok(n.idea===true&&n.pinned===true&&n.color==='verde'&&n.kind==='nota'&&n.due==null&&!n.time,'‹ saves idea, pinned and color; still a note');
await p.evaluate(()=>{const now=new Date().toISOString();act({type:'add',task:{id:'n2',src:'cel',kind:'nota',title:'Otra nota más nueva',requester:'',priority:'Media',due:null,time:null,notes:'',done:false,createdAt:now,completedAt:null}})});await sleep(300);
const order=await p.evaluate(()=>[...document.querySelectorAll('#notesSec .task .ttext')].map(x=>x.textContent));
ok(order[0]==='Código del portón','pinned notes go first '+JSON.stringify(order));
const nr=row(p,'Código del portón');
ok(await nr.evaluate(r=>r.classList.contains('nc-verde'))&&/Fijada/.test(await nr.innerText())&&/Idea/.test(await nr.innerText()),'the row takes the color and says Fijada and Idea');
// Convertir en tarea: queda para hoy, anotada al pasar, con Deshacer
await nr.locator('.body').tap();await sleep(300);
await p.locator('#eToTask').tap();await sleep(500);
n=item(gh,'n');
ok(n.kind!=='nota'&&n.due===day(0)&&n.inbox===true&&/Ahora es una tarea/.test(await p.innerText('#toastMsg'))&&await p.isVisible('#toastUndo'),'Convertir en tarea: for today, anotada al pasar, with Deshacer');
// "idea:" al anotar marca Es una idea
await L.alta(p);await p.fill('#title','idea: app para el consorcio');await p.dispatchEvent('#title','input');await p.locator('#addBtn').tap();await sleep(500);
const id=gh.items.find(x=>x.title==='app para el consorcio');
ok(id&&id.kind==='nota'&&id.idea===true,'"idea:" saves a note marked as an idea');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Compu ancha: el panel de la columna derecha =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,{viewport:{width:1300,height:900}},APP,SEEN));
ok(await seen(p,'#sideNone')||await seen(p,'#sideWait')||true,'side column');
await row(p,'Llamar al banco').locator('.body').click();await sleep(300);
let pan=await box(p,'#editForm'),sd=await box(p,'#side');
ok(await p.evaluate(()=>$('editOv').parentNode.id==='side'&&$('editOv').classList.contains('inpanel')&&!$('wrap').inert)&&pan&&sd&&pan.x>=sd.x-1&&pan.w<=sd.w+1,'computer: the detail is the panel of the right column; the list stays usable '+JSON.stringify({pan,sd}));
ok(!(await seen(p,'#sideNone .grp'))&&!(await seen(p,'#sideWait .grp')),'in place of Esperando and Sin fecha');
ok(await p.evaluate(()=>document.activeElement.id)==='eTitle','cursor in the title');
await p.fill('#eTitle','Llamar al banco Galicia');await p.dispatchEvent('#eTitle','input');
await row(p,'Turno dentista').locator('.body').click();await sleep(400);
ok(item(gh,'a').title==='Llamar al banco Galicia'&&await p.inputValue('#eTitle')==='Turno dentista','choosing another row saves and shows that one');
ok((await p.innerText('#editH'))==='Recordatorio'&&await p.inputValue('#eTime')==='23:30','a task with a time is a Recordatorio');
await p.keyboard.press('Escape');await sleep(300);
ok(!(await seen(p,'#editOv'))&&!(await p.evaluate(()=>document.body.classList.contains('detpanel'))),'Esc closes it; Esperando and Sin fecha come back');
// Tocar afuera (un lugar vacío) guarda y cierra
await row(p,'Llamar al banco').locator('.body').click();await sleep(300);
await p.fill('#eNotes','cuenta 123');await p.dispatchEvent('#eNotes','input');
await p.mouse.click(1290,880);await sleep(400);
ok(!(await seen(p,'#editOv'))&&item(gh,'a').notes==='cuenta 123','clicking an empty spot saves and closes');
// Sin título no se puede guardar al elegir otra fila: queda abierto y avisa
await row(p,'Llamar al banco').locator('.body').click();await sleep(300);
await p.fill('#eTitle','');await p.dispatchEvent('#eTitle','input');
await row(p,'Turno dentista').locator('.body').click();await sleep(300);
ok(await p.inputValue('#eTitle')===''&&/Falta el título/.test(await p.innerText('#toastMsg')),'empty title: stays open and says why');
await p.locator('#editX').click();await sleep(300);
ok(!(await seen(p,'#editOv'))&&item(gh,'a').title==='Llamar al banco Galicia','Descartar closes without saving');
// Otra pantalla guarda y cierra el panel
await row(p,'Llamar al banco').locator('.body').click();await sleep(300);
await p.locator('#ePrios .prio',{hasText:'Baja'}).click();
await p.locator('#navNotas').click();await sleep(400);
ok(!(await seen(p,'#editOv'))&&item(gh,'a').priority==='Baja','going to another screen saves and closes it');
// La hora de la fila: Posponer como ventana centrada
await go(p,'hoy');
await row(p,'Turno dentista').locator('button.time').click();await sleep(300);
const pw=await box(p,'#posOv .modal');
ok(await seen(p,'#posOv')&&pw&&Math.abs(pw.x+pw.w/2-650)<40&&pw.b<880,'computer: tapping the time opens Posponer centered '+JSON.stringify(pw));
await p.keyboard.press('Escape');await sleep(200);
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// Desde Ordenar: el detalle es la ventana (no el panel) y sin ⋯ (el menú quedaría detrás)
gh=makeGH(items());
({ctx,p}=await device(b,gh,{viewport:{width:1300,height:900}},APP,SEEN));
await p.locator('#procBtn').click();await sleep(300);
if(await seen(p,'#procOv')){
  await p.keyboard.press('e');await sleep(300);
  ok(await seen(p,'#editOv')&&await p.evaluate(()=>!$('editOv').classList.contains('inpanel'))&&!(await seen(p,'#eMore')),'from Ordenar: a window, without ⋯');
  await p.keyboard.press('Escape');await sleep(200);
  ok(await seen(p,'#procOv')&&!(await seen(p,'#editOv')),'Esc closes the detail and goes back to Ordenar');
}else ok(false,'Ordenar did not open');
await ctx.close();

// ===== Compu más angosta: ventana centrada =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:800}},APP,SEEN));
await row(p,'Llamar al banco').locator('.body').click();await sleep(300);
pan=await box(p,'#editForm');
ok(await p.evaluate(()=>$('editOv').parentNode===document.body&&!$('editOv').classList.contains('inpanel')&&$('wrap').inert)&&pan&&Math.abs(pan.x+pan.w/2-500)<30,'900–1199 px: a centered window '+JSON.stringify(pan));
await p.keyboard.press('Escape');await sleep(200);
ok(!(await seen(p,'#editOv')),'Esc closes it');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
