// Correcciones de la revisión de la tanda 1
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
let APP;   // la app servida por http (L.appUrl)
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true};
// Reconocimiento falso: __endDelay demora el onend (como Chrome en Android)
const FAKE=()=>{class FakeSR{start(){window.__rec=this;const say=window.__say||[];say.forEach((txt,i)=>setTimeout(()=>{const r=[[{transcript:txt}]];r[0].isFinal=i===say.length-1;this.onresult&&this.onresult({results:r})},60+i*80));if(!window.__hold)setTimeout(()=>this.onend&&this.onend(),120+say.length*80)}
  stop(){setTimeout(()=>this.onend&&this.onend(),window.__endDelay||10)} abort(){setTimeout(()=>this.onend&&this.onend(),10)}}window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR};
const pend=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')||'[]'));
(async()=>{
const b=await L.launch();APP=await L.appUrl();
let gh=makeGH([T('p','Otra',{requester:'Marcela'})]);
// Dock: el aviso va arriba
let {ctx,p}=await device(b,gh,PHONE,APP+'?voz=1',FAKE);
await p.evaluate(()=>{window.__say=['comprar pan']});await p.locator('#dockMic').tap();await sleep(3800);
const hit=await p.evaluate(()=>{const r=document.getElementById('dockClose').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).id});
ok(hit==='dockClose'&&await p.isVisible('#toast'),'toast does not cover "Ver lista": '+hit);
await p.locator('#dockClose').tap();
ok(gh.items.some(x=>x.title==='Comprar pan'),'task kept after tapping Ver lista');
ok(await p.evaluate(()=>getComputedStyle(document.getElementById('toast')).bottom)!=='auto'||!(await p.evaluate(()=>document.body.classList.contains('docked'))),'toast back at the bottom after closing the dock');
await ctx.close();
// Bloquear el celular mientras todavía escucha
({ctx,p}=await device(b,gh,PHONE,APP,FAKE));
await p.evaluate(()=>{window.__say=['llamar a la escribanía'];window.__hold=true});
await p.locator('#addBtn').tap();await sleep(300);
await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{get:()=>'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))});await sleep(300);
ok((await pend(p)).some(o=>o.type==='add'&&o.task.title==='Llamar a la escribanía')||gh.items.some(x=>x.title==='Llamar a la escribanía'),'locking while listening still saves what was understood');
await ctx.close();
// Aviso anterior: se cierra al dictar otra; + Nota y @… detienen la cuenta; "recordame mañana" deja el micrófono
({ctx,p}=await device(b,gh,PHONE,APP,FAKE));
await p.evaluate(()=>{window.__say=['comprar yerba']});await p.locator('#addBtn').tap();await sleep(3800);
ok(await p.isVisible('#toast'),'toast of the first task');
await p.evaluate(()=>{window.__say=['pagar el seguro']});await p.locator('#addBtn').tap();await sleep(100);
ok(!(await p.isVisible('#toast')),'starting a new dictation hides the previous toast');
await sleep(500);await p.locator('#noteToggle').tap();await sleep(3500);
ok(!gh.items.some(x=>x.title==='Pagar el seguro')&&await p.evaluate(()=>!autoSave),'+ Nota stops the countdown');
await p.fill('#title','');await p.fill('#note','');
await p.evaluate(()=>{window.__say=['llamar al banco']});await p.locator('#addBtn').tap();await sleep(500);
await p.locator('#whoRow button',{hasText:'@…'}).tap();await sleep(100);
ok(await p.evaluate(()=>!autoSave),'"@…" stops the countdown');
await p.keyboard.type('Mar');await sleep(100);
ok((await p.innerText('#suggest')).includes('@Marcela'),'person suggestions work on dictated text');
await p.fill('#title','');
await p.evaluate(()=>{window.__say=['recordame mañana']});await p.locator('#addBtn').tap();await sleep(500);
ok(await p.evaluate(()=>document.getElementById('addBtn').dataset.mode)==='mic','bare command: the button stays the mic');
await ctx.close();
// Borrador: no se pierde por una sesión de "Dictar tarea"; "Quitar nota" lo actualiza
({ctx,p}=await device(b,gh,PHONE,APP,FAKE));
await p.locator('#title').tap();await p.keyboard.type('mandar remito a Ferretería Sur');await sleep(100);
await p.goto(APP+'?voz=1');await sleep(500);
await p.evaluate(()=>{window.__say=['comprar pan']});await p.locator('#dockMic').tap();await sleep(3800);
await p.goto(APP);await sleep(500);
ok(await p.inputValue('#title')==='mandar remito a Ferretería Sur','draft survives a "Dictar tarea" session');
await p.locator('#noteToggle').tap();await p.locator('#note').fill('número viejo');await p.evaluate(()=>document.getElementById('note').dispatchEvent(new Event('input')));
await p.locator('#noteToggle').tap();await p.reload();await sleep(500);
ok(!(await p.isVisible('#note'))&&await p.inputValue('#note')==='','"Quitar nota" updates the draft');
await ctx.close();
// Compartir: fecha y prioridad no se pierden
const A=encodeURIComponent('Hola! Mañana, a primera hora, pasá por el banco a depositar');
({ctx,p}=await device(b,gh,PHONE,APP+'?text='+A));
ok((await p.inputValue('#title')).startsWith('Mañana, a primera hora')&&(await p.innerText('#detected')).includes('Mañana'),'"Hola! Mañana, …" keeps the date: '+await p.inputValue('#title'));
await ctx.close();
const B=encodeURIComponent('Buen día! Necesito que me mandes el presupuesto actualizado de las herramientas eléctricas para el cliente nuevo. Es urgente, me lo pidió Laura para mañana a las 10.');
({ctx,p}=await device(b,gh,PHONE,APP+'?text='+B));
const det=await p.innerText('#detected');
ok(!(await p.isVisible('#note'))&&det.includes('Mañana')&&det.includes('10:00')&&det.includes('@Laura')&&det.includes('alta'),'long message with date/priority stays whole: '+det.replace(/\n/g,' '));
await ctx.close();
const C=encodeURIComponent('Mañana tenés que pasar por la oficina del Dr. Gómez en Av. Corrientes para firmar los papeles del seguro. Llevá el DNI y una copia del contrato que te mandé ayer.');
({ctx,p}=await device(b,gh,PHONE,APP+'?text='+C));
ok((await p.inputValue('#title')).includes('Dr. Gómez en Av. Corrientes'),'no split after "Dr." or "Av.": '+await p.inputValue('#title'));
await ctx.close();
await b.close();console.log('fails',L.fails)})();
