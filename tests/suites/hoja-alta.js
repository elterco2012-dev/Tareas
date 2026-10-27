// Rediseño 1b: la hoja para anotar. En el celular el "+" abre una hoja desde abajo (sin campo arriba) con "Entendí:",
// el tipo (Tarea · Recordatorio · Nota), "Para" sin nada marcado de entrada (la línea del punto azul) y, en
// Recordatorio, "Avisar". Agregar la cierra; Atrás, tocar afuera o Esc la cierran y lo escrito queda. En la compu el
// campo sigue arriba de la lista, con los mismos chips.
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
let APP;
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}};
const INIT=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}
  class FakeSR{start(){window.__rec=this;const say=window.__say||[];say.forEach((txt,i)=>setTimeout(()=>{const r=[[{transcript:txt}]];r[0].isFinal=i===say.length-1;this.onresult&&this.onresult({results:r})},60+i*80));setTimeout(()=>this.onend&&this.onend(),120+say.length*80)}
  stop(){setTimeout(()=>this.onend&&this.onend(),10)} abort(){setTimeout(()=>this.onend&&this.onend(),10)}}window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR};
const box=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return r.width&&r.height?{y:Math.round(r.top),b:Math.round(r.bottom),h:Math.round(r.height)}:null},s);
const pressed=p=>p.evaluate(()=>[...document.querySelectorAll('#addForm .chip[aria-pressed="true"]')].map(b=>b.textContent));
const seen=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!!e.getBoundingClientRect().height},s);
const type=async(p,v)=>{await p.fill('#title',v);await p.dispatchEvent('#title','input');await sleep(150)};
const byT=(gh,t)=>gh.items.find(x=>x.title.toLowerCase()===t.toLowerCase());
(async()=>{
const b=await L.launch();APP=await L.appUrl();
const items=()=>[T('o','Pagar el seguro',{due:day(-1),requester:'Laura'}),T('t','Revisar presupuesto',{due:day(0)})];

// ===== Celular: el "+" abre la hoja =====
let gh=makeGH(items());
let {ctx,p}=await device(b,gh,PHONE,APP,INIT);
ok(!(await seen(p,'#addForm')),'phone: no add field at the top of Hoy');
await go(p,'tareas');ok(!(await seen(p,'#addForm')),'phone: none on Tareas either');await go(p,'hoy');
await p.locator('#fabAdd').tap();await sleep(250);
const sh=await box(p,'#addForm');
ok(sh&&sh.b===832&&await seen(p,'#capScrim')&&await p.evaluate(()=>document.activeElement.id)==='title','+ opens the sheet from the bottom, ready to write '+JSON.stringify(sh));
ok(!(await seen(p,'#fabs')),'the + and the mic step aside while it is open');
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Tarea'])&&!(await seen(p,'#timeRow'))&&!(await seen(p,'#inboxLine')),'empty: Tarea, no date marked, no Avisar '+JSON.stringify(await pressed(p)));
await type(p,'llamar al banco');
ok(await seen(p,'#inboxLine')&&JSON.stringify(await pressed(p))===JSON.stringify(['Tarea']),'no date chosen: "Sin fecha elegida: queda en Hoy como anotada al pasar", Hoy not marked');
// Recordatorio: se adivina con "recordame" o una hora
await type(p,'recordame mañana llamar a Juan');
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Recordatorio','Mañana'])&&await seen(p,'#timeRow')&&!(await seen(p,'#inboxLine')),'"recordame mañana": Recordatorio, Mañana, Avisar shown (no hour chosen by hand) '+JSON.stringify(await pressed(p)));
ok(/Entendí:\s*Mañana\s*09:00/.test((await p.innerText('#detected')).replace(/\n/g,' ')),'"Entendí: Mañana 09:00" ('+(await p.innerText('#detected')).replace(/\n/g,' ')+')');
// Tarea a mano: sin hora ni aviso
await p.locator('#typeRow .chip',{hasText:'Tarea'}).tap();await sleep(150);
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Tarea','Mañana'])&&!(await seen(p,'#timeRow')),'Tarea by hand: no time, no Avisar');
await p.locator('#addBtn').tap();await sleep(300);
const t1=byT(gh,'Llamar a Juan');
ok(t1&&t1.due===day(1)&&!t1.time&&!t1.inbox,'saved as a task for tomorrow, without a time '+JSON.stringify(t1&&{due:t1.due,time:t1.time}));
ok(!(await seen(p,'#addForm'))&&!(await seen(p,'#capScrim'))&&await seen(p,'#fabs'),'adding closes the sheet');
ok(/Agregada para mañana/.test(await p.innerText('#toastMsg'))&&await p.isVisible('#toastUndo')&&(await p.innerText('#toastB2'))==='Cambiar','toast with Deshacer and Cambiar');
// Recordatorio con Avisar
await p.locator('#fabAdd').tap();await sleep(200);
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Tarea']),'reopened: from scratch');
await type(p,'turno dentista el viernes');
await p.locator('#typeRow .chip',{hasText:'Recordatorio'}).tap();await sleep(100);
await p.locator('#timeChips .chip',{hasText:'15:00'}).tap();await sleep(100);
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Recordatorio','15:00']),'Recordatorio + Avisar 15:00 (Viernes comes from the text) '+JSON.stringify(await pressed(p)));
await p.keyboard.press('Enter');await sleep(300);
const t2=gh.items.find(x=>/dentista/i.test(x.title));
ok(t2&&t2.time==='15:00'&&t2.due&&t2.due>day(0),'saved with the reminder at 15:00 '+JSON.stringify(t2&&{due:t2.due,time:t2.time}));
// Una hora escrita y otra elegida: manda la elegida
await p.locator('#fabAdd').tap();await sleep(200);
await type(p,'reunión a las 15');
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Recordatorio'])&&/15:00/.test(await p.innerText('#detected')),'a time in the text: Recordatorio, the time under "Entendí:", no Avisar chip lit');
// Avisar marca solo lo elegido: tocar 15:00 lo marca, tocarlo otra vez lo saca
const c15=p.locator('#timeChips .chip',{hasText:'15:00'});
await c15.tap();await sleep(100);const on1=JSON.stringify(await pressed(p));await c15.tap();await sleep(100);const on2=JSON.stringify(await pressed(p));
ok(on1===JSON.stringify(['Recordatorio','15:00'])&&on2===JSON.stringify(['Recordatorio']),'an Avisar chip lights only when chosen, and a second tap clears it '+on1+' '+on2);
await p.locator('#timeChips .chip',{hasText:'12:00'}).tap();await sleep(100);
await p.keyboard.press('Enter');await sleep(300);
ok(byT(gh,'Reunión')&&byT(gh,'Reunión').time==='12:00','the Avisar chip wins over the written time');
// Para: tocar la elegida la saca (queda anotada al pasar)
await p.locator('#fabAdd').tap();await sleep(200);
await type(p,'comprar pilas');
await p.locator('#chips .chip',{hasText:'Mañana'}).tap();await sleep(100);
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Tarea','Mañana'])&&!(await seen(p,'#inboxLine')),'Mañana chosen');
await p.locator('#chips .chip',{hasText:'Mañana'}).tap();await sleep(100);
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Tarea'])&&await seen(p,'#inboxLine'),'tapping it again: no date chosen again');
await p.keyboard.press('Enter');await sleep(300);
ok(byT(gh,'Comprar pilas')&&byT(gh,'Comprar pilas').inbox===true&&byT(gh,'Comprar pilas').due===day(0),'saved for today, anotada al pasar');
// Nota
await p.locator('#fabAdd').tap();await sleep(200);
await type(p,'el talle de Juan es 42');
await p.locator('#noteChip').tap();await sleep(100);
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Nota'])&&!(await seen(p,'#dueRow'))&&!(await seen(p,'#timeRow')),'Nota: no Para, no Avisar');
await p.keyboard.press('Enter');await sleep(300);
ok(byT(gh,'el talle de Juan es 42')&&byT(gh,'el talle de Juan es 42').kind==='nota','saved as a note, text as written');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Celular: cerrar sin agregar, Notas, Buscar, micrófono, ?nueva =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP,INIT));
await p.locator('#fabAdd').tap();await sleep(200);
await type(p,'algo a medio escribir');
await p.goBack();await sleep(400);
ok(!(await seen(p,'#addForm'))&&p.url().startsWith(APP)&&await p.evaluate(()=>document.body.dataset.screen)==='hoy','Back closes the sheet and stays on Hoy');
await p.locator('#fabAdd').tap();await sleep(200);
ok(await p.inputValue('#title')==='algo a medio escribir','what you were writing is still there');
await p.locator('#capScrim').tap({position:{x:150,y:120}});await sleep(250);
ok(!(await seen(p,'#addForm')),'tapping outside closes it');
await p.locator('#fabAdd').tap();await sleep(200);await p.fill('#title','');await p.dispatchEvent('#title','input');
await p.locator('#typeRow .chip',{hasText:'Recordatorio'}).tap();await sleep(100);
await p.goBack();await sleep(400);await p.locator('#fabAdd').tap();await sleep(200);
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Tarea']),'closed empty: the next time starts from scratch');
await p.goBack();await sleep(400);
await go(p,'notas');await p.locator('#fabAdd').tap();await sleep(200);
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Nota'])&&await p.getAttribute('#title','placeholder')==='Escribí una nota…','on Notas the sheet starts as a note');
await p.goBack();await sleep(400);
await go(p,'buscar');await p.evaluate(()=>document.activeElement.blur());await sleep(150);
await p.locator('#fabAdd').tap();await sleep(300);
ok(await p.evaluate(()=>document.body.dataset.screen)==='hoy'&&await seen(p,'#addForm'),'+ on Buscar: Hoy, with the sheet open');
await p.goBack();await sleep(400);
// El micrófono abre la hoja y escucha
await p.evaluate(()=>{window.__say=['comprar yerba mañana']});
await p.locator('#fabMic').tap();
ok(await L.until(()=>seen(p,'#addForm')),'the mic opens the sheet');
ok(await L.until(()=>byT(gh,'Comprar yerba'),{timeout:8000})&&byT(gh,'Comprar yerba').due===day(1),'dictated and saved by itself');
ok(await L.until(async()=>!(await seen(p,'#addForm'))),'and the sheet closes');
// Dictado y cerrar antes de que se guarde solo: queda como borrador
await p.evaluate(()=>{window.__say=['comprar pan']});
await p.locator('#fabMic').tap();
ok(await L.until(()=>p.evaluate(()=>$('addBtn').dataset.mode==='saving')),'dictated: counting down to save');
await p.locator('#capScrim').tap({position:{x:150,y:100}});await sleep(3800);
ok(!byT(gh,'Comprar pan')&&await p.inputValue('#title')==='comprar pan','tapping outside during the countdown: not saved, kept as a draft');
// Con la hoja abierta los avisos van arriba (no tapan los chips)
await p.locator('#fabMic').tap();await sleep(300);
const tb=await box(p,'#toast'),ty=await box(p,'#typeRow');
ok(tb&&ty&&tb.b<=ty.y,'with the sheet open, a toast sits above the chips '+JSON.stringify({tb,ty}));
await p.fill('#title','');await p.dispatchEvent('#title','input');
// Varias líneas pegadas en la hoja: se agregan, la hoja se cierra y no queda nada elegido
await p.locator('#typeRow .chip',{hasText:'Recordatorio'}).tap();await p.locator('#timeChips .chip',{hasText:'18:00'}).tap();await sleep(100);
await p.evaluate(()=>{const dt=new DataTransfer();dt.setData('text/plain','lavar el auto\npagar la luz');$('title').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))});await sleep(300);
ok(await seen(p,'#bulkOv'),'several lines: the load-one-per-line dialog');await p.locator('#bulkOk').tap();await sleep(400);
ok(byT(gh,'Lavar el auto')&&byT(gh,'Pagar la luz')&&!(await seen(p,'#addForm')),'several lines: added, and the sheet closes');
await p.locator('#fabAdd').tap();await sleep(200);
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Tarea']),'and nothing chosen is left over '+JSON.stringify(await pressed(p)));
// Compartido con la app abierta: no hereda lo elegido para el borrador de antes
await type(p,'algo');await p.locator('#typeRow .chip',{hasText:'Tarea'}).tap();await p.locator('#chips .chip',{hasText:'Lunes'}).tap();await sleep(100);
await p.locator('#capScrim').tap({position:{x:150,y:100}});await sleep(250);
await p.evaluate(()=>handleLaunch(new URLSearchParams('share=1&text='+encodeURIComponent('Llamar a Juan mañana a las 15')),false));await sleep(300);
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Recordatorio','Mañana']),'shared text: its own type and date, nothing carried over '+JSON.stringify(await pressed(p)));
await p.locator('#addBtn').tap();await sleep(400);
ok(byT(gh,'Llamar a Juan')&&byT(gh,'Llamar a Juan').time==='15:00'&&byT(gh,'Llamar a Juan').due===day(1),'saved for tomorrow at 15:00 '+JSON.stringify(byT(gh,'Llamar a Juan')));
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
gh=makeGH(items());
({ctx,p}=await device(b,gh,PHONE,APP+'?nueva=1',INIT));
ok(await seen(p,'#addForm')&&await p.evaluate(()=>document.activeElement.id)==='title','?nueva=1: the sheet open, ready to write');
await ctx.close();

// ===== Compu: el campo arriba, con los mismos chips =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,{viewport:{width:1000,height:800}},APP,SEEN));
ok(await seen(p,'#addForm')&&await seen(p,'#typeRow')&&await seen(p,'#dueRow')&&!(await seen(p,'#capScrim')),'computer: the field above the list, chips in view');
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Tarea']),'computer: no date marked at first');
await p.click('#title');await type(p,'reunión a las 15');
ok(JSON.stringify(await pressed(p))===JSON.stringify(['Recordatorio'])&&/15:00/.test(await p.innerText('#detected')),'computer: a time → Recordatorio, 15:00 understood');
await p.keyboard.press('Enter');await sleep(300);
ok(byT(gh,'Reunión')&&byT(gh,'Reunión').time==='15:00'&&await p.evaluate(()=>document.activeElement.id)==='title','saved; the cursor stays in the field for the next one');
// Recordatorio sin hora para hoy, ya pasadas las 9: sin hora (la regla de "recordame")
await type(p,'llamar a Ana');await p.click('#typeRow .chip:has-text("Recordatorio")');await sleep(100);
ok(!(await p.evaluate(()=>[...document.querySelectorAll('#timeChips .chip')].some(b=>b.getAttribute('aria-pressed')==='true'))),'Recordatorio for today after 9 without a time: no time marked');
await p.press('#title','Enter');await sleep(300);
ok(byT(gh,'Llamar a Ana')&&!byT(gh,'Llamar a Ana').time,'saved without a time (the 9:00 aviso already passed)');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
