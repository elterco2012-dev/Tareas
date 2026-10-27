// Fase 5: el celular a una mano (barra de abajo, sin teclado al abrir, encabezado y alta compactos, grupos que se
// pliegan, menú ⋯ como hoja, pista de la primera vez y bienvenida sin conectar)
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
let APP;
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const DESK={viewport:{width:1100,height:900}};
const FAKE=()=>{class FakeSR{start(){window.__rec=this;const say=window.__say||[];say.forEach((txt,i)=>setTimeout(()=>{const r=[[{transcript:txt}]];r[0].isFinal=i===say.length-1;this.onresult&&this.onresult({results:r})},60+i*80));if(!window.__hold)setTimeout(()=>this.onend&&this.onend(),120+say.length*80)}
  stop(){setTimeout(()=>this.onend&&this.onend(),10)} abort(){setTimeout(()=>this.onend&&this.onend(),10)}}window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR};
const STANDALONE=()=>{const mm=window.matchMedia.bind(window);window.matchMedia=q=>/display-mode:\s*standalone/.test(q)?{matches:true,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}:mm(q)};
// Sin la pista de la primera vez (salvo en las pruebas de la pista)
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}))}};
const row=(p,t)=>p.locator('.task').filter({has:p.locator('.ttext',{hasText:t})}).first();
const vis=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'},s);
const active=p=>p.evaluate(()=>document.activeElement&&document.activeElement.id);
(async()=>{
const b=await L.launch();APP=await L.appUrl();
const items=()=>[T('a','Llamar al banco',{due:day(-1),priority:'Alta'}),T('b','Mandar remitos',{due:day(0),time:'10:30'}),T('c','Revisar stock',{due:day(0)}),
  T('d','Pagar la luz',{due:day(1)}),T('e','Comprar cartuchos'),T('w','Respuesta de Juan',{waiting:true,waitingOn:'Juan',waitingSince:L.ago(1)})];
let gh=makeGH(items());

// ===== Encabezado y alta compactos =====
let {ctx,p}=await device(b,gh,PHONE,APP,SEEN);
const hd=await p.evaluate(()=>({h:Math.round(document.querySelector('.top').getBoundingClientRect().height),short:getComputedStyle(document.querySelector('.dshort')).display,long:getComputedStyle(document.querySelector('.dlong')).display,
  h1:document.querySelector('.top h1').textContent,h1w:document.querySelector('.top h1').getBoundingClientRect().width,txt:document.querySelector('#todayLabel .dshort').textContent}));
ok(hd.short!=='none'&&hd.long==='none'&&hd.txt==='Mié 14/10','phone: short date "Mié 14/10" '+JSON.stringify(hd));
ok(hd.h<=56&&hd.h1==='Hoy'&&hd.h1w<=1,'phone: header on one line, title only for screen readers '+JSON.stringify(hd));
// En el celular no hay campo arriba: se anota en la hoja que abre el "+" (rediseño 1b; el alta "en reposo" de la fase 5
// ya no existe, y con ella las pruebas de las fechas que se pliegan bajo el campo)
ok(!(await vis(p,'#addForm'))&&await vis(p,'#fabAdd'),'phone: no add field at the top, the + at the bottom');
ok(await active(p)!=='title','phone browser tab: opens without the keyboard');
await p.locator('#fabAdd').tap();await sleep(250);
ok(await vis(p,'#addForm .chiprow')&&await vis(p,'#chips .chip[data-v="1"]')&&await active(p)==='title','the + opens the sheet with the dates, ready to write');
await p.locator('#chips .chip[data-v="1"]').tap();await sleep(400);
ok(await p.evaluate(()=>document.querySelector('#chips .chip.on').dataset.v)==='1'&&await active(p)==='title','tapping Mañana selects it and the keyboard stays');
await p.keyboard.type('Pasar presupuesto');await p.keyboard.press('Enter');await sleep(400);
ok(gh.items.some(x=>x.title==='Pasar presupuesto'&&x.due===day(1)),'added for tomorrow');
ok(!(await vis(p,'#addForm'))&&await vis(p,'#fabs'),'adding closes the sheet: back to the list');
// Tocar la lista después: el toque cae donde apuntaba
const vY=()=>p.evaluate(()=>Math.round(document.querySelector('.ghead.over .gfold').getBoundingClientRect().top));
const y0=await vY();
await p.locator('.ghead.over .gfold').tap();await sleep(600);
const y1=await vY();
ok(y1===y0&&await p.locator('.ghead.over .gfold').getAttribute('aria-expanded')==='false','a tap on the list lands where it pointed '+y0+'→'+y1);
await p.locator('.ghead.over .gfold').tap();await sleep(150);
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
gh.items=items().concat(Array.from({length:25},(_,i)=>T('m'+i,'Más tarde '+i,{due:day(9)})));gh.sha++;
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await L.go(p,'tareas');   // las de más adelante están en Tareas
await p.locator('.ghead.over .gfold').tap();await sleep(150);
// Al final de la página: abrir y cerrar la hoja ⋯ no corre la lista (el margen de abajo no cambia)
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await sleep(200);
const lastY=()=>p.evaluate(()=>{const r=[...document.querySelectorAll('.task')].find(r=>r.textContent.includes('Respuesta de Juan'));return Math.round(r.getBoundingClientRect().top)});
const l0=await lastY();
await row(p,'Respuesta de Juan').locator('.more').tap();await sleep(200);await p.locator('#menuBackdrop').tap({position:{x:5,y:5}});await sleep(200);
const l1=await lastY();
ok(l1===l0,'bottom of the page: opening and closing ⋯ does not move the list '+l0+'→'+l1);
await ctx.close();
gh.items=items();gh.sha++;
// En la compu, las fechas siempre a la vista
({ctx,p}=await device(b,gh,DESK,APP,SEEN));
await p.evaluate(()=>document.activeElement.blur());await sleep(400);
ok(await vis(p,'#addForm .chiprow')&&await vis(p,'.top h1')&&!(await vis(p,'#fabs')),'desktop: dates, title and no bottom buttons');
await ctx.close();
gh.items=items();gh.sha++;

// ===== "+" y micrófono abajo =====
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await p.addInitScript(FAKE);await p.reload();await sleep(700);
ok(await vis(p,'#fabs')&&await vis(p,'#fabAdd')&&await vis(p,'#fabMic'),'phone: + and mic at the bottom');
// Abajo está la barra de secciones (76 px): los botones van justo arriba de ella
const fr=await p.evaluate(()=>{const r=document.getElementById('fabAdd').getBoundingClientRect(),n=document.getElementById('nav').getBoundingClientRect();return {b:Math.round(n.top-r.bottom),r:Math.round(innerWidth-r.right)}});
ok(fr.b>=0&&fr.b<=24&&fr.r<=24,'bottom right, right above the bottom bar, within thumb reach '+JSON.stringify(fr));
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await sleep(100);
const sy=await p.evaluate(()=>scrollY);
await p.locator('#fabAdd').tap();await sleep(300);
ok(await active(p)==='title'&&await vis(p,'#addForm')&&await p.evaluate(()=>scrollY)===sy,'+ opens the sheet with the field ready (the list stays where it was)');
ok(!(await vis(p,'#fabs')),'with the sheet open, the bottom buttons step aside');
await p.goBack();await sleep(300);
ok(await vis(p,'#fabs')&&!(await vis(p,'#addForm')),'back after closing the sheet');
// Dictar desde abajo: escucha, cuenta regresiva en el mismo botón y el Deshacer justo arriba
await p.evaluate(()=>{window.__say=['llamar a la escribanía'];window.__hold=true});
await p.locator('#fabMic').tap();
ok(await L.until(()=>p.evaluate(()=>listening&&document.body.classList.contains('capopen')&&document.getElementById('addBtn').dataset.mode==='listening')),'mic at the bottom opens the sheet and starts listening');
await L.until(()=>p.evaluate(()=>!!document.getElementById('title').value));
await p.locator('#addBtn').tap();   // "Listo"
ok(await L.until(()=>p.evaluate(()=>!!autoSave&&/[123]/.test(document.getElementById('addBtn').textContent))),'tap Listo: stops, and the countdown shows on the button');
await p.evaluate(()=>{window.__hold=false});
await p.locator('#addBtn').tap();
ok(await L.until(()=>gh.items.some(x=>x.title==='Llamar a la escribanía')),'tapping it during the countdown saves now');
ok(await L.until(async()=>!(await vis(p,'#addForm'))&&await vis(p,'#fabs')),'the sheet closes, the bottom buttons are back');
const tp=await p.evaluate(()=>{const t=document.getElementById('toast').getBoundingClientRect(),m=document.getElementById('fabMic').getBoundingClientRect();return {vis:!document.getElementById('toast').classList.contains('hidden'),gap:Math.round(m.top-t.bottom),undo:!document.getElementById('toastUndo').classList.contains('hidden')}});
ok(tp.vis&&tp.undo&&tp.gap>=4&&tp.gap<=40,'Undo toast right above the mic, not covering it '+JSON.stringify(tp));
await p.locator('#toastUndo').tap();
ok(await L.until(()=>!gh.items.some(x=>x.title==='Llamar a la escribanía')),'Undo from there removes it');
// Con algo escrito en el campo: no dicta encima (lo mezclaría); avisa y lo escrito queda como estaba
await L.alta(p);await p.keyboard.type('Comprar pan');await p.goBack();await sleep(300);
await p.evaluate(()=>{window.__say=['llamar al plomero']});
await p.locator('#fabMic').tap();await sleep(400);
ok(await p.evaluate(()=>!listening&&!autoSave&&document.body.classList.contains('capopen'))&&await p.inputValue('#title')==='Comprar pan'&&/agregalo o borralo/.test(await p.innerText('#toastMsg')),'typed text: the bottom mic does not dictate over it; it opens the sheet with the text and says to add or clear it first');
ok(!gh.items.some(x=>/plomero|pan/i.test(x.title)),'nothing saved');
await p.fill('#title','');await p.dispatchEvent('#title','input');await p.goBack();await sleep(300);
// El menú ⋯ y los modales tapan la barra (la de mañana está en Tareas)
await L.go(p,'tareas');
await row(p,'Pagar la luz').locator('.more').tap();await sleep(200);
ok(!(await vis(p,'#fabs')),'bottom buttons hidden under the ⋯ sheet');
await p.locator('#menuBackdrop').tap({position:{x:5,y:5}});await sleep(200);
await row(p,'Pagar la luz').locator('.body').tap();await sleep(200);
ok(!(await vis(p,'#fabs')),'and under a task being edited');
await p.locator('#editX').tap();await sleep(200);
ok(await vis(p,'#fabs'),'back after closing');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

gh.items=items();gh.sha++;
// ===== Abrir sin el teclado (con opción para volver a abrir lista para anotar) =====
({ctx,p}=await device(b,gh,PHONE,APP,()=>{const mm=window.matchMedia.bind(window);window.matchMedia=q=>/display-mode:\s*standalone/.test(q)?{matches:true,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}:mm(q)}));
ok(await active(p)!=='title','installed app on the phone: opens showing the list, without the keyboard');
await p.locator('#statusBtn').tap();await sleep(200);
ok(await p.isVisible('#kbdRow')&&!(await p.isChecked('#kbdSw')),'Sincronización › Este dispositivo: keyboard option, off');
await p.locator('#kbdSw').tap();await sleep(100);
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('abrirConTeclado')))===true,'turning it on is remembered on this device');
await p.reload();await sleep(700);
ok(await active(p)==='title','with the option on: opens ready to type, as before');
await ctx.close();
({ctx,p}=await device(b,gh,DESK));
await p.click('#statusBtn');await sleep(200);
ok(!(await p.isVisible('#kbdRow')),'desktop: no keyboard option');
await ctx.close();
// Volver después de un rato: arriba y sin menú, pero sin abrir el teclado
({ctx,p}=await device(b,gh,PHONE,APP,STANDALONE));
await L.go(p,'tareas');
await row(p,'Pagar la luz').locator('.more').tap();await sleep(100);
const setVis=v=>p.evaluate(v=>{window.__vis=v;Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true});document.dispatchEvent(new Event('visibilitychange'))},v);
await setVis('hidden');await p.clock.fastForward(200000);await setVis('visible');
ok(await L.until(async()=>!(await p.isVisible('#menu'))&&await p.evaluate(()=>scrollY)===0,{timeout:3000})&&await active(p)!=='title','after 2+ min away: menu closed, top, no keyboard');
await ctx.close();

// ===== Grupos que se pliegan =====
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await L.go(p,'tareas');
const hoy=p.locator('#groups .ghead.today .gfold');
ok(await hoy.getAttribute('aria-expanded')==='true','groups start open');
await hoy.tap();await sleep(200);
const hdt=await p.locator('#groups .ghead.today').textContent();
ok(await hoy.getAttribute('aria-expanded')==='false'&&!(await row(p,'Mandar remitos').count())&&/Hoy\s*2/.test(hdt),'Hoy folded: tasks hidden, count still shown: '+hdt);
await p.reload();await sleep(700);
ok(!(await row(p,'Mandar remitos').count())&&await p.evaluate(()=>JSON.parse(localStorage.getItem('gruposPlegados')).includes('today')),'folded state remembered on this device');
await p.locator('#searchBtn').tap();await p.locator('#search').fill('remitos');await sleep(200);
ok(await row(p,'Mandar remitos').count()===1,'searching shows the folded groups too');
ok(!(await p.locator('#groups .ghead.today .gfold').count())&&/Hoy/.test(await p.locator('#groups .ghead.today').textContent()),'while searching the header is just a label (cannot change the saved fold unseen)');
await p.locator('#searchClose').tap();await sleep(200);
await p.locator('.ghead .gfold',{hasText:'Esperando'}).tap();await sleep(200);
ok(!(await row(p,'Respuesta de Juan').count()),'Esperando folds too');
await p.locator('#groups .ghead.today .gfold').tap();await p.locator('.ghead .gfold',{hasText:'Esperando'}).tap();await sleep(200);
ok(await row(p,'Mandar remitos').count()===1&&await row(p,'Respuesta de Juan').count()===1,'unfolding brings them back');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
// En la compu: con las flechas no se entra a un grupo plegado; "Todas a hoy" sigue andando
gh.items=items().concat([T('a2','Otra vencida',{due:day(-2)})]);gh.sha++;
({ctx,p}=await device(b,gh,DESK,APP,SEEN));
await L.go(p,'tareas');
await p.click('#groups .ghead.over .gfold');await sleep(150);
await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('ArrowDown');await sleep(100);
ok(await p.evaluate(()=>document.querySelector('.task.sel .ttext').textContent)==='Mandar remitos','desktop: arrows skip the folded group');
await p.click('#groups .ghead.over .gbtn');await sleep(500);
ok(gh.items.filter(x=>x.id==='a'||x.id==='a2').every(x=>x.due===day(0)),'"Todas a hoy" still works on a folded group');
await p.locator('#groups .ghead.today .gfold').focus();await p.keyboard.press('Enter');await sleep(150);
ok(await p.evaluate(()=>{const a=document.activeElement;return a&&a.dataset.g==='today'&&a.getAttribute('aria-expanded')==='false'}),'keyboard: Enter folds and the focus stays on the header');
await p.keyboard.press('Enter');await sleep(150);
ok(await p.evaluate(()=>document.activeElement.getAttribute('aria-expanded'))==='true','a second Enter unfolds it');
await p.evaluate(()=>renderList());
ok(await p.evaluate(()=>document.activeElement&&document.activeElement.dataset.g==='today'),'focus stays on the header when the list redraws on its own');
await p.evaluate(()=>document.activeElement.blur());
// Lo que llega del otro dispositivo a un grupo plegado: el título lo dice y "Ver" lo despliega
await p.click('#groups .ghead .gfold[data-g="tomorrow"]');await sleep(150);
gh.items.push(T('nw','Nueva del celu',{due:day(1),src:'cel'}));gh.sha++;
await p.evaluate(()=>{hideToast();sync()});
ok(await L.until(async()=>/1 nueva/.test(await p.innerText('#toastMsg').catch(()=>''))),'arrival toast');
ok(/1 nueva/.test(await p.locator('.gfold[data-g="tomorrow"]').textContent()),'folded header says "· 1 nueva"');
await p.click('#toastUndo');await sleep(300);
ok(await p.locator('.gfold[data-g="tomorrow"]').getAttribute('aria-expanded')==='true'&&await p.locator('.task.llego',{hasText:'Nueva del celu'}).count()===1,'"Ver" unfolds the group and shows it highlighted');
// Dos llegadas en grupos plegados: "Ver" va a la que anunció el aviso, no a una anterior
await p.evaluate(()=>{setFold('tomorrow',true);setFold('later',true);renderList()});
gh.items.push(T('nw2','Llegó lejos',{due:day(30),src:'cel'}));gh.sha++;
await p.evaluate(()=>{hideToast();sync()});
await L.until(()=>p.evaluate(()=>!document.getElementById('toast').classList.contains('hidden')&&/1 nueva/.test(document.getElementById('toastMsg').textContent)));
gh.items.push(T('nw3','Llegó para mañana',{due:day(1),src:'cel'}));gh.sha++;
await p.evaluate(()=>{hideToast();sync()});
await L.until(()=>p.evaluate(()=>!document.getElementById('toast').classList.contains('hidden')&&/1 nueva/.test(document.getElementById('toastMsg').textContent)));
await p.click('#toastUndo');await sleep(300);
const vr=await p.evaluate(()=>({t:(document.querySelector('.gfold[data-g="tomorrow"]')||{}).ariaExpanded,l:(document.querySelector('.gfold[data-g="later"]')||{}).ariaExpanded,llego:[...document.querySelectorAll('.task.llego')].map(r=>r.textContent.slice(0,20)),arr:[...arrived],fold:localStorage.getItem('gruposPlegados'),msg:document.getElementById('toastMsg').textContent}));
ok(vr.t==='true'&&vr.l==='false'&&vr.llego.some(x=>x.startsWith('Llegó para mañana')),'"Ver" opens the group of the task it announced '+JSON.stringify(vr));
await ctx.close();
gh.items=items();gh.sha++;

// ===== Menú ⋯ como hoja de abajo =====
({ctx,p}=await device(b,gh,PHONE,APP,SEEN));
await L.go(p,'tareas');
await row(p,'Comprar cartuchos').locator('.chk').tap();
await L.until(()=>p.evaluate(()=>!document.getElementById('toast').classList.contains('hidden')&&!document.getElementById('toastUndo').classList.contains('hidden')));
await row(p,'Revisar stock').locator('.more').tap();await sleep(200);
const hit=await p.evaluate(()=>{const bs=[...document.querySelectorAll('#menu button')],b=bs[bs.length-1],r=b.getBoundingClientRect();
  return {toast:!document.getElementById('toast').classList.contains('hidden'),pts:[0.25,0.5,0.85].map(f=>{const e=document.elementFromPoint(r.x+r.width*f,r.y+r.height/2);return e===b||b.contains(e)})}});
ok(hit.toast&&hit.pts.every(Boolean),'with an Undo toast showing, the sheet stays on top: its last button is all tappable '+JSON.stringify(hit));
await p.locator('#menuBackdrop').tap({position:{x:5,y:5}});await sleep(200);
await row(p,'Pagar la luz').locator('.more').tap();await sleep(200);
const sh=await p.evaluate(()=>{const m=document.getElementById('menu'),r=m.getBoundingClientRect(),bd=getComputedStyle(document.getElementById('menuBackdrop')).backgroundColor;
  return {sheet:m.classList.contains('sheet'),bottom:Math.round(innerHeight-r.bottom),left:Math.round(r.left),w:Math.round(r.width),vw:innerWidth,title:(m.querySelector('.mtitle')||{}).textContent,btn:Math.round(m.querySelector('button').getBoundingClientRect().height),dim:bd!=='rgba(0, 0, 0, 0)'}});
ok(sh.sheet&&sh.bottom===0&&sh.left===0&&sh.w===sh.vw,'phone: ⋯ opens as a sheet at the bottom '+JSON.stringify(sh));
ok(sh.title==='Pagar la luz'&&sh.btn>=48&&sh.dim,'sheet says which task, big buttons, list dimmed '+JSON.stringify(sh));
await p.locator('#menu button',{hasText:'Para hoy'}).tap();await sleep(400);
ok(gh.items.find(x=>x.id==='d').due===day(0)&&!(await p.isVisible('#menu')),'an option in the sheet works and closes it');
await row(p,'Revisar stock').locator('.more').tap();await sleep(150);
await p.goBack();await sleep(400);
ok(!(await p.isVisible('#menu')),'Back closes the sheet');
await ctx.close();
({ctx,p}=await device(b,gh,DESK,APP,SEEN));
await row(p,'Revisar stock').locator('.more').click();await sleep(150);
ok(await p.evaluate(()=>!document.getElementById('menu').classList.contains('sheet')&&!document.querySelector('#menu .mtitle')),'desktop: ⋯ stays a small menu next to the button');
await ctx.close();
gh.items=items();gh.sha++;

// ===== Pista de la primera vez =====
gh.items=items().concat([T('in','Anotada al pasar',{due:day(0),inbox:true})]);gh.sha++;
({ctx,p}=await device(b,gh,PHONE));
let ht=await p.innerText('#hint').catch(()=>'');
ok(await p.isVisible('#hint')&&/Deslizá una tarea a la derecha/.test(ht)&&/punto azul/.test(ht),'phone, first time: gestures and the blue dot explained');
ok(await p.evaluate(()=>{const d=document.querySelector('.task .inboxdot');return !!d&&/al pasar/.test(d.title)&&d.getAttribute('aria-label')===d.title}),'the blue dot has a label');
await p.locator('#hintOk').tap();await sleep(150);
ok(!(await p.isVisible('#hint')),'Entendido hides it');
await p.reload();await sleep(700);
ok(!(await p.isVisible('#hint')),'and it does not come back');
await ctx.close();
// Deslizar ya cuenta como aprendido
gh.items=items();gh.sha++;
({ctx,p}=await device(b,gh,PHONE));
ok(await p.isVisible('#hint')&&!/punto azul/.test(await p.innerText('#hint')),'no blue dot visible: only the gestures');
await L.go(p,'tareas');   // la sin fecha está en Tareas
const box=await row(p,'Comprar cartuchos').boundingBox();
await p.evaluate(({x,y})=>{const r=[...document.querySelectorAll('.task')].find(e=>e.textContent.includes('Comprar cartuchos'));const ev=(t,cx)=>r.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:7,isPrimary:true,pointerType:'touch',clientX:cx,clientY:y}));
  ev('pointerdown',x);for(let i=1;i<=10;i++)ev('pointermove',x+i*15);ev('pointerup',x+150)},{x:box.x+40,y:box.y+box.height/2});
await sleep(600);
ok(gh.items.find(x=>x.id==='e').done===true&&!(await p.isVisible('#hint')),'a swipe completes the task and retires the hint');
await ctx.close();
// En la compu: solo el punto azul (con Ordenar)
gh.items=items().concat([T('in','Anotada al pasar',{due:day(0),inbox:true})]);gh.sha++;
({ctx,p}=await device(b,gh,DESK));
ht=await p.innerText('#hint').catch(()=>'');
ok(await p.isVisible('#hint')&&!/Deslizá/.test(ht)&&/Ordenar/.test(ht),'desktop: blue dot legend, no swipe hint: '+ht.replace(/\s+/g,' '));
await ctx.close();
gh.items=items();gh.sha++;

// ===== Bienvenida sin conectar =====
const NOCFG=()=>{localStorage.removeItem('githubTasksConfig')};
({ctx,p}=await device(b,makeGH([]),PHONE,APP,NOCFG));
ok(await p.isVisible('#welcome')&&!(await p.isVisible('#empty'))&&/Conectá tu repositorio/.test(await p.innerText('#welcome')),'unconfigured, no tasks: welcome with Conectar instead of "Nada pendiente"');
await p.locator('#welcomeGo').tap();await sleep(200);
ok(await p.isVisible('#syncOv')&&await p.evaluate(()=>document.getElementById('acct').open),'Conectar opens the GitHub account settings');
await p.locator('#syncX').tap();await sleep(150);
await L.alta(p);await p.keyboard.type('Primera tarea');await p.keyboard.press('Enter');await sleep(300);
ok(!(await p.isVisible('#welcome'))&&await row(p,'Primera tarea').count()===1,'after the first task, the welcome steps aside');
await ctx.close();
({ctx,p}=await device(b,makeGH([]),PHONE));
await sleep(500);
ok(!(await p.isVisible('#welcome'))&&/Nada pendiente/.test(await p.innerText('#empty')),'connected and empty: "Nada pendiente" as before');
await ctx.close();
({ctx,p}=await device(b,makeGH([]),DESK,APP,NOCFG));
ok(await p.isVisible('#welcome')&&await p.textContent('#welcomeQ')==='¿Ya usás Mis tareas en otro dispositivo?','desktop welcome speaks of the other device');
await ctx.close();

await b.close();
})().catch(e=>{console.log('FAIL exception '+(e&&e.stack||e));process.exit(1)});
