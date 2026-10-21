// Lógica de los workflows del repo de datos (repo-datos/.github/workflows/*.yml): se extrae el JS de cada
// workflow y se corre con un reloj fijo (FAKE_NOW, ver fakedate.mjs) contra un Telegram, un GitHub y un
// servidor de mail falsos en puertos libres. La copia de seguridad (respaldo.yml) escribe con git en un repositorio
// "bare" local (RESPALDO_GIT_URL).
import http from 'node:http';import fs from 'node:fs';import {execFile,execFileSync} from 'node:child_process';import path from 'node:path';import os from 'node:os';import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(here,'..','..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tareas-wf-'));   // rec.mjs, res.mjs, resp.mjs y los repos de prueba
process.on('exit',()=>{try{fs.rmSync(dir,{recursive:true,force:true})}catch{}});
const listen=srv=>new Promise(r=>srv.listen(0,'127.0.0.1',()=>r(srv.address().port)));
// (En Windows, git puede bajar los .yml con fin de línea CRLF: se normaliza)
const yml=f=>{const t=fs.readFileSync(path.join(ROOT,'repo-datos','.github','workflows',f),'utf8').replace(/\r\n/g,'\n');const m=t.match(/<<'JS'\n([\s\S]*?)\n\s*JS\n/);if(!m)throw new Error('No encontré el bloque <<\'JS\' en '+f);return m[1].split('\n').map(l=>l.replace(/^ {10}/,'')).join('\n')};
fs.writeFileSync(dir+'/rec.mjs',yml('recordatorios.yml'));fs.writeFileSync(dir+'/res.mjs',yml('resumen.yml'));fs.writeFileSync(dir+'/resp.mjs',yml('respaldo.yml'));
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c)fails++};
// Telegram falso (con tgSinBotones rechaza los mensajes con botones, como con una APP_URL mal escrita)
let tg=[],tgFail=false,tgSinBotones=false,tgRechazos=0;
const TG_PORT=await listen(http.createServer((q,s)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{if(tgFail){s.writeHead(400);s.end(JSON.stringify({ok:false,description:'Bad Request: chat not found'}));return}
  const j=JSON.parse(b);if(tgSinBotones&&j.reply_markup){tgRechazos++;s.writeHead(400);s.end(JSON.stringify({ok:false,description:'Bad Request: BUTTON_URL_INVALID'}));return}
  tg.push({url:q.url,...j});s.writeHead(200,{'Content-Type':'application/json'});s.end('{"ok":true}')})}));
// GitHub falso (recordatorios-enviados.json y, para el respaldo, las corridas disparadas por cron-job.org; para la
// copia de seguridad, los datos de un repositorio: GET /repos/usuario/nombre → {id, full_name, private}, de ghRepos)
let file=null,sha=0,conflicts=0,puts=[],auth=[],runs=null,runsUrl=[],ghRepos={},ghRepoToken=null,ghRepoReqs=[];
const GH_PORT=await listen(http.createServer((q,s)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{
  if(/^\/repos\/[^/]+\/[^/]+$/.test(q.url)){ghRepoReqs.push(q.method+' '+q.headers.authorization+' '+q.url);const x=ghRepos[q.url.slice(7).toLowerCase()];
    if(ghRepoToken&&q.headers.authorization!=='Bearer '+ghRepoToken){s.writeHead(401);s.end('{"message":"Bad credentials"}');return}
    if(!x){s.writeHead(404);s.end('{"message":"Not Found"}');return}
    s.writeHead(200,{'Content-Type':'application/json'});s.end(JSON.stringify(x));return}
  if(q.url.includes('/actions/workflows/')){runsUrl.push(q.headers.authorization+' '+q.url);if(runs===500){s.writeHead(500);s.end('{}');return}
    s.writeHead(200,{'Content-Type':'application/json'});s.end(JSON.stringify({workflow_runs:runs||[]}));return}
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
const run=(script,now,env={},cwd=repo)=>new Promise(res=>execFile(process.execPath,['--import',pathToFileURL(path.join(here,'fakedate.mjs')).href,path.join(dir,script)],{cwd,env:{PATH:process.env.PATH,FAKE_NOW:now,TELEGRAM_API:'http://127.0.0.1:'+TG_PORT,GITHUB_API:'http://127.0.0.1:'+GH_PORT,GITHUB_REPOSITORY:'u/datos',GH_TOKEN:'tok',TELEGRAM_TOKEN:'abc',TELEGRAM_CHAT_ID:'99',...env}},(e,out,err)=>res({code:e?e.code:0,out,err})));
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
ok(tg[0]&&!('reply_markup' in tg[0])&&tg[0].disable_web_page_preview===true,'no APP_URL → no buttons (as before)');
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
// Plantilla: cada media hora de 6:20 a 22:50 en Argentina, y el horario de respaldo (para quien usa cron-job.org) en un comentario
{const t=fs.readFileSync(path.join(ROOT,'repo-datos','.github','workflows','recordatorios.yml'),'utf8');
 ok(/^ {4}- cron: "20,50 9-23,0-1 \* \* \*"/m.test(t)&&/^ *# +- cron: "37 9-23,0-1 \* \* \*"/m.test(t)&&/^ {10}APP_URL: \$\{\{ vars\.APP_URL \}\}$/m.test(t),'rec template: schedule 6:20–22:50, backup schedule in a comment, APP_URL in the env')}
let logs='';const log=x=>{logs+=x.out+x.err;return x};   // para ver que en los registros no quedan títulos
// De noche: la corrida de las 22:20 avisa la tarea de las 22:30. El script no tiene límite de hora (lo pone el horario)
file=null;tg=[];put([T('n1','Cerrar caja',{time:'22:30'}),T('n2','Muy de noche',{time:'23:45'})]);
r=log(await run('rec.mjs','2026-10-13T01:20:00Z'));ok(r.code===0&&tg.length===1&&tg[0].text==='⏰ 22:30 · Cerrar caja','22:20 run → 22:30 reminder: '+JSON.stringify(tg[0]&&tg[0].text));
r=log(await run('rec.mjs','2026-10-13T02:20:00Z'));ok(r.code===0&&tg.length===2&&tg[1].text==='⏰ 23:45 · Muy de noche','no hour limit in the script itself (23:20 run → 23:45 reminder): '+JSON.stringify(tg[1]&&tg[1].text));
// Botón "Posponer o hecha" debajo de cada recordatorio, con APP_URL
const largo='Revisar la propuesta del proveedor nuevo de cajas y embalajes',emojis='Emojis '+'🎉'.repeat(40);
file=null;tg=[];put([T('a','Llamar al banco',{time:'15:00'}),T('x y/ñ&?','Pagar',{time:'14:55'}),T('l',largo,{time:'15:10'}),T('e2',emojis,{time:'15:20'})]);
r=log(await run('rec.mjs',NOW,{APP_URL:' https://yo.github.io/app '}));
ok(r.code===0&&tg.length===1&&tg[0].text==='⏰ 14:55 · Pagar\n⏰ 15:00 · Llamar al banco\n⏰ 15:10 · '+largo+'\n⏰ 15:20 · '+emojis&&tg[0].disable_web_page_preview===true,'buttons: message text unchanged (MacroDroid): '+JSON.stringify(tg[0]&&tg[0].text));
{const kb=(tg[0]&&tg[0].reply_markup&&tg[0].reply_markup.inline_keyboard)||[];const b=[0,1,2,3].map(i=>(kb[i]&&kb[i][0])||{});
 ok(kb.length===4&&kb.every(row=>row.length===1),'buttons: one row per reminder: '+JSON.stringify(kb));
 ok(b[0].text==='Posponer o hecha · 14:55 Pagar'&&b[1].text==='Posponer o hecha · 15:00 Llamar al banco','buttons: text "Posponer o hecha · HH:MM título": '+JSON.stringify(b.map(x=>x.text)));
 ok(b[0].url==='https://yo.github.io/app/?tarea=x%20y%2F%C3%B1%26%3F'&&b[1].url==='https://yo.github.io/app/?tarea=a','buttons: url = APP_URL + "/?tarea=" + encoded id: '+JSON.stringify(b.map(x=>x.url)));
 ok(b[2].text==='Posponer o hecha · 15:10 Revisar la propuesta del proveedor…','buttons: long title cut to 60 characters with "…": '+JSON.stringify(b[2].text));
 const e=b[3].text||'';ok(Array.from(e).length===60&&e.endsWith('🎉…')&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(e),'buttons: emojis are not split when cutting: '+JSON.stringify(e))}
// Más de 8: botones solo para las primeras 8 (el texto trae todas)
file=null;tg=[];put(Array.from({length:10},(_,i)=>T('m'+i,'Tarea '+i,{time:'15:0'+i})));
r=log(await run('rec.mjs',NOW,{APP_URL:'https://yo.github.io/app/'}));
{const kb=(tg[0]&&tg[0].reply_markup&&tg[0].reply_markup.inline_keyboard)||[];
 ok(tg.length===1&&tg[0].text.split('\n').length===10&&kb.length===8&&kb.every((row,i)=>row.length===1&&row[0].text==='Posponer o hecha · 15:0'+i+' Tarea '+i&&row[0].url==='https://yo.github.io/app/?tarea=m'+i),'buttons: at most 8, for the first 8 reminders: '+kb.length)}
// El mensaje de prueba no lleva botones
file=null;tg=[];put([T('k','Noche',{time:'21:00'})]);
r=log(await run('rec.mjs',NOW,{GITHUB_EVENT_NAME:'workflow_dispatch',APP_URL:'https://yo.github.io/app/'}));
ok(tg.length===1&&/funcionan/.test(tg[0].text)&&!('reply_markup' in tg[0]),'test message: no buttons');
// Telegram no acepta los botones (APP_URL mal escrita): el aviso sale igual, sin botones, y se anota
file=null;tg=[];tgSinBotones=true;put([T('a','Llamar al banco',{time:'15:00'})]);
r=log(await run('rec.mjs',NOW,{APP_URL:'yo.github.io app'}));tgSinBotones=false;
ok(r.code===0&&tgRechazos===1&&tg.length===1&&!('reply_markup' in tg[0])&&tg[0].text==='⏰ 15:00 · Llamar al banco'&&JSON.parse(file||'{}')['a|2026-10-12|15:00']&&/sin botones/.test(r.out),'buttons rejected by Telegram → reminder sent without them and recorded: '+JSON.stringify(r.out+r.err));
// La corrida de cron-job.org que empieza tarde (14:21 o 14:28) cuenta como la de las 14:20: la de las 15:00 espera a la de las 14:50
{const tareas=[T('a1','La de las 15',{time:'15:00'}),T('a2','La de las 14:59',{time:'14:59'})];
 for(const [hora,env,esperado,nombre] of [['17:21:40',{GITHUB_EVENT_NAME:'workflow_dispatch',AUTOMATICO:'true'},'⏰ 14:59 · La de las 14:59','cron-job.org run starting at 14:21'],
   ['17:28:10',{GITHUB_EVENT_NAME:'schedule',HORARIO:'20,50 9-23,0-1 * * *'},'⏰ 14:59 · La de las 14:59','the :20/:50 GitHub schedule starting at 14:28'],
   ['17:30:10',{GITHUB_EVENT_NAME:'workflow_dispatch',AUTOMATICO:'true'},'⏰ 14:59 · La de las 14:59\n⏰ 15:00 · La de las 15','a run 10 minutes late counts from when it starts'],
   ['17:21:40',{GITHUB_EVENT_NAME:'workflow_dispatch',AUTOMATICO:'false'},'⏰ 14:59 · La de las 14:59\n⏰ 15:00 · La de las 15','a manual Run workflow counts from when it starts']]){
   file=null;tg=[];put(tareas);r=log(await run('rec.mjs','2026-10-12T'+hora+'Z',env));
   ok(tg.length===1&&tg[0].text===esperado,nombre+': '+JSON.stringify(tg[0]&&tg[0].text))}}
// Respaldo (horario de GitHub, a los :37) con cron-job.org andando: solo lo que ya tendría que haber salido
{const R37='2026-10-12T17:37:00Z',REF='u/datos/.github/workflows/recordatorios.yml@refs/heads/main',B={GITHUB_EVENT_NAME:'schedule',GITHUB_WORKFLOW_REF:REF,HORARIO:'37 9-23,0-1 * * *'};   // 14:37 en Argentina
 const tareas=[T('r1','Ya tendría que haber salido',{time:'14:55'}),T('r2','La de las 15',{time:'15:00'}),T('r3','15:16',{time:'15:16'}),T('r4','Recién pasada',{time:'14:40'})];
 file=null;tg=[];runsUrl=[];put(tareas);runs=[{created_at:'2026-10-12T17:20:31Z',event:'workflow_dispatch',display_title:'Recordatorios (cron-job.org)'}];
 r=log(await run('rec.mjs',R37,B));
 ok(r.code===0&&tg.length===1&&tg[0].text==='⏰ 14:40 · Recién pasada\n⏰ 14:55 · Ya tendría que haber salido'&&/Respaldo/.test(r.out),'backup with cron-job.org working: only the overdue ones (15:00 still waits for 14:50): '+JSON.stringify(tg[0]&&tg[0].text));
 ok(runsUrl.length===1&&runsUrl[0]==='Bearer tok /repos/u/datos/actions/workflows/recordatorios.yml/runs?event=workflow_dispatch&per_page=10','backup asks GitHub for the last cron-job.org runs: '+runsUrl[0]);
 // Un "Run workflow" de prueba (sin el nombre de cron-job.org) no cuenta como que cron-job.org anda
 file=null;tg=[];put(tareas);runs=[{created_at:'2026-10-12T17:30:00Z',event:'workflow_dispatch',display_title:'Recordatorios a la hora'},{created_at:'2026-10-12T15:20:31Z',event:'workflow_dispatch',display_title:'Recordatorios (cron-job.org)'}];
 r=log(await run('rec.mjs',R37,B));
 ok(tg.length===1&&tg[0].text.split('\n').length===4&&!/Respaldo/.test(r.out),'a manual Run workflow 7 min ago does not count as cron-job.org working: reminds as usual');
 // El horario de las :20 y :50 (quien no usa cron-job.org) nunca es respaldo, aunque haya una corrida de cron-job.org reciente
 file=null;tg=[];runsUrl=[];put(tareas);runs=[{created_at:'2026-10-12T17:20:31Z',event:'workflow_dispatch',display_title:'Recordatorios (cron-job.org)'}];
 r=log(await run('rec.mjs',R37,{...B,HORARIO:'20,50 9-23,0-1 * * *'}));
 ok(tg.length===1&&tg[0].text.split('\n').length===4&&runsUrl.length===0,'the :20/:50 GitHub schedule is never the backup (does not even ask)');
 file=null;tg=[];put(tareas);runs=[{created_at:'2026-10-12T15:20:31Z',event:'workflow_dispatch',display_title:'Recordatorios (cron-job.org)'}];
 r=log(await run('rec.mjs',R37,B));
 ok(tg.length===1&&tg[0].text.split('\n').length===4,'backup with cron-job.org stopped (last run 2 h ago): reminds as usual: '+JSON.stringify(tg[0]&&tg[0].text));
 file=null;tg=[];put(tareas);runs=500;
 r=log(await run('rec.mjs',R37,B));runs=null;
 ok(r.code===0&&tg.length===1&&tg[0].text.split('\n').length===4,'backup, GitHub fails to answer about runs: reminds as usual');
 file=null;tg=[];runsUrl=[];put(tareas);runs=[{created_at:'2026-10-12T17:20:31Z',event:'workflow_dispatch',display_title:'Recordatorios (cron-job.org)'}];
 r=log(await run('rec.mjs',R37,{GITHUB_EVENT_NAME:'workflow_dispatch',AUTOMATICO:'true'}));runs=null;
 ok(tg.length===1&&tg[0].text.split('\n').length===4&&runsUrl.length===0,'cron-job.org runs never ask and remind as usual');
 const t=fs.readFileSync(path.join(ROOT,'repo-datos','.github','workflows','recordatorios.yml'),'utf8');
 ok(/^permissions:\n {2}contents: write.*\n {2}actions: read/m.test(t),'rec template: actions: read (to see the cron-job.org runs)');
 ok(/^run-name: \$\{\{ \(inputs\.automatico == true \|\| inputs\.automatico == 'true'\) && 'Recordatorios \(cron-job\.org\)' \|\| 'Recordatorios a la hora' \}\}$/m.test(t)&&/^ {10}HORARIO: \$\{\{ github\.event\.schedule \}\}$/m.test(t),'rec template: run-name marks the cron-job.org runs, HORARIO in the env')}
ok(logs&&!['Cerrar caja','Muy de noche','Llamar al banco','Pagar',largo,'Emojis','Tarea 0','Noche'].some(x=>logs.includes(x)),'rec: no task titles in the logs');
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
// ===== Resumen diario: recordatorios de ayer que no salieron (recordatorios-enviados.json del checkout) =====
const ENV=repo+'/recordatorios-enviados.json',PERD=' por Telegram (revisá cron-job.org y que Actions esté activo).';
const MARTES='2026-10-13T10:00:00Z',LUNES='2026-10-19T10:00:00Z';logs='';
const ayer=[T('m1','Perdida',{time:'15:00',createdAt:'2026-10-11T12:00:00Z'}),   // la corrida de las 14:50 no la avisó
  T('s1','Salió bien',{time:'16:00'}),
  T('c1','Cargada tarde',{time:'15:00',createdAt:'2026-10-12T18:30:00Z'}),                    // 15:30: después de la corrida de las 14:50
  T('d1','Hecha antes',{time:'15:00',done:true,completedAt:'2026-10-12T17:00:00Z'}),          // 14:00
  T('d3','Hecha justo',{time:'15:00',done:true,completedAt:'2026-10-12T17:50:40Z'}),          // 14:50, el mismo minuto de la corrida
  T('d2','Hecha después',{time:'15:00',done:true,completedAt:'2026-10-12T19:00:00Z'}),        // 16:00: el aviso tenía que haber salido
  T('o1','Muy de noche',{time:'23:45'}),T('o2','Madrugada',{time:'02:00'}),                    // fuera del horario (6:20 a 22:50)
  T('n1','Cerrar caja',{time:'22:30'}),                                                        // la corrida de las 22:20
  T('x1','Borrada',{time:'15:00',deletedAt:'2026-10-12T20:00:00Z'}),T('y1','Hora rara',{time:'3pm'}),T('w1','En espera con hora',{time:'11:00',waiting:true}),
  T('z1','Anteayer',{due:'2026-10-11',time:'15:00'}),T('h1','Hoy con hora',{due:'2026-10-13',time:'09:00'})];
// s1 y w1 se avisaron; m1 se avisó con otra hora (después se la cambiaron): esa no cuenta
fs.writeFileSync(ENV,JSON.stringify({'s1|2026-10-12|16:00':'2026-10-12T18:50:05Z','w1|2026-10-12|11:00':'2026-10-12T13:50:04Z','m1|2026-10-12|14:00':'2026-10-12T16:50:00Z'}));
put(ayer);tg=[];r=log(await run('res.mjs',MARTES));
ok(r.code===0&&tg.length===1&&tg[0].text.startsWith('⚠ Ayer no salieron 3 avisos'+PERD+'\n\nBuen día. 8 vencidas, 1 para hoy'),'missed: not sent / done after it / 22:30 count; sent, created late, done before, outside the hours, deleted, other days do not: '+JSON.stringify(tg[0]&&tg[0].text.slice(0,150)));
ok(/Ayer no salieron 3 avisos/.test(r.out),'missed: the count is in the log');
put([T('d2','Hecha después',{time:'15:00',done:true,completedAt:'2026-10-12T19:00:00Z'})]);tg=[];r=log(await run('res.mjs',MARTES));
ok(r.code===0&&tg.length===1&&tg[0].text==='⚠ Ayer no salió 1 aviso'+PERD+'\n\nBuen día.','missed only: still sent, singular: '+JSON.stringify(tg[0]&&tg[0].text));
mails=[];tg=[];r=log(await run('res.mjs',MARTES,{TELEGRAM_TOKEN:'',...MAIL}));
ok(r.code===0&&mails.length===1&&mails[0].includes('Subject: =?UTF-8?B?'+Buffer.from('Mis tareas: avisos que no salieron').toString('base64')),'missed only, by mail: subject');
fs.writeFileSync(ENV,JSON.stringify({'d2|2026-10-12|15:00':'2026-10-12T17:50:09Z'}));tg=[];r=log(await run('res.mjs',MARTES));
ok(r.code===0&&tg.length===0&&/no se envía nada/.test(r.out),'missed: it was sent → no warning, nothing to send');
// Pasada a hoy (o con la hora cambiada, o vuelta a abrir) después de su corrida: la app anota whenAt y no cuenta
put([T('v1','Vencida pasada a hoy',{time:'08:00',createdAt:'2026-10-09T12:00:00Z',whenAt:'2026-10-12T14:30:00Z'}),T('v2','Cambiada antes',{time:'15:00',createdAt:'2026-10-09T12:00:00Z',whenAt:'2026-10-12T12:00:00Z'})]);
fs.writeFileSync(ENV,JSON.stringify({'zz|2026-10-11|10:00':'2026-10-11T12:50:00Z'}));tg=[];r=log(await run('res.mjs',MARTES));
ok(tg.length===1&&tg[0].text.startsWith('⚠ Ayer no salió 1 aviso'),'whenAt after the run (moved to today in the afternoon) does not count; changed before the run does: '+JSON.stringify(tg[0]&&tg[0].text.slice(0,80)));
// Hace más de 30 días que no sale ninguno: se dejaron de usar, no se reclama
fs.writeFileSync(ENV,JSON.stringify({'zz|2026-09-01|10:00':'2026-09-01T12:50:00Z'}));put(ayer);tg=[];r=log(await run('res.mjs',MARTES));
ok(tg.length===1&&tg[0].text.startsWith('Buen día. 8 vencidas')&&!tg[0].text.includes('⚠'),'last reminder more than 30 days ago (reminders no longer used) → no warning');
fs.rmSync(ENV);put(ayer);tg=[];r=log(await run('res.mjs',MARTES));
ok(r.code===0&&tg.length===1&&tg[0].text.startsWith('Buen día. 8 vencidas')&&!tg[0].text.includes('⚠'),'no recordatorios-enviados.json (reminders not used) → no warning');
for(const roto of ['{roto','[]','null']){fs.writeFileSync(ENV,roto);tg=[];r=log(await run('res.mjs',MARTES));
  ok(r.code===0&&tg.length===1&&tg[0].text.startsWith('Buen día. 8 vencidas'),'invalid recordatorios-enviados.json ('+roto+') → ignored')}
// Los lunes se mira desde el viernes (viernes, sábado y domingo; el jueves no)
fs.writeFileSync(ENV,JSON.stringify({'f3|2026-10-18|12:00':'2026-10-18T14:50:03Z'}));
const finde=[T('f0','Del jueves',{due:'2026-10-15',time:'15:00'}),T('f1','Del viernes',{due:'2026-10-16',time:'15:00'}),T('f2','Del sábado',{due:'2026-10-17',time:'10:00'}),
  T('f3','Del domingo',{due:'2026-10-18',time:'12:00'}),T('f4','Domingo a la noche',{due:'2026-10-18',time:'22:00'})];
put(finde);tg=[];r=log(await run('res.mjs',LUNES,{PROGRAMA:'0 10 * * 1-5'}));
ok(tg.length===1&&tg[0].text.startsWith('⚠ Desde el viernes no salieron 3 avisos'+PERD+'\n\nBuen día. 5 vencidas'),'Monday: Friday to Sunday: '+JSON.stringify(tg[0]&&tg[0].text.slice(0,120)));
tg=[];r=log(await run('res.mjs',LUNES,{PROGRAMA:'diario'}));
ok(tg.length===1&&tg[0].text.startsWith('⚠ Desde el viernes no salieron 3 avisos'),'Monday from cron-job.org (diario, Monday to Friday): Friday to Sunday');
tg=[];r=log(await run('res.mjs',LUNES,{PROGRAMA:'0 10 * * *'}));
ok(tg.length===1&&tg[0].text.startsWith('⚠ Ayer no salió 1 aviso'),'Monday with a daily summary: only Sunday (Saturday was already counted): '+JSON.stringify(tg[0]&&tg[0].text.slice(0,80)));
// Con el aviso del token: primero el token, después los recordatorios
fs.writeFileSync(repo+'/ajustes.json',JSON.stringify({tokens:{abc123:'2026-10-21'}}));tg=[];r=log(await run('res.mjs',LUNES,{PROGRAMA:'0 10 * * 1-5'}));
ok(tg[0]&&tg[0].text.startsWith('⚠ El token de GitHub de la app vence en 2 días (21/10). Generá uno nuevo y cargalo en Sincronización, con su fecha.\n⚠ Desde el viernes no salieron 3 avisos'+PERD+'\n\nBuen día.'),'token warning, then the missed reminders: '+JSON.stringify(tg[0]&&tg[0].text.slice(0,200)));
fs.rmSync(repo+'/ajustes.json');
// La revisión de los viernes no lo lleva
put([T('f0','Del jueves',{due:'2026-10-15',time:'15:00'}),T('sf','Sin fecha',{due:null})]);fs.writeFileSync(ENV,'{}');tg=[];r=log(await run('res.mjs','2026-10-16T18:45:00Z',{PROGRAMA:'45 18 * * 5'}));
ok(tg.length===1&&tg[0].text.startsWith('Revisión de la semana: 1 sin fecha.')&&!tg[0].text.includes('⚠'),'weekly review: no missed-reminders line');
ok(logs&&![...ayer,...finde].some(t=>logs.includes(t.title))&&!logs.includes('Sin fecha'),'res: no task titles in the logs');
fs.rmSync(ENV);
// ===== Copia de seguridad diaria (respaldo.yml): copia los datos a otro repositorio privado, con git =====
// El "repositorio de respaldo" es un repositorio bare local (RESPALDO_GIT_URL); sus datos (privado o no) los da el GitHub falso.
{const datos=dir+'/datos',bare=dir+'/respaldo.git',TOKEN='github_pat_SECRETO123',BASIC=Buffer.from('x-access-token:'+TOKEN).toString('base64');
 const gitEnv={PATH:process.env.PATH,GIT_AUTHOR_NAME:'Yo',GIT_AUTHOR_EMAIL:'yo@x.invalid',GIT_COMMITTER_NAME:'Yo',GIT_COMMITTER_EMAIL:'yo@x.invalid'};
 const G=(b,args,input)=>{try{return execFileSync('git',['--git-dir='+b,...args],{encoding:'utf8',input,stdio:['pipe','pipe','ignore'],env:gitEnv})}catch{return null}};
 const nuevoBare=(b,readme)=>{execFileSync('git',['init','-q','--bare','-b','main',b],{env:gitEnv});if(!readme)return;   // como lo crea GitHub (con o sin README)
   const blob=G(b,['hash-object','-w','--stdin'],'# Respaldo\n').trim(),tree=G(b,['mktree'],'100644 blob '+blob+'\tREADME.md\n').trim();
   G(b,['update-ref','refs/heads/main',G(b,['commit-tree',tree,'-m','Initial commit']).trim()])};
 const commits=(b=bare)=>Number(G(b,['rev-list','--count','main'])||0);
 const ultimo=(b=bare)=>(G(b,['log','-1','--format=%s|%an <%ae>','main'])||'').trim();
 const archivosEn=(b=bare)=>(G(b,['ls-tree','-r','--name-only','main'])||'').split('\n').filter(Boolean).join(' ');
 const enCopia=(f,ref='main')=>G(bare,['show',ref+':'+f]);
 const escribir=(f,x)=>{fs.mkdirSync(path.dirname(datos+'/'+f),{recursive:true});fs.writeFileSync(datos+'/'+f,typeof x==='string'?x:JSON.stringify(x))};
 nuevoBare(bare);fs.mkdirSync(datos,{recursive:true});
 ghRepos={'u/respaldo':{id:2,full_name:'u/respaldo',private:true},'u/publico':{id:3,full_name:'u/publico',private:false},
   'u/viejo-nombre':{id:77,full_name:'U/Datos',private:true},'u/mismo-id':{id:1,full_name:'u/otra-cosa',private:true}};
 ghRepoToken=TOKEN;ghRepoReqs=[];
 const E0={RESPALDO_TOKEN:TOKEN,RESPALDO_REPO:'u/respaldo',RESPALDO_GIT_URL:pathToFileURL(bare).href,GITHUB_EVENT_NAME:'schedule',GITHUB_REPOSITORY_ID:'1'};
 let rlogs='';const R=async(now,env={})=>{const x=await run('resp.mjs',now,{...E0,...env},datos);rlogs+=x.out+x.err;return x};
 const D1='2026-10-21T06:17:00Z',D2='2026-10-22T06:17:00Z';   // 3:17 en Argentina
 const titulos=['Llamar al banco','Pagar expensas','Mandar remitos','Revisar stock','Cerrar caja','Turno médico'],seis=titulos.map((t,i)=>T('r'+i,t,{}));
 escribir('tareas.json',seis);escribir('archivo/2025.json',[T('v1','Vieja terminada 2025',{done:true})]);escribir('archivo/2026.json',[T('v2','Terminada en 2026',{done:true})]);
 escribir('ajustes.json',{tokens:{abc123:'2027-10-01'}});escribir('recordatorios-enviados.json',{'r1|2026-10-20|15:00':'2026-10-20T17:50:00Z'});
 // Lo que no se copia: otros archivos, los workflows, los que empiezan con punto en archivo/ y los enlaces (a un archivo de afuera)
 escribir('notas.txt','no va');escribir('.github/workflows/respaldo.yml','name: x');escribir('archivo/.gitignore','*');
 fs.writeFileSync(dir+'/secreto.txt','SECRETO-DE-AFUERA');let enlaces=true;try{fs.symlinkSync(dir+'/secreto.txt',datos+'/archivo/enlace.json')}catch{enlaces=false}
 // Plantilla
 {const t=fs.readFileSync(path.join(ROOT,'repo-datos','.github','workflows','respaldo.yml'),'utf8').replace(/\r\n/g,'\n');
  ok(/^ {4}- cron: "17 6 \* \* \*"/m.test(t)&&/^ {2}workflow_dispatch:/m.test(t)&&/^permissions:\n {2}contents: read\b[^\n]*\n\n/m.test(t)&&/^concurrency:\n {2}group: respaldo\n {2}cancel-in-progress: false$/m.test(t),'resp template: daily at 3:17 in Argentina + Run workflow, only contents: read, one run at a time');
  ok(/^ {10}RESPALDO_TOKEN: \$\{\{ secrets\.RESPALDO_TOKEN \}\}$/m.test(t)&&/^ {10}RESPALDO_REPO: \$\{\{ vars\.RESPALDO_REPO \}\}$/m.test(t)&&/^ {10}persist-credentials: false\b/m.test(t),'resp template: RESPALDO_TOKEN secret, RESPALDO_REPO variable, checkout without stored credentials')}
 // Sin configurar
 let x=await R(D1,{RESPALDO_TOKEN:'',RESPALDO_REPO:''});
 ok(x.code===0&&/Todavía no están cargados RESPALDO_TOKEN ni RESPALDO_REPO/.test(x.out)&&/INSTRUCCIONES\.md/.test(x.out)&&commits()===0&&!ghRepoReqs.length,'resp: scheduled, not configured yet → quiet exit 0, nothing copied: '+JSON.stringify(x.out+x.err));
 x=await R(D1,{RESPALDO_TOKEN:'',RESPALDO_REPO:'',GITHUB_EVENT_NAME:'workflow_dispatch'});
 ok(x.code===1&&/Falta configurar el secreto RESPALDO_TOKEN y la variable RESPALDO_REPO/.test(x.err)&&/INSTRUCCIONES\.md/.test(x.err),'resp: Run workflow, not configured → exit 1 with the hint: '+JSON.stringify(x.err));
 x=await R(D1,{RESPALDO_REPO:''});
 ok(x.code===1&&/Falta configurar la variable RESPALDO_REPO/.test(x.err)&&!/RESPALDO_TOKEN/.test(x.err),'resp: scheduled but half configured (no RESPALDO_REPO) → exit 1, so days without a copy do not go unnoticed');
 x=await R(D1,{RESPALDO_TOKEN:'',GITHUB_EVENT_NAME:'workflow_dispatch'});
 ok(x.code===1&&/Falta configurar el secreto RESPALDO_TOKEN en/.test(x.err),'resp: Run workflow without RESPALDO_TOKEN → exit 1');
 x=await R(D1,{RESPALDO_REPO:'mis-tareas-respaldo'});
 ok(x.code===1&&/usuario\/mis-tareas-respaldo/.test(x.err)&&!ghRepoReqs.length&&commits()===0,'resp: RESPALDO_REPO without the user → exit 1, explains the format');
 // Controles antes de escribir: privado, otro repositorio, token aceptado
 x=await R(D1,{RESPALDO_REPO:'u/publico'});
 ok(x.code===1&&/^El repositorio de respaldo es público: no se copia nada/.test(x.err)&&commits()===0,'resp: public backup repo → exit 1, nothing pushed: '+JSON.stringify(x.err));
 ghRepoReqs=[];x=await R(D1,{RESPALDO_REPO:'U/Datos'});
 ok(x.code===1&&/este mismo repositorio de datos/.test(x.err)&&commits()===0&&!ghRepoReqs.length,'resp: RESPALDO_REPO = the data repo (other case) → exit 1, nothing pushed');
 x=await R(D1,{RESPALDO_REPO:'u/viejo-nombre'});
 ok(x.code===1&&/este mismo repositorio de datos/.test(x.err)&&commits()===0,'resp: GitHub answers with the data repo full_name (old name, other case) → exit 1');
 x=await R(D1,{RESPALDO_REPO:'u/mismo-id'});
 ok(x.code===1&&/este mismo repositorio de datos/.test(x.err)&&commits()===0,'resp: same repository id as the data repo → exit 1');
 x=await R(D1,{RESPALDO_TOKEN:'otro-token'});
 ok(x.code===1&&/GitHub no acepta el token RESPALDO_TOKEN/.test(x.err)&&commits()===0,'resp: token rejected (401) → exit 1');
 x=await R(D1,{RESPALDO_REPO:'u/no-existe'});
 ok(x.code===1&&/No encuentro el repositorio u\/no-existe/.test(x.err)&&commits()===0,'resp: repo not found or token without access (404) → exit 1');
 // Primera copia, en un repositorio vacío
 ghRepoReqs=[];x=await R(D1);
 ok(x.code===0&&commits()===1&&ultimo()==='Copia del 2026-10-21|Respaldo Mis tareas <respaldo@mis-tareas.invalid>','resp: first copy into an empty repo → one commit "Copia del 2026-10-21" with the neutral identity: '+JSON.stringify(x.out+x.err)+' '+ultimo());
 ok(archivosEn()==='ajustes.json archivo/2025.json archivo/2026.json recordatorios-enviados.json tareas.json','resp: copies tareas.json, archivo/, ajustes.json and recordatorios-enviados.json; not other files, workflows, dotfiles or symlinks'+(enlaces?'':' (no symlinks here)')+': '+archivosEn());
 ok(['tareas.json','archivo/2025.json','archivo/2026.json','ajustes.json','recordatorios-enviados.json'].every(f=>enCopia(f)===fs.readFileSync(datos+'/'+f,'utf8'))&&!(G(bare,['log','--all','-p'])||'').includes('SECRETO-DE-AFUERA'),'resp: copied byte for byte, nothing from outside');
 ok(x.out.trim()==='Copia del 2026-10-21 guardada en u/respaldo: 5 archivos (tareas.json con 6 tareas, archivo/2025.json, archivo/2026.json, ajustes.json, recordatorios-enviados.json).'&&!x.err,'resp: the log has only counts and file names: '+JSON.stringify(x.out+x.err));
 ok(ghRepoReqs.length===1&&ghRepoReqs[0]==='GET Bearer '+TOKEN+' /repos/u/respaldo','resp: asks GitHub about the backup repo with its own token: '+JSON.stringify(ghRepoReqs.map(r=>r.split(TOKEN).join('***'))));
 x=await R(D1);
 ok(x.code===0&&commits()===1&&/^Sin cambios desde la última copia: 5 archivos/.test(x.out),'resp: second run without changes → no new commit: '+JSON.stringify(x.out+x.err));
 // Al otro día cambió tareas.json y ya no está recordatorios-enviados.json
 const siete=[...seis,T('r6','Comprar cartuchos',{})];escribir('tareas.json',siete);fs.rmSync(datos+'/recordatorios-enviados.json');
 x=await R(D2,{GITHUB_EVENT_NAME:'workflow_dispatch'});
 ok(x.code===0&&commits()===2&&ultimo().startsWith('Copia del 2026-10-22|')&&enCopia('tareas.json')===JSON.stringify(siete)&&/tareas\.json con 7 tareas/.test(x.out),'resp: changed tareas.json → new commit with the new copy: '+JSON.stringify(x.out+x.err));
 ok(enCopia('recordatorios-enviados.json')===null&&enCopia('recordatorios-enviados.json','main~1')!==null&&enCopia('tareas.json','main~1')===JSON.stringify(seis),'resp: a file deleted in the data repo leaves the latest copy too; the day before keeps it (history)');
 // Lo que la copia protege: tareas.json borrado, roto o vaciado de golpe → no se toca y la corrida falla (GitHub avisa por mail)
 const n=commits(),ultima=enCopia('tareas.json');
 fs.renameSync(datos+'/tareas.json',dir+'/tareas-afuera.json');
 x=await R(D2);ok(x.code===1&&/No está tareas\.json/.test(x.err)&&commits()===n&&enCopia('tareas.json')===ultima,'resp: tareas.json missing → exit 1, the backup keeps its last tareas.json');
 if(enlaces){fs.symlinkSync(dir+'/tareas-afuera.json',datos+'/tareas.json');x=await R(D2);fs.rmSync(datos+'/tareas.json');
   ok(x.code===1&&/No está tareas\.json/.test(x.err)&&commits()===n,'resp: tareas.json as a symlink is not followed → exit 1')}
 fs.renameSync(dir+'/tareas-afuera.json',datos+'/tareas.json');
 for(const roto of ['{roto','{"tareas":[]}','null','']){escribir('tareas.json',roto);x=await R(D2);
   ok(x.code===1&&/tareas\.json no tiene una lista de tareas válida/.test(x.err)&&commits()===n&&enCopia('tareas.json')===ultima,'resp: tareas.json not a list ('+JSON.stringify(roto)+') → exit 1, the backup keeps its last tareas.json')}
 escribir('tareas.json',[]);x=await R(D2);
 ok(x.code===1&&/tareas\.json quedó vacío \(en la última copia tenía 7 tareas\)/.test(x.err)&&commits()===n&&enCopia('tareas.json')===ultima,'resp: tareas.json emptied ([]) when the backup had 7 → exit 1, nothing pushed: '+JSON.stringify(x.err));
 escribir('tareas.json',seis.slice(0,4));x=await R(D2);
 ok(x.code===0&&commits()===n+1&&/tareas\.json con 4 tareas/.test(x.out),'resp: 4 tasks → copied');
 escribir('tareas.json',[]);x=await R('2026-10-23T02:30:00Z');   // 22/10 a las 23:30 en Argentina
 ok(x.code===0&&commits()===n+2&&enCopia('tareas.json')==='[]'&&ultimo().startsWith('Copia del 2026-10-22|')&&/tareas\.json con 0 tareas/.test(x.out),'resp: emptied when the backup had fewer than 5 → allowed; the date is the one in Argentina: '+JSON.stringify(x.out+x.err)+' '+ultimo());
 // Fallas de git
 escribir('tareas.json',siete);fs.writeFileSync(bare+'/hooks/pre-receive','#!/bin/sh\necho rechazado >&2\nexit 1\n',{mode:0o755});
 x=await R(D2);fs.rmSync(bare+'/hooks/pre-receive');
 ok(x.code===1&&/No se pudo guardar la copia en u\/respaldo/.test(x.err)&&/rechazado/.test(x.err)&&commits()===n+2,'resp: push rejected → exit 1 with git\'s reason: '+JSON.stringify(x.err));
 x=await R(D2,{RESPALDO_GIT_URL:pathToFileURL(dir+'/no-existe.git').href});
 ok(x.code===1&&/No se pudo bajar el repositorio de respaldo u\/respaldo/.test(x.err),'resp: backup repo cannot be cloned → exit 1');
 // Repositorio de respaldo creado con README: queda, y la copia va encima. RESPALDO_REPO como dirección completa también sirve.
 const bare2=dir+'/respaldo2.git';nuevoBare(bare2,true);
 x=await R(D2,{RESPALDO_REPO:' https://github.com/u/respaldo.git ',RESPALDO_GIT_URL:pathToFileURL(bare2).href});
 ok(x.code===0&&commits(bare2)===2&&archivosEn(bare2)==='README.md ajustes.json archivo/2025.json archivo/2026.json tareas.json'&&ultimo(bare2).startsWith('Copia del 2026-10-22|'),'resp: backup repo created with a README → README kept, copy on top; RESPALDO_REPO as a full address: '+JSON.stringify(x.out+x.err)+' '+archivosEn(bare2));
 // Registros: sin títulos de tareas y sin el token
 ok(rlogs&&![...titulos,'Comprar cartuchos','Vieja terminada 2025','Terminada en 2026'].some(t=>rlogs.includes(t)),'resp: no task titles in the logs');
 ok(!rlogs.includes(TOKEN)&&!rlogs.includes(BASIC)&&!rlogs.includes('SECRETO123'),'resp: the token never appears in stdout/stderr');
 ok(!fs.readFileSync(bare+'/config','utf8').includes(TOKEN)&&!(G(bare,['log','--all','--format=%B'])||'').includes(TOKEN),'resp: the token is not stored in the backup repo')}
console.log('fails',fails);process.exit(fails?1:0);
