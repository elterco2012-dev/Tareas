// Dictado: correcciones (Enter mientras escucha, escribir encima, botón trabado, calendario, aviso en 320 px)
const H=require('../lib/harness');const {ok,sleep,TZ}=H;
const gh={items:[{id:'v',title:'Pagar luz a las 9',priority:'Media',order:0,done:false,due:'2026-10-01'}],sha:1};
async function mock(ctx){await ctx.route('https://api.github.com/**',async route=>{const req=route.request();
  if(req.method()==='PUT'){const body=JSON.parse(req.postData());if(String(body.sha)!==String(gh.sha))return route.fulfill({status:409,body:'{}'});gh.items=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));gh.sha++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.sha)}})})}
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from(JSON.stringify(gh.items)).toString('base64'),sha:String(gh.sha)})})})}
const FAKE=()=>{
  localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'}));
  window.__opened=[];window.open=u=>{window.__opened.push(u);return null};
  class F{start(){window.__rec=this;const say=window.__say||[];say.forEach((t,i)=>setTimeout(()=>{if(this.onresult)this.onresult({results:[[{transcript:t}]]})},(window.__delay||100)+500*i));if(!window.__hold)setTimeout(()=>this.onend&&this.onend(),100+500*say.length)}
    stop(){window.__stopped=(window.__stopped||0)+1;if(!window.__noend)setTimeout(()=>this.onend&&this.onend(),20)}
    abort(){window.__aborted=(window.__aborted||0)+1;if(!window.__noend)setTimeout(()=>this.onend&&this.onend(),20)}}
  window.SpeechRecognition=F;window.webkitSpeechRecognition=F;
};
(async()=>{
const b=await H.launch();
const ctx=await b.newContext({timezoneId:TZ,viewport:{width:375,height:740},isMobile:true,hasTouch:true});await mock(ctx);
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.addInitScript(FAKE);
await p.goto(await H.appUrl());await sleep(500);
const mode=()=>p.evaluate(()=>document.getElementById('addBtn').dataset.mode);
// Enter mientras escucha = Listo (no guarda el parcial)
await p.evaluate(()=>{window.__say=['llamar al banco mañana','llamar al banco mañana a las 10'];window.__hold=true});
await p.locator('#addBtn').tap();await sleep(200);
ok((await p.inputValue('#title'))==='llamar al banco mañana','interim in field');
await p.focus('#title');await p.keyboard.press('Enter');await sleep(100);
ok(await p.evaluate(()=>window.__stopped>=1)&&!gh.items.some(x=>/banco/.test(x.title))&&(await p.evaluate(()=>JSON.parse(localStorage.getItem('tareasPendientes')||'[]').length))===0,'Enter while listening stops instead of saving');
await sleep(600);
ok((await mode())==='saving'&&(await p.inputValue('#title'))==='llamar al banco mañana','text left in the field, saving countdown');
await p.evaluate(()=>cancelAutoSave());
ok((await p.innerText('#detected')).split('\n')[0]==='Llamar al banco','Detectado shows the full title to be saved: '+(await p.innerText('#detected')).replace(/\n/g,' | '));
await p.fill('#title','');
// Escribir mientras escucha corta el dictado y no se pisa. El resultado de mentira llega tarde (1,5 s), después
// de lo que se escribe, así se prueba que un resultado que llega después no pisa lo escrito.
await p.evaluate(()=>{window.__say=['algo dictado'];window.__hold=true;window.__aborted=0;window.__delay=1500});
await p.locator('#addBtn').tap();
await p.focus('#title');await p.keyboard.type('pagar luz');await sleep(1800);
ok(await p.evaluate(()=>window.__aborted>=1)&&(await p.inputValue('#title'))==='pagar luz'&&(await mode())==='add','typing during dictation aborts it and keeps typed text');
await p.evaluate(()=>{window.__delay=0});
await p.fill('#title','');await p.evaluate(()=>document.activeElement.blur());
// El navegador nunca avisa el fin: el botón se libera igual
await p.evaluate(()=>{window.__say=[];window.__hold=true;window.__noend=true});
await p.locator('#addBtn').tap();await sleep(50);ok((await mode())==='listening','listening');
await p.locator('#addBtn').tap();await sleep(4300);
ok((await mode())==='mic','button recovers if onend never fires');
await p.evaluate(()=>{window.__noend=false;window.__hold=false});
// Calendario de tarea vencida → hoy
await p.locator('.task',{hasText:'Pagar luz'}).locator('.more').tap();
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#menu button:has-text("Agregar al calendario")')]);
const today=(await p.evaluate(()=>ymd(new Date()))).replace(/-/g,'');
let url=require('fs').readFileSync(await dl.path(),'utf8');
ok(url.includes('DTSTART:'+today+'T090000')&&url.includes('DTEND:'+today+'T093000'),'overdue task goes to the calendar today');
// 12 de la noche → 00:00 del día siguiente
url=await p.evaluate(()=>{const q=parse('cerrar sistema mañana a las 12 de la noche');return icsText({id:'m',title:q.title,...whenFields(q,q.due)})});
const d2=(await p.evaluate(()=>addDays(2))).replace(/-/g,'');
ok(url.includes('DTSTART:'+d2+'T000000')&&url.includes('DTEND:'+d2+'T003000'),'12 de la noche = midnight');
// 23:45 cruza la medianoche
url=await p.evaluate(()=>icsText({id:'y',title:'x a las 23:45',due:addDays(1)}));
const d1=(await p.evaluate(()=>addDays(1))).replace(/-/g,'');
ok(url.includes('DTSTART:'+d1+'T234500')&&url.includes('DTEND:'+d2+'T001500'),'23:45 end crosses midnight');
// Hora de la mañana que ya pasó hoy → de la noche (solo al dictar/escribir para hoy)
const ev=await p.evaluate(()=>{const now=new Date();const h=now.getHours();return {h,res:h>=9?timeLabel(parse('llamar a las 8',addDays(0)).time):null,tom:timeLabel(parse('llamar a las 8',addDays(1)).time)}});
ok(ev.tom==='08:00','"a las 8" tomorrow stays 08:00');
if(ev.res)ok(ev.res==='20:00','"a las 8" today after 8am becomes 20:00');
// Aviso en 320px: el texto no se corta
await p.setViewportSize({width:320,height:640});
await p.fill('#title','recordame el lunes llamar al banco a las 10');await p.locator('#addBtn').tap();await sleep(300);
const tb=await p.evaluate(()=>{const m=document.getElementById('toastMsg');return {sw:m.scrollWidth,cw:m.clientWidth,txt:m.textContent}});
ok(tb.sw<=tb.cw+1,'toast message not truncated at 320px: '+tb.txt);
ok(errs.length===0,'no page errors '+JSON.stringify(errs));
await b.close();})();
