// Repetidas y pegar varias líneas con la subida en curso, compartir sin share=1, mensual día 31, calendario tarde
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,TZ,go}=L;
(async()=>{
const b=await L.launch();const APP=await L.appUrl();
const mob={viewport:{width:375,height:740},isMobile:true,hasTouch:true};
// 1) Deshacer de una repetida con la subida en curso
let gh=makeGH([T('r','Semanal',{due:day(0),repeat:'weekly'})]);
let {ctx,p}=await device(b,gh,mob);
gh.putDelay=1500;
await p.locator('.task',{hasText:'Semanal'}).locator('.chk').tap();await sleep(400);
await p.locator('#toastUndo').tap();await sleep(4000);gh.putDelay=0;
ok(gh.items.length===1&&gh.items[0].id==='r'&&gh.items[0].done===false,'repeat undo during in-flight PUT leaves only the original: '+JSON.stringify(gh.items.map(x=>[x.title,x.due,x.done])));
ok((await p.locator('.task',{hasText:'Semanal'}).count())===1,'one row in the UI');
// 3) Terminar, reabrir y terminar otra vez → una sola próxima
await p.locator('.task',{hasText:'Semanal'}).locator('.chk').tap();await L.until(()=>gh.items.find(x=>x.id==='r')?.done&&gh.items.length===2);
await go(p,'tareas');await p.locator('#doneToggle').tap();await p.locator('.drow',{hasText:'Semanal'}).locator('.chk').tap();await L.until(()=>gh.items.find(x=>x.id==='r')?.done===false);
await p.locator('#groups .task',{hasText:'Semanal'}).first().locator('.chk').tap();await L.until(()=>gh.items.find(x=>x.id==='r')?.done);
const pend=gh.items.filter(x=>!x.done);
ok(pend.length===1&&pend[0].due===day(7),'reopen + complete again → single next occurrence: '+JSON.stringify(gh.items.map(x=>[x.id.slice(0,4),x.due,x.done])));
await ctx.close();
// 3b) Dos dispositivos terminan la misma repetida
gh=makeGH([T('r2','Diaria',{due:day(0),repeat:'daily'})]);
const A=await device(b,gh,{viewport:{width:1000,height:800}}),B=await device(b,gh,mob);
gh.putDelay=300;
await Promise.all([A.p.locator('.task',{hasText:'Diaria'}).locator('.chk').click(),B.p.locator('.task',{hasText:'Diaria'}).locator('.chk').tap()]);
await sleep(3500);gh.putDelay=0;
ok(gh.items.filter(x=>!x.done).length===1,'two devices completing → single next: '+JSON.stringify(gh.items.map(x=>[x.title,x.due,x.done])));
await A.ctx.close();await B.ctx.close();
// 2) Deshacer de pegar varias líneas con la subida en curso
gh=makeGH([T('e','Existente',{due:day(0)})]);
({ctx,p}=await device(b,gh,mob));
await p.evaluate(()=>openBulk(['Uno','Dos','Tres']));await p.locator('#bulkOk').tap();
gh.putDelay=1500;await sleep(400);await p.locator('#toastUndo').tap();await sleep(4000);gh.putDelay=0;
ok(JSON.stringify(gh.items.map(x=>x.title))==='["Existente"]','bulk undo during in-flight PUT removes all: '+JSON.stringify(gh.items.map(x=>x.title)));
// 5) Pegar desde el portapapeles del teclado (beforeinput insertText con saltos de línea)
await p.focus('#title');
await p.evaluate(()=>{const t=document.getElementById('title');const ev=new InputEvent('beforeinput',{inputType:'insertText',data:'Comprar toner\nLlamar a Laura',bubbles:true,cancelable:true});t.dispatchEvent(ev)});
ok(await p.isVisible('#bulkOv')&&(await p.$$eval('#bulkList .inp',x=>x.map(y=>y.value))).join('|')==='Comprar toner|Llamar a Laura','keyboard-clipboard insert opens the bulk modal');
await p.keyboard.press('Escape');
// 10) números al principio
const lines=await p.evaluate(()=>splitLines('1.000 tornillos M8\n9.30 reunión con Laura\n1. pan\n1) leche\n1.Comprar pan\n10) diez\n- [ ] tarea\n2.5 kg harina'));
ok(JSON.stringify(lines)===JSON.stringify(['1.000 tornillos M8','9.30 reunión con Laura','pan','leche','Comprar pan','diez','tarea','2.5 kg harina']),'bullets vs numbers: '+JSON.stringify(lines));
await ctx.close();
// 8) Compartir sin ?share=1 (como lo arma Chrome en Android)
({ctx,p}=await device(b,makeGH([]),mob,APP+'?title=&text='+encodeURIComponent('Pasar a buscar el pedido mañana')+'&url='));
ok((await p.inputValue('#title'))==='Pasar a buscar el pedido mañana'&&await p.evaluate(()=>location.search==='')&&await p.evaluate(()=>document.activeElement.id==='title'),'share via title/text/url params (no share=1)');
await ctx.close();
// 6) Monthly anchor 31 → 28 → 31
const c2=await b.newContext({timezoneId:TZ,clock:false});await c2.route('https://api.github.com/**',r=>r.abort());
const pc=await c2.newPage();await pc.clock.install({time:new Date('2026-01-31T12:00:00-03:00')});
await pc.goto(APP);await sleep(300);
const res=await pc.evaluate(()=>{
  remote=[{id:'m',title:'Pagar alquiler',due:'2026-01-31',repeat:'monthly',done:false,priority:'Media'}];setOutbox([]);recompute();
  toggle(tasks.find(t=>t.id==='m'));
  const n1=tasks.find(t=>t.repeatOf==='m');
  return {due:n1.due,repeatDay:n1.repeatDay,next2:nextDue({...n1,due:n1.due})};
});
ok(res.due==='2026-02-28'&&res.repeatDay===31&&res.next2==='2026-03-31','monthly keeps day 31: '+JSON.stringify(res));
// 9) Calendario después de las 23 → mañana 9:00
await pc.clock.setFixedTime(new Date('2026-01-31T23:20:00-03:00'));
const ics=await pc.evaluate(()=>icsText({id:'q',title:'Sin hora',due:ymd(new Date())}));
ok(ics.includes('DTSTART:20260201T090000'),'after 23:00, today task without time → tomorrow 9:00');
await c2.close();
// 7) Placeholder en modo oscuro
({ctx,p}=await device(b,makeGH([]),{...mob,colorScheme:'dark'}));
const r=await p.evaluate(()=>{const c=getComputedStyle(document.getElementById('title'),'::placeholder').color;return c});
ok(r==='rgb(143, 155, 176)','dark placeholder uses --muted (#8f9bb0): '+r);
await ctx.close();
const man=JSON.parse(L.readRepo('manifest.webmanifest'));
ok(man.share_target.action==='./','manifest share_target action ./');
await b.close();})();
