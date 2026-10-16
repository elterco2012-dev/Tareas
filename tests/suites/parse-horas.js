// Intérprete de horas: a.m./p.m., "y cuarto", "menos cuarto", madrugada, números que no son horas
const H=require('../lib/harness');
(async()=>{const b=await H.launch();
const ctx=await b.newContext({timezoneId:'America/Argentina/Buenos_Aires'});await ctx.route('https://api.github.com/**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(await H.appUrl());await p.waitForTimeout(300);
const cases=[['llamar a las 8 p.m. a Juan','llamar a Juan','20:00'],['turno a las 10 am','turno','10:00'],['cerrar a las 12 am','cerrar','00:00'],
['tengo turno a las 10 y 30','tengo turno','10:30'],['llamar a las 3 y 15','llamar','15:15'],['llamar a las 9 menos cuarto','llamar','08:45'],
['llamar a la una menos cuarto','llamar','12:45'],['llamar a las 3 de la madrugada al sereno','llamar al sereno','03:00'],['salir a las 8 menos 10 de la mañana','salir','07:50'],
['mandar un mail a las 3 sucursales','mandar un mail a las 3 sucursales',null],['ir a las 5 a mi casa','ir a mi casa','17:00'],['a las 3 y diez reunión','reunión','15:10'],
['llamar a las 3 y 75','llamar a las 3 y 75',null],['llamar a las 2 pm','llamar','14:00'],['revisar a las 7 a.m.','revisar','07:00']];
const r=await p.evaluate(cs=>cs.map(([t])=>{const q=parse(t);return [q.title,q.time?timeLabel(q.time):null]}),cases);
let f=0;cases.forEach((c,i)=>{const okk=r[i][0]===c[1]&&r[i][1]===c[2];if(!okk)f++;console.log((okk?'OK  ':'FAIL')+' '+c[0]+' → '+JSON.stringify(r[i]))});
console.log('fails',f);if(f)process.exitCode=1;H.ok(errs.length===0,'no page errors '+JSON.stringify(errs));await b.close()})();
