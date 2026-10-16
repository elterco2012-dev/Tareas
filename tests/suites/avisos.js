// Avisos por Telegram (fase 3): cuándo llega cada aviso (Detectado y al agregar), "recordame" a las 9, la hoja para
// posponer que abre el botón del aviso (?tarea=<id>), "En 1 hora" en el menú, el último aviso en Sincronización,
// la barra cuando un aviso de hoy no salió y cuando una tarea con hora cercana todavía no subió.
// Reloj: miércoles 14/10/2026 10:00 en Buenos Aires (ver tests/lib/harness.js).
const L=require('../lib/gh');const {sleep,ok,until,device,makeGH,day,T}=L;
const PHONE={viewport:{width:384,height:832},isMobile:true,hasTouch:true},DESK={viewport:{width:1000,height:900}};
const ENV='recordatorios-enviados.json';
// El archivo que escribe el workflow: "id|fecha|hora": cuándo salió
const envFile=o=>({content:JSON.stringify(o),sha:1});
// Este dispositivo ya vio salir avisos (como si hubiera leído el archivo otro día)
const AVISOS_ON=()=>{if(!sessionStorage.getItem('av')){sessionStorage.setItem('av','1');localStorage.setItem('avisosTelegram',JSON.stringify({repo:'u/r',last:'2026-10-13T23:50:00.000Z'}))}};
const tags=p=>p.$$eval('#detected .tag',e=>e.map(x=>x.textContent+(x.classList.contains('warn')?'!':'')));
const type=async(p,v)=>{await p.fill('#title',v);await sleep(120)};
(async()=>{
const b=await L.launch();

// ---- En qué corrida llega cada aviso ----
{
  const {ctx,p}=await device(b,makeGH([]),DESK);
  const r=await p.evaluate(([t0,t1,y])=>{
    const R=(d,h,f)=>{const x=remindRun(d,h,f);return x==null?null:hmLabel(x)};
    return {
      hoy1030:R(t0,'10:30'),hoy1005:R(t0,'10:05'),man0900:R(t1,'09:00'),man1500:R(t1,'15:00'),man1459:R(t1,'14:59'),
      man2329:R(t1,'23:29'),man2330:R(t1,'23:30'),man0600:R(t1,'06:00'),man0320:R(t1,'03:20'),man0319:R(t1,'03:19'),
      ayer:R(y,'15:00'),sinFecha:R(null,'15:00'),hoy0800:R(t0,'08:00'),hoy0700:R(t0,'07:00'),desde:R(t0,'09:00',8*60),desde2:R(t0,'09:00',8*60+55)
    };
  },[day(0),day(1),day(-1)]);
  console.log(JSON.stringify(r));
  ok(r.hoy1030==='10:20'&&r.man0900==='08:50'&&r.man1500==='14:50'&&r.man1459==='14:20','avisa entre 10 y 39 minutos antes (10:30 → 10:20, 9:00 → 8:50, 15:00 → 14:50, 14:59 → 14:20)');
  ok(r.hoy1005==='10:20','hoy, si la corrida de antes ya pasó, avisa en la próxima aunque sea después de la hora (10:05 → 10:20)');
  ok(r.man2329==='22:50'&&r.man2330===null,'la última corrida es 22:50: avisa hasta las 23:29, no 23:30');
  ok(r.man0600==='06:20'&&r.man0320==='06:20'&&r.man0319===null,'antes de las 6:20 avisa a las 6:20, hasta 3 horas tarde (3:20 sí, 3:19 no)');
  ok(r.ayer===null&&r.sinFecha===null,'ni de días que ya pasaron ni sin fecha');
  ok(r.hoy0800==='10:20'&&r.hoy0700===null,'hoy, una hora que ya pasó: avisa tarde hasta 3 horas después (8:00 → 10:20; 7:00, no)');
  ok(r.desde==='08:50'&&r.desde2==='09:20','desde cuándo cuenta (from) mueve la corrida (9:00 desde las 8:00 → 8:50; desde las 8:55 → 9:20)');
  ok(!p.errs.length,'sin errores ('+p.errs.join(' | ')+')');
  await ctx.close();
}

// ---- Detectado: sin avisos conocidos no dice nada; al leer el archivo del workflow, sí ----
{
  const gh=makeGH([]);
  const {ctx,p}=await device(b,gh,DESK);await sleep(800);
  await type(p,'Llamar al banco mañana a las 15');
  const t0=await tags(p);
  ok(t0.includes('15:00')&&!t0.some(x=>/aviso/i.test(x)),'sin avisos por Telegram vistos, Detectado no habla de avisos ('+t0.join(', ')+')');
  ok(await p.evaluate(()=>!avisosOn()),'sin recordatorios-enviados.json, los avisos no cuentan como activos');
  await ctx.close();
  // Con el archivo (un aviso de ayer): ahora sí
  gh.files[ENV]=envFile({['x|'+day(-1)+'|09:00']:'2026-10-13T11:50:31.000Z'});
  const d2=await device(b,gh,DESK);const q=d2.p;
  await until(()=>q.evaluate(()=>avisosOn()),{timeout:4000});
  ok(await q.evaluate(()=>avisosOn()),'leído el archivo del workflow, los avisos cuentan como activos');
  ok(await q.evaluate(()=>JSON.parse(localStorage.getItem('avisosTelegram')).last==='2026-10-13T11:50:31.000Z'),'el dispositivo recuerda cuándo salió el último');
  await type(q,'Llamar al banco mañana a las 15');
  let t=await tags(q);
  ok(t.includes('15:00')&&t.includes('Aviso 14:50'),'Detectado: "Aviso 14:50" para mañana a las 15 ('+t.join(', ')+')');
  await type(q,'Llamar al banco hoy a las 10:05');
  t=await tags(q);
  ok(t.includes('Aviso 10:20 (tarde)!'),'hoy a las 10:05 (ya pasó la corrida de las 9:50): "Aviso 10:20 (tarde)", marcado ('+t.join(', ')+')');
  await type(q,'Algo mañana a las 23:45');
  t=await tags(q);
  ok(t.includes('Sin aviso (muy tarde)!'),'mañana 23:45: "Sin aviso (muy tarde)" ('+t.join(', ')+')');
  await type(q,'Algo mañana a las 02:30');
  t=await tags(q);
  ok(t.includes('Sin aviso (muy temprano)!'),'mañana 02:30: "Sin aviso (muy temprano)" ('+t.join(', ')+')');
  // Sincronización: el último aviso
  await q.click('#statusBtn');await sleep(400);
  const line=await q.textContent('#avisosLine');
  ok(await q.isVisible('#avisosLine')&&/el último salió ayer a las 08:50/.test(line),'Sincronización: "'+line+'"');
  ok(!d2.p.errs.length,'sin errores ('+d2.p.errs.join(' | ')+')');
  await d2.ctx.close();
}

// ---- "Recordame" sin hora: a las 9 (no hoy si ya pasaron) ----
{
  const gh=makeGH([]);
  const {ctx,p}=await device(b,gh,DESK,null,AVISOS_ON);await sleep(800);
  await type(p,'recordame pagar la luz mañana');
  let t=await tags(p);
  ok(t.includes('09:00')&&t.includes('Aviso 08:50'),'"recordame … mañana": Detectado 09:00 y "Aviso 08:50" ('+t.join(', ')+')');
  await p.press('#title','Enter');await sleep(1500);
  let task=gh.items.find(x=>/pagar la luz/i.test(x.title));
  ok(task&&task.due===day(1)&&task.time==='09:00','se guarda para mañana a las 09:00 ('+JSON.stringify(task&&{due:task.due,time:task.time})+')');
  const msg=await p.textContent('#toastMsg');
  ok(/09:00 · aviso 08:50/.test(msg),'el aviso de agregada dice cuándo llega: "'+msg+'"');
  await type(p,'recordame pagar el gas a las 11');
  t=await tags(p);
  ok(t.includes('11:00')&&!t.includes('09:00'),'con hora, la que dijiste ('+t.join(', ')+')');
  await type(p,'recordame llamar a Juan');
  t=await tags(p);
  ok(!t.includes('09:00')&&t.includes('Sin hora: sin aviso!'),'hoy, pasadas las 9: sin hora y avisa que no hay aviso ('+t.join(', ')+')');
  await p.press('#title','Enter');await sleep(1500);
  task=gh.items.find(x=>/llamar a Juan/i.test(x.title));
  ok(task&&task.due===day(0)&&!task.time,'se guarda para hoy sin hora ('+JSON.stringify(task&&{due:task.due,time:task.time})+')');
  // Varias líneas pegadas: igual
  await p.evaluate(()=>openBulk(['recordame renovar el registro mañana','Comprar pan']));await sleep(200);
  await p.click('#bulkOk');await sleep(1500);
  const reg=gh.items.find(x=>/renovar el registro/i.test(x.title)),pan=gh.items.find(x=>x.title==='Comprar pan');
  ok(reg&&reg.time==='09:00'&&reg.due===day(1)&&pan&&!pan.time,'lista pegada: "recordame … mañana" a las 09:00, las demás sin hora');
  ok(!p.errs.length,'sin errores ('+p.errs.join(' | ')+')');
  await ctx.close();
}
{
  // A las 8:00: "recordame" de hoy queda a las 9; a las 8:55 (ya pasó la corrida de las 8:50), no
  const gh=makeGH([]);
  const {ctx,p}=await device(b,gh,{...DESK,clock:Date.parse('2026-10-14T11:00:00Z')},null,AVISOS_ON);await sleep(800);
  await type(p,'recordame sacar turno');
  let t=await tags(p);
  ok(t.includes('09:00')&&t.includes('Aviso 08:50'),'a las 8:00, "recordame" de hoy: 09:00 y aviso 08:50 ('+t.join(', ')+')');
  await p.clock.fastForward('55:00');await type(p,'recordame sacar turno ya');
  t=await tags(p);
  ok(!t.includes('09:00'),'a las 8:55 ya no llega el aviso de las 9: queda sin hora ('+t.join(', ')+')');
  await ctx.close();
}

// ---- Un aviso de hoy que no salió ----
{
  const tasksM=()=>[
    T('m','Pagar expensas',{due:day(0),time:'09:30',createdAt:L.ago(1)}),                    // tocaba a las 9:20
    T('n','Nueva de recién',{due:day(0),time:'09:45',createdAt:new Date(L.REF-10*60000).toISOString()}),   // creada 9:50: a las 10:20
    T('h','Hecha temprano',{due:day(0),time:'09:15',done:true,completedAt:new Date(L.REF-3*3600000).toISOString(),createdAt:L.ago(1)})
  ];
  const gh=makeGH(tasksM());
  gh.files[ENV]=envFile({['x|'+day(-1)+'|20:00']:'2026-10-13T22:50:20.000Z'});
  const {ctx,p}=await device(b,gh,PHONE);
  await until(()=>p.isVisible('#avisoBar'),{timeout:5000});
  const msg=await p.textContent('#avisoMsg');
  ok(await p.isVisible('#avisoBar')&&/No salió el aviso por Telegram de «Pagar expensas» \(09:30\)/.test(msg),'barra: "'+msg+'"');
  ok(await p.evaluate(()=>missedAvisos().map(x=>x.t.id).join(','))==='m','solo cuenta la que tocaba (no la creada después de su corrida ni la terminada antes)');
  await p.click('#statusBtn');await sleep(400);
  const line=await p.textContent('#avisosLine');
  ok(/Hoy falta alguno/.test(line),'Sincronización también lo dice: "'+line+'"');
  await p.click('#syncX');await sleep(300);
  await p.click('#avisoX');await sleep(200);
  ok(!await p.isVisible('#avisoBar'),'✕ la oculta');
  await p.reload();await sleep(1500);
  ok(!await p.isVisible('#avisoBar'),'oculta hasta mañana (también al volver a abrir)');
  await ctx.close();
  // Si salió alguno desde esa corrida (la de las 9:20), no falta nada
  const gh2=makeGH(tasksM());
  gh2.files[ENV]=envFile({['m|'+day(0)+'|09:30']:'2026-10-14T12:20:40.000Z'});
  const d2=await device(b,gh2,PHONE);await sleep(1500);
  ok(!await d2.p.isVisible('#avisoBar')&&await d2.p.evaluate(()=>missedAvisos().length===0),'con un aviso anotado después de las 9:20, no hay barra');
  await d2.ctx.close();
  // La tarea ya estaba (creada ayer) pero esta fecha y hora este dispositivo la ve recién ahora (la cambiaron en el
  // otro): no se reclama hasta la próxima corrida
  const gh3=makeGH(tasksM());
  gh3.files[ENV]=envFile({['x|'+day(-1)+'|20:00']:'2026-10-13T22:50:20.000Z'});
  const d3=await device(b,gh3,PHONE,null,()=>{if(!sessionStorage.getItem('v')){sessionStorage.setItem('v','1');localStorage.setItem('avisosDesde',JSON.stringify({m:{},at:Date.now()-3600000}))}});
  await sleep(1800);
  ok(!await d3.p.isVisible('#avisoBar')&&await d3.p.evaluate(()=>missedAvisos().length===0),'fecha y hora nuevas para este dispositivo: espera a la próxima corrida antes de reclamar');
  await d3.ctx.close();
}

// ---- Una tarea con hora dentro de poco que todavía no subió ----
{
  const gh=makeGH([]);
  const {ctx,p}=await device(b,gh,PHONE,null,AVISOS_ON);await sleep(800);
  gh.mode='offline';
  await type(p,'Llamar al proveedor a las 10:30');
  await p.press('#title','Enter');await sleep(500);
  ok(!await p.isVisible('#avisoBar'),'recién agregada: todavía no avisa (se sube en segundos)');
  await p.clock.fastForward(16000);await sleep(400);
  const msg=await until(async()=>await p.isVisible('#avisoBar')&&await p.textContent('#avisoMsg'),{timeout:3000});
  ok(/«Llamar al proveedor» \(10:30\) todavía no subió a GitHub/.test(msg||''),'a los 15 s sin subir: "'+msg+'"');
  ok(await p.isVisible('#avisoAct')&&await p.textContent('#avisoAct')==='Al calendario','con el botón "Al calendario"');
  await p.click('#avisoX');await sleep(200);
  ok(!await p.isVisible('#avisoBar'),'✕ la oculta');
  gh.mode='ok';
  await ctx.close();
}

// ---- Posponer desde el aviso: ?tarea=<id> ----
{
  const mk=()=>makeGH([T('a','Alfa',{due:day(0),time:'10:30'}),T('b','Beta',{due:day(0)}),T('c','Gamma',{due:day(0),time:'12:00'})]);
  let gh=mk();
  // Dispositivo recién abierto (sin nada guardado): espera a traer la tarea de GitHub
  let d=await device(b,gh,PHONE,(await L.appUrl())+'?tarea=a',AVISOS_ON);let p=d.p;
  await until(()=>p.isVisible('#posOv'),{timeout:5000});
  ok(await p.isVisible('#posOv'),'abre la hoja para posponer');
  ok(await p.textContent('#posT')==='10:30 · Alfa','con la hora y el título ("'+await p.textContent('#posT')+'")');
  const btns=await p.$$eval('#posBtns button',e=>e.map(x=>x.textContent));
  ok(btns.join('|')==='En 1 hora (11:00)|Hoy 18:00|Mañana 9:00|Hecha|Abrir','botones: '+btns.join(' | '));
  ok(!/tarea=/.test(p.url()),'la dirección queda limpia ('+p.url()+')');
  ok(await p.evaluate(()=>document.activeElement!==$('title')),'no abre el teclado del campo de alta');
  await p.click('#posBtns button.main');await sleep(1500);
  let a=gh.items.find(x=>x.id==='a');
  ok(a.due===day(0)&&a.time==='11:00','En 1 hora: hoy a las 11:00 ('+a.due+' '+a.time+')');
  const msg=await p.textContent('#toastMsg');
  ok(/Pasada a las 11:00 · aviso 10:50/.test(msg),'toast: "'+msg+'"');
  ok(!await p.isVisible('#posOv'),'la hoja se cierra');
  await p.click('#toastUndo');await sleep(1500);
  a=gh.items.find(x=>x.id==='a');
  ok(a.time==='10:30','Deshacer vuelve a las 10:30');
  await d.ctx.close();

  gh=mk();d=await device(b,gh,PHONE,(await L.appUrl())+'?tarea=c',AVISOS_ON);p=d.p;
  await until(()=>p.isVisible('#posOv'),{timeout:5000});
  await p.locator('#posBtns button',{hasText:'Mañana 9:00'}).click();await sleep(1500);
  const c=gh.items.find(x=>x.id==='c');
  ok(c.due===day(1)&&c.time==='09:00'&&c.postponed===1,'Mañana 9:00: mañana a las 09:00, cuenta como pateada ('+JSON.stringify({due:c.due,time:c.time,postponed:c.postponed})+')');
  await d.ctx.close();

  gh=mk();d=await device(b,gh,PHONE,(await L.appUrl())+'?tarea=a',AVISOS_ON);p=d.p;
  await until(()=>p.isVisible('#posOv'),{timeout:5000});
  await p.locator('#posBtns button',{hasText:'Hecha'}).click();await sleep(1500);
  ok(gh.items.find(x=>x.id==='a').done===true,'Hecha la termina');
  await d.ctx.close();

  gh=mk();d=await device(b,gh,PHONE,(await L.appUrl())+'?tarea=a',AVISOS_ON);p=d.p;
  await until(()=>p.isVisible('#posOv'),{timeout:5000});
  // Atrás la cierra sin salir de la app
  await p.locator('#posBtns button',{hasText:'Hoy 18:00'}).waitFor();
  await p.evaluate(()=>new Promise(r=>{const t0=Date.now();(function w(){if(!navPending&&history.state&&history.state.tareas==='atras'||Date.now()-t0>3000)r();else setTimeout(w,50)})()}));
  await p.goBack();await sleep(500);
  ok(!await p.isVisible('#posOv')&&/\/Tareas\//.test(p.url()),'Atrás cierra la hoja y queda en la app');
  // Abrir: la tarea para editar
  await p.evaluate(()=>handleLaunch(new URLSearchParams('tarea=a'),false));await sleep(400);
  ok(await p.isVisible('#posOv'),'con la app abierta, el aviso abre la hoja');
  await p.locator('#posBtns button',{hasText:'Abrir'}).click();await sleep(400);
  ok(await p.isVisible('#editOv')&&await p.inputValue('#eTitle')==='Alfa','Abrir: la tarea para editar');
  // Con algo abierto no interrumpe: lo ofrece en el aviso de abajo
  await p.evaluate(()=>handleLaunch(new URLSearchParams('tarea=c'),false));await sleep(400);
  ok(!await p.isVisible('#posOv')&&/Aviso de «Gamma»/.test(await p.textContent('#toastMsg')),'con una tarea abierta: "'+await p.textContent('#toastMsg')+'"');
  // Una que no existe
  await p.keyboard.press('Escape');await sleep(300);
  await p.evaluate(()=>handleLaunch(new URLSearchParams('tarea=zzz'),false));await sleep(1500);
  ok(/No encontré esa tarea/.test(await p.textContent('#toastMsg')),'id desconocido: "'+await p.textContent('#toastMsg')+'"');
  ok(!p.errs.length,'sin errores ('+p.errs.join(' | ')+')');
  await d.ctx.close();

  // Ya terminada: Volver a pendientes o Abrir
  gh=makeGH([T('a','Alfa',{due:day(0),time:'10:30',done:true,completedAt:L.ago(0.01)})]);
  d=await device(b,gh,PHONE,(await L.appUrl())+'?tarea=a',AVISOS_ON);p=d.p;
  await until(()=>p.isVisible('#posOv'),{timeout:5000});
  const bt=await p.$$eval('#posBtns button',e=>e.map(x=>x.textContent));
  ok(await p.textContent('#posH')==='Ya está terminada'&&bt.join('|')==='Volver a pendientes|Abrir','terminada: '+bt.join(' | '));
  await d.ctx.close();
}

// ---- "En 1 hora" en el menú ⋯ ----
{
  const gh=makeGH([T('a','Alfa',{due:day(0)})]);
  const {ctx,p}=await device(b,gh,DESK);await sleep(800);
  await p.locator('.task',{hasText:'Alfa'}).locator('.more').click();await sleep(200);
  const first=await p.$eval('#menu button',x=>x.textContent);
  ok(first==='En 1 hora','el menú empieza con "En 1 hora" ('+first+')');
  await p.click('#menu button');await sleep(1500);
  const a=gh.items.find(x=>x.id==='a');
  ok(a.due===day(0)&&a.time==='11:00','queda para hoy a las 11:00 ('+a.due+' '+a.time+')');
  ok(/Pasada a las 11:00/.test(await p.textContent('#toastMsg')),'toast: "'+await p.textContent('#toastMsg')+'"');
  await ctx.close();
}

await b.close();
})().catch(e=>{console.log('FAIL excepción: '+(e&&e.stack||e));process.exitCode=1});
