// Lógica de los workflows del repo de datos (repo-datos/.github/workflows/*.yml): se extrae el JS de cada
// workflow y se corre con un reloj fijo (FAKE_NOW, ver fakedate.mjs) contra un Telegram, un GitHub y un
// servidor de mail falsos en puertos libres.
import http from 'node:http';import fs from 'node:fs';import {execFile} from 'node:child_process';import path from 'node:path';import os from 'node:os';import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(here,'..','..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tareas-wf-'));   // rec.mjs, res.mjs y el repo de prueba
process.on('exit',()=>{try{fs.rmSync(dir,{recursive:true,force:true})}catch{}});
const listen=srv=>new Promise(r=>srv.listen(0,'127.0.0.1',()=>r(srv.address().port)));
// (En Windows, git puede bajar los .yml con fin de línea CRLF: se normaliza)
const yml=f=>{const t=fs.readFileSync(path.join(ROOT,'repo-datos','.github','workflows',f),'utf8').replace(/\r\n/g,'\n');const m=t.match(/<<'JS'\n([\s\S]*?)\n\s*JS\n/);if(!m)throw new Error('No encontré el bloque <<\'JS\' en '+f);return m[1].split('\n').map(l=>l.replace(/^ {10}/,'')).join('\n')};
fs.writeFileSync(dir+'/rec.mjs',yml('recordatorios.yml'));fs.writeFileSync(dir+'/res.mjs',yml('resumen.yml'));
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c)fails++};
// Telegram falso
let tg=[],tgFail=false;
const TG_PORT=await listen(http.createServer((q,s)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{if(tgFail){s.writeHead(400);s.end(JSON.stringify({ok:false,description:'Bad Request: chat not found'}));return}tg.push({url:q.url,...JSON.parse(b)});s.writeHead(200,{'Content-Type':'application/json'});s.end('{"ok":true}')})}));
// GitHub falso (solo recordatorios-enviados.json)
let file=null,sha=0,conflicts=0,puts=[],auth=[];
const GH_PORT=await listen(http.createServer((q,s)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{
  auth.push(q.headers.authorization+' '+q.url);
  if(q.method==='GET'){if(!file){s.writeHead(404);s.end('{}');return}s.writeHead(200,{'Content-Type':'application/json'});s.end(JSON.stringify({content:Buffer.from(file).toString('base64'),sha:String(sha)}));return}
  const j=JSON.parse(b);
  if(conflicts>0){conflicts--;sha++;s.writeHead(409);s.end('{}');return}   // otro commit se cruzó
  if(file&&String(j.sha)!==String(sha)||!file&&j.sha){s.writeHead(409);s.end('{}');return}
  file=Buffer.from(j.content,'base64').toString('utf8');sha++;puts.push(j.message);s.writeHead(200,{'Content-Type':'application/json'});s.end('{}')})}));
// Servidor de mail falso (puerto libre, sin TLS): guarda lo que llega después de DATA
import net from 'node:net';
let mails=[];
const SMTP_PORT=await listen(net.createServer(c=>{let buf='',st='cmd',data='',auth=0;c.write('220 hola\r\n');c.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\r\n'))>=0){const l=buf.slice(0,i);buf=buf.slice(i+2);
  if(st==='data'){if(l==='.'){mails.push(data);data='';st='cmd';c.write('250 ok\r\n')}else data+=l+'\n';continue}
  if(auth){auth--;c.write(auth?'334 x\r\n':'235 ok\r\n');continue}
  if(/^EHLO/.test(l))c.write('250 hola\r\n');else if(/^AUTH/.test(l)){auth=2;c.write('334 x\r\n')}else if(/^(MAIL|RCPT)/.test(l))c.write('250 ok\r\n');
  else if(l==='DATA'){st='data';c.write('354 dale\r\n')}else if(l==='QUIT'){c.write('221 chau\r\n');c.end()}else c.write('250 ok\r\n')}})}));
const MAIL={SMTP_HOST:'127.0.0.1',SMTP_PORT:String(SMTP_PORT),SMTP_USER:'yo@x.com',SMTP_PASS:'p'};
const repo=dir+'/repo';fs.mkdirSync(repo,{recursive:true});
const run_=(s,n)=>run(s,n);
const run=(script,now,env={})=>new Promise(res=>execFile(process.execPath,['--import',pathToFileURL(path.join(here,'fakedate.mjs')).href,path.join(dir,script)],{cwd:repo,env:{PATH:process.env.PATH,FAKE_NOW:now,TELEGRAM_API:'http://127.0.0.1:'+TG_PORT,GITHUB_API:'http://127.0.0.1:'+GH_PORT,GITHUB_REPOSITORY:'u/datos',GH_TOKEN:'tok',TELEGRAM_TOKEN:'abc',TELEGRAM_CHAT_ID:'99',...env}},(e,out,err)=>res({code:e?e.code:0,out,err})));
const T=(id,title,o)=>({id,title,done:false,priority:'Media',requester:'',due:'2026-10-12',...o});
const put=items=>fs.writeFileSync(repo+'/tareas.json',JSON.stringify(items));
const NOW='2026-10-12T17:52:00Z';   // 14:52 en Argentina
put([T('a','Llamar al banco',{time:'15:00'}),T('b','Más tarde',{time:'15:30'}),T('c','Atrasada',{time:'12:00'}),T('d','Muy atrasada',{time:'11:30'}),
  T('e','Hecha',{time:'15:00',done:true}),T('f','Borrada',{time:'15:00',deletedAt:'2026-10-12T10:00:00Z'}),T('g','Mañana',{time:'15:00',due:'2026-10-13'}),
  T('h','Sin hora',{}),T('i','Urgente',{time:'14:55',priority:'Alta',requester:'Laura'}),T('j','Hora rara',{time:'3pm'})]);
let r=await run('rec.mjs',NOW);
ok(r.code===0&&tg.length===1,'sends one message: code '+r.code+' '+r.err);
ok(tg[0]&&tg[0].text==='⏰ 12:00 · Atrasada\n⏰ 14:55 · Urgente (ALTA) · @Laura\n⏰ 15:00 · Llamar al banco\n⏰ 15:30 · Más tarde','message text: '+JSON.stringify(tg[0]&&tg[0].text));
ok(tg[0]&&tg[0].url==='/botabc/sendMessage'&&tg[0].chat_id==='99','token and chat id');
let st=JSON.parse(file||'{}');
ok(Object.keys(st).sort().join()==='a|2026-10-12|15:00,b|2026-10-12|15:30,c|2026-10-12|12:00,i|2026-10-12|14:55','state saved: '+Object.keys(st));
// Anticipación: cada hora avisa entre 10 y 39 minutos antes (corridas a las :20 y :50)
{const lead=[];for(const tm of ['15:00','15:10','15:19','15:20','15:29','15:30','15:45']){file=null;tg=[];put([T('z'+tm,'L',{time:tm})]);
  for(const run of ['17:20','17:50','18:20','18:50']){await run_('rec.mjs','2026-10-12T'+run+':00Z');if(tg.length){lead.push(tm+'@'+(Number(run.slice(0,2))-3)+':'+run.slice(3));break}}}
 ok(lead.join(' ')==='15:00@14:50 15:10@14:50 15:19@14:50 15:20@14:50 15:29@14:50 15:30@15:20 15:45@15:20','lead times: '+lead.join(' '))}
file=JSON.stringify(st);
ok(auth.every(a=>a.startsWith('Bearer tok /repos/u/datos/contents/recordatorios-enviados.json')),'GitHub API auth/path');
r=await run('rec.mjs','2026-10-12T17:55:00Z');
ok(r.code===0&&tg.length===1,'second run: no duplicate ('+r.out.trim()+')');
// cambió la hora → se avisa de nuevo
put([T('a','Llamar al banco',{time:'15:02'})]);
r=await run('rec.mjs','2026-10-12T17:56:00Z');
ok(r.code===0&&tg.length===2&&tg[1].text==='⏰ 15:02 · Llamar al banco','new time → new reminder');
// fuera del horario de la tarea
put([T('k','Noche',{time:'21:00'})]);tg=[];
r=await run('rec.mjs',NOW);ok(r.code===0&&tg.length===0&&/Nada para recordar/.test(r.out),'nothing due → nothing sent');
// Run workflow (prueba) sin nada para avisar
r=await run('rec.mjs',NOW,{GITHUB_EVENT_NAME:'workflow_dispatch'});
ok(r.code===0&&tg.length===1&&tg[0].text==='✅ Los recordatorios funcionan. El próximo de hoy: 21:00 · Noche','manual run sends a test message: '+JSON.stringify(tg[0]&&tg[0].text));
// Telegram falla → no se anota
put([T('m','Pagar luz',{time:'14:50'})]);tg=[];tgFail=true;const before=file;
r=await run('rec.mjs',NOW);tgFail=false;
ok(r.code===1&&/chat not found/.test(r.err)&&file===before,'telegram error: exit 1, nothing recorded');
// conflicto al guardar → reintenta
conflicts=1;r=await run('rec.mjs',NOW);
ok(r.code===0&&tg.length===1&&JSON.parse(file)['m|2026-10-12|14:50'],'409 on save → retried');
// limpieza de más de 7 días
file=JSON.stringify({'viejo|2026-10-01|10:00':'2026-10-01T13:00:00Z',...JSON.parse(file)});sha++;
put([T('n','Otra',{time:'14:52'})]);r=await run('rec.mjs',NOW);
st=JSON.parse(file);ok(!st['viejo|2026-10-01|10:00']&&st['n|2026-10-12|14:52']&&st['m|2026-10-12|14:50'],'entries older than 7 days pruned');
// sin secretos
put([T('o','Algo',{time:'14:52'})]);
r=await run('rec.mjs',NOW,{TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:''});ok(r.code===1&&/Falta configurar/.test(r.err),'missing secrets with something due → exit 1');
put([T('o','Algo',{time:'20:00'})]);
r=await run('rec.mjs',NOW,{TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:''});ok(r.code===0,'missing secrets, nothing due → quiet');
// Recién copiado, sin secretos: las corridas programadas no fallan; Run workflow sí dice qué falta
put([T('o','Algo',{time:'14:52'})]);tg=[];
r=await run('rec.mjs',NOW,{TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:'',GITHUB_EVENT_NAME:'schedule'});ok(r.code===0&&tg.length===0&&/Todavía no están cargados/.test(r.out),'rec: scheduled, no secrets at all → quiet exit 0');
r=await run('rec.mjs',NOW,{TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:'',GITHUB_EVENT_NAME:'workflow_dispatch'});ok(r.code===1&&/Falta configurar/.test(r.err),'rec: Run workflow, no secrets → exit 1 with the hint');
r=await run('rec.mjs',NOW,{TELEGRAM_CHAT_ID:'',GITHUB_EVENT_NAME:'schedule'});ok(r.code===1&&/Falta configurar/.test(r.err),'rec: scheduled, only one secret → still an error');
// Disparado por cron-job.org (workflow_dispatch con automatico=true): como el horario, sin mensaje de prueba
put([T('k','Noche',{time:'21:00'})]);tg=[];
r=await run('rec.mjs',NOW,{GITHUB_EVENT_NAME:'workflow_dispatch',AUTOMATICO:'true'});ok(r.code===0&&tg.length===0&&/Nada para recordar/.test(r.out),'rec: cron-job.org run with nothing due → no test message');
r=await run('rec.mjs',NOW,{GITHUB_EVENT_NAME:'workflow_dispatch',AUTOMATICO:'false'});ok(r.code===0&&tg.length===1&&/funcionan/.test(tg[0].text)&&!/Noche/.test(r.out),'rec: manual Run workflow (automatico=false) → test message, title not in the log');
put([T('q2','Pagar expensas',{time:'14:55'})]);tg=[];const filePrev=file;
r=await run('rec.mjs',NOW,{GITHUB_EVENT_NAME:'workflow_dispatch',AUTOMATICO:'true'});
ok(r.code===0&&tg.length===1&&tg[0].text==='⏰ 14:55 · Pagar expensas'&&JSON.parse(file)['q2|2026-10-12|14:55']&&!/Pagar expensas/.test(r.out),'rec: cron-job.org run → reminder sent and recorded, title not in the log');
r=await run('rec.mjs',NOW,{GITHUB_EVENT_NAME:'workflow_dispatch',AUTOMATICO:'true'});ok(tg.length===1,'rec: next cron-job.org run → not repeated');
put([T('q3','Otra con hora',{time:'14:58'})]);r=await run('rec.mjs',NOW,{GITHUB_EVENT_NAME:'workflow_dispatch',AUTOMATICO:'true',TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:''});ok(r.code===0&&/Todavía no están cargados/.test(r.out),'rec: cron-job.org run without secrets → quiet');
// sin tareas.json
fs.rmSync(repo+'/tareas.json');r=await run('rec.mjs',NOW);ok(r.code===0&&/Todavía no hay/.test(r.out),'no tareas.json → exit 0');
// Zona horaria: 23:00 UTC es 20:00 en Argentina del mismo día
file=null;put([T('p','Cena',{time:'20:05',due:'2026-10-12'})]);tg=[];
r=await run('rec.mjs','2026-10-12T23:00:00Z');ok(tg.length===1&&tg[0].text==='⏰ 20:05 · Cena','timezone: 20:00 local = 23:00 UTC');
// ===== Resumen diario =====
put([T('q','Sin hora hoy',{}),T('r','Banco',{time:'15:00'}),T('s','Temprano',{time:'09:00',requester:'Ana'}),T('t','En la papelera',{deletedAt:'2026-10-11T10:00:00Z'}),T('u','Vencida',{due:'2026-10-10',time:'10:00'})]);
tg=[];r=await run('res.mjs','2026-10-12T10:00:00Z');
ok(r.code===0&&tg.length===1,'summary sent '+r.err);
ok(tg[0]&&tg[0].text==='Buen día. 1 vencida, 3 para hoy\n\nVencidas\n• Vencida · venció hace 2 días\n\nPara hoy\n• 09:00 Temprano · @Ana\n• 15:00 Banco\n• Sin hora hoy','summary text: '+JSON.stringify(tg[0]&&tg[0].text));
// Aviso del token (ajustes.json)
fs.writeFileSync(repo+'/ajustes.json',JSON.stringify({tokens:{abc123:'2026-10-15'}}));
tg=[];r=await run('res.mjs','2026-10-12T10:00:00Z');
ok(tg[0]&&tg[0].text.startsWith('⚠ El token de GitHub de la app vence en 3 días (15/10).')&&tg[0].text.includes('\n\nBuen día. 1 vencida'),'token warning first: '+JSON.stringify(tg[0]&&tg[0].text.slice(0,120)));
put([T('z','Hecha',{done:true})]);tg=[];r=await run('res.mjs','2026-10-12T10:00:00Z');
ok(tg.length===1&&/vence en 3 días/.test(tg[0].text)&&/Buen día\.$/.test(tg[0].text),'only the warning: still sent: '+JSON.stringify(tg[0]&&tg[0].text));
fs.writeFileSync(repo+'/ajustes.json',JSON.stringify({tokens:{abc123:'2026-12-15'}}));tg=[];r=await run('res.mjs','2026-10-12T10:00:00Z');
ok(tg.length===0,'far date: nothing sent');
fs.rmSync(repo+'/ajustes.json');
// Revisión de los viernes
put([T('a','Sin fecha nueva',{due:null,createdAt:'2026-10-10T12:00:00Z'}),T('b','Sin fecha vieja',{due:null,createdAt:'2026-08-01T12:00:00Z'}),T('c','Esperando',{waiting:true,waitingSince:'2026-10-11T12:00:00Z'}),
  T('d','Muy pateada',{due:'2026-10-20',postponed:4}),T('e','Hecha esta semana',{done:true,completedAt:'2026-10-14T15:00:00Z'})]);
tg=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5',APP_URL:'https://yo.github.io/organizador-web'});
ok(tg.length===1&&tg[0].text==='Revisión de la semana: 2 sin fecha (1 con más de un mes), 1 esperando respuesta, 1 pateada 3 veces o más.\nEsta semana terminaste 1 tarea.\nRevisalas en 2 minutos: https://yo.github.io/organizador-web/?revisar=1','weekly message: '+JSON.stringify(tg[0]&&tg[0].text));
tg=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5',APP_URL:''});
ok(tg.length===1&&tg[0].text.endsWith('Abrí la app y tocá "Revisión de la semana" (abajo, junto a Terminadas).'),'weekly without APP_URL: '+JSON.stringify(tg[0]&&tg[0].text));
// Solo mail (sin Telegram): la revisión llega por mail
tg=[];mails=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5',TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:'',...MAIL});
ok(r.code===0&&tg.length===0&&mails.length===1&&mails[0].includes('Revisión de la semana: 2 sin fecha')&&mails[0].includes('Subject: =?UTF-8?B?'+Buffer.from('Mis tareas: revisión de la semana').toString('base64')),'weekly, mail only → sent by mail: code '+r.code+' '+r.err);
// Los dos canales: llega por los dos
tg=[];mails=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5',...MAIL});
ok(r.code===0&&tg.length===1&&mails.length===1,'weekly, both channels → both');
// Sin ningún canal: avisa qué falta
tg=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5',TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:''});
ok(r.code===1&&/Falta configurar/.test(r.err),'weekly, no channel → says what is missing');
tg=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5',TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:'',GITHUB_EVENT_NAME:'schedule'});
ok(r.code===0&&tg.length===0&&/Todavía no están cargados/.test(r.out),'res weekly: scheduled, no secrets at all → quiet exit 0');
tg=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5',TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:'',SMTP_HOST:'x',GITHUB_EVENT_NAME:'schedule'});
ok(r.code===1&&/Falta configurar/.test(r.err),'res: scheduled, half-configured mail → still an error');
// Disparado por cron-job.org: programa=semanal / diario
put([T('a','Sin fecha nueva',{due:null,createdAt:'2026-10-10T12:00:00Z'}),T('v','Vencida x',{due:'2026-10-10'})]);
tg=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{GITHUB_EVENT_NAME:'workflow_dispatch',PROGRAMA:'semanal',APP_URL:'https://yo.github.io/app/'});
ok(tg.length===1&&tg[0].text.startsWith('Revisión de la semana: 1 sin fecha.')&&tg[0].text.endsWith('https://yo.github.io/app/?revisar=1'),'res: programa=semanal → weekly review: '+JSON.stringify(tg[0]&&tg[0].text));
tg=[];r=await run('res.mjs','2026-10-16T10:00:00Z',{GITHUB_EVENT_NAME:'workflow_dispatch',PROGRAMA:'diario'});
ok(tg.length===1&&tg[0].text.startsWith('Buen día. 1 vencida')&&tg[0].text.includes('Vencida x')&&!/Vencida x/.test(r.out)&&/Buen día\. 1 vencida/.test(r.out),'res: programa=diario → daily; log has the counts but not the titles');
tg=[];r=await run('res.mjs','2026-10-16T10:00:00Z',{GITHUB_EVENT_NAME:'workflow_dispatch',PROGRAMA:'diario',TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:''});
ok(r.code===0&&tg.length===0&&/Todavía no están cargados/.test(r.out),'res: cron-job.org daily without secrets → quiet');
tg=[];r=await run('res.mjs','2026-10-16T10:00:00Z',{GITHUB_EVENT_NAME:'workflow_dispatch',PROGRAMA:'',TELEGRAM_TOKEN:'',TELEGRAM_CHAT_ID:''});
ok(r.code===1&&/Falta configurar/.test(r.err),'res: manual Run workflow without secrets → says what is missing');
// Diario solo por mail sigue andando
put([T('q','Sin hora hoy',{})]);mails=[];tg=[];r=await run('res.mjs','2026-10-12T10:00:00Z',{TELEGRAM_TOKEN:'',...MAIL});
ok(r.code===0&&tg.length===0&&mails.length===1&&mails[0].includes('Buen día. 1 para hoy')&&mails[0].includes('Subject: =?UTF-8?B?'+Buffer.from('Mis tareas: 1 para hoy').toString('base64')),'daily, mail only: '+r.err);
// Las sin fecha revisadas ("Sigue así") hace menos de un mes no se cuentan, como en la app
put([T('a','Revisada',{due:null,createdAt:'2026-08-01T12:00:00Z',reviewedAt:'2026-10-13T12:00:00Z'}),T('b','Revisada hace mucho',{due:null,createdAt:'2026-08-01T12:00:00Z',reviewedAt:'2026-09-01T12:00:00Z'}),T('c','Revisada otra',{due:null,reviewedAt:'2026-10-09T12:00:00Z'})]);
tg=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5'});
ok(tg.length===1&&tg[0].text.startsWith('Revisión de la semana: 1 sin fecha (1 con más de un mes).'),'weekly: reviewed in the last month left out: '+JSON.stringify(tg[0]&&tg[0].text));
put([T('a','Revisada',{due:null,reviewedAt:'2026-10-13T12:00:00Z'})]);tg=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5'});
ok(tg.length===0&&/Nada para revisar/.test(r.out),'weekly: all reviewed → nothing sent');
put([T('x','Con fecha',{due:'2026-10-20'})]);tg=[];r=await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5'});
ok(tg.length===0&&/Nada para revisar/.test(r.out),'weekly: nothing to review → nothing sent');
// Resumen diario: pospuestas y esperando desde el último reclamo / volver a mirar
put([T('p','Pateada',{due:'2026-10-12',postponed:3}),T('w1','Reclamada ayer',{waiting:true,waitingOn:'Juan',waitingSince:'2026-10-01T12:00:00Z',lastNudge:'2026-10-11T12:00:00Z'}),
  T('w2','Mirar hoy',{waiting:true,waitingOn:'Ana',waitingSince:'2026-10-11T12:00:00Z',followUp:'2026-10-12'}),T('w3','Mirar el jueves',{waiting:true,waitingOn:'Leo',waitingSince:'2026-10-01T12:00:00Z',followUp:'2026-10-15'})]);
tg=[];r=await run('res.mjs','2026-10-12T10:00:00Z');
ok(tg[0]&&tg[0].text.includes('• Pateada (pospuesta 3 veces)')&&tg[0].text.includes('• Mirar hoy · Ana, volver a mirar hoy')&&!tg[0].text.includes('Reclamada ayer')&&!tg[0].text.includes('Mirar el jueves'),'daily: postponed note, waiting by nudge/follow-up: '+JSON.stringify(tg[0]&&tg[0].text));
ok(tg[0]&&tg[0].text.startsWith('Buen día. 1 para hoy, 1 esperando respuesta\n')&&tg[0].text.includes('\n\nEsperando respuesta\n• Mirar hoy'),'daily: neutral waiting wording: '+JSON.stringify(tg[0]&&tg[0].text));
put([T('w4','Mirar ayer',{waiting:true,waitingOn:'Leo',waitingSince:'2026-10-01T12:00:00Z',followUp:'2026-10-09'}),T('w5','Vieja',{waiting:true,waitingOn:'Ana',waitingSince:'2026-10-07T12:00:00Z'})]);
tg=[];r=await run('res.mjs','2026-10-12T10:00:00Z');
ok(tg[0]&&tg[0].text==='Buen día. 2 esperando respuesta\n\nEsperando respuesta\n• Mirar ayer · Leo, había que mirarla el 9/10\n• Vieja · Ana, hace 5 días','daily: past follow-up date: '+JSON.stringify(tg[0]&&tg[0].text));
console.log('fails',fails);process.exit(fails?1:0);
