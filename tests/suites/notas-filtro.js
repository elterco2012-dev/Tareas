// Notas recuerda el filtro (mejora de Claude Design, con un ajuste): Todas, Ideas o un color quedan guardados en este
// dispositivo (localStorage 'filtroNotas', una clave nueva), así las ideas quedan a un toque aunque la app se vuelva a
// abrir. Los chips Todas e Ideas dicen cuántas hay. Si el filtro guardado ya no aplica (un color que no usa ninguna
// nota, o Ideas sin ideas al entrar), vuelve a Todas. El ajuste: con Ideas elegido, el alta en Notas arranca como
// Idea, y si se agrega algo que el filtro no muestra, Notas pasa a Todas (para que no parezca que se perdió).
const L=require('../lib/gh');const {sleep,ok,device,makeGH,T,go,alta}=L;
let APP;
const SEEN=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9')}};
const N=(id,title,o={})=>({...T(id,title,{}),kind:'nota',time:null,...o});
const items=()=>[N('n1','Código del portón',{color:'verde'}),N('n2','Viaje a Mendoza',{idea:true}),N('n3','Talle de Juan'),T('t1','Llamar al banco')];
// Los chips del filtro: texto (sin el número), número, si está elegido y su etiqueta
const chips=p=>p.evaluate(()=>[...document.querySelectorAll('#notesSec .nfilter .chip')].map(b=>({t:(b.firstChild&&b.firstChild.nodeType===3?b.firstChild.textContent:'')||b.getAttribute('aria-label'),
  n:(b.querySelector('.n')||{}).textContent||null,on:b.getAttribute('aria-pressed')==='true',label:b.getAttribute('aria-label'),h:Math.round(b.getBoundingClientRect().height)})));
const shown=p=>p.evaluate(()=>[...document.querySelectorAll('#notesSec .task')].map(r=>r.querySelector('.ttext').textContent).sort());
const chosen=async p=>((await chips(p)).find(c=>c.on)||{}).t;
const saved=p=>p.evaluate(()=>localStorage.getItem('filtroNotas'));
(async()=>{
const b=await L.launch();APP=await L.appUrl();

for(const [name,opts] of [['phone',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],['computer',{viewport:{width:1280,height:800}}]]){
  const gh=makeGH(items());
  const {ctx,p}=await device(b,gh,opts,APP,SEEN);
  const tap=(s,o)=>opts.hasTouch?p.locator(s,o).first().tap():p.locator(s,o).first().click();
  await go(p,'notas');
  const keys0=await p.evaluate(()=>Object.keys(localStorage).sort());
  let c=await chips(p);
  ok(JSON.stringify(c.slice(0,2).map(x=>[x.t,x.n,x.label]))===JSON.stringify([['Todas','3','Todas, 3'],['Ideas','1','Ideas, 1']])&&c[2].t==='Verde'&&!c[2].n,name+': "Todas 3" and "Ideas 1" show how many; color chips without a number '+JSON.stringify(c));
  if(opts.hasTouch)ok(c.every(x=>x.h>=44),name+': filter chips are still 44 px tall '+JSON.stringify(c.map(x=>x.h)));
  // Ideas: se recuerda al ir a Hoy y volver, y al volver a abrir la app
  await tap('#notesSec .nfilter .chip',{hasText:'Ideas'});await sleep(200);
  ok(await chosen(p)==='Ideas'&&JSON.stringify(await shown(p))==='["Viaje a Mendoza"]'&&await saved(p)==='"ideas"',name+': choosing Ideas shows only ideas and is saved on this device');
  const keys1=await p.evaluate(()=>Object.keys(localStorage).sort());
  ok(JSON.stringify(keys1.filter(k=>!keys0.includes(k)))==='["filtroNotas"]'&&keys0.every(k=>keys1.includes(k)),name+': only one new localStorage key, "filtroNotas"; the old ones stay '+JSON.stringify(keys1.filter(k=>!keys0.includes(k))));
  await go(p,'hoy');await go(p,'notas');
  ok(await chosen(p)==='Ideas','Hoy and back: Ideas is still chosen');
  await p.reload();await sleep(800);await go(p,'notas');
  ok(await chosen(p)==='Ideas'&&JSON.stringify(await shown(p))==='["Viaje a Mendoza"]',name+': after reopening the app, Notas opens with Ideas');
  // Con Ideas elegido, el alta en Notas arranca como Idea: lo que se anota queda como idea y se ve
  await alta(p);
  const kind=await p.evaluate(()=>[...document.querySelectorAll('#typeRow .chip')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent));
  ok(JSON.stringify(kind)==='["Idea"]',name+': with Ideas chosen, a new entry in Notas starts as Idea '+JSON.stringify(kind));
  await p.fill('#title','Huerta en el balcón');await p.press('#title','Enter');await sleep(400);
  const nn=gh.items.find(x=>x.title==='Huerta en el balcón');
  ok(nn&&nn.kind==='nota'&&nn.idea===true&&(await shown(p)).includes('Huerta en el balcón')&&await chosen(p)==='Ideas',name+': it is saved as an idea and shows up under Ideas');
  // Si se elige Nota (no idea), al guardarla Notas pasa a Todas: si no, parecería que se perdió
  await alta(p);await p.fill('#title','Clave del wifi del club');await tap('#typeRow .chip',{hasText:'Nota'});await sleep(100);
  await p.press('#title','Enter');await sleep(400);
  ok(await chosen(p)==='Todas'&&(await shown(p)).includes('Clave del wifi del club')&&await saved(p)==='"todas"',name+': a plain note added under Ideas: Notas switches to Todas and shows it');
  // Un color: si se borra la última nota de ese color, al volver a Notas queda Todas (y se guarda así)
  await tap('#notesSec .nfilter .chip[aria-label="Verde"]');await sleep(200);
  ok(await chosen(p)==='Verde'&&await saved(p)==='"verde"',name+': choosing a color is saved too');
  // Buscando se ven las notas que coinciden de todos los colores, aunque el filtro guardado sea Verde
  await go(p,'buscar');await p.fill('#search','talle');await sleep(300);
  ok(JSON.stringify(await shown(p))==='["Talle de Juan"]',name+': search ignores the saved filter');
  await p.fill('#search','');await p.keyboard.press('Escape');await sleep(200);
  await p.evaluate(()=>act({type:'edit',id:'n1',patch:{color:''}}));await sleep(300);
  await go(p,'hoy');await go(p,'notas');
  ok(await chosen(p)==='Todas'&&await saved(p)==='"todas"',name+': the last green note lost its color: back to Todas, saved');
  ok(p.errs.length===0,name+': no page errors '+JSON.stringify(p.errs));
  await ctx.close();
}

// Ideas guardado y sin ninguna idea al abrir: Todas, sin "No hay ideas." (y se guarda así)
{const gh=makeGH([N('n3','Talle de Juan')]);
 const {ctx,p}=await device(b,gh,{viewport:{width:390,height:844},isMobile:true,hasTouch:true},APP,()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9');localStorage.setItem('filtroNotas','"ideas"')}});
 await go(p,'notas');
 const c=await chips(p);
 ok(await chosen(p)==='Todas'&&JSON.stringify(await shown(p))==='["Talle de Juan"]'&&!/No hay ideas/.test(await p.innerText('#notesSec'))&&await saved(p)==='"todas"','saved Ideas with no ideas left: Notas opens on Todas, no "No hay ideas." '+JSON.stringify(c));
 ok(c[1].t==='Ideas'&&c[1].n==='0'&&!c[1].on,'"Ideas 0" is still there, not chosen');
 // Elegido a mano con 0 ideas, como antes: "No hay ideas."
 await p.locator('#notesSec .nfilter .chip',{hasText:'Ideas'}).tap();await sleep(200);
 ok(await chosen(p)==='Ideas'&&/No hay ideas/.test(await p.innerText('#notesSec')),'tapping "Ideas 0" by hand: "No hay ideas.", as before');
 ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
 await ctx.close()}
// ===== Lo que encontró la revisión: el alta propone Idea solo si Notas muestra de verdad el filtro Ideas, y
// "nota:" al principio o lo elegido a mano le ganan =====
const typeNow=p=>p.evaluate(()=>[...document.querySelectorAll('#typeRow .chip')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent).join());
const PC={viewport:{width:1280,height:800}};
const SEEN_IDEAS=()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9');localStorage.setItem('filtroNotas','"ideas"')}};
{const gh=makeGH(items());
 const {ctx,p}=await device(b,gh,PC,APP,SEEN_IDEAS);
 await go(p,'notas');
 ok(await chosen(p)==='Ideas'&&await typeNow(p)==='Idea','Notas on Ideas: the empty entry proposes Idea');
 // "nota:" al principio gana: es una nota común (y Notas pasa a Todas para mostrarla)
 await p.fill('#title','nota: Patente del auto');await p.dispatchEvent('#title','input');await sleep(100);
 ok(await typeNow(p)==='Nota','"nota:" at the start: the type shows Nota, even on Ideas');
 await p.press('#title','Enter');await sleep(400);
 let it=gh.items.find(x=>x.title==='Patente del auto');
 ok(it&&it.kind==='nota'&&!it.idea&&await chosen(p)==='Todas','"nota: Patente del auto" on Ideas is saved as a plain note, and Notas shows it (Todas) '+JSON.stringify(it&&{idea:it.idea}));
 // Varias líneas pegadas en Notas › Ideas: "nota:" es nota, "idea:" es idea y las demás, ideas
 await p.locator('#notesSec .nfilter .chip',{hasText:'Ideas'}).click();await sleep(200);
 await p.evaluate(()=>openBulk(['nota: Uno','idea: Dos','Tres']));await sleep(200);await p.click('#bulkOk');await sleep(400);
 const k=['Uno','Dos','Tres'].map(t=>{const x=gh.items.find(y=>y.title===t);return x?(x.kind==='nota'?(x.idea?'idea':'nota'):'tarea'):'-'});
 ok(JSON.stringify(k)==='["nota","idea","idea"]','pasted lines on Ideas: "nota:" stays a note, the rest are ideas '+JSON.stringify(k));
 // Se borra la última idea: al volver a Notas queda Todas y el alta propone Nota (no Idea)
 await p.evaluate(()=>{for(const t of notes.filter(n=>n.idea))act({type:'edit',id:t.id,patch:{deletedAt:new Date().toISOString()}})});await sleep(300);
 await go(p,'hoy');await go(p,'notas');
 ok(await chosen(p)==='Todas'&&await typeNow(p)==='Nota','the last idea deleted: Notas is on Todas and the entry proposes Nota, not Idea');
 await p.fill('#title','Clave del wifi');await p.press('#title','Enter');await sleep(400);
 it=gh.items.find(x=>x.title==='Clave del wifi');
 ok(it&&it.kind==='nota'&&!it.idea,'... and what is written there is saved as a plain note '+JSON.stringify(it&&{idea:it.idea}));
 ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
 await ctx.close()}
// "Ver" del aviso: Notas pasa a Todas y el alta propone Nota
{const gh=makeGH(items());
 const {ctx,p}=await device(b,gh,PC,APP,SEEN_IDEAS);
 await p.fill('#title','nota: Medidas del placard');await p.press('#title','Enter');await sleep(300);
 await p.locator('#toast button',{hasText:'Ver'}).click();await sleep(400);
 ok(await p.evaluate(()=>document.body.dataset.screen)==='notas'&&await chosen(p)==='Todas'&&(await shown(p)).includes('Medidas del placard')&&await typeNow(p)==='Nota','"Ver" from the toast: Notas on Todas, the note is visible, the entry proposes Nota');
 await ctx.close()}
// Notas sin ninguna nota (la fila de filtros no está) con Ideas guardado: el alta propone Nota, y la primera es nota común
{const gh=makeGH([T('t1','Llamar al banco')]);
 const {ctx,p}=await device(b,gh,PC,APP,SEEN_IDEAS);
 await go(p,'notas');
 ok(await typeNow(p)==='Nota','no notes at all (saved Ideas): the entry proposes Nota');
 await p.fill('#title','Primera nota');await p.press('#title','Enter');await sleep(400);
 const it=gh.items.find(x=>x.title==='Primera nota');
 ok(it&&it.kind==='nota'&&!it.idea,'... and the first one is saved as a plain note '+JSON.stringify(it&&{idea:it.idea}));
 await ctx.close()}
// Ordenar (P) en Notas › Ideas: una tarea pasada a nota (N) se ve al cerrar (Notas pasa a Todas)
{const gh=makeGH([...items(),T('i1','Talle de remeras',{due:L.day(0),inbox:true})]);
 const {ctx,p}=await device(b,gh,PC,APP,SEEN_IDEAS);
 await go(p,'notas');await p.evaluate(()=>document.activeElement&&document.activeElement.blur());
 await p.keyboard.press('p');await sleep(300);
 ok(await p.isVisible('#procOv'),'P opens Ordenar from Notas');
 await p.keyboard.press('n');await sleep(300);await p.keyboard.press('Escape');await sleep(300);
 const it=gh.items.find(x=>x.id==='i1');
 ok(it&&it.kind==='nota'&&await chosen(p)==='Todas'&&(await shown(p)).includes('Talle de remeras'),'a task turned into a note from Ordenar on Ideas: Notas shows it (Todas) '+JSON.stringify({kind:it&&it.kind,f:await chosen(p)}));
 await ctx.close()}

// Un valor guardado que no es un filtro (editado a mano): Todas
{const gh=makeGH(items());
 const {ctx,p}=await device(b,gh,{viewport:{width:1280,height:800}},APP,()=>{if(!sessionStorage.getItem('h')){sessionStorage.setItem('h','1');localStorage.setItem('pistasVistas',JSON.stringify({gestos:1,punto:1}));localStorage.setItem('tipVisto','9');localStorage.setItem('filtroNotas','{"x":1}')}});
 await go(p,'notas');
 ok(await chosen(p)==='Todas'&&(await shown(p)).length===3&&p.errs.length===0,'an invalid saved filter: Todas, no errors '+JSON.stringify(p.errs));
 await ctx.close()}

await b.close();console.log('fails',L.fails);
})().catch(e=>{console.error(e);process.exit(1)});
