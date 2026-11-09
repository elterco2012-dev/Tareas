// El pie del detalle (⋯ · Esperando… · Terminar, o Convertir en tarea) siempre a la vista y sin tapar:
// - En la compu ancha, el panel de la derecha entra entero desde donde empieza (debajo del alta) hasta abajo de la
//   pantalla; lo de adentro se desliza. Al desplazar la página o si cambia el alta, se vuelve a acomodar.
// - En la compu, la ventana del detalle deja libre abajo el lugar del aviso ("Cambios guardados · Deshacer"): en una
//   pantalla baja, el aviso le tapaba el pie. Arriba no va (taparía Descartar). En el celular, el aviso sigue arriba.
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
let APP;
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}};
const long='Renglón de la nota con bastante texto para que el detalle crezca\n'.repeat(30);
const items=(extra=[])=>[
  T('t1','Llamar al banco por el resumen de la tarjeta',{due:day(0),time:'15:00',requester:'Laura',notes:long}),
  T('t2','Comprar pilas',{due:day(1),requester:'Juan',notes:long}),
  {...T('n1','Código del portón'),kind:'nota'},
  {...T('n2','Ideas para el informe',{notes:long}),kind:'nota'},...extra];
const row=(p,t)=>p.locator('.task',{has:p.locator('.ttext',{hasText:t})}).first();
// Cada botón del pie (y del encabezado) visible, entero en la pantalla y sin nada encima (ni el aviso)
const controls=p=>p.evaluate(()=>{
  const vis=x=>{const q=x.getBoundingClientRect();return q.height>0&&q.width>0};
  const free=x=>{const q=x.getBoundingClientRect();if(q.top<0||q.bottom>innerHeight+0.5)return false;
    const xs=[q.left+q.width*.25,q.left+q.width/2,q.right-q.width*.25],ys=[q.top+q.height*.25,q.top+q.height/2,q.bottom-q.height*.25];
    return xs.flatMap(a=>ys.map(c=>[a,c])).every(([a,c])=>{const e=document.elementFromPoint(a,c);return e&&(e===x||x.contains(e))})};
  const foot=[...document.querySelectorAll('#editForm .dfoot button')].filter(vis),head=[...document.querySelectorAll('#editForm .dhead button')].filter(vis);
  const body=document.querySelector('#editForm .dbody');
  return {foot:foot.map(x=>x.textContent.trim()),footFree:foot.filter(free).length===foot.length&&foot.length>0,headFree:head.filter(free).length===head.length&&head.length>0,
    blocked:foot.concat(head).filter(x=>!free(x)).map(x=>x.textContent.trim()||x.getAttribute('aria-label')),
    scrolls:!!body&&body.scrollHeight>body.clientHeight+20,form:Math.round(document.getElementById('editForm').getBoundingClientRect().bottom),vh:innerHeight}});
(async()=>{
const b=await L.launch();APP=await L.appUrl();

// ===== Compu ancha: el panel entra entero =====
for(const [w,h] of [[1280,800],[1280,720],[1440,900],[1200,640]]){
  const gh=makeGH(items());
  const {ctx,p}=await device(b,gh,{viewport:{width:w,height:h}},APP,SEEN);
  await go(p,'tareas');await row(p,'Llamar al banco').locator('.ttext').click();await sleep(400);
  const c=await controls(p);
  ok(await p.evaluate(()=>document.body.classList.contains('detpanel'))&&c.footFree&&c.headFree&&c.form<=c.vh,w+'×'+h+': the panel fits, its footer ('+c.foot.join(' · ')+') and header are on screen '+JSON.stringify(c));
  ok(c.scrolls,w+'×'+h+': what does not fit scrolls inside the panel');
  ok(p.errs.length===0,w+'×'+h+': no page errors '+JSON.stringify(p.errs));
  await ctx.close();
}
{
  // Con una lista larga: al desplazar la página, la columna se pega arriba y el panel crece (el pie sigue a la vista)
  const many=Array.from({length:30},(_,i)=>T('x'+i,'Tarea de relleno '+(i+1),{due:day(2)}));
  const gh=makeGH(items(many));
  const {ctx,p}=await device(b,gh,{viewport:{width:1280,height:800}},APP,SEEN);
  await go(p,'tareas');await row(p,'Llamar al banco').locator('.ttext').click();await sleep(400);
  const h0=await p.evaluate(()=>Math.round(document.getElementById('editForm').getBoundingClientRect().height));
  await p.mouse.move(400,600);await p.mouse.wheel(0,600);await sleep(400);
  const c=await controls(p),h1=await p.evaluate(()=>Math.round(document.getElementById('editForm').getBoundingClientRect().height));
  ok(c.footFree&&c.headFree&&h1>h0&&h1>=800-32-1,'long list, page scrolled: the panel grows to the full height and its footer stays on screen '+JSON.stringify({h0,h1,c}));
  // Hasta el final de la página: el panel no pasa del final de la lista, así se ven el encabezado y el pie
  await p.mouse.wheel(0,20000);await sleep(500);
  const cEnd=await controls(p);
  ok(cEnd.footFree&&cEnd.headFree,'long list, end of the page: header and footer of the panel are on screen '+JSON.stringify(cEnd));
  await p.mouse.wheel(0,-20000);await sleep(400);
  const c2=await controls(p);
  ok(c2.footFree&&c2.headFree,'scrolled back to the top: the footer is on screen again '+JSON.stringify(c2));
  // Si el alta crece (lo que entiende al escribir), el panel baja y se achica: el pie sigue a la vista
  const top0=await p.evaluate(()=>Math.round(document.getElementById('side').getBoundingClientRect().top));
  await p.click('#title');await p.keyboard.type('Pagar la luz mañana a las 10 @Pedro !alta');await sleep(500);
  const top1=await p.evaluate(()=>Math.round(document.getElementById('side').getBoundingClientRect().top)),c3=await controls(p);
  ok(c3.footFree&&c3.form<=c3.vh,'typing in the add form ('+top0+'→'+top1+' px): the panel still fits '+JSON.stringify(c3));
  // Al achicar la ventana (sin la columna derecha), el detalle pasa a ventana y no queda el alto del panel
  await p.keyboard.press('Escape');await sleep(200);
  await p.evaluate(()=>{document.getElementById('title').value='';document.getElementById('title').dispatchEvent(new Event('input'))});
  await row(p,'Llamar al banco').locator('.ttext').click();await sleep(300);
  await p.setViewportSize({width:1000,height:700});await sleep(500);
  const c4=await controls(p);
  ok(await p.evaluate(()=>!document.body.classList.contains('detpanel')&&!document.getElementById('editOv').style.getPropertyValue('--pmax'))&&c4.footFree&&c4.headFree,'narrowed to 1000 px with the detail open: a window, footer and header on screen '+JSON.stringify(c4));
  ok(p.errs.length===0,'long list: no page errors '+JSON.stringify(p.errs));
  await ctx.close();
}

{
  // Con una lista corta, la página no crece mientras bajás: Fin llega abajo de una vez, con el panel entero a la vista
  const gh=makeGH(items());
  const {ctx,p}=await device(b,gh,{viewport:{width:1280,height:800}},APP,SEEN);
  await go(p,'tareas');await row(p,'Llamar al banco').locator('.ttext').click();await sleep(400);
  await p.evaluate(()=>document.activeElement&&document.activeElement.blur());
  const doc=()=>p.evaluate(()=>({h:document.documentElement.scrollHeight,y:Math.round(scrollY)}));
  const d0=await doc();
  await p.keyboard.press('End');await sleep(500);const d1=await doc();
  await p.keyboard.press('End');await sleep(500);const d2=await doc();
  const c=await controls(p);
  ok(d1.h===d0.h&&d2.y===d1.y&&await p.evaluate(()=>!!edit),'short list: the page does not grow while scrolling, End reaches the bottom at once '+JSON.stringify({d0,d1,d2}));
  ok(c.footFree&&c.headFree,'short list, at the bottom: header and footer of the panel are on screen '+JSON.stringify(c));
  ok(p.errs.length===0,'short list: no page errors '+JSON.stringify(p.errs));
  await ctx.close();
}
{
  // Con barras de desplazamiento como las de Windows (ocupan lugar): un clic en la barra de la página no cierra el panel
  const b2=await L.launch({ignoreDefaultArgs:['--hide-scrollbars']});
  const many=Array.from({length:30},(_,i)=>T('x'+i,'Tarea de relleno '+(i+1),{due:day(2)}));
  const gh=makeGH(items(many));
  const {ctx,p}=await device(b2,gh,{viewport:{width:1280,height:800}},APP,SEEN);
  await go(p,'tareas');await row(p,'Llamar al banco').locator('.ttext').click();await sleep(400);
  const bar=await p.evaluate(()=>({cw:document.documentElement.clientWidth,iw:innerWidth}));
  await p.mouse.click(Math.round((bar.cw+bar.iw)/2),500);await sleep(400);
  ok(bar.iw>bar.cw&&await p.evaluate(()=>!!edit&&document.body.classList.contains('detpanel')),'visible scrollbars: a click on the page scrollbar keeps the panel open '+JSON.stringify(bar));
  // y un clic en un lugar vacío de la página sí lo cierra (como antes)
  await p.evaluate(()=>scrollTo(0,0));await sleep(300);await p.mouse.click(700,275);await sleep(400);
  ok(await p.evaluate(()=>!edit),'a click on an empty spot of the page still closes the panel');
  ok(p.errs.length===0,'visible scrollbars: no page errors '+JSON.stringify(p.errs));
  await ctx.close();await b2.close();
}

// ===== Compu: la ventana del detalle no queda debajo del aviso =====
for(const [w,h] of [[1100,700],[1000,700],[1000,520],[900,600],[800,600]]){
  const gh=makeGH(items());
  const {ctx,p}=await device(b,gh,{viewport:{width:w,height:h}},APP,SEEN);
  await go(p,'tareas');
  // Se cambia una y se cierra (aviso "Cambios guardados · Deshacer"); enseguida se abre otra con mucho texto
  await row(p,'Comprar pilas').locator('.ttext').click();await sleep(300);
  await p.fill('#eTitle','Comprar pilas AA');await p.keyboard.press('Escape');await sleep(300);
  ok(await p.isVisible('#toast')&&(await p.textContent('#toastMsg'))==='Cambios guardados',w+'×'+h+': "Cambios guardados" after closing');
  await row(p,'Llamar al banco').locator('.ttext').click();await sleep(400);
  let c=await controls(p);
  ok(await p.isVisible('#toast')&&c.footFree&&c.headFree,w+'×'+h+', task: the toast covers no button of the window ('+c.foot.join(' · ')+', Descartar) '+JSON.stringify(c));
  // Deshacer del aviso se puede tocar con la ventana abierta y vuelve lo anterior
  await p.click('#toastUndo');await sleep(400);
  ok(gh.items.find(x=>x.id==='t2').title==='Comprar pilas',w+'×'+h+': Deshacer is reachable with the window open and undoes the change');
  await p.keyboard.press('Escape');await sleep(300);
  // Una nota larga: "Convertir en tarea"
  await go(p,'notas');
  await row(p,'Código del portón').locator('.body').click();await sleep(300);
  await p.fill('#eTitle','Código del portón 4822');await p.keyboard.press('Escape');await sleep(300);
  await row(p,'Ideas para el informe').locator('.body').click();await sleep(400);
  c=await controls(p);
  ok(await p.isVisible('#toast')&&c.footFree&&c.headFree&&c.foot.includes('Convertir en tarea'),w+'×'+h+', note: "Convertir en tarea" is not covered by the toast '+JSON.stringify(c));
  ok(p.errs.length===0,w+'×'+h+': no page errors '+JSON.stringify(p.errs));
  await ctx.close();
}

// ===== Celular: el aviso sigue arriba con el detalle abierto (como antes) =====
{
  const gh=makeGH(items());
  const {ctx,p}=await device(b,gh,{viewport:{width:390,height:844},isMobile:true,hasTouch:true},APP,SEEN);
  await go(p,'tareas');
  await row(p,'Comprar pilas').locator('.ttext').tap();await sleep(400);
  await p.fill('#eTitle','Comprar pilas AA');await p.evaluate(()=>dismissEdit());await sleep(300);
  await row(p,'Llamar al banco').locator('.ttext').tap();await sleep(500);
  const r=await p.evaluate(()=>{const t=document.getElementById('toast').getBoundingClientRect(),f=document.getElementById('editForm').getBoundingClientRect();return {tTop:Math.round(t.top),tBot:Math.round(t.bottom),fBot:Math.round(f.bottom),vh:innerHeight}});
  const c=await controls(p);
  ok(r.tTop<80&&c.footFree,'phone: with the sheet open the toast is at the top and the footer is free '+JSON.stringify({r,c}));
  ok(p.errs.length===0,'phone: no page errors '+JSON.stringify(p.errs));
  await ctx.close();
}

await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
