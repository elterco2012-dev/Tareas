// Rediseño fase 2: la fila nueva (renglón de detalle en orden, inicial de la persona, hora a la derecha, ⋯ discreto),
// las notas en grilla (Fijadas · Otras o Recientes, filtros Todas · Ideas · colores) y Ajustes como pantalla
// (Sincronización, Este dispositivo, Herramientas, Cuenta).
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
let APP;
const PHONE={viewport:{width:360,height:780},isMobile:true,hasTouch:true};
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}};
const box=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return r.width&&r.height?{y:Math.round(r.top),b:Math.round(r.bottom),h:Math.round(r.height),x:Math.round(r.left),w:Math.round(r.width)}:null},s);
const seen=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!!e.getBoundingClientRect().height},s);
const row=(p,t)=>p.locator('.task',{has:p.locator('.ttext',{hasText:t})}).first();
const ago=n=>new Date(L.date().getTime()-n*86400000).toISOString();   // (el reloj de la app en las pruebas)
const noHScroll=p=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
(async()=>{
const b=await L.launch();APP=await L.appUrl();
const items=()=>[
  T('o','Pagar el seguro',{due:day(-2),priority:'Alta',requester:'Laura',repeat:'monthly',postponed:3}),
  T('h','Turno dentista',{due:day(0),time:'23:30',requester:'Juan',notes:'llevar estudios'}),
  T('w','Presupuesto techo',{waiting:true,waitingOn:'Martín',waitingSince:ago(5),lastNudge:ago(4),nudges:1}),
  T('w2','Respuesta de Ana',{waiting:true,waitingOn:'Ana',waitingSince:ago(1),followUp:day(0)}),
  {...T('n1','Código del portón',{notes:'4822'}),kind:'nota',time:null,pinned:true,color:'verde'},
  {...T('n2','Viaje a Mendoza',{}),kind:'nota',time:null,idea:true},
  {...T('n3','Talle de Juan',{notes:'42'}),kind:'nota',time:null}
];

// ===== Celular (360 px): la fila nueva =====
let gh=makeGH(items());
let {ctx,p}=await device(b,gh,PHONE,APP,SEEN);
const meta=await row(p,'Pagar el seguro').evaluate(r=>[...r.querySelector('.meta').children].map(x=>x.textContent.trim()));
ok(meta[0]==='Alta'&&/^Venció/.test(meta[1])&&/pateada 3×/.test(meta[2])&&meta[3]==='LLaura'&&/↻/.test(meta[4]),'detail line in order: Alta · fecha · pateada · inicial + nombre · ↻ '+JSON.stringify(meta));
ok(await row(p,'Pagar el seguro').locator('.meta .person .pini').count()===1,'the person has the circle with her initial next to the name');
const tp=await row(p,'Turno dentista').evaluate(r=>{const t=r.querySelector('.tcol button.time'),m=r.querySelector('.more'),c=r.querySelector('.chk');return {t:t&&t.textContent,al:t&&t.getAttribute('aria-label'),right:t&&t.getBoundingClientRect().left>r.querySelector('.body').getBoundingClientRect().left,mw:Math.round(m.getBoundingClientRect().width),mh:Math.round(m.getBoundingClientRect().height),ma:m.getAttribute('aria-label'),cw:Math.round(c.getBoundingClientRect().width),ca:c.getAttribute('aria-label'),inMeta:!!r.querySelector('.meta .time')}});
ok(tp.t==='23:30'&&tp.al==='Aviso a las 23:30. Posponer'&&tp.right&&!tp.inMeta,'the time is a pill on the right, not in the detail line '+JSON.stringify(tp));
ok(tp.mw===42&&tp.mh>=52&&tp.ma==='Más acciones: Turno dentista'&&tp.cw===52&&tp.ca==='Terminar: Turno dentista','⋯ 42×52 and the circle 52, with labels');
ok(await row(p,'Turno dentista').locator('.notes').count()===1,'optional detail line');
await row(p,'Pagar el seguro').locator('.meta .person').tap();await sleep(300);
ok(await p.isVisible('#filterBar')&&(await p.innerText('#filterName'))==='Laura','tapping the person filters by her');
await p.locator('#filterX').tap();await sleep(200);
// Esperando: "Esperando · hace N días" (ámbar si toca reclamar) · reclamado · mirar hoy
await go(p,'tareas');
const wm=await row(p,'Presupuesto techo').evaluate(r=>[...r.querySelector('.meta').children].map(x=>({t:x.textContent.trim(),late:x.classList.contains('late')})));
ok(wm[0].t==='Esperando · hace 5 días'&&wm[0].late&&/^reclamado hace 4 días/.test(wm[1].t)&&wm[2].t==='MMartín','waiting: "Esperando · hace 5 días" in amber · reclamado · Martín '+JSON.stringify(wm));
const wm2=await row(p,'Respuesta de Ana').evaluate(r=>[...r.querySelector('.meta').children].map(x=>x.textContent.trim()));
ok(wm2[0]==='Esperando · hace 1 día'&&wm2[1]==='mirar hoy','waiting with a follow-up today: "mirar hoy" '+JSON.stringify(wm2));
ok(await noHScroll(p),'360 px: nothing cut off on Tareas');
// ===== Notas en grilla =====
await go(p,'notas');
const heads=await p.evaluate(()=>[...document.querySelectorAll('#notesSec .ghead')].map(h=>h.textContent.replace(/\s+/g,'')));
ok(JSON.stringify(heads)===JSON.stringify(['Fijadas1','Otras2']),'sections Fijadas and Otras '+JSON.stringify(heads));
const g=await p.evaluate(()=>{const c=[...document.querySelectorAll('#notesSec .ngrid')].pop().children;return {cols:getComputedStyle(c[0].parentNode).gridTemplateColumns.split(' ').length,sameRow:Math.abs(c[0].getBoundingClientRect().top-c[1].getBoundingClientRect().top)<2}});
ok(g.cols===2&&g.sameRow,'phone: 2 columns '+JSON.stringify(g));
const tw=await row(p,'Código del portón').evaluate(r=>({t:Math.round(r.querySelector('.body').getBoundingClientRect().width),c:Math.round(r.getBoundingClientRect().width),ico:getComputedStyle(r.querySelector('.nico')).display}));
ok(tw.ico==='none'&&tw.t>=tw.c-60,'cards: no icon, the text uses the card width '+JSON.stringify(tw));
ok(await row(p,'Código del portón').evaluate(r=>r.classList.contains('nc-verde'))&&await row(p,'Viaje a Mendoza').evaluate(r=>r.classList.contains('nc-amarillo')),'cards take their color (an idea without color, amber)');
const chips=await p.evaluate(()=>[...document.querySelectorAll('#notesSec .nfilter .chip')].map(b=>b.textContent||b.getAttribute('aria-label')));
ok(JSON.stringify(chips)===JSON.stringify(['Todas','Ideas','Verde']),'filters: Todas, Ideas and the colors in use '+JSON.stringify(chips));
await p.locator('#notesSec .nfilter .chip',{hasText:'Ideas'}).tap();await sleep(200);
ok(await p.locator('#notesSec .task').count()===1&&await row(p,'Viaje a Mendoza').count()===1,'Ideas shows only ideas');
await p.locator('#notesSec .nfilter .chip[aria-label="Verde"]').tap();await sleep(200);
ok(await p.locator('#notesSec .task').count()===1&&await row(p,'Código del portón').count()===1,'a color shows only that color');
await p.locator('#notesSec .nfilter .chip',{hasText:'Todas'}).tap();await sleep(200);
ok(await p.locator('#notesSec .task').count()===3,'Todas shows all');
ok(await noHScroll(p),'360 px: nothing cut off on Notas');
// ===== Ajustes como pantalla =====
await go(p,'hoy');
await p.locator('#setBtn').tap();await sleep(300);
ok(await p.evaluate(()=>document.body.dataset.screen)==='ajustes'&&(await p.innerText('#scrTitle'))==='Ajustes'&&await seen(p,'#syncOv')&&await seen(p,'#nav'),'the gear opens the Ajustes screen (the bottom bar stays)');
const grp=await p.evaluate(()=>[...document.querySelectorAll('#syncOv .ajh')].map(h=>h.textContent));
ok(JSON.stringify(grp)===JSON.stringify(['Sincronización','Este dispositivo','Herramientas','Cuenta']),'groups in order '+JSON.stringify(grp));
ok(!(await seen(p,'#hoyView'))&&!(await seen(p,'#fabs'))&&!(await seen(p,'.task')),'only Ajustes on screen');
ok(await p.locator('#setTrash').count()===1&&await p.locator('#setRep').count()===1&&await p.locator('#setRev').count()===1,'Herramientas: Informe · Revisión de la semana · Papelera');
ok(await noHScroll(p),'360 px: nothing cut off on Ajustes');
await p.goBack();await sleep(400);
ok(await p.evaluate(()=>document.body.dataset.screen)==='hoy'&&p.url().startsWith(APP),'Back goes to Hoy (and stays in the app)');
// El estado abre Ajustes en Sincronización; Cerrar vuelve a la pantalla de antes
await go(p,'tareas');
await p.locator('#statusBtn').tap();await sleep(300);
const sy=await box(p,'#ajSync');
ok(await p.evaluate(()=>document.body.dataset.screen)==='ajustes'&&sy&&sy.y<200,'the status button opens Ajustes at Sincronización');
await p.locator('#syncX').tap();await sleep(300);
ok(await p.evaluate(()=>document.body.dataset.screen)==='tareas','Cerrar goes back to the screen before');
// Con el filtro por persona o una búsqueda, ir a Ajustes y volver los deja como estaban
await row(p,'Pagar el seguro').locator('.meta .person').tap();await sleep(300);
await p.locator('#setBtn').tap();await sleep(300);await p.locator('#syncX').tap();await sleep(300);
ok(await p.evaluate(()=>document.body.dataset.screen)==='tareas'&&(await p.innerText('#filterName'))==='Laura'&&await p.isVisible('#filterBar'),'Tareas filtered by Laura → Ajustes → Cerrar: still filtered');
await p.locator('#filterX').tap();await sleep(200);
await p.locator('#searchBtn').tap();await sleep(200);await p.fill('#search','seguro');await p.dispatchEvent('#search','input');await sleep(200);
await p.locator('#setBtn').tap();await sleep(300);await p.locator('#syncX').tap();await sleep(300);
ok(await p.evaluate(()=>document.body.dataset.screen)==='buscar'&&await p.inputValue('#search')==='seguro','Buscar → Ajustes → Cerrar: back in Buscar with the search');
const nh=await p.evaluate(()=>[...document.querySelectorAll('#notesSec .ghead')].map(h=>h.textContent.replace(/\s+/g,'')));
await p.fill('#search','portón');await p.dispatchEvent('#search','input');await sleep(200);
ok(JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#notesSec .ghead')].map(h=>h.textContent.replace(/\s+/g,''))))===JSON.stringify(['Notas1']),'notes in search results are headed Notas');
await p.locator('#searchClose').tap();await sleep(200);await go(p,'tareas');
// El punto de estado en Ajustes no borra lo que estás escribiendo
await p.locator('#setBtn').tap();await sleep(300);
await p.evaluate(()=>{$('acct').open=true});await p.fill('#owner','otro');
await p.locator('#statusBtn').tap();await sleep(300);
ok(await p.inputValue('#owner')==='otro'&&await p.evaluate(()=>$('acct').open),'the status button on Ajustes keeps what you typed');
await p.locator('#syncX').tap();await sleep(300);
// Borrar conexión: dos toques
await p.locator('#setBtn').tap();await sleep(300);
await p.locator('#clearCfg').tap();await sleep(150);
ok(/Tocá de nuevo/.test(await p.innerText('#clearCfg'))&&await p.evaluate(()=>!!localStorage.getItem('githubTasksConfig')),'Borrar conexión asks for a second tap');
await go(p,'hoy');await p.locator('#setBtn').tap();await sleep(300);
ok((await p.innerText('#clearCfg'))==='Borrar conexión y datos de este dispositivo','leaving Ajustes cancels it');
// Papelera desde Herramientas: Tareas, con la papelera abierta
await p.evaluate(()=>{const t=tasks.find(x=>x.id==='h');del(t)});await sleep(200);
await p.locator('#setTrash').tap();await sleep(500);
ok(await p.evaluate(()=>document.body.dataset.screen)==='tareas'&&await seen(p,'#trashWrap')&&/Turno dentista/.test(await p.innerText('#trashWrap')),'Papelera: Tareas with the trash open');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Compu =====
gh=makeGH(items());
({ctx,p}=await device(b,gh,{viewport:{width:1300,height:900}},APP,SEEN));
await go(p,'notas');
const gc=await p.evaluate(()=>{const gr=[...document.querySelectorAll('#notesSec .ngrid')].pop();return {cols:getComputedStyle(gr).gridTemplateColumns.split(' ').length,w:Math.round(gr.firstElementChild.getBoundingClientRect().width)}});
ok(gc.cols>=2&&gc.w>=200,'computer: notes grid fills the width with cards of 200 px or more '+JSON.stringify(gc));
await p.locator('#setBtn').click();await sleep(300);
ok(await p.evaluate(()=>document.body.dataset.screen)==='ajustes'&&await p.getAttribute('#setBtn','aria-current')==='page','computer: Ajustes from the sidebar, marked as current');
await p.locator('#setRev').click();await sleep(400);
ok(await seen(p,'#procOv'),'Revisión de la semana opens from Herramientas');
await p.keyboard.press('Escape');await sleep(200);
await p.locator('#setBtn').click();await sleep(300);
await p.keyboard.press('Escape');await sleep(300);
ok(await p.evaluate(()=>document.body.dataset.screen)!=='ajustes','Esc closes Ajustes');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
