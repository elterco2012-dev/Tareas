// Regresiones: deshacer sin señal, Espacio con foco en un botón, menú anclado, modal, teclado, texto libre
const H=require('../lib/harness');const {ok,sleep,TZ}=H;
let APP;   // la app servida por http (H.appUrl)
const gh={items:[],sha:1,mode:'ok'};
async function mock(ctx,devOffline){
  await ctx.route('https://api.github.com/**',async route=>{
    const req=route.request();
    if(gh.mode==='offline'||devOffline.v)return route.abort('internetdisconnected');
    if(req.method()==='PUT'){
      const body=JSON.parse(req.postData());
      if(String(body.sha)!==String(gh.sha))return route.fulfill({status:409,body:'{}'});
      gh.items=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));gh.sha++;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.sha)}})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from(JSON.stringify(gh.items)).toString('base64'),sha:String(gh.sha)})});
  });
}
async function device(b,opts){
  const off={v:false};const ctx=await b.newContext({timezoneId:TZ,...opts});await mock(ctx,off);
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  await p.addInitScript(()=>{if(!sessionStorage.getItem('i')){sessionStorage.setItem('i','1');localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'}))}});
  await p.goto(APP);await sleep(500);return {ctx,p,off};
}
const row=(p,t)=>p.locator('.task',{hasText:t}).first();
(async()=>{
const b=await H.launch();APP=await H.appUrl();
gh.items=['Uno','Dos','Tres','Cuatro'].map((t,i)=>({id:'t'+i,title:t,priority:'Media',order:i,done:false,due:null,notes:'',requester:''}));
// 1) Deshacer borrado sin señal no pisa cambios del otro dispositivo
const P=await device(b,{viewport:{width:375,height:740},isMobile:true,hasTouch:true}),D=await device(b,{viewport:{width:1100,height:900}});
P.off.v=true;
await row(P.p,'Dos').locator('.more').tap();await P.p.click('#menu button:has-text("Borrar")');await P.p.click('#toastUndo');await sleep(200);
ok(await P.p.evaluate(()=>{const o=JSON.parse(localStorage.getItem('tareasPendientes'));return o.length===2&&o[0].patch.deletedAt&&o[1].patch.deletedAt===null}),'undo queues the restore');
await row(D.p,'Dos').locator('.body').click();await D.p.fill('#eNotes','Pedir datos a Ana');await D.p.click('#editForm button[type=submit]');await sleep(300);
await row(D.p,'Dos').locator('.chk').click();await sleep(400);await sleep(300);
P.off.v=false;await P.p.evaluate(()=>window.dispatchEvent(new Event('online')));await sleep(600);
const dos=gh.items.find(x=>x.id==='t1');
ok(dos&&dos.notes==='Pedir datos a Ana'&&dos.done===true&&!dos.deletedAt,'other device\'s edit + done survive phone undo-delete: '+JSON.stringify(dos&&{n:dos.notes,d:dos.done}));
// undo after the delete already uploaded restores the task
await row(D.p,'Tres').locator('.more').click();await D.p.click('#menu button:has-text("Borrar")');await sleep(400);
ok(gh.items.find(x=>x.id==='t2').deletedAt,'delete uploaded (to the trash)');
await D.p.click('#toastUndo');await sleep(400);
ok(!!gh.items.find(x=>x.id==='t2')&&!gh.items.find(x=>x.id==='t2').deletedAt,'undo after upload restores task');
await P.ctx.close();
// 2) Espacio con un botón clickeado en foco actúa sobre la fila elegida
const p=D.p;
await p.click('#doneToggle');await p.keyboard.press('ArrowDown');
const selT=await p.evaluate(()=>document.querySelector('.task.sel .ttext').textContent);
await p.keyboard.press(' ');await sleep(300);
ok(gh.items.find(x=>x.title===selT).done===true&&await p.evaluate(()=>!document.getElementById('doneWrap').classList.contains('hidden')),'Space after clicking Terminadas completes the selected row');
await p.click('#toastUndo');await sleep(300);
await p.click('#statusBtn');await p.keyboard.press('Escape');await p.keyboard.press('ArrowDown');
const selT2=await p.evaluate(()=>document.querySelector('.task.sel .ttext').textContent);
await p.keyboard.press(' ');await sleep(300);
ok(gh.items.find(x=>x.title===selT2).done===true&&!(await p.isVisible('#syncOv')),'Space after closing Sincronización completes the row');
await p.click('#toastUndo');await sleep(300);
// 3) Menú bien ubicado aunque el tip se oculte (compu con autofoco)
await p.reload();await sleep(500);
ok(await p.isVisible('#tip'),'tip visible on desktop load');
await row(p,'Cuatro').locator('.more').click();await sleep(100);
const pos=await p.evaluate(()=>{const b=[...document.querySelectorAll('.task')].find(r=>r.textContent.includes('Cuatro')).querySelector('.more').getBoundingClientRect(),m=document.getElementById('menu').getBoundingClientRect();return {gap:Math.round(m.top-b.bottom),up:Math.round(b.top-m.bottom)}});
ok(pos.gap===2||pos.up===2,'menu anchored to its button after tip collapse '+JSON.stringify(pos));
await p.keyboard.press('Escape');
// 4) Arrastrar una selección fuera del modal no lo cierra
await row(p,'Uno').locator('.body').click();await p.fill('#eNotes','sin guardar');
const ti=await p.locator('#eTitle').boundingBox();
await p.mouse.move(ti.x+ti.width-5,ti.y+ti.height/2);await p.mouse.down();await p.mouse.move(5,ti.y+ti.height/2,{steps:5});await p.mouse.up();
ok(await p.isVisible('#editOv')&&(await p.inputValue('#eNotes'))==='sin guardar','drag-select out of modal keeps it open');
await p.mouse.click(5,5);ok(!(await p.isVisible('#editOv')),'plain backdrop click still closes');
// 5) E abre la edición con el foco adentro y el fondo inactivo
await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('ArrowDown');await p.keyboard.press('e');
ok(await p.evaluate(()=>document.activeElement.id)==='eTitle','E: focus inside edit modal');
await p.keyboard.type(' editado');await p.keyboard.press('Enter');await sleep(300);
ok(gh.items.some(x=>/ editado$/.test(x.title)),'type + Enter saves from keyboard');
await p.keyboard.press('ArrowDown');await p.keyboard.press('e');
for(let i=0;i<12;i++)await p.keyboard.press('Tab');
ok(await p.evaluate(()=>!!document.activeElement.closest('#editOv')||document.activeElement===document.body),'Tab stays out of the page behind the modal');
await p.keyboard.press('Escape');
ok(await p.evaluate(()=>!document.getElementById('wrap').inert),'page active again after closing');
// 6) Texto libre
const P2=await p.evaluate(()=>[parse('Pasar por el banco a la mañana'),parse('Reunión de equipo los lunes'),parse('Llamar esta mañana'),parse('Llamar a la mañana del viernes'),parse('Hablar con @Juan, urgente'),parse('Correo a juan@empresa.com mañana')]);
ok(!P2[0].due&&P2[0].title==='Pasar por el banco a la mañana','"a la mañana" is not a date');
ok(!P2[1].due&&P2[1].title==='Reunión de equipo los lunes','"los lunes" is not a date');
ok(!P2[2].due,'"esta mañana" is not a date');
ok(P2[3].due&&new Date(P2[3].due+'T12:00').getDay()===5&&P2[3].title==='Llamar a la mañana','"a la mañana del viernes" → viernes: '+P2[3].title);
ok(P2[4].requester==='Juan','"@Juan," → Juan');
ok(!P2[5].requester&&P2[5].due,'email not taken as @persona');
ok(D.p.errs.length===0,'no page errors '+JSON.stringify(D.p.errs));
await b.close();})();
