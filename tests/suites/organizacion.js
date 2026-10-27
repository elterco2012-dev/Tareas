// Tanda 3: organización en la compu
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
let APP;   // la app servida por http (L.appUrl)
const row=(p,t)=>p.locator('.task').filter({has:p.locator('.ttext',{hasText:t})}).first();
const iso=L.ago;
const DESK={viewport:{width:1000,height:900}},PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
const sel=p=>p.evaluate(()=>{const r=document.querySelector('.task.sel');return r?r.querySelector('.ttext').textContent:null});
(async()=>{
const b=await L.launch();APP=await L.appUrl();
// ===== Teclas en la lista =====
let gh=makeGH([T('o1','Vencida uno',{due:day(-2),order:0}),T('o2','Vencida dos',{due:day(-1),order:1}),T('t1','Hoy uno',{due:day(0),order:2}),T('n1','Sin fecha uno',{order:3})]);
let {ctx,p}=await device(b,gh,DESK);
await go(p,'tareas');   // las teclas en la lista completa (la app abre en Hoy)
const g=id=>gh.items.find(x=>x.id===id);
await p.focus('#title');await p.keyboard.press('ArrowDown');
ok(await sel(p)==='Vencida uno'&&await p.evaluate(()=>document.activeElement.id)!=='title','↓ from the empty field selects the first task');
await p.keyboard.press('h');await sleep(400);
ok(g('o1').due===day(0)&&g('o1').postponed===1&&await sel(p)==='Vencida dos','H: to today, counted as postponed, selection moves on');
await p.keyboard.press('l');await sleep(400);
ok(g('o2').due!==day(-1)&&new Date(g('o2').due+'T12:00').getDay()===1,'L → Monday');
await p.evaluate(()=>{sel=tasks.find(x=>x.title==='Sin fecha uno').id;renderList()});
await p.keyboard.press('f');await sleep(100);
ok(await p.isVisible('#askOv')&&(await p.innerText('#askH'))==='¿Para cuándo?','F asks for a date');
await p.keyboard.type('jueves a las 3');await sleep(50);
ok((await p.innerText('#askDet')).includes('15:00'),'date preview while typing');
await p.keyboard.press('Enter');await sleep(400);
ok(new Date(g('n1').due+'T12:00').getDay()===4&&g('n1').time==='15:00','F "jueves a las 3" → Thursday 15:00');
await p.evaluate(()=>{sel=tasks.find(x=>x.title==='Hoy uno').id;renderList()});
await p.keyboard.press('q');await sleep(100);await p.keyboard.type('Laura');await p.keyboard.press('Enter');await sleep(400);
ok(g('t1').requester==='Laura','Q sets who asked for it');
await p.keyboard.press('!');await sleep(400);ok(g('t1').priority==='Alta','! toggles high priority');
await p.keyboard.press('.');await sleep(100);
ok(await p.isVisible('#menu')&&await p.evaluate(()=>document.activeElement.closest('#menu')!==null),'. opens the menu with focus inside');
await p.keyboard.press('ArrowDown');await p.keyboard.press('ArrowDown');
const lbl=await p.evaluate(()=>document.activeElement.textContent);
ok(!!lbl,'arrows move inside the menu: '+lbl);
await p.keyboard.press('Escape');ok(!(await p.isVisible('#menu')),'Esc closes the menu');
await p.keyboard.press('w');await sleep(100);await p.keyboard.type('Pedro');await p.keyboard.press('Enter');await sleep(400);
ok(g('t1').waiting===true&&g('t1').waitingOn==='Pedro','W → waiting on Pedro');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
// ===== Pateadas =====
gh=makeGH([T('a','Pateada mucho',{due:day(-1),postponed:3}),T('b','Pateada poco',{due:day(-1),postponed:1}),T('c','Normal vencida',{due:day(-3)})]);
({ctx,p}=await device(b,gh,DESK));
ok((await row(p,'Pateada mucho').innerText()).includes('pateada 3×'),'"pateada 3×" shown from 3');
ok(!(await row(p,'Pateada poco').innerText()).includes('pateada'),'not shown below 3');
await p.click('.ghead.over .gbtn');await sleep(500);
ok(gh.items.find(x=>x.id==='a').due===day(-1)&&gh.items.find(x=>x.id==='b').due===day(0)&&gh.items.find(x=>x.id==='b').postponed===2,'Todas a hoy skips the ones kicked 3+ times and counts the rest');
ok((await p.innerText('#toastMsg')).includes('1 quedó afuera'),'toast says one stayed out: '+await p.innerText('#toastMsg'));
await p.click('#toastUndo');await sleep(500);
ok(gh.items.find(x=>x.id==='b').due===day(-1)&&gh.items.find(x=>x.id==='b').postponed===1,'undo restores date and counter');
await ctx.close();
// ===== Anotadas al pasar =====
gh=makeGH([]);
({ctx,p}=await device(b,gh,PHONE));
// (en el celular cada una se anota en la hoja del "+", que se cierra al agregar)
await L.alta(p);await p.keyboard.type('Comprar cartuchos');await p.keyboard.press('Enter');await sleep(400);
await L.alta(p);await p.keyboard.type('Llamar a Pedro mañana');await p.keyboard.press('Enter');await sleep(400);
await L.alta(p);await p.locator('#chips .chip[data-v="1"]').tap();await p.locator('#title').tap();await p.keyboard.type('Pasar presupuesto');await p.keyboard.press('Enter');await sleep(400);
const ib=t=>gh.items.find(x=>x.title===t);
ok(ib('Comprar cartuchos').inbox===true&&ib('Comprar cartuchos').due===day(0),'phone, no date chosen → inbox, still today');
ok(!ib('Llamar a Pedro').inbox&&!ib('Pasar presupuesto').inbox,'date in the text or chip chosen → not inbox');
ok(await row(p,'Comprar cartuchos').locator('.inboxdot').count()===1,'blue dot on the row');
await ctx.close();
({ctx,p}=await device(b,gh,DESK));
await p.fill('#title','Desde la compu');await p.press('#title','Enter');await sleep(400);
// En la compu también: sin fecha en el texto ni en los chips, queda marcada para procesar
ok(ib('Desde la compu').inbox===true&&ib('Desde la compu').due===day(0),'desktop add without a date → inbox too, still today');
ok(await p.isVisible('#procBtn')&&(await p.innerText('#procCount'))==='2','Ordenar row on Hoy with 2 on desktop: the phone one and this one');
// (se deshace, así lo que sigue cuenta como antes)
await p.click('#toastUndo');await sleep(400);
ok(!ib('Desde la compu')&&(await p.innerText('#procCount'))==='1','undo removes it: Ordenar row with 1');
// ===== Procesar =====
gh.items.push(T('ov','Vencida vieja',{due:day(-4),postponed:2}),T('ov2','Vencida nueva',{due:day(-1)}),T('wt','Respuesta de Juan',{waiting:true,waitingOn:'Juan',waitingSince:iso(5)}),T('wt2','Respuesta reciente',{waiting:true,waitingOn:'Ana',waitingSince:iso(1)}));gh.sha++;
await p.evaluate(()=>sync());await sleep(600);
ok((await p.innerText('#procCount'))==='4','count: inbox + 2 overdue + late waiting');
await p.click('#procBtn');await sleep(200);
ok(await p.isVisible('#procOv')&&(await p.innerText('#procCard')).startsWith('Comprar cartuchos')&&(await p.innerText('#procN'))==='1 de 4','opens with the inbox first');
await p.keyboard.press('h');await sleep(400);
ok(ib('Comprar cartuchos').inbox===false&&ib('Comprar cartuchos').due===day(0)&&(await p.innerText('#procCard')).startsWith('Vencida vieja'),'H keeps it for today, clears inbox, next is the most kicked overdue');
await p.keyboard.press('f');await sleep(100);await p.keyboard.type('en 2 semanas');await p.keyboard.press('Enter');await sleep(400);
ok(gh.items.find(x=>x.id==='ov').due===await p.evaluate(()=>addDays(14))&&gh.items.find(x=>x.id==='ov').postponed===3,'F "en 2 semanas" from Procesar, counted');
ok((await p.innerText('#procCard')).startsWith('Vencida nueva'),'advances');
await p.keyboard.press(' ');await sleep(600);
ok(gh.items.find(x=>x.id==='ov2').done===true,'Space: done');
ok((await p.innerText('#procCard')).startsWith('Respuesta de Juan')&&(await p.innerText('#procBtns')).includes('Ya respondió'),'waiting card with its own actions');
await p.evaluate(()=>{window.__opened=[];window.open=u=>{window.__opened.push(u);return null}});
await p.keyboard.press('n');await sleep(400);
const wt=gh.items.find(x=>x.id==='wt');
ok(wt.nudges===1&&!!wt.lastNudge&&(await p.evaluate(()=>window.__opened[0]||'')).startsWith('https://wa.me/?text=Hola%20Juan'),'N: nudge via WhatsApp, recorded');
ok((await p.innerText('#procCard')).includes('Listo')&&(await p.innerText('#procCard')).includes('4 ordenadas'),'end screen: '+(await p.innerText('#procCard')).replace(/\n/g,' | '));
await p.keyboard.press('Escape');ok(!(await p.isVisible('#procOv')),'Esc closes');
// (ya reclamada no está tarde: deja Hoy y se ve en Esperando, en Tareas)
await go(p,'tareas');
ok((await row(p,'Respuesta de Juan').innerText()).includes('reclamado hoy'),'row: "Juan · reclamado hoy"');
// Volver a mirar el…
await row(p,'Respuesta reciente').locator('.more').click();await p.click('#menu button:has-text("Volver a mirar el…")');
await p.keyboard.type('pasado mañana');await p.keyboard.press('Enter');await sleep(400);
ok(gh.items.find(x=>x.id==='wt2').followUp===await p.evaluate(()=>addDays(2))&&(await row(p,'Respuesta reciente').innerText()).includes('mirar'),'follow-up date set, row says "mirar …"');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
// ===== Revisión semanal (?revisar=1) =====
gh=makeGH([T('s1','Sin fecha vieja',{createdAt:iso(40)}),T('s2','Sin fecha revisada',{reviewedAt:iso(3)}),T('k','Muy pateada',{due:day(2),postponed:4}),T('w','Esperando algo',{waiting:true,waitingOn:'Marta',waitingSince:iso(1)})]);
({ctx,p}=await device(b,gh,DESK,APP+'?revisar=1'));await sleep(500);
ok(await p.isVisible('#procOv')&&(await p.innerText('#procH'))==='Revisión de la semana'&&(await p.innerText('#procN'))==='1 de 3','weekly review opens with 3 items');
await p.keyboard.press('ArrowRight');await sleep(400);
ok(!!gh.items.find(x=>x.id==='s1').reviewedAt,'"Sigue así" stamps reviewedAt');
await p.keyboard.press('ArrowRight');await sleep(200);await p.keyboard.press('ArrowRight');await sleep(400);
ok((await p.innerText('#procBtns')).includes('Informe de la semana'),'end screen offers the week report');
await ctx.close();
// ===== Dos columnas =====
gh=makeGH([T('a','Con fecha',{due:day(0)}),T('n','Sin fecha X'),T('w','Esperando X',{waiting:true,waitingOn:'Ana',waitingSince:iso(1)})]);
({ctx,p}=await device(b,gh,{viewport:{width:1366,height:768}}));
await go(p,'tareas');
ok((await p.innerText('#sideNone')).includes('Sin fecha X')&&(await p.innerText('#sideWait')).includes('Esperando X')&&!(await p.innerText('#groups')).includes('Sin fecha X'),'1366 px: Sin fecha and Esperando on the right column');
await p.screenshot({path:L.out('wide-1366.png')});
await p.setViewportSize({width:1000,height:768});await sleep(200);
ok((await p.innerText('#groups')).includes('Sin fecha X')&&(await p.innerText('#waitingSec')).includes('Esperando X'),'1000 px: back in the main column');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
await b.close();console.log('fails',L.fails)})();
