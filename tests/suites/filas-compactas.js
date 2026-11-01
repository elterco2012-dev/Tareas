// Filas compactas (mejora de Claude Design, con un ajuste): el renglón de abajo del título (fecha, pateada, persona,
// repetición, "sin subir") ocupa un renglón mientras entra; si no entra, primero se acorta el nombre de la persona con
// "…" y lo que siga sin entrar baja a otro renglón, nunca se esconde. En el celular la fecha va corta ("Vie 23/10", sin
// " · en 9 días": el grupo ya dice Más adelante) y la fila tiene menos aire, sin achicar letra ni toques. El ⋯ mide 44 px.
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,go}=L;
let APP;
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}};
const BIG=()=>{document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='html{font-size:130%}';document.head.append(s)})};
const items=()=>[
  T('a','Pagar el seguro del auto',{due:day(9),postponed:3,requester:'Laura Fernández'}),
  T('b','Llamar al proveedor de cartuchos',{due:day(12),priority:'Alta',postponed:4,requester:'Martín Rodríguez Echeverría',repeat:'weekdays'}),
  T('j','Revisar stock',{due:day(10),requester:'Juan'}),
  // Esperando, con dos personas: a quién se espera y quién la pidió
  T('w','Presupuesto techo',{waiting:true,waitingOn:'Martín Rodríguez Echeverría',requester:'Laura Fernández',waitingSince:new Date(L.date().getTime()-2*86400000).toISOString()}),
  {...T('n','Código del portón',{notes:'4822'}),kind:'nota',time:null}];
// Cómo quedó una fila (la que se ve, si está en dos lugares): alto, renglones del detalle (por la altura de cada cosa),
// qué se ve entero y qué no, y cuánto se ve de cada nombre (en em de la letra del renglón)
const rowInfo=(p,id)=>p.evaluate(id=>{
  const r=[...document.querySelectorAll('.task[data-id="'+id+'"]')].find(x=>x.offsetHeight);if(!r)return null;
  const m=r.querySelector('.meta'),mr=m.getBoundingClientRect(),fs=parseFloat(getComputedStyle(m).fontSize);
  // (la persona, en el celular, tiene 8 px de relleno con margen negativo para tocarla mejor: no cuenta como afuera)
  const kids=[...m.children].map(c=>{const b=c.getBoundingClientRect(),pad=c.classList.contains('person')?parseFloat(getComputedStyle(c).paddingRight)||0:0;return {t:c.innerText.replace(/\s+/g,' ').trim(),top:b.top,left:b.left,right:b.right-pad,w:b.width}});
  const tops=[];kids.forEach(k=>{if(!tops.some(t=>Math.abs(t-k.top)<fs*0.6))tops.push(k.top)});
  const nm=m.querySelector('.person .nm'),more=r.querySelector('.more').getBoundingClientRect(),chk=r.querySelector('.chk').getBoundingClientRect();
  const names=[...m.querySelectorAll('.person .nm')].map(n=>({t:n.textContent,whole:n.scrollWidth<=n.clientWidth+1,em:+(n.clientWidth/fs).toFixed(1)}));
  return {rowH:Math.round(r.getBoundingClientRect().height),lines:tops.length,texts:kids.map(k=>k.t),names,
    hidden:kids.filter(k=>k.right>mr.right+1||k.w<1).map(k=>k.t),rowOverflow:r.scrollWidth>r.clientWidth+1,
    nameCut:!!nm&&nm.scrollWidth>nm.clientWidth+1,nameEllipsis:!!nm&&getComputedStyle(nm).textOverflow==='ellipsis',
    more:{w:Math.round(more.width),h:Math.round(more.height)},chk:{w:Math.round(chk.width),h:Math.round(chk.height)}};
},id);
const noHScroll=p=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
(async()=>{
const b=await L.launch();APP=await L.appUrl();

// ===== Celular: 390 y 360 px con la letra al 130 %, y 390 px al 100 % =====
const INIT_BIG=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='html{font-size:130%}';document.head.append(s)})};
let together=0;   // en cuántos casos las dos personas de la fila de Esperando quedaron en el mismo renglón
for(const [name,w,big] of [['phone 390 at 130%',390,true],['phone 360 at 130%',360,true],['phone 390 at 100%',390,false]]){
  const gh=makeGH(items());
  const {ctx,p}=await device(b,gh,{viewport:{width:w,height:844},isMobile:true,hasTouch:true},APP,big?INIT_BIG:SEEN);
  await go(p,'tareas');
  // Un cambio que no sube (sin señal): la fila de b dice "sin subir", al final del renglón de detalle
  gh.mode='offline';await p.evaluate(()=>act({type:'edit',id:'b',patch:{notes:'pedir presupuesto'}}));await p.clock.fastForward(6000);await sleep(300);
  const a=await rowInfo(p,'a'),bb=await rowInfo(p,'b'),j=await rowInfo(p,'j'),wt=await rowInfo(p,'w');
  if(big&&w===390){
    ok(a.lines<=2&&a.hidden.length===0&&a.rowH<128,name+': date, "pateada 3×" and the person: at most two lines, shorter than before (128 px) '+JSON.stringify(a));
    ok(a.texts[0]==='Vie 23/10','phone: the date goes short, without " · en 9 días" '+JSON.stringify(a.texts));
  }
  if(!big)ok(a.lines===1&&a.hidden.length===0,name+': date, "pateada 3×" and the person fit in one line '+JSON.stringify(a));
  ok(bb.texts.includes('↻ lun a vie')&&bb.texts.includes('sin subir')&&bb.hidden.length===0,name+': a full row hides nothing (not the repetition, not "sin subir") '+JSON.stringify(bb));
  // (seis datos: antes, al 130 %, eran cuatro renglones a 390 px y cinco a 360 px)
  if(big){const before=w===390?4:5;ok(bb.lines<before,name+': a full row takes fewer lines than before ('+before+') '+bb.lines)}
  // Un nombre se acorta con "…" pero siempre se lee: unas cinco letras o más (antes de esto quedaba "L La…")
  const names=[a,bb,j,wt].flatMap(x=>x.names);
  ok(names.length===5&&names.every(n=>n.whole||n.em>=3.5),name+': every name is whole or shows at least ~5 letters '+JSON.stringify(names));
  ok(bb.names[0].whole||bb.nameEllipsis,name+': a long name that does not fit ends with "…"');
  ok(j.names[0].whole&&j.hidden.length===0,name+': a short name ("Juan") is shown whole');
  ok(wt.hidden.length===0&&wt.names.length===2,name+': waiting row with two people: both visible '+JSON.stringify(wt));
  // Dos personas en el mismo renglón: tocar justo a la derecha del primer nombre filtra por esa persona, no por la otra
  const hit=await p.evaluate(()=>{
    const r=[...document.querySelectorAll('.task[data-id="w"]')].find(x=>x.offsetHeight),ps=[...r.querySelectorAll('.meta .person')];
    const n1=ps[0].querySelector('.nm').getBoundingClientRect(),p2=ps[1].getBoundingClientRect();
    if(Math.abs(n1.top-ps[1].querySelector('.nm').getBoundingClientRect().top)>4)return null;
    const e=document.elementFromPoint(n1.right+4,n1.top+n1.height/2);return {first:ps[0].contains(e)};
  });
  if(hit){together++;ok(hit.first,name+': tapping just right of the first name picks that person, not the next one')}
  ok(!a.rowOverflow&&!bb.rowOverflow&&!wt.rowOverflow&&await noHScroll(p),name+': nothing sticks out to the side');
  ok(a.more.w>=44&&a.more.h>=44&&a.chk.w>=48&&a.chk.h>=48,name+': ⋯ is at least 44×44 and the circle at least 48×48 '+JSON.stringify({more:a.more,chk:a.chk}));
  await go(p,'notas');
  const nm=await p.evaluate(()=>{const e=document.querySelector('.ngrid .more');if(!e)return null;const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)}});
  ok(nm&&nm.w>=44&&nm.h>=44,name+': ⋯ of a note is at least 44×44 '+JSON.stringify(nm));
  ok(p.errs.length===0,name+': no page errors '+JSON.stringify(p.errs));
  await ctx.close();
}
ok(together>0,'the two-people tap check ran at least once (both names on the same line) '+together);

// ===== Compu =====
{const gh=makeGH(items());
 const {ctx,p}=await device(b,gh,{viewport:{width:1280,height:800}},APP,SEEN);
 await go(p,'tareas');
 const a=await rowInfo(p,'a');
 ok(a.texts[0]==='Vie 23/10 · en 9 días','computer: the date keeps " · en 9 días" '+JSON.stringify(a.texts));
 ok(a.lines===1&&a.hidden.length===0,'computer: the detail line fits in one line '+JSON.stringify(a));
 ok(a.more.w>=44&&a.chk.w===52&&a.chk.h===52,'computer: ⋯ is 44 px wide and the circle stays 52 px '+JSON.stringify({more:a.more,chk:a.chk}));
 // La columna de la derecha (Esperando): los dos nombres se leen
 const wt=await rowInfo(p,'w');
 ok(wt&&wt.hidden.length===0&&wt.names.length===2&&wt.names.every(n=>n.whole||n.em>=3.5),'computer, right column: both names of a waiting row are whole or show at least ~5 letters '+JSON.stringify(wt&&wt.names));
 // Si la ventana se angosta hasta el ancho de un celular, la fecha pasa a ser corta (y al revés)
 await p.setViewportSize({width:500,height:800});await sleep(300);
 ok((await rowInfo(p,'a')).texts[0]==='Vie 23/10','computer window made narrow (500 px): the date goes short');
 await p.setViewportSize({width:1280,height:800});await sleep(300);
 ok((await rowInfo(p,'a')).texts[0]==='Vie 23/10 · en 9 días','computer window wide again: the date is long again');
 await go(p,'notas');
 const nm=await p.evaluate(()=>{const r=document.querySelector('.ngrid .more').getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)}});
 ok(nm.w>=44&&nm.h>=44,'computer: ⋯ of a note is at least 44×44 '+JSON.stringify(nm));
 ok(p.errs.length===0,'computer: no page errors '+JSON.stringify(p.errs));
 await ctx.close()}

await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
