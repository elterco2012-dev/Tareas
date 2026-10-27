// Rediseño fase 3: la ayuda de atajos (tecla ?, y al pie de la barra lateral solo N, /, . y ?), la letra grande
// (130 %: nada se corta ni obliga a deslizar a los costados) y el contraste en los dos temas.
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
let APP;
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}};
const BIG=()=>{document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='html{font-size:130%}';document.head.append(s)})};
const ago=n=>new Date(L.date().getTime()-n*86400000).toISOString();
const items=()=>[
  T('o','Pagar el seguro del auto que vence esta semana',{due:day(-2),priority:'Alta',requester:'Laura Fernández',repeat:'monthly',postponed:3,notes:'póliza https://empresa.atlassian.net/browse/WB-3438'}),
  T('h','Turno dentista',{due:day(0),time:'00:30',requester:'Juan'}),T('h2','Más tarde',{due:day(0),time:'23:30'}),
  T('i','Comprar pilas',{due:day(0),inbox:true}),T('s','Sin fecha cosa',{due:null}),
  T('w','Presupuesto techo',{waiting:true,waitingOn:'Martín',waitingSince:ago(5),lastNudge:ago(4),nudges:2,followUp:day(0)}),
  ...['amarillo','verde','azul','rosa','lila',''].map((c,i)=>({...T('n'+i,'Nota '+(c||'sin color'),{notes:'detalle de la nota'}),kind:'nota',time:null,pinned:i<2,color:c,idea:i===5}))];
// Lo que se corta o sale de la pantalla (sin contar lo oculto a propósito para lectores de pantalla)
const audit=p=>p.evaluate(()=>{
  const out=[];if(document.documentElement.scrollWidth>innerWidth+1)out.push('scroll horizontal '+document.documentElement.scrollWidth);
  for(const e of document.querySelectorAll('body *')){
    const r=e.getBoundingClientRect();if(r.width<2||r.height<2)continue;
    const c=getComputedStyle(e);if(c.visibility==='hidden')continue;
    if(r.right>innerWidth+1&&c.position!=='fixed'&&!e.closest('.swbg'))out.push('afuera '+(e.id||e.className||e.tagName));
    const clip=/hidden|clip/.test(c.overflow+c.overflowX+c.overflowY);
    if(clip&&e.childNodes.length&&(e.scrollWidth>e.clientWidth+2&&c.textOverflow!=='ellipsis'||e.scrollHeight>e.clientHeight+2&&!/\d/.test(c.webkitLineClamp)&&!/auto|scroll/.test(c.overflowY)))out.push('cortado '+(e.id||e.className||e.tagName));
  }
  return [...new Set(out)];
});
const contrast=p=>p.evaluate(()=>{
  const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
  const bgOf=el=>{for(let e=el;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;const a=c.match(/[\d.]+/g);if(a&&(a.length<4||+a[3]>0.5))return c}return getComputedStyle(document.body).backgroundColor};
  const bad=[];const seen=new Set();
  document.querySelectorAll('body *').forEach(el=>{
    const r0=el.getBoundingClientRect();if(r0.width<3||r0.height<3)return;
    const txt=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join(' ');if(!txt)return;
    const cs=getComputedStyle(el);if(cs.visibility==='hidden'||+cs.opacity<.6)return;
    const L1=lum(cs.color),L2=lum(bgOf(el)),r=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
    const key=(el.id||el.className||el.tagName)+':'+txt.slice(0,24);
    if(r<4.5&&!seen.has(key)){seen.add(key);bad.push(key+' '+r.toFixed(2))}
  });return bad});
// Recorre las pantallas (y el detalle, Posponer, Ajustes y el alta) y junta lo que encuentre f
async function tour(p,f,phone){
  const res={};
  res.hoy=await f(p);
  await go(p,'tareas');await p.evaluate(()=>{showDone=true;renderList()});await sleep(150);res.tareas=await f(p);
  await go(p,'notas');res.notas=await f(p);
  await go(p,'tareas');await p.locator('.task .body').first().click();await sleep(300);res.detalle=await f(p);await p.keyboard.press('Escape');await sleep(150);
  await go(p,'notas');await p.locator('.task.note .body').first().click();await sleep(300);res.nota=await f(p);await p.keyboard.press('Escape');await sleep(150);
  await p.evaluate(()=>openSettings());await sleep(300);res.ajustes=await f(p);await p.evaluate(()=>closeSettings('hoy'));await sleep(150);
  await p.evaluate(()=>openPos(tasks.find(x=>x.id==='h2')));await sleep(200);res.posponer=await f(p);await p.keyboard.press('Escape');await sleep(150);
  if(phone){await p.evaluate(()=>openCap(false));await p.fill('#title','recordame mañana a las 3 llamar a Juan @Laura');await p.dispatchEvent('#title','input');await sleep(200);res.alta=await f(p)}
  return Object.entries(res).filter(([,v])=>v.length);
}
(async()=>{
const b=await L.launch();APP=await L.appUrl();
// ===== Ayuda de atajos =====
let gh=makeGH(items());
let {ctx,p}=await device(b,gh,{viewport:{width:1300,height:900}},APP,SEEN);
const foot=await p.evaluate(()=>[...document.querySelectorAll('#shortcuts > *')].filter(e=>e.getBoundingClientRect().height).map(e=>e.querySelector('kbd').textContent));
ok(JSON.stringify(foot)===JSON.stringify(['N','/','.','?']),'sidebar foot: only N, /, . and ? '+JSON.stringify(foot));
await p.evaluate(()=>document.activeElement.blur());
await p.keyboard.press('?');await sleep(200);
ok(await p.isVisible('#helpOv')&&await p.locator('#helpList dt').count()>=17&&/otra fecha/.test(await p.innerText('#helpList')),'? opens the help with all the shortcuts');
await p.keyboard.press('j');await sleep(100);
ok(await p.evaluate(()=>!sel),'with the help open, keys do not move the list');
await p.keyboard.press('Escape');await sleep(150);
ok(!(await p.isVisible('#helpOv')),'Esc closes it');
await p.locator('#title').click();await p.keyboard.type('¿qué?');await sleep(100);
ok(!(await p.isVisible('#helpOv'))&&(await p.inputValue('#title')).includes('?'),'typing ? in a field just writes it');
await p.fill('#title','');
await p.locator('#shortcuts .scbtn').click();await sleep(150);
ok(await p.isVisible('#helpOv'),'"? todos los atajos" opens it too');
await p.locator('#helpX').click();await sleep(150);
ok(!(await p.isVisible('#helpOv'))&&await p.evaluate(()=>!$('wrap').inert),'✕ closes it and the list is usable again');
// Desde la pantalla Ajustes (con el botón del pie): al cerrar, todo sigue andando
await p.locator('#setBtn').click();await sleep(300);
await p.locator('#shortcuts .scbtn').click();await sleep(150);
ok(await p.isVisible('#helpOv'),'the help opens from the sidebar while on Ajustes');
await p.keyboard.press('Escape');await sleep(150);
ok(!(await p.isVisible('#helpOv'))&&await p.evaluate(()=>!$('wrap').inert&&document.body.dataset.screen==='ajustes'),'closing it on Ajustes leaves the app usable (still on Ajustes)');
await p.locator('#navHoy').click({timeout:3000});await sleep(200);
ok(await p.evaluate(()=>document.body.dataset.screen)==='hoy','and the sidebar responds');
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();

// ===== Letra grande (130 %) =====
for(const [name,opts,phone] of [['phone 360',{viewport:{width:360,height:780},isMobile:true,hasTouch:true},true],['computer',{viewport:{width:1300,height:900}},false],['narrow computer',{viewport:{width:1000,height:800}},false]]){
  gh=makeGH(items());
  ({ctx,p}=await device(b,gh,opts,APP,()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas','{"gestos":1,"punto":1}');localStorage.setItem('tipVisto','9')}document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='html{font-size:130%}';document.head.append(s)})}));
  ok(await p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.ttext')).fontSize))>20,name+': at 130% the text grows');
  const bad=await tour(p,audit,phone);
  ok(bad.length===0,name+' at 130%: nothing cut off or off screen '+JSON.stringify(bad));
  ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
  await ctx.close();
}

// ===== Contraste en los dos temas =====
for(const theme of ['light','dark'])for(const [name,opts,phone] of [['phone',{viewport:{width:384,height:832},isMobile:true,hasTouch:true},true],['computer',{viewport:{width:1300,height:900}},false]]){
  gh=makeGH(items());
  ({ctx,p}=await device(b,gh,{...opts,colorScheme:theme},APP,SEEN));
  const bad=await tour(p,contrast,phone);
  ok(bad.length===0,theme+' '+name+': contrast of at least 4.5:1 '+JSON.stringify(bad));
  await ctx.close();
}
await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
