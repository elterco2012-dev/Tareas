// Fase 4, protección de datos y seguridad básica: tareas.json borrado, vaciado o dañado (no se toma como lista vacía:
// se ofrece volver a subir la copia del dispositivo), datos inválidos que se arreglan, errores bien clasificados,
// "Descargar copia", repositorio público, token que no se muestra, CSP, archivos de más de 1 MB, error del archivo de
// terminadas a la vista y cambios cruzados entre dispositivos.
const L=require('../lib/gh');const {sleep,ok,until,device,makeGH,day,T}=L;
const fs=require('fs');
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true},DESK={viewport:{width:1000,height:900}};
const three=()=>[T('a','Alfa',{due:day(0)}),T('b','Beta',{due:day(0)}),T('c','Gama',{due:day(1)}),T('d','Delta')];
const titles=p=>p.evaluate(()=>tasks.map(t=>t.title).sort().join(','));
const state=p=>p.evaluate(()=>({kind:fileGuard&&fileGuard.kind,errorKind,lastError,bar:!$('guardBar').classList.contains('hidden')}));
// Sin señal en un solo dispositivo (setOffline no corta los pedidos que atiende el GitHub falso)
const cut=r=>r.abort('internetdisconnected');
const offline=(d,on)=>on?d.ctx.route('https://api.github.com/**',cut):d.ctx.unroute('https://api.github.com/**',cut);
(async()=>{
const b=await L.launch();

// ---- tareas.json desapareció ----
{
  const gh=makeGH(three());
  const {ctx,p}=await device(b,gh,PHONE);await sleep(1000);
  gh.missing=true;gh.items=[];
  await p.evaluate(()=>sync());await sleep(1200);
  let s=await state(p);
  ok(s.kind==='missing'&&s.errorKind==='hard'&&s.bar,'archivo borrado: queda frenado y con el aviso arriba ('+JSON.stringify(s)+')');
  ok(await titles(p)==='Alfa,Beta,Delta,Gama','las tareas siguen a la vista en este dispositivo');
  ok(/desapareció/.test(await p.textContent('#guardMsg')),'aviso: "'+await p.textContent('#guardMsg')+'"');
  ok(await p.innerText('#statusShort')==='Revisar','el estado dice Revisar');
  // Lo que se agrega mientras tanto no se sube (no se crea un tareas.json con solo eso)
  await L.alta(p);await p.fill('#title','Nueva mientras tanto');await p.press('#title','Enter');await sleep(1500);
  ok(gh.missing&&!(gh.puts>0),'mientras tanto no se sube nada');
  ok(await p.evaluate(()=>getOutbox().length)===1,'lo nuevo queda guardado para subir');
  // Sigue frenado al volver a abrir la app (aunque no haya señal: queda guardado)
  gh.mode='offline';await p.reload();await sleep(1500);
  s=await state(p);
  ok(s.kind==='missing'&&s.bar&&await titles(p)==='Alfa,Beta,Delta,Gama,Nueva mientras tanto','al volver a abrir (sin señal) sigue frenado y con las tareas ('+JSON.stringify(s)+')');
  gh.mode='ok';await p.evaluate(()=>sync());await sleep(1000);
  // Revisar → Sincronización con la explicación y Volver a subir
  await p.click('#guardFix');await sleep(300);
  ok(await p.isVisible('#guardBox')&&/5 tareas \(con 1 cambio sin subir\)/.test(await p.textContent('#guardTxt')),'Sincronización explica: "'+await p.textContent('#guardTxt')+'"');
  await p.click('#guardRestore');await sleep(1500);
  ok(!gh.missing&&gh.items.map(t=>t.title).sort().join(',')==='Alfa,Beta,Delta,Gama,Nueva mientras tanto','Volver a subir: tareas.json se crea con la copia de este dispositivo y lo que faltaba');
  s=await state(p);
  ok(!s.kind&&!s.bar&&s.errorKind===null&&await p.evaluate(()=>getOutbox().length)===0,'resuelto: sin aviso y sin nada pendiente ('+JSON.stringify(s)+')');
  ok(/quedó como la copia/.test(await p.textContent('#toastMsg')),'toast: "'+await p.textContent('#toastMsg')+'"');
  ok(!p.errs.length,'sin errores ('+p.errs.join(' | ')+')');
  await ctx.close();
}
// Un dispositivo nuevo, con el repositorio recién creado (sin tareas.json): no es un problema
{
  const gh=makeGH([]);gh.missing=true;
  const {ctx,p}=await device(b,gh,PHONE);await sleep(1000);
  ok(!(await state(p)).kind,'repositorio nuevo sin tareas.json: sin aviso');
  await L.alta(p);await p.fill('#title','La primera');await p.press('#title','Enter');await sleep(1500);
  ok(!gh.missing&&gh.items.length===1,'la primera tarea crea tareas.json');
  await ctx.close();
}

// ---- tareas.json quedó vacío ----
{
  const gh=makeGH(three());
  const {ctx,p}=await device(b,gh,DESK);await sleep(1000);
  gh.items=[];gh.sha++;
  await p.evaluate(()=>sync());await sleep(1200);
  ok((await state(p)).kind==='emptied'&&await titles(p)==='Alfa,Beta,Delta,Gama','vaciado: frenado y con las tareas');
  // Lo arregla el otro dispositivo: sigue solo
  gh.items=three();gh.sha++;
  await p.evaluate(()=>sync());await sleep(1200);
  ok(!(await state(p)).kind,'si el otro dispositivo lo arregla, el aviso se va solo');
  // Vaciado a propósito: dos toques
  gh.items=[];gh.sha++;
  await p.evaluate(()=>sync());await sleep(1200);
  await p.click('#statusBtn');await sleep(300);
  await p.click('#guardAccept');await sleep(200);
  ok(/Tocá de nuevo/.test(await p.textContent('#guardAccept'))&&(await state(p)).kind==='emptied','"Fue a propósito" pide un segundo toque');
  await p.click('#syncX');await sleep(300);await p.click('#statusBtn');await sleep(300);
  ok(!/Tocá de nuevo/.test(await p.textContent('#guardAccept')),'al cerrar y volver a abrir Sincronización, vuelve a pedir los dos toques');
  await p.click('#guardAccept');await sleep(200);await p.click('#guardAccept');await sleep(1500);
  ok(!(await state(p)).kind&&await titles(p)===''&&gh.items.length===0,'aceptado: este dispositivo también queda vacío');
  ok(!p.errs.length,'sin errores ('+p.errs.join(' | ')+')');
  await ctx.close();
}
// Las que se van porque el otro dispositivo las archivó (terminadas hace más de un mes) no cuentan como vaciado
{
  const viejas=[1,2,3,4].map(i=>T('v'+i,'Vieja '+i,{done:true,completedAt:L.ago(40),due:day(-40)}));
  const gh=makeGH(viejas);
  const {ctx,p}=await device(b,gh,DESK,null,()=>{localStorage.setItem('ultimoArchivo',JSON.stringify(new Date().toISOString().slice(0,10)))});await sleep(1000);
  gh.items=[];gh.sha++;
  await p.evaluate(()=>sync());await sleep(1200);
  ok(!(await state(p)).kind,'si solo se fueron terminadas viejas (las archivó el otro), no hay aviso');
  await ctx.close();
}

// Si las que había estaban en la papelera (y se vació en el otro dispositivo), no es un problema
{
  const gh=makeGH([1,2,3,4].map(i=>T('p'+i,'En la papelera '+i,{deletedAt:L.ago(1)})));
  const {ctx,p}=await device(b,gh,DESK);await sleep(1000);
  gh.items=[];gh.sha++;
  await p.evaluate(()=>sync());await sleep(1200);
  ok(!(await state(p)).kind,'vaciar la papelera en el otro dispositivo no cuenta como vaciado');
  await ctx.close();
}
// ---- Volver a subir usa la última versión buena de GitHub si es más nueva que la copia del dispositivo ----
{
  const v1=three(),v2=[...three(),T('n','Nueva de la compu',{due:day(0)})];
  const gh=makeGH(v1);
  const d=await device(b,gh,PHONE);const p=d.p;await sleep(1000);
  await offline(d,true);
  gh.items=v2;gh.sha++;   // la compu subió algo mientras el celular no miraba
  gh.history=[{sha:'c3',content:null,date:'2026-10-14T15:40:00Z'},{sha:'c2',content:JSON.stringify(v2),date:'2026-10-14T15:30:00Z'},{sha:'c1',content:JSON.stringify(v1),date:'2026-10-14T12:00:00Z'}];
  gh.missing=true;gh.items=[];
  await p.evaluate(()=>act({type:'add',task:{id:'cel',title:'Del celular sin subir',priority:'Media',due:null,done:false,createdAt:new Date().toISOString(),completedAt:null}}));
  await offline(d,false);await p.evaluate(()=>sync());await sleep(1200);
  ok((await state(p)).kind==='missing','el celular ve que el archivo desapareció');
  await p.evaluate(()=>restoreFile());await sleep(2000);
  const t=gh.items.map(x=>x.title).sort().join(',');
  ok(!gh.missing&&t==='Alfa,Beta,Del celular sin subir,Delta,Gama,Nueva de la compu','usa la última versión buena (con lo de la compu) más lo pendiente del celular: '+t);
  ok(/volvió la última versión buena de tareas\.json \(del 14\/10 a las 12:30\), con lo que faltaba subir/.test(await p.textContent('#toastMsg')),'toast: "'+await p.textContent('#toastMsg')+'"');
  await d.ctx.close();
}
// Dañado en un dispositivo sin copia: usa la última versión buena; si no hay ninguna, no sube una lista vacía
{
  const good=[T('a','Alfa'),T('b','Beta')];
  const gh=makeGH([]);gh.raw='[{"id":"a","title":"Alfa"},]';gh.sha=5;
  gh.history=[{sha:'h2',content:gh.raw},{sha:'h1',content:JSON.stringify(good)}];
  let d=await device(b,gh,DESK);await sleep(1200);
  ok((await state(d.p)).kind==='broken','dañado en un dispositivo nuevo: frenado');
  await d.p.evaluate(()=>restoreFile());await sleep(2000);
  ok(gh.raw===undefined&&gh.items.map(x=>x.title).join(',')==='Alfa,Beta','vuelve la última versión buena del historial');
  await d.ctx.close();
  const gh2=makeGH([]);gh2.raw='{roto';gh2.sha=5;gh2.history=[{sha:'h1',content:'{roto'}];
  d=await device(b,gh2,DESK);await sleep(1200);
  await d.p.evaluate(()=>restoreFile());await sleep(1500);
  ok(gh2.raw==='{roto'&&!(gh2.puts>0)&&/No encontré una versión buena/.test(await d.p.textContent('#toastMsg')),'sin ninguna versión buena ni copia: no sube nada y lo explica');
  await d.ctx.close();
}
// Volver a subir con el repositorio que ahora es público: no sube
{
  const gh=makeGH(three());
  const {ctx,p}=await device(b,gh,DESK);await sleep(1000);
  gh.missing=true;gh.items=[];await p.evaluate(()=>sync());await sleep(1000);
  gh.repo={private:false};
  await p.evaluate(()=>restoreFile());await sleep(1500);
  ok(gh.missing&&!(gh.puts>0)&&/es público/.test(await p.textContent('#toastMsg')),'repositorio que pasó a ser público: Volver a subir no sube nada');
  await ctx.close();
}

// ---- tareas.json dañado ----
{
  const gh=makeGH(three());
  const {ctx,p}=await device(b,gh,DESK);await sleep(1000);
  gh.raw='{"esto no es": "una lista"';gh.sha++;
  await p.evaluate(()=>sync());await sleep(1200);
  ok((await state(p)).kind==='broken'&&await titles(p)==='Alfa,Beta,Delta,Gama','dañado: frenado y con las tareas');
  await p.click('#statusBtn');await sleep(300);
  ok(!await p.isVisible('#guardAccept'),'dañado: no se ofrece "dejarlo así"');
  await p.click('#guardRestore');await sleep(1500);
  ok(gh.raw===undefined&&gh.items.length===4&&!(await state(p)).kind,'Volver a subir pisa el archivo dañado con la copia');
  await ctx.close();
}

// ---- Datos inválidos: se arreglan ----
{
  const gh=makeGH([null,7,'texto',T('a','Bien',{due:day(0)}),{title:'Sin id',due:day(0)},T('a','Repetida'),
    T('x',12345,{due:'mañana',time:'3pm',priority:'urgente',done:'si'}),T('y','Borrada rara',{deletedAt:'ayer'}),T('z','Repetición rara',{repeat:'a veces',requester:42})]);
  const {ctx,p}=await device(b,gh,DESK);await sleep(1500);
  const r=await p.evaluate(()=>({n:tasks.length+trash.length,ids:[...tasks,...trash].map(t=>String(t.id)),x:tasks.find(t=>t.id==='x'),y:trash.find(t=>t.id==='y'),z:tasks.find(t=>t.id==='z'),rows:document.querySelectorAll('.task').length}));
  ok(!p.errs.length,'con datos inválidos la app anda, sin errores ('+p.errs.join(' | ')+')');
  ok(r.n===6&&new Set(r.ids).size===6&&r.ids.some(i=>/^reparada-/.test(i)),'se descartan los que no son tareas; la sin id y la repetida quedan con un id propio ('+r.ids.join(',')+')');
  ok(r.x&&r.x.title==='12345'&&r.x.due===null&&r.x.time===null&&r.x.priority==='Media'&&r.x.done===true,'campos inválidos arreglados: '+JSON.stringify(r.x&&{title:r.x.title,due:r.x.due,time:r.x.time,priority:r.x.priority,done:r.x.done}));
  ok(r.y&&!isNaN(Date.parse(r.y.deletedAt)),'una fecha de borrado ilegible queda en la papelera desde hoy (no se borra del todo)');
  ok(r.z&&r.z.repeat===null&&r.z.requester==='42','repetición desconocida y quién la pidió como texto');
  ok(/datos inválidos: se arreglaron/.test(await p.textContent('#toastMsg')),'aviso: "'+await p.textContent('#toastMsg')+'"');
  // En la próxima subida se guarda arreglado
  await L.alta(p);await p.fill('#title','Otra');await p.press('#title','Enter');await sleep(1500);
  ok(gh.items.length===7&&gh.items.every(t=>t&&typeof t==='object'&&t.id!=null),'al subir, tareas.json queda arreglado');
  await ctx.close();
}

// ---- Errores bien clasificados ----
{
  const gh=makeGH(three());
  const {ctx,p}=await device(b,gh,DESK);await sleep(1000);
  gh.mode='ratelimit';await p.evaluate(()=>sync());await sleep(800);
  let s=await state(p);
  ok(s.errorKind==='soft'&&/limitó las consultas/.test(s.lastError),'límite de consultas de GitHub: se reintenta solo, no culpa al token ('+s.lastError+')');
  gh.mode='offline';await p.evaluate(()=>sync());await sleep(800);
  s=await state(p);
  ok(s.errorKind==='offline'&&s.lastError==='Sin conexión','sin señal: "Sin conexión"');
  gh.mode='ok';
  await p.evaluate(()=>{window.__fileText=fileText;fileText=()=>{throw new TypeError('x is null')}});
  gh.sha++;await p.evaluate(()=>sync());await sleep(800);
  s=await state(p);
  ok(s.errorKind==='soft'&&/^Error interno de la app/.test(s.lastError),'un error de la app no se muestra como "Sin conexión" ('+s.lastError+')');
  await p.evaluate(()=>{fileText=window.__fileText});
  await ctx.close();
}

// ---- Repositorio público ----
{
  const gh=makeGH(three());gh.repo={private:false};
  const {ctx,p}=await device(b,gh,DESK);await sleep(1000);
  const s=await state(p);
  ok(s.errorKind==='hard'&&/es público/.test(s.lastError),'repositorio público: frena con aviso ('+s.lastError+')');
  await L.alta(p);await p.fill('#title','No tiene que subir');await p.press('#title','Enter');await sleep(1500);
  ok(!(gh.puts>0),'no se sube nada a un repositorio público');
  gh.repo={private:true};
  await p.evaluate(()=>{repoOk=null;return sync()});await sleep(1500);
  ok(gh.items.some(t=>t.title==='No tiene que subir'),'hecho privado: sube lo que esperaba');
  await ctx.close();
}

// ---- Token: no se muestra ----
{
  const gh=makeGH(three());
  const {ctx,p}=await device(b,gh,DESK,null,()=>{if(!sessionStorage.getItem('t')){sessionStorage.setItem('t','1');localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'github_pat_SECRETO1234'}))}});await sleep(800);
  await p.click('#statusBtn');await sleep(300);
  await p.evaluate(()=>{$('acct').open=true});
  ok(await p.inputValue('#token')===''&&/…1234/.test(await p.getAttribute('#token','placeholder')),'el token no aparece; solo sus últimas letras ('+await p.getAttribute('#token','placeholder')+')');
  await p.click('#saveCfg');await sleep(500);
  ok(await p.evaluate(()=>cfg.token)==='github_pat_SECRETO1234','guardar sin tocar el campo deja el token como estaba');
  await p.click('#statusBtn');await sleep(300);await p.evaluate(()=>{$('acct').open=true});
  await p.fill('#token','github_pat_NUEVO9999');await p.click('#saveCfg');await sleep(500);
  ok(await p.evaluate(()=>cfg.token)==='github_pat_NUEVO9999','pegar uno nuevo lo reemplaza');
  await ctx.close();
}

// ---- Descargar copia ----
{
  const gh=makeGH(three());
  gh.files['archivo/2026.json']={content:JSON.stringify([T('h1','Archivada',{done:true,completedAt:L.ago(60)})]),sha:1};
  const {ctx,p}=await device(b,gh,DESK);await sleep(1000);
  await p.evaluate(()=>act({type:'add',task:{id:'nuevo',title:'Sin subir todavía',priority:'Media',due:null,done:false,createdAt:new Date().toISOString(),completedAt:null}}));
  await p.click('#statusBtn');await sleep(300);
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#exportBtn')]);
  const data=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  ok(/^mis-tareas-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()),'nombre del archivo: '+dl.suggestedFilename());
  ok(data.app==='Mis tareas'&&data.repositorio==='u/r'&&data.version&&data.tareas.length===5&&data.tareas.some(t=>t.title==='Sin subir todavía'),'la copia trae todas las tareas, también lo que falta subir');
  ok(data.archivo&&Array.isArray(data.archivo['2026.json'])&&data.archivo['2026.json'][0].title==='Archivada','y el archivo de terminadas');
  gh.mode='offline';
  const [dl2]=await Promise.all([p.waitForEvent('download'),p.click('#exportBtn')]);
  const d2=JSON.parse(fs.readFileSync(await dl2.path(),'utf8'));
  ok(d2.archivo===null&&d2.tareas.length>=4&&/sin el archivo de terminadas: no hay señal/.test(await p.textContent('#toastMsg')),'sin señal: la copia sale igual, sin el archivo, y lo dice');
  gh.mode='ok';
  await ctx.close();
}

// ---- Archivos de más de 1 MB (GitHub no manda el contenido): se piden crudos ----
{
  const gh=makeGH(three());
  gh.files['archivo/2026.json']={content:JSON.stringify([T('g1','Archivada grande',{done:true,completedAt:L.ago(90)})]),sha:3};
  gh.big.add('archivo/2026.json');gh.big.add('tareas.json');
  const {ctx,p}=await device(b,gh,DESK);await sleep(1200);
  ok(await titles(p)==='Alfa,Beta,Delta,Gama'&&!(await state(p)).kind,'tareas.json de más de 1 MB: se lee igual');
  await p.evaluate(()=>loadArchive());await sleep(1000);
  ok(await p.evaluate(()=>archiveData&&archiveData.items.some(t=>t.title==='Archivada grande')),'el archivo de terminadas de más de 1 MB también');
  await ctx.close();
}

// ---- Si archivar falla, se ve en Sincronización ----
{
  const gh=makeGH([...three(),T('o','Terminada hace mucho',{done:true,completedAt:L.ago(45)})]);
  gh.failPut.add('archivo/2026.json');
  const {ctx,p}=await device(b,gh,DESK);await sleep(1800);
  await p.click('#statusBtn');await sleep(300);
  ok(await p.isVisible('#archLine')&&/No se pudieron archivar/.test(await p.textContent('#archLine')),'Sincronización: "'+await p.textContent('#archLine')+'"');
  ok(gh.items.some(t=>t.id==='o'),'la terminada sigue en tareas.json (no se borra si no se archivó)');
  await ctx.close();
}

// ---- Cambios cruzados entre dispositivos ----
{
  // El celular, sin señal, cambia el título; después la compu cambia el mismo título. Al volver la señal gana la compu
  const gh=makeGH([T('x','Original',{due:day(0)}),T('y','Otra',{due:day(0)})]);
  const cel=await device(b,gh,PHONE),pc=await device(b,gh,DESK);await sleep(1000);
  await offline(cel,true);
  await cel.p.evaluate(()=>editWithUndo(tasks.find(t=>t.id==='x'),{title:'Del celular'},'Cambiada'));
  await cel.p.evaluate(()=>editWithUndo(tasks.find(t=>t.id==='y'),{notes:'nota del celular'},'Cambiada'));
  await pc.p.clock.fastForward('10:00');
  await pc.p.evaluate(()=>editWithUndo(tasks.find(t=>t.id==='x'),{title:'De la compu'},'Cambiada'));
  await pc.p.evaluate(()=>editWithUndo(tasks.find(t=>t.id==='y'),{title:'Otra (compu)'},'Cambiada'));
  await sleep(1500);
  await offline(cel,false);
  await cel.p.evaluate(()=>sync());await sleep(1500);
  const x=gh.items.find(t=>t.id==='x'),y=gh.items.find(t=>t.id==='y');
  ok(x.title==='De la compu','mismo campo, la compu lo cambió después: gana la compu ('+x.title+')');
  ok(y.title==='Otra (compu)'&&y.notes==='nota del celular','campos distintos: se aplican los dos');
  // (el aviso espera a que se vaya el Deshacer de la edición)
  await until(async()=>/No se aplicó/.test(await cel.p.textContent('#toastMsg')),{timeout:7000});
  ok(/No se aplicó tu cambio en el título de «De la compu»/.test(await cel.p.textContent('#toastMsg')),'el celular avisa: "'+await cel.p.textContent('#toastMsg')+'"');
  await cel.ctx.close();await pc.ctx.close();
}
{
  // Al revés: la compu cambió primero; el celular, sin señal, lo cambió después → gana el celular
  const gh=makeGH([T('x','Original',{due:day(0)})]);
  const cel=await device(b,gh,PHONE),pc=await device(b,gh,DESK);await sleep(1000);
  await offline(cel,true);
  await pc.p.evaluate(()=>editWithUndo(tasks.find(t=>t.id==='x'),{title:'De la compu'},'Cambiada'));await sleep(1200);
  await cel.p.clock.fastForward('10:00');
  await cel.p.evaluate(()=>editWithUndo(tasks.find(t=>t.id==='x'),{title:'Del celular, después'},'Cambiada'));
  await offline(cel,false);
  await cel.p.evaluate(()=>sync());await sleep(1500);
  ok(gh.items[0].title==='Del celular, después','el cambio más nuevo (el del celular) gana: '+gh.items[0].title);
  ok(!/No se aplicó/.test(await cel.p.textContent('#toastMsg')||''),'sin aviso de conflicto');
  await cel.ctx.close();await pc.ctx.close();
}

{
  // El otro dispositivo tocó otra cosa de la tarea después (el orden): no hace ganar su valor viejo de la fecha
  const gh=makeGH([T('x','Uno',{due:day(0)})]);
  const cel=await device(b,gh,PHONE),pc=await device(b,gh,DESK);await sleep(1000);
  await offline(cel,true);
  await pc.p.evaluate(()=>editWithUndo(tasks.find(t=>t.id==='x'),{due:addDays(2)},'Cambiada'));await sleep(1200);
  await cel.p.clock.fastForward('10:00');
  await cel.p.evaluate(()=>editWithUndo(tasks.find(t=>t.id==='x'),{due:addDays(5)},'Cambiada'));
  await pc.p.clock.fastForward('20:00');
  await pc.p.evaluate(()=>editWithUndo(tasks.find(t=>t.id==='x'),{notes:'nota de la compu'},'Cambiada'));await sleep(1200);
  await offline(cel,false);await cel.p.evaluate(()=>sync());await sleep(1500);
  const x=gh.items[0];
  ok(x.due===day(5)&&x.notes==='nota de la compu','la fecha del celular (más nueva que la de la compu) gana aunque la compu después cambió la nota ('+x.due+')');
  await cel.ctx.close();await pc.ctx.close();
}
{
  // Los dos hicieron el mismo cambio (por ejemplo, pasarla a hoy): no hay aviso de conflicto
  const gh=makeGH([T('x','Vencida',{due:day(-2)})]);
  const cel=await device(b,gh,PHONE),pc=await device(b,gh,DESK);await sleep(1000);
  await offline(cel,true);
  await cel.p.evaluate(()=>reschedule(tasks.find(t=>t.id==='x'),'0'));
  await pc.p.clock.fastForward('10:00');
  await pc.p.evaluate(()=>reschedule(tasks.find(t=>t.id==='x'),'0'));await sleep(1200);
  await offline(cel,false);await cel.p.evaluate(()=>sync());await sleep(1500);
  ok(gh.items[0].due===day(0)&&!/No se aplic/.test(await cel.p.textContent('#toastMsg')||''),'mismo cambio en los dos: sin aviso de conflicto');
  // Lo que subió el service worker con un conflicto se avisa al abrir
  await cel.p.evaluate(async()=>{hideToast();await idbSet('perdidos',[{id:'x',keys:['title'],title:'Vencida'}]);bgCheck=true;await sync()});await sleep(800);
  ok(/No se aplicó tu cambio en el título de «Vencida»/.test(await cel.p.textContent('#toastMsg')),'conflicto en segundo plano: se avisa al abrir ("'+await cel.p.textContent('#toastMsg')+'")');
  ok(!(await cel.p.evaluate(()=>idbGet('perdidos'))),'y se borra el aviso guardado');
  await cel.ctx.close();await pc.ctx.close();
}

// ---- CSP: la app corre entera sin violaciones ----
{
  const gh=makeGH(three());
  const {ctx,p}=await device(b,gh,DESK,null,()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))});
  await sleep(800);
  ok(await p.evaluate(()=>!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')),'la página tiene CSP');
  await L.alta(p);await p.fill('#title','Llamar mañana a las 10');await p.press('#title','Enter');await sleep(800);
  await p.locator('.task .ttext',{hasText:'Alfa'}).click();await sleep(300);await p.keyboard.press('Escape');await sleep(300);
  await p.click('#statusBtn');await sleep(300);
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#exportBtn')]);await dl.path();
  await p.click('#syncX');await sleep(300);
  const v=await p.evaluate(()=>window.__csp);
  ok(Array.isArray(v)&&v.length===0,'sin violaciones de CSP al agregar, editar, abrir Sincronización y descargar la copia ('+JSON.stringify(v)+')');
  ok(!p.errs.length,'sin errores ('+p.errs.join(' | ')+')');
  await ctx.close();
}

await b.close();
})().catch(e=>{console.log('FAIL excepción: '+(e&&e.stack||e));process.exitCode=1});
