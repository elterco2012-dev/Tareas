// Intérprete de texto libre: título, fecha, prioridad, quién lo pidió, hora y "recordame".
// Las fechas AAAA-MM-DD fijas cuentan con el instante de referencia (miércoles 14/10/2026, ver lib/harness.js).
const H=require('../lib/harness');
(async()=>{const b=await H.launch();
const ctx=await b.newContext({timezoneId:'America/Argentina/Buenos_Aires'});await ctx.route('https://api.github.com/**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(await H.appUrl());await p.waitForTimeout(300);
const cases=[
 // [texto, título esperado, fecha (días desde hoy | 'mon' | 'YYYY-MM-DD' | null), prioridad, solicitante, hora, remind]
 ['Recordame mañana a las 3 llamar al banco, es urgente, me lo pidió Laura','Llamar al banco',1,'Alta','Laura','15:00',true],
 ['recordame que mañana tengo que llamar al contador','Llamar al contador',1,null,null,null,true],
 ['crear tarea revisar stock de anclajes el viernes','Revisar stock de anclajes','wd5',null,null,null,false],
 ['nueva tarea: enviar presupuesto para el 15 de octubre','Enviar presupuesto','2026-10-15',null,null,null,false],
 ['tengo que pasar por el banco a la mañana','Pasar por el banco a la mañana',null,null,null,null,false],
 ['anotá comprar cartuchos el viernes que viene','Comprar cartuchos','wd5',null,null,null,false],
 ['hay que preparar la presentación la semana que viene prioridad alta','Preparar la presentación','mon','Alta',null,null,false],
 ['llamar al proveedor en dos semanas','llamar al proveedor',14,null,null,null,false],
 ['reunión con Juan el próximo martes a las 10','reunión con Juan','wd2',null,null,'10:00',false],
 ['Acordate de mandar los remitos pasado mañana','Mandar los remitos',2,null,null,null,true],
 ['enviar factura dentro de 3 días pedido por Martín Gómez','enviar factura',3,null,'Martín Gómez',null,false],
 ['revisar mails a la una','revisar mails',null,null,null,'13:00',false],
 ['llamar a las 9 de la mañana a Pedro','llamar a Pedro',null,null,null,'09:00',false],
 ['reunión de equipo los lunes','reunión de equipo los lunes',null,null,null,null,false],
 ['entregar informe el primero de noviembre','entregar informe','2026-11-01',null,null,null,false],
 ['pagar el seguro el 5 de octubre','pagar el seguro','2026-10-05',null,null,null,false],
  ['pagar el seguro el 5 de agosto','pagar el seguro','2027-08-05',null,null,null,false],
 ['Llamar proveedor viernes !alta @Juan','Llamar proveedor','wd5','Alta','Juan',null,false],
 ['comprar regalo para Juan','comprar regalo para Juan',null,null,null,null,false],
 ['agregar stock al sistema','agregar stock al sistema',null,null,null,null,false],
 ['anotar pedidos en el sistema hoy','anotar pedidos en el sistema',0,null,null,null,false],
 ['me lo pidió Juan, revisar el contrato','revisar el contrato',null,null,'Juan',null,false],
 ['hacer el pedido por mail','hacer el pedido por mail',null,null,null,null,false],
 ['visitar al cliente de 9 de Julio el jueves','visitar al cliente de 9 de Julio','wd4',null,null,null,false],
 ['entregar el balance antes del 20 de octubre','entregar el balance','2026-10-20',null,null,null,false],
 ['recordame a las 5 que tengo que llamar a Juan','Llamar a Juan',null,null,null,'17:00',true],
 ['no es urgente revisar el mail','no es urgente revisar el mail',null,null,null,null,false],
 ['mandar un mail a las 3 sucursales','mandar un mail a las 3 sucursales',null,null,null,null,false],
 ['Crear tarea en Jira','Crear tarea en Jira',null,null,null,null,false],
 ['llamar a Juan el lunes 19','llamar a Juan','2026-10-19',null,null,null,false],
 ['llamar a Ana este viernes a las 4 y media de la tarde','llamar a Ana','wd5',null,null,'16:30',false],
 ['revisar presupuesto con prioridad baja','revisar presupuesto',null,'Baja',null,null,false],
 ['recordame','recordame',null,null,null,null,true],
];
const res=await p.evaluate(cs=>cs.map(([txt])=>{const r=parse(txt);return {title:r.title,due:r.due||null,priority:r.priority||null,requester:r.requester||null,time:r.time?timeLabel(r.time):null,remind:!!r.remind}}),cases);
const exp=await p.evaluate(cs=>cs.map(c=>{const d=c[2];return d===null?null:d==='mon'?nextMonday():/^wd\d$/.test(d)?addDays((+d[2]-new Date().getDay()+7)%7||7):typeof d==='number'?addDays(d):d}),cases);
let fails=0;
cases.forEach((c,i)=>{const r=res[i];const e={title:c[1],due:exp[i],priority:c[3],requester:c[4],time:c[5],remind:c[6]};
  const bad=Object.keys(e).filter(k=>e[k]!==r[k]);
  console.log((bad.length?'FAIL':'OK  ')+' '+c[0]+(bad.length?'\n      got '+JSON.stringify(r)+'\n      exp '+JSON.stringify(e):''));if(bad.length)fails++});
console.log('fails',fails);H.ok(errs.length===0,'no page errors '+JSON.stringify(errs));await b.close();if(fails)process.exitCode=1})();
