// Fase 6: notas (kind:'nota'): sin fecha ni aviso, fuera de Hoy, Procesar, la revisión y el resumen; "nota:"/"idea:" o el
// botón Nota; sección plegada; ⋯ Convertir en tarea / Pasar a notas; "+ Detalle"
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
let APP;
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const DESK={viewport:{width:1100,height:900}};
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}))}};
const FAKE=()=>{class FakeSR{start(){window.__rec=this;const say=window.__say||[];say.forEach((txt,i)=>setTimeout(()=>{const r=[[{transcript:txt}]];r[0].isFinal=i===say.length-1;this.onresult&&this.onresult({results:r})},60+i*80));setTimeout(()=>this.onend&&this.onend(),120+say.length*80)}
  stop(){setTimeout(()=>this.onend&&this.onend(),10)} abort(){setTimeout(()=>this.onend&&this.onend(),10)}}window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR};
const row=(p,t)=>p.locator('.task').filter({has:p.locator('.ttext',{hasText:t})}).first();
const byT=(gh,t)=>gh.items.find(x=>x.title===t);
(async()=>{
const b=await L.launch();APP=await L.appUrl();
const items=()=>[T('a','Llamar al banco',{due:day(0)}),T('b','Pagar la luz',{due:day(1)}),T('n1','Código del portón 4821',{kind:'nota',createdAt:L.ago(2)})];
let gh=makeGH(items());

// ===== Alta: "nota:", "idea:" y el botón Nota =====
let {ctx,p}=await device(b,gh,DESK,APP,SEEN);
ok(await p.textContent('#noteToggle')==='+ Detalle'&&await p.getAttribute('#note','placeholder')==='Detalle (opcional)','"+ Nota" is now "+ Detalle"');
ok(await p.locator('.gfold[data-g="notes"]').getAttribute('aria-expanded')==='false'&&/Notas\s*1/.test(await p.locator('#notesSec .ghead').textContent())&&!(await row(p,'Código del portón').count()),'notes section starts folded, with its count');
ok(!/Código/.test(await p.textContent('#groups'))&&/1 para hoy/.test(await p.textContent('#summary')),'a note is not in the groups nor in the header summary');
await p.fill('#title','nota: reunión el viernes a las 10 con @Laura !alta');await sleep(150);
ok(/Nota: sin fecha ni aviso/.test(await p.innerText('#detected'))&&!/Vie|10:00|@Laura|Alta/i.test(await p.innerText('#detected'))&&await p.getAttribute('#noteChip','aria-pressed')==='true','"nota:" → Detectado says note; no date, time, person or priority detected');
await p.press('#title','Enter');await sleep(400);
let n=byT(gh,'reunión el viernes a las 10 con @Laura !alta');
ok(n&&n.kind==='nota'&&n.due==null&&!n.time&&!n.inbox&&!n.requester&&n.priority==='Media','saved as a note, text untouched, no date/time/inbox: '+JSON.stringify(n&&{k:n.kind,d:n.due,t:n.time,i:n.inbox}));
ok(/Nota guardada/.test(await p.innerText('#toastMsg'))&&await p.innerText('#toastB2')==='Ver','toast "Nota guardada · Ver"');
await p.click('#toastB2');await sleep(400);
ok(await p.locator('.gfold[data-g="notes"]').getAttribute('aria-expanded')==='true'&&await row(p,'reunión el viernes').count()===1,'"Ver" opens the notes and shows it');
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('notasAbiertas')))===true,'notes open is remembered');
await p.fill('#title','Idea : probar el horno nuevo');await p.press('#title','Enter');await sleep(300);
ok(byT(gh,'probar el horno nuevo')?.kind==='nota','"Idea :" works too (case and spaces)');
// El botón Nota
await p.click('#noteChip');await p.fill('#title','Talle de zapatillas 42');await sleep(100);
ok(await p.getAttribute('#noteChip','aria-pressed')==='true'&&await p.evaluate(()=>!document.querySelector('#chips .chip.on')),'Nota button on, no date chip highlighted');
await p.reload();await sleep(700);
ok(await p.inputValue('#title')==='Talle de zapatillas 42'&&await p.getAttribute('#noteChip','aria-pressed')==='true','draft keeps the Nota button');
await p.press('#title','Enter');await sleep(300);
ok(byT(gh,'Talle de zapatillas 42')?.kind==='nota'&&await p.getAttribute('#noteChip','aria-pressed')==='false','saved as a note; the button goes back off');
await p.click('#noteChip');await p.click('#chips .chip[data-v="1"]');await p.fill('#title','Comprar pilas');await p.press('#title','Enter');await sleep(300);
ok(byT(gh,'Comprar pilas')?.kind!=='nota'&&byT(gh,'Comprar pilas')?.due===day(1),'a date chip turns Nota off: a normal task for tomorrow');
await p.fill('#title','nota:');await p.press('#title','Enter');await sleep(200);
ok(!gh.items.some(x=>x.title===''||x.title==='nota:'),'"nota:" alone adds nothing');
await p.fill('#title','');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Convertir: nota ↔ tarea (⋯, Editar, Procesar) =====
gh.items=items().concat([T('r','Regar plantas',{due:day(0),time:'18:00',repeat:'weekly',priority:'Alta',requester:'Ana'}),T('i','Anotado en el pasillo',{due:day(0),inbox:true,createdAt:L.ago(0)})]);gh.sha++;
({ctx,p}=await device(b,gh,DESK,APP,()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas','{"gestos":1,"punto":1}');localStorage.setItem('notasAbiertas','true')}}));
await row(p,'Código del portón').locator('.more').click();await sleep(150);
const mt=await p.innerText('#menu');
ok(/Convertir en tarea/.test(mt)&&/Editar/.test(mt)&&/Borrar/.test(mt)&&!/Para mañana|Esperando|calendario/.test(mt),'note menu: Convertir en tarea, Editar, Borrar (no dates)');
await p.locator('#menu button',{hasText:'Convertir en tarea'}).click();await sleep(400);
let c=gh.items.find(x=>x.id==='n1');
ok(c.kind!=='nota'&&c.due===day(0)&&c.inbox===true,'converted: a task for today, marked "anotada al pasar"');
ok(/Ahora es una tarea/.test(await p.innerText('#toastMsg'))&&await row(p,'Código del portón').evaluate(r=>!!r.closest('#groups')&&!!r.querySelector('.inboxdot')),'shows in Hoy with the blue dot');
await p.click('#toastUndo');await sleep(400);
c=gh.items.find(x=>x.id==='n1');
ok(c.kind==='nota'&&c.due==null&&!c.inbox&&await row(p,'Código del portón').evaluate(r=>!!r.closest('#notesSec')),'Undo: back to a note');
await row(p,'Regar plantas').locator('.more').click();await sleep(150);
await p.locator('#menu button',{hasText:'Pasar a notas'}).click();await sleep(400);
c=gh.items.find(x=>x.id==='r');
ok(c.kind==='nota'&&c.due==null&&c.time==null&&c.repeat==null&&c.priority==='Alta'&&c.requester==='Ana','task → note: date, time and repeat cleared (priority and person kept)');
ok(await row(p,'Regar plantas').evaluate(r=>!!r.closest('#notesSec')),'now in Notas');
await p.click('#toastUndo');await sleep(400);
c=gh.items.find(x=>x.id==='r');
ok(c.kind!=='nota'&&c.due===day(0)&&c.time==='18:00'&&c.repeat==='weekly','Undo restores date, time and repeat');
// Editar una nota
await row(p,'Código del portón').locator('.body').click();await sleep(200);
const ed=await p.evaluate(()=>({h:document.getElementById('editH').textContent,hidden:[...document.querySelectorAll('#editForm .taskonly')].every(e=>getComputedStyle(e).display==='none'),row:!document.getElementById('eNoteRow').classList.contains('hidden'),lbl:document.getElementById('eNotes').closest('label').textContent.trim()}));
ok(ed.h==='Nota'&&ed.hidden&&ed.row&&/^Detalle/.test(ed.lbl),'editing a note: no date, priority, repeat or person; "Convertir en tarea" offered '+JSON.stringify(ed));
await p.fill('#eTitle','Código del portón 4822');await p.fill('#eNotes','cambió en octubre');await p.click('#eSave');await sleep(400);
c=gh.items.find(x=>x.id==='n1');
ok(c.title==='Código del portón 4822'&&c.notes==='cambió en octubre'&&c.kind==='nota'&&c.due==null&&!c.time,'saved; still a note with no date or time');
await row(p,'Código del portón').locator('.body').click();await sleep(200);
await p.fill('#eNotes','cambió en octubre, el nuevo');await p.click('#eToTask');await sleep(400);
c=gh.items.find(x=>x.id==='n1');
ok(c.kind!=='nota'&&c.due===day(0)&&c.notes==='cambió en octubre, el nuevo'&&!(await p.isVisible('#editOv')),'"Convertir en tarea" from Editar keeps the edit and converts');
// Procesar: N pasa a notas
await p.evaluate(()=>{hideToast();document.activeElement.blur()});await p.keyboard.press('p');await sleep(200);
const first=await p.textContent('#procCard .pt');
ok(/Nota/.test(await p.innerText('#procBtns')),'Procesar offers N · Nota');
await p.keyboard.press('n');await sleep(400);
ok(gh.items.find(x=>x.title===first)?.kind==='nota','N in Procesar turns "'+first+'" into a note');
await p.keyboard.press('Escape');await sleep(200);
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Fuera de todo lo que cuenta pendientes =====
gh.items=[T('a','Tarea sin fecha'),T('n1','Nota vieja sin fecha',{kind:'nota',createdAt:L.ago(60)}),T('n2','Nota con fecha rara',{kind:'nota',due:day(-1),time:'09:00'})];gh.sha++;
({ctx,p}=await device(b,gh,DESK,APP,SEEN));
const ex=await p.evaluate(()=>({proc:procQueue(false).length,week:procQueue(true).map(id=>tasks.concat(notes).find(t=>t.id===id).title),groups:document.getElementById('groups').textContent+document.getElementById('side').textContent,sum:document.getElementById('summary').textContent,soon:typeof unsentSoon==='function'?!!unsentSoon():false}));
ok(ex.proc===0&&ex.week.length===1&&ex.week[0]==='Tarea sin fecha','Procesar and the weekly review leave notes out '+JSON.stringify(ex.week));
ok(!/Nota/.test(ex.groups)&&/1 pendiente/.test(ex.sum),'notes are not in Vencidas/Sin fecha nor in the summary, even with a stale date: '+ex.sum);
// Buscar
await p.click('#searchBtn');await p.fill('#search','porton');await sleep(150);
await p.fill('#search','nota vieja');await sleep(150);
ok(await row(p,'Nota vieja sin fecha').count()===1&&/Hay 1 nota más abajo/.test(await p.textContent('#empty')),'search finds notes (folded section opens) and says so when only notes match');
await p.click('#searchClose');await sleep(150);
ok(!(await row(p,'Nota vieja sin fecha').count()),'closing the search folds them back');
// Papelera
await p.evaluate(()=>setFold('notes',false));await p.evaluate(()=>renderList());
await row(p,'Nota vieja sin fecha').locator('.more').click();await p.locator('#menu button',{hasText:'Borrar'}).click();await sleep(400);
ok(gh.items.find(x=>x.id==='n1').deletedAt,'a note goes to the trash');
await p.click('#trashToggle');await p.locator('#trashList .trow',{hasText:'Nota vieja'}).locator('button').click();await sleep(400);
ok(!gh.items.find(x=>x.id==='n1').deletedAt&&/Nota recuperada/.test(await p.innerText('#toastMsg')),'and comes back: "Nota recuperada"');
// Teclado: sobre una nota, E edita y Espacio no hace nada
await p.evaluate(()=>{hideToast();document.activeElement.blur();sel=null;renderList()});
for(let k=0;k<6&&await p.evaluate(()=>!notes.some(n=>n.id===sel));k++)await p.keyboard.press('ArrowDown');
const selId=await p.evaluate(()=>sel);
await p.keyboard.press(' ');await sleep(300);
ok(selId&&!gh.items.find(x=>x.id===selId).done,'Space on a selected note does nothing');
await p.keyboard.press('e');await sleep(200);
ok(await p.isVisible('#editOv')&&await p.textContent('#editH')==='Nota','E opens the selected note');
await p.keyboard.press('Escape');await sleep(150);
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Lista pegada, dictado, filtro por persona, llegadas, bienvenida =====
gh.items=items();gh.sha++;
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await p.addInitScript(FAKE);await p.reload();await sleep(700);
await p.locator('#title').tap();
await p.evaluate(()=>{const dt=new DataTransfer();dt.setData('text','nota: wifi casa clave123\nComprar yerba mañana\nidea: viaje a Mendoza');document.getElementById('title').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))});await sleep(200);
ok(/notas/.test(await p.textContent('#bulkHint')),'pasted list: the hint explains "nota:"/"idea:"');
await p.locator('#bulkOk').tap();await sleep(400);
ok(byT(gh,'wifi casa clave123')?.kind==='nota'&&byT(gh,'viaje a Mendoza')?.kind==='nota'&&byT(gh,'Comprar yerba')?.kind!=='nota'&&byT(gh,'Comprar yerba')?.due===day(1),'pasted list: "nota:"/"idea:" lines become notes, the rest tasks');
ok(/1 tarea y 2 notas agregadas/.test(await p.innerText('#toastMsg')),'toast counts both: '+await p.innerText('#toastMsg'));
// Dictar con el botón Nota
await p.locator('#title').tap();await p.locator('#noteChip').tap();await p.evaluate(()=>document.activeElement.blur());
await p.evaluate(()=>{window.__say=['la llave está en la maceta']});
await p.locator('#addBtn').tap();
ok(await L.until(()=>p.evaluate(()=>!!autoSave)),'dictation with Nota on: countdown');
await p.locator('#addBtn').tap();
ok(await L.until(()=>byT(gh,'La llave está en la maceta')?.kind==='nota'),'dictated note saved (capitalized like dictated tasks)');
// Filtro por persona: sin notas
await p.evaluate(()=>{setFold('notes',false);setPersonFilter('Laura')});await sleep(150);
ok(!(await p.locator('#notesSec .task').count()),'person filter hides notes');
await p.evaluate(()=>setPersonFilter(null));
// Lo que llega del otro dispositivo: una nota no se anuncia como "nueva"
gh.items.push(T('nn','Nota del celu',{kind:'nota',src:'cel'}));gh.sha++;
await p.evaluate(()=>{hideToast();sync()});await sleep(800);
ok(!/nueva/.test(await p.innerText('#toastMsg').catch(()=>''))&&await row(p,'Nota del celu').count()===1,'a note from the other device arrives without a "nueva" toast');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
({ctx,p}=await device(b,makeGH([T('n','Solo una nota',{kind:'nota'})]),PHONE,APP,()=>{localStorage.removeItem('githubTasksConfig');localStorage.setItem('tareasCache',JSON.stringify({items:[]}))}));
await p.evaluate(()=>{tasks=[];notes=[{id:'x',kind:'nota',title:'Local'}];renderList()});
ok(!(await p.isVisible('#welcome')),'unconfigured with only notes: no welcome card');
await ctx.close();

await b.close();
})().catch(e=>{console.log('FAIL exception '+(e&&e.stack||e));process.exit(1)});
