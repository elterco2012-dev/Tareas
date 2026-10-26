// Pegar varias líneas, acceso directo Nueva tarea, deslizar en el celular, contraste en modo oscuro
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
(async()=>{
const b=await L.launch();const APP=await L.appUrl();
const gh=makeGH([T('a','Tarea A',{due:day(0)}),T('b','Tarea B',{due:day(0)}),T('c','Tarea C',{due:day(1)})]);
// ===== 2. Pegar varias líneas (compu) =====
let {ctx,p}=await device(b,gh,{viewport:{width:1100,height:900}});
const paste=async(text)=>p.evaluate(t=>{const dt=new DataTransfer();dt.setData('text/plain',t);document.getElementById('title').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))},text);
await p.focus('#title');
await paste('- Llamar a Laura mañana\n* Revisar stock !alta\n\n• Pedir presupuesto @Juan\n1. Mandar remitos el viernes\n2) [ ] Ordenar carpeta\n[x] Archivar mails');
ok(await p.isVisible('#bulkOv'),'pasting 2+ lines opens the modal');
ok((await p.innerText('#bulkH'))==='¿Cargar 6 tareas?','title shows count: '+await p.innerText('#bulkH'));
const vals=await p.$$eval('#bulkList .inp',xs=>xs.map(x=>x.value));
ok(JSON.stringify(vals)===JSON.stringify(['Llamar a Laura mañana','Revisar stock !alta','Pedir presupuesto @Juan','Mandar remitos el viernes','Ordenar carpeta','Archivar mails']),'bullets stripped: '+JSON.stringify(vals));
ok((await p.inputValue('#title'))==='','field not filled with pasted text');
await p.locator('#bulkList .bulkrow').nth(5).locator('input[type=checkbox]').uncheck();
await p.locator('#bulkList .bulkrow').nth(4).locator('.inp').fill('Ordenar carpeta de reclamos');
ok((await p.innerText('#bulkH'))==='¿Cargar 5 tareas?'&&(await p.innerText('#bulkOk'))==='Agregar 5','unchecking updates count');
await p.click('#bulkOk');await sleep(500);
ok(!(await p.isVisible('#bulkOv')),'modal closes');
const g=t=>gh.items.find(x=>x.title===t);
ok(g('Llamar a Laura')&&g('Llamar a Laura').due===day(1),'line parsed (mañana)');
ok(g('Revisar stock')&&g('Revisar stock').priority==='Alta'&&g('Revisar stock').due===day(0),'line without date uses chip (hoy) + !alta');
ok(g('Pedir presupuesto')&&g('Pedir presupuesto').requester==='Juan','@Juan');
ok(g('Ordenar carpeta de reclamos'),'edited line saved');
ok(!g('Archivar mails'),'unchecked line not saved');
ok((await p.innerText('#toastMsg'))==='5 tareas agregadas','toast "5 tareas agregadas"');
await p.click('#toastUndo');await sleep(500);
ok(!['Llamar a Laura','Revisar stock','Pedir presupuesto','Mandar remitos','Ordenar carpeta de reclamos'].some(g),'Deshacer removes all 5');
// una sola línea: pegado normal
await p.focus('#title');await paste('una sola línea');
ok(!(await p.isVisible('#bulkOv')),'single line paste is normal');
// Esc cierra el modal
await paste('x\ny');ok(await p.isVisible('#bulkOv'),'modal open');await p.keyboard.press('Escape');ok(!(await p.isVisible('#bulkOv')),'Esc closes bulk modal');
// chip Sin fecha
await p.click('#chips .chip[data-v=""]');await paste('Sin fecha uno\nSin fecha dos el lunes');
ok((await p.innerText('#bulkHint')).includes('sin fecha'),'hint mentions chip date');
await p.click('#bulkOk');await sleep(400);
ok(g('Sin fecha uno')&&g('Sin fecha uno').due===null&&g('Sin fecha dos')&&g('Sin fecha dos').due,'chip Sin fecha used; explicit date kept');
ok(p.errs.length===0,'desktop errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== 3. Acceso directo Nueva tarea (celular) =====
({ctx,p}=await device(b,gh,{viewport:{width:375,height:740},isMobile:true,hasTouch:true},APP+'?nueva=1'));
ok(await p.evaluate(()=>document.activeElement.id)==='title','?nueva=1 focuses the field on mobile');
ok(await p.evaluate(()=>location.search)==='','URL cleaned');
await ctx.close();
({ctx,p}=await device(b,gh,{viewport:{width:375,height:740},isMobile:true,hasTouch:true}));
ok(await p.evaluate(()=>document.activeElement===document.body),'normal mobile open: no focus');

// ===== 10. Deslizar (celular) =====
const swipe=async(title,dx,dy=0,steps=8)=>{
  const r=await p.locator('.task',{hasText:title}).first().boundingBox();
  const x0=r.x+r.width/2,y0=r.y+r.height/2;
  const cdp=await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:y0}]});
  for(let i=1;i<=steps;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+dx*i/steps,y:y0+dy*i/steps}]});await sleep(16)}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(450);
};
await swipe('Tarea A',140);
ok(gh.items.find(x=>x.id==='a').done===true,'swipe right > 80px completes');
ok((await p.innerText('#toastMsg'))==='Tarea terminada'&&await p.isVisible('#toastUndo'),'swipe shows toast with Deshacer');
ok(!(await p.isVisible('#editOv')),'swipe does not open edit');
await p.locator('#toastUndo').tap();await sleep(400);
ok(gh.items.find(x=>x.id==='a').done===false,'undo swipe-complete');
await swipe('Tarea B',-140);
ok(gh.items.find(x=>x.id==='b').due===day(1),'swipe left > 80px → mañana');
ok((await p.innerText('#toastMsg'))==='Pasada a mañana','toast Pasada a mañana');
await p.locator('#toastUndo').tap();await sleep(400);
ok(gh.items.find(x=>x.id==='b').due===day(0),'undo swipe-tomorrow');
await swipe('Tarea A',50);
ok(gh.items.find(x=>x.id==='a').done===false,'short swipe does nothing');
ok(await p.evaluate(()=>{const r=[...document.querySelectorAll('.task')].find(x=>x.textContent.includes('Tarea A'));return !r.style.transform}),'row snaps back');
await swipe('Tarea A',30,160);
ok(gh.items.find(x=>x.id==='a').done===false,'vertical gesture does not swipe');
// tap still opens edit
await p.locator('.task',{hasText:'Tarea A'}).locator('.body').tap();await sleep(200);
ok(await p.isVisible('#editOv'),'tap still opens edit');await p.click('#editX');
ok(p.errs.length===0,'mobile errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== 11. Modo oscuro: contraste =====
const contrast=async(pg)=>pg.evaluate(()=>{
  const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
  const bgOf=el=>{for(let e=el;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;const a=c.match(/[\d.]+/g);if(a&&(a.length<4||+a[3]>0.5))return c}return getComputedStyle(document.body).backgroundColor};
  const bad=[];const seen=new Set();
  document.querySelectorAll('body *').forEach(el=>{
    if(!el.offsetParent&&getComputedStyle(el).position!=='fixed')return;
    const txt=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join(' ');
    if(!txt&&!(el.tagName==='INPUT'&&el.value))return;
    const cs=getComputedStyle(el);if(cs.visibility==='hidden'||+cs.opacity<.6)return;
    const fg=cs.color,bg=bgOf(el);const L1=lum(fg),L2=lum(bg);const r=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
    const key=(txt||el.value).slice(0,30);
    if(r<4.5&&!seen.has(key)){seen.add(key);bad.push(key+' '+r.toFixed(2)+' '+fg+' on '+bg)}
  });return bad});
const gh2=makeGH([T('o','Vencida importante',{due:day(-2),priority:'Alta',requester:'Martín'}),T('t','Para hoy con nota',{due:day(0),notes:'una nota'}),T('w','Más adelante',{due:day(12)}),T('d','Hecha',{done:true,completedAt:L.date().toISOString()}),
  T('i','Anotada ayer',{due:day(-1),inbox:true}),T('r','Respuesta de Ana',{waiting:true,waitingOn:'Ana',waitingSince:L.ago(4)}),T('m','Turno',{due:day(1),time:'11:00'}),T('n','Una nota guardada',{kind:'nota'})]);
for(const vp of [{viewport:{width:375,height:800},isMobile:true,hasTouch:true},{viewport:{width:1100,height:900}}]){
  vp.width=vp.viewport.width;
  ({ctx,p}=await device(b,gh2,{viewport:vp.viewport,isMobile:vp.isMobile,hasTouch:vp.hasTouch,colorScheme:'dark'}));
  ok(await p.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(14, 19, 27)','dark background applied');
  // Hoy (la fila Ordenar, Para reclamar, Próximas con hora, los links), Notas y Buscar también
  let bad=await contrast(p);ok(bad.length===0,'dark contrast Hoy '+vp.width+': '+JSON.stringify(bad));
  await L.go(p,'notas');bad=await contrast(p);ok(bad.length===0,'dark contrast Notas '+vp.width+': '+JSON.stringify(bad));
  await L.go(p,'buscar');await p.evaluate(()=>document.activeElement.blur());bad=await contrast(p);ok(bad.length===0,'dark contrast Buscar '+vp.width+': '+JSON.stringify(bad));
  await L.go(p,'tareas'); // la lista completa (con Terminadas) está en Tareas
  await p.click('#doneToggle');await p.fill('#title','reunión mañana !alta @Juan');await sleep(100);
  bad=await contrast(p);ok(bad.length===0,'dark contrast main '+vp.width+': '+JSON.stringify(bad));
  await p.locator('.task .more').first().click();bad=await contrast(p);ok(bad.length===0,'dark contrast menu: '+JSON.stringify(bad));await p.keyboard.press('Escape');
  await p.locator('.task .body').first().click();bad=await contrast(p);ok(bad.length===0,'dark contrast edit: '+JSON.stringify(bad));await p.click('#editX');
  await p.click('#statusBtn');bad=await contrast(p);ok(bad.length===0,'dark contrast sync: '+JSON.stringify(bad));await p.click('#syncX');
  await p.locator('.task .chk').first().click();await L.until(async()=>(await p.innerText('#toastMsg'))==='Tarea terminada');await sleep(200);bad=await contrast(p);ok(bad.length===0,'dark contrast toast: '+JSON.stringify(bad));
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow '+vp.width);
  await p.screenshot({path:L.out('dark-'+vp.width+'.png'),fullPage:true});
  ok(p.errs.length===0,'dark errors');await ctx.close();
}
({ctx,p}=await device(b,gh2,{viewport:{width:375,height:800},isMobile:true,hasTouch:true,colorScheme:'light'}));
await p.screenshot({path:L.out('light-375.png'),fullPage:true});await ctx.close();
await b.close();})();
