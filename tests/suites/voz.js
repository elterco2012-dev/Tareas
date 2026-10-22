// Dictado por voz: botón micrófono/Agregar, confirmación, aviso, calendario, errores
const H=require('../lib/harness');const {ok,sleep,TZ,go}=H;
const gh={items:[{id:'a',title:'Tarea existente',priority:'Media',order:0,done:false,due:null}],sha:1};
async function mock(ctx){await ctx.route('https://api.github.com/**',async route=>{const req=route.request();
  if(req.method()==='PUT'){const body=JSON.parse(req.postData());if(String(body.sha)!==String(gh.sha))return route.fulfill({status:409,body:'{}'});gh.items=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));gh.sha++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.sha)}})})}
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from(JSON.stringify(gh.items)).toString('base64'),sha:String(gh.sha)})})})}
// Reconocimiento de voz simulado: el test decide qué "se dijo" con window.__say / __fail
const FAKE=()=>{
  localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'}));
  window.__opened=[];window.open=(u)=>{window.__opened.push(u);return null};
  class FakeSR{constructor(){window.__rec=this;this.started=false}
    start(){this.started=true;window.__lang=this.lang;window.__interim=this.interimResults;
      const say=window.__say||[],fail=window.__fail;
      if(fail){setTimeout(()=>{this.onerror&&this.onerror({error:fail});this.onend&&this.onend()},50);return}
      say.forEach((txt,i)=>setTimeout(()=>{const r=[[{transcript:txt}]];r[0].isFinal=i===say.length-1;this.onresult&&this.onresult({results:r})},i===0?80:600));
      if(!window.__hold)setTimeout(()=>this.onend&&this.onend(),700);
    }
    stop(){window.__stopped=true;setTimeout(()=>this.onend&&this.onend(),10)}
    abort(){window.__aborted=true;setTimeout(()=>this.onend&&this.onend(),10)}}
  window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR;
};
(async()=>{
const b=await H.launch();const APP=await H.appUrl();
const ctx=await b.newContext({timezoneId:TZ,viewport:{width:375,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:2});await mock(ctx);
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(FAKE);
await p.goto(APP);await sleep(500);
const btn=()=>p.evaluate(()=>{const b=document.getElementById('addBtn');return {mode:b.dataset.mode,type:b.type,label:b.getAttribute('aria-label'),text:b.textContent.trim(),cls:b.className,w:Math.round(b.getBoundingClientRect().width)}});
let s=await btn();
ok(s.mode==='mic'&&s.label==='Dictar tarea'&&s.type==='button','empty field shows mic button '+JSON.stringify(s));
const wMic=s.w;
await p.fill('#title','escrito');s=await btn();
ok(s.mode==='add'&&s.text==='Agregar'&&s.type==='submit','typing switches to Agregar');
ok(s.w===wMic,'same width in both states (no layout shift) '+wMic+'/'+s.w);
await p.fill('#title','');ok((await btn()).mode==='mic','clearing returns to mic');
// Dictado completo → confirma antes de guardar
await p.evaluate(()=>{window.__say=['recordame mañana','recordame mañana a las 3 llamar al banco'];window.__hold=true});
await p.locator('#addBtn').tap();await sleep(30);
s=await btn();
ok(s.mode==='listening'&&s.text==='Listo'&&/listening/.test(s.cls),'listening state shows Listo in red');
ok(await p.getAttribute('#title','placeholder')==='Escuchando…','placeholder Escuchando…');
ok(!(await p.isVisible('#tip')),'tip hidden while listening');
ok(await p.evaluate(()=>window.__lang==='es-AR'&&window.__interim===true),'es-AR with interim results');
await sleep(150);
ok((await p.inputValue('#title'))==='recordame mañana','interim text shown live');
await sleep(600);
ok((await p.inputValue('#title'))==='recordame mañana a las 3 llamar al banco','final text in field');
await p.locator('#addBtn').tap();await sleep(60);
ok(await p.evaluate(()=>window.__stopped===true),'tapping Listo stops listening');
s=await btn();ok(s.mode==='saving'&&/Guardar · 3/.test(s.text),'after dictation the button counts down to save: '+s.text);
const det=await p.innerText('#detected');
ok(det.includes('Mañana')&&det.includes('15:00'),'Detectado shows date and time: '+det.replace(/\n/g,' '));
ok(!gh.items.some(x=>/banco/.test(x.title))&&(await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')||'[]').length))===0,'nothing saved before confirming');
ok(await p.evaluate(()=>document.activeElement!==document.getElementById('title')),'keyboard not opened after dictation (field not focused)');
await p.locator('#addBtn').tap();await sleep(400);
const t=gh.items.find(x=>/banco/.test(x.title));
const tomorrow=await p.evaluate(()=>addDays(1));
ok(t&&t.title==='Llamar al banco'&&t.due===tomorrow,'saved after Agregar: '+JSON.stringify(t&&{t:t.title,d:t.due}));
ok((await p.innerText('#toastMsg'))==='Agregada para mañana · 15:00'&&(await p.innerText('#toastUndo'))==='Deshacer'&&(await p.innerText('#toastB2'))==='Cambiar'&&(await p.innerText('#toastB3'))==='Al calendario','toast offers Deshacer, Cambiar, Al calendario: '+(await p.innerText('#toastMsg')));
ok(await p.evaluate(()=>document.activeElement!==document.getElementById('title')),'mobile: keyboard not reopened after tapping Agregar');
const [dl1]=await Promise.all([p.waitForEvent('download'),p.locator('#toastB3').tap()]);
let url=require('fs').readFileSync(await dl1.path(),'utf8');
const d=tomorrow.replace(/-/g,'');
ok(url.includes('DTSTART:'+d+'T150000')&&url.includes('DTEND:'+d+'T153000')&&url.includes('SUMMARY:Llamar al banco\r\n'),'calendar event (.ics) 15:00-15:30');
// Minúscula dictada → mayúscula al guardar
await p.evaluate(()=>{window.__say=['comprar pan el viernes'];window.__hold=false});
await p.locator('#addBtn').tap();await sleep(900);
await p.locator('#addBtn').tap();await sleep(300);
ok(gh.items.some(x=>x.title==='Comprar pan'),'dictated lowercase saved capitalized');
ok(!(await p.isVisible('#toastB3')),'no calendar offer without time/recordame');
// Menú: agregar al calendario (todo el día); la tarea sin fecha está en Tareas
await go(p,'tareas');await p.locator('.task',{hasText:'Tarea existente'}).locator('.more').tap();
const [dl2]=await Promise.all([p.waitForEvent('download'),p.click('#menu button:has-text("Agregar al calendario")')]);
url=require('fs').readFileSync(await dl2.path(),'utf8');
const today=(await p.evaluate(()=>ymd(new Date()))).replace(/-/g,'');
const tmw=(await p.evaluate(()=>addDays(1))).replace(/-/g,'');
ok(new RegExp('DTSTART:(?:'+today+'|'+tmw+')T\\d{6}').test(url),'menu calendar event (.ics) for today without time');
// Errores
for(const [err,msg] of [['not-allowed','Permití el uso del micrófono para dictar'],['network','Sin señal: tocá el micrófono del teclado para dictar'],['no-speech','No se escuchó nada. Probá de nuevo']]){
  await p.evaluate(e=>{window.__fail=e},err);await p.locator('#addBtn').tap();await sleep(150);
  ok((await p.innerText('#toastMsg'))===msg&&(await btn()).mode==='mic',err+' → "'+msg+'"');
}
await p.evaluate(()=>{window.__fail=null});
await p.screenshot({path:H.out('voice-375.png')});
// Esc corta el dictado (compu)
const ctx2=await b.newContext({timezoneId:TZ,viewport:{width:1000,height:800}});await mock(ctx2);
const q=await ctx2.newPage();q.on('pageerror',e=>errs.push(e.message));await q.addInitScript(FAKE);await q.goto(APP);await sleep(400);
await q.evaluate(()=>{window.__say=['algo'];window.__hold=true});await q.click('#addBtn');await sleep(50);
await q.keyboard.press('Escape');await sleep(50);
ok(await q.evaluate(()=>window.__aborted===true&&document.getElementById('addBtn').dataset.mode!=='listening'),'Esc aborts dictation');
// Sin reconocimiento de voz: siempre Agregar
const ctx3=await b.newContext({timezoneId:TZ});await mock(ctx3);
const r=await ctx3.newPage();r.on('pageerror',e=>errs.push(e.message));
await r.addInitScript(()=>{delete window.webkitSpeechRecognition;delete window.SpeechRecognition;localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'}))});
await r.goto(APP);await sleep(300);
ok(await r.evaluate(()=>{const b=document.getElementById('addBtn');return b.dataset.mode==='add'&&b.textContent==='Agregar'}),'without speech support the button is always Agregar');
ok(errs.length===0,'no page errors '+JSON.stringify(errs));
await b.close();})();
