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
  {...T('n','Código del portón',{notes:'4822'}),kind:'nota',time:null}];
// Cómo quedó una fila: alto, renglones del detalle (por la altura de cada cosa), qué se ve entero y qué no
const rowInfo=(p,id)=>p.evaluate(id=>{
  const r=document.querySelector('.task[data-id="'+id+'"]');if(!r)return null;
  const m=r.querySelector('.meta'),mr=m.getBoundingClientRect(),fs=parseFloat(getComputedStyle(m).fontSize);
  // (la persona, en el celular, tiene 8 px de relleno con margen negativo para tocarla mejor: no cuenta como afuera)
  const kids=[...m.children].map(c=>{const b=c.getBoundingClientRect(),pad=c.classList.contains('person')?parseFloat(getComputedStyle(c).paddingRight)||0:0;return {t:c.innerText.replace(/\s+/g,' ').trim(),top:b.top,left:b.left,right:b.right-pad,w:b.width}});
  const tops=[];kids.forEach(k=>{if(!tops.some(t=>Math.abs(t-k.top)<fs*0.6))tops.push(k.top)});
  const nm=m.querySelector('.person .nm'),more=r.querySelector('.more').getBoundingClientRect(),chk=r.querySelector('.chk').getBoundingClientRect();
  return {rowH:Math.round(r.getBoundingClientRect().height),lines:tops.length,texts:kids.map(k=>k.t),
    hidden:kids.filter(k=>k.right>mr.right+1||k.w<1).map(k=>k.t),rowOverflow:r.scrollWidth>r.clientWidth+1,
    nameCut:!!nm&&nm.scrollWidth>nm.clientWidth+1,nameEllipsis:!!nm&&getComputedStyle(nm).textOverflow==='ellipsis',
    more:{w:Math.round(more.width),h:Math.round(more.height)},chk:{w:Math.round(chk.width),h:Math.round(chk.height)}};
},id);
const noHScroll=p=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
(async()=>{
const b=await L.launch();APP=await L.appUrl();

// ===== Celular, letra al 130 % =====
for(const [name,w] of [['phone 390 at 130%',390],['phone 360 at 130%',360]]){
  const gh=makeGH(items());
  const {ctx,p}=await device(b,gh,{viewport:{width:w,height:844},isMobile:true,hasTouch:true},APP,()=>{(()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}})();document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='html{font-size:130%}';document.head.append(s)})});
  await go(p,'tareas');
  // Un cambio que no sube (sin señal): la fila de b dice "sin subir", al final del renglón de detalle
  gh.mode='offline';await p.evaluate(()=>act({type:'edit',id:'b',patch:{notes:'pedir presupuesto'}}));await p.clock.fastForward(6000);await sleep(300);
  const a=await rowInfo(p,'a'),bb=await rowInfo(p,'b'),j=await rowInfo(p,'j');
  if(w===390){
    ok(a.lines===1&&a.hidden.length===0,name+': date, "pateada 3×" and the person fit in one line '+JSON.stringify(a));
    ok(a.rowH<=100,name+': the row is compact (it was 128 px) '+a.rowH);
    ok(a.texts[0]==='Vie 23/10','phone: the date goes short, without " · en 9 días" '+JSON.stringify(a.texts));
  }
  ok(bb.texts.includes('↻ lun a vie')&&bb.texts.includes('sin subir')&&bb.hidden.length===0,name+': a full row hides nothing (not the repetition, not "sin subir") '+JSON.stringify(bb));
  // (seis datos: a 390 px entran en dos renglones; a 360 px, en tres: antes eran cuatro y cinco)
  const maxLines=w===390?2:3;
  ok(bb.lines<=maxLines,name+': a full row takes at most '+maxLines+' lines (it took '+(w===390?4:5)+') '+bb.lines);
  ok(bb.nameCut&&bb.nameEllipsis,name+': a long name is cut with "…" first '+JSON.stringify({cut:bb.nameCut,ell:bb.nameEllipsis}));
  ok(!j.nameCut&&j.hidden.length===0,name+': a short name ("Juan") is shown whole');
  ok(!a.rowOverflow&&!bb.rowOverflow&&await noHScroll(p),name+': nothing sticks out to the side');
  ok(a.more.w>=44&&a.more.h>=44&&a.chk.w>=48&&a.chk.h>=48,name+': ⋯ is at least 44×44 and the circle at least 48×48 '+JSON.stringify({more:a.more,chk:a.chk}));
  await go(p,'notas');
  const nm=await p.evaluate(()=>{const e=document.querySelector('.ngrid .more');if(!e)return null;const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)}});
  ok(nm&&nm.w>=44&&nm.h>=44,name+': ⋯ of a note is at least 44×44 '+JSON.stringify(nm));
  ok(p.errs.length===0,name+': no page errors '+JSON.stringify(p.errs));
  await ctx.close();
}

// ===== Compu =====
{const gh=makeGH(items());
 const {ctx,p}=await device(b,gh,{viewport:{width:1280,height:800}},APP,SEEN);
 await go(p,'tareas');
 const a=await rowInfo(p,'a');
 ok(a.texts[0]==='Vie 23/10 · en 9 días','computer: the date keeps " · en 9 días" '+JSON.stringify(a.texts));
 ok(a.lines===1&&a.hidden.length===0,'computer: the detail line fits in one line '+JSON.stringify(a));
 ok(a.more.w>=44&&a.chk.w===52&&a.chk.h===52,'computer: ⋯ is 44 px wide and the circle stays 52 px '+JSON.stringify({more:a.more,chk:a.chk}));
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
