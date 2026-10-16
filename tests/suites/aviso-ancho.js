// El aviso (toast) en una línea y centrado en 320, 375 y 1100 px
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
(async()=>{const b=await L.launch();
for(const w of [320,375,1100]){
  const gh=makeGH([T('a','Tarea A',{due:day(0)})]);
  const {ctx,p}=await device(b,gh,{viewport:{width:w,height:700},isMobile:w<500,hasTouch:w<500});
  await p.locator('.task .chk').first().click();await L.until(async()=>(await p.innerText('#toastMsg'))==='Tarea terminada');await sleep(150);
  const r=await p.evaluate(()=>{const t=document.getElementById('toast').getBoundingClientRect(),m=document.getElementById('toastMsg');return {h:Math.round(m.getBoundingClientRect().height),w:Math.round(t.width),left:Math.round(t.left),right:Math.round(innerWidth-t.right)}});
  ok(r.h<36&&Math.abs(r.left-r.right)<=1,w+'px: "Tarea terminada" on one line, centered '+JSON.stringify(r));
  await p.evaluate(()=>toast('Agregada para el mié 14/10 con un texto bastante largo para probar',()=>{},'Al calendario'));
  const r2=await p.evaluate(()=>{const t=document.getElementById('toast').getBoundingClientRect();return {w:Math.round(t.width),left:Math.round(t.left),vw:innerWidth}});
  ok(r2.left>=12&&r2.w<=r2.vw-24,w+'px: long toast fits '+JSON.stringify(r2));
  await ctx.close();
}
await b.close()})();
