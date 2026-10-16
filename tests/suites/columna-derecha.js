// Columna derecha en pantallas anchas: fija solo si entra; si no, sin segunda barra de desplazamiento
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T}=L;
(async()=>{
const b=await L.launch();
const many=Array.from({length:7},(_,i)=>T('n'+i,'Una tarea sin fecha bastante larga para que ocupe dos o tres renglones en la columna número '+i,{requester:'German',order:i}));
const gh=makeGH([T('h','Hoy',{due:day(0)}),...many]);
let {ctx,p}=await device(b,gh,{viewport:{width:1270,height:670}});
const st=()=>p.evaluate(()=>{const s=document.getElementById('side'),c=getComputedStyle(s);return {pos:c.position,inner:s.scrollHeight>s.clientHeight+1,tall:s.classList.contains('tall')}});
let s1=await st();ok(s1.pos==='static'&&!s1.inner&&s1.tall,'7 long undated tasks: column scrolls with the page, no inner scrollbar '+JSON.stringify(s1));
await p.setViewportSize({width:1270,height:2000});await sleep(300);
let s2=await st();ok(s2.pos==='sticky'&&!s2.tall,'tall window: column stays in view '+JSON.stringify(s2));
await p.setViewportSize({width:1000,height:700});await sleep(300);
ok(!(await st()).tall,'narrow: no class');
ok(p.errs.length===0,'no errors '+p.errs);
await b.close();console.log('fails',L.fails);
})();
