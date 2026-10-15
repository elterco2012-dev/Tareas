// Tanda 2: sincronización y pantalla
const L=require('../lib/gh');const {sleep,ok,device,makeGH,day,T,TZ}=L;
let APP;   // la app servida por http (L.appUrl)
const row=(p,t)=>p.locator('.task').filter({has:p.locator('.ttext',{hasText:t})}).first();
// GitHub falso con ETag / 304 y registro de pedidos
function etagMock(gh){
  gh.log=[];gh.messages=[];
  return async route=>{
    const req=route.request(),u=new URL(req.url()),m=u.pathname.match(/\/contents\/(.+)$/),path=m&&decodeURIComponent(m[1]);
    if(gh.mode==='offline')return route.abort('internetdisconnected');
    if(gh.mode==='401')return route.fulfill({status:401,body:'{}'});
    if(path!=='tareas.json'){
      const f=gh.files[path];
      if(req.method()==='PUT'){const b=JSON.parse(req.postData());gh.files[path]={content:Buffer.from(b.content,'base64').toString('utf8'),sha:(f?f.sha+1:1)};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.files[path].sha)}})})}
      if(!f)return route.fulfill({status:404,body:'{}'});
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from(f.content).toString('base64'),sha:String(f.sha)})});
    }
    const etag='"e'+gh.sha+'"';
    if(req.method()==='PUT'){
      if(gh.putDelay)await sleep(gh.putDelay);
      const b=JSON.parse(req.postData());gh.log.push('PUT');gh.messages.push(b.message);
      if(String(b.sha)!==String(gh.sha))return route.fulfill({status:409,body:'{}'});
      gh.items=JSON.parse(Buffer.from(b.content,'base64').toString('utf8'));gh.sha++;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.sha)}})});
    }
    if(req.headers()['if-none-match']===etag){gh.log.push('304');return route.fulfill({status:304,headers:{etag,'access-control-expose-headers':'ETag'}})}
    gh.log.push('200');
    return route.fulfill({status:200,contentType:'application/json',headers:{etag,'access-control-expose-headers':'ETag'},body:JSON.stringify({content:Buffer.from(JSON.stringify(gh.items)).toString('base64'),sha:String(gh.sha)})});
  };
}
async function dev(b,gh,opts={},url=APP,init){
  const ctx=await b.newContext({timezoneId:TZ,...opts});await ctx.route('https://api.github.com/**',etagMock(gh));
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  await p.addInitScript(()=>{if(!sessionStorage.getItem('i')){sessionStorage.setItem('i','1');localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'}))}});
  if(init)await p.addInitScript(init);
  await p.goto(url);await sleep(600);return {ctx,p};
}
(async()=>{
const b=await L.launch();APP=await L.appUrl();
// ===== 304, consultas según uso, un viaje, sin redibujar =====
let gh=makeGH([T('a','Uno',{due:day(0)}),T('b','Dos',{due:day(0)})]);
let {ctx,p}=await dev(b,gh,{viewport:{width:1000,height:800}});
const first=await p.$('.task');
await p.mouse.move(10,10);await p.mouse.move(20,20);
await sleep(11000);
const polls=gh.log.filter(x=>x==='304').length;
ok(gh.log[0]==='200'&&polls>=2,'polls are conditional (304) and frequent while active: '+gh.log.join(','));
ok(await first.evaluate(n=>n.isConnected),'no re-render on 304 (row element kept)');
gh.log.length=0;
await p.fill('#title','Llamar al banco');await p.press('#title','Enter');await sleep(600);
ok(gh.log[0]==='PUT'&&gh.items.some(x=>x.title==='Llamar al banco'),'add uploads in one trip (no GET first): '+gh.log.join(','));
ok(gh.messages.slice(-1)[0]==='+ Llamar al banco · pc','readable commit message: '+gh.messages.slice(-1)[0]);
await row(p,'Uno').locator('.chk').click();
ok(await row(p,'Uno').evaluate(n=>n.classList.contains('closing')),'checkbox: closing animation first');
await sleep(600);
ok(gh.items.find(x=>x.id==='a').done===true&&gh.messages.slice(-1)[0]==='✓ Uno · pc','then done, message "✓ Uno · pc"');
// otro dispositivo cambió: llega y se resalta
gh.items.push(T('c','Anotada en el pasillo',{due:day(0),src:'cel'}));gh.sha++;
await p.evaluate(()=>{lastActivity=Date.now()});
await sleep(6500);
ok(await row(p,'Anotada en el pasillo').evaluate(n=>n.classList.contains('llego')),'arrival highlighted');
ok((await p.innerText('#toastMsg'))==='1 nueva desde el celular'&&(await p.innerText('#toastUndo'))==='Ver','toast "1 nueva desde el celular · Ver"');
await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await sleep(5500);
ok(!(await row(p,'Anotada en el pasillo').evaluate(n=>n.classList.contains('llego'))),'highlight fades after you look');
// conflicto: subida directa con sha viejo → vuelve a leer y reaplica
gh.items.push(T('d','Otra del celu',{due:day(0)}));gh.sha++;gh.log.length=0;
await p.fill('#title','Tercera');await p.press('#title','Enter');await sleep(1200);
ok(gh.items.some(x=>x.title==='Tercera')&&gh.items.some(x=>x.id==='d'),'stale sha → 409 → re-read → both kept: '+gh.log.join(','));
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
// ===== Estados honestos =====
gh=makeGH([T('a','Uno',{due:day(0)})]);
({ctx,p}=await dev(b,gh,{viewport:{width:1000,height:800}}));
ok(await p.innerText('#statusShort')==='Al día','green Al día');
await p.click('#statusBtn');ok((await p.innerText('#statusLong')).startsWith('Tenés lo último de GitHub · hace'),'long: lo último · hace N s');
ok(!(await p.evaluate(()=>document.getElementById('acct').open)),'account folded when configured');
ok((await p.getAttribute('#histLink','href'))==='https://github.com/u/r/commits/HEAD/tareas.json','history link');
await p.keyboard.press('Escape');
gh.mode='offline';
await p.fill('#title','Sin señal');await p.press('#title','Enter');await sleep(800);
ok(await p.innerText('#statusShort')==='Sin señal'&&await p.evaluate(()=>getComputedStyle(document.getElementById('dot')).backgroundColor)!=='rgb(180, 35, 24)','offline: amber "Sin señal", not red');
await p.click('#statusBtn');
ok((await p.innerText('#pendList')).includes('Sin señal · nueva'),'pending list: "Sin señal · nueva": '+await p.innerText('#pendList'));
await p.keyboard.press('Escape');
// algo que no sube hace más de 30 min con señal → rojo
gh.mode='500';
await ctx.route('https://api.github.com/**',r=>r.fulfill({status:500,body:'{}'}));
await p.evaluate(()=>{const o=JSON.parse(localStorage.getItem('tareasPendientes'));o.forEach(x=>x.ts=Date.now()-31*60000);localStorage.setItem('tareasPendientes',JSON.stringify(o));sync()});await sleep(800);
ok((await p.innerText('#statusShort')).startsWith('Sin subir'),'stuck > 30 min → red: '+await p.innerText('#statusShort'));
await ctx.unroute('https://api.github.com/**');gh.mode='401';await ctx.route('https://api.github.com/**',etagMock(gh));
await p.evaluate(()=>sync());await sleep(600);
ok(await p.innerText('#statusShort')==='Token','401 → red "Token"');
await p.click('#tokenFix');ok(await p.evaluate(()=>document.getElementById('acct').open&&document.activeElement.id==='token'),'Renovar opens the account section on the token');
await ctx.close();
// "sin subir" solo si tarda más de 5 s
gh=makeGH([]);gh.putDelay=7000;
({ctx,p}=await dev(b,gh,{viewport:{width:1000,height:800}}));
await p.fill('#title','Lenta');await p.press('#title','Enter');await sleep(1500);
ok(!(await row(p,'Lenta').innerText()).includes('sin subir'),'no "sin subir" flicker in the first seconds');
await sleep(4500);
ok((await row(p,'Lenta').innerText()).includes('sin subir'),'"sin subir" after 5 s');
await sleep(2500);await ctx.close();
// ===== Fecha del token compartida (ajustes.json) y Telegram =====
gh=makeGH([]);
({ctx,p}=await dev(b,gh,{viewport:{width:1000,height:800}}));
await p.click('#statusBtn');await p.evaluate(()=>document.getElementById('acct').open=true);
await p.fill('#tokenExp',day(40));await p.click('#saveCfg');await sleep(1200);
const aj=gh.files['ajustes.json']&&JSON.parse(gh.files['ajustes.json'].content);
ok(aj&&Object.values(aj.tokens||{})[0]===day(40)&&!JSON.stringify(aj).includes('"x"'),'date saved in ajustes.json (without the token): '+JSON.stringify(aj));
await ctx.close();
({ctx,p}=await dev(b,gh,{viewport:{width:400,height:800},isMobile:true,hasTouch:true}));await sleep(800);
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('githubTasksConfig')).tokenExp)===day(40),'other device gets the date from ajustes.json');
// token nuevo con fecha: queda solo esa
await p.locator('#statusBtn').tap();await p.evaluate(()=>document.getElementById('acct').open=true);
await p.fill('#token','nuevo');await p.fill('#tokenExp',day(120));await p.locator('#saveCfg').tap();await sleep(1200);
const aj2=JSON.parse(gh.files['ajustes.json'].content);
ok(Object.keys(aj2.tokens).length===1&&Object.values(aj2.tokens)[0]===day(120),'renewed token replaces the old date: '+JSON.stringify(aj2));
ok(p.errs.length===0,'no page errors '+JSON.stringify(p.errs));
await ctx.close();
// ===== Contraseñas de Chrome =====
({ctx,p}=await dev(b,makeGH([]),{viewport:{width:1000,height:800}},APP,()=>{if(!sessionStorage.getItem('c')){sessionStorage.setItem('c',1);localStorage.removeItem('githubTasksConfig')}
  window.__stored=[];window.PasswordCredential=function(o){Object.assign(this,o)};
  Object.defineProperty(navigator,'credentials',{value:{store:c=>{window.__stored.push(c);return Promise.resolve()},get:()=>Promise.resolve({id:'yo/mis-datos',password:'tok123'})},configurable:true})}));
await p.click('#statusBtn');
ok(await p.evaluate(()=>document.getElementById('acct').open)&&await p.isVisible('#credBtn'),'not configured: account open, "Traer de mis contraseñas" visible');
await p.click('#credBtn');await sleep(200);
ok(await p.inputValue('#owner')==='yo'&&await p.inputValue('#repo')==='mis-datos'&&await p.inputValue('#token')==='tok123','credentials filled from Chrome passwords');
await p.click('#saveCfg');await sleep(300);
ok(await p.evaluate(()=>window.__stored.length===1&&window.__stored[0].id==='yo/mis-datos'&&window.__stored[0].password==='tok123'),'saving offers to store it in Chrome passwords');
await ctx.close();
// ===== Contraste y toques =====
({ctx,p}=await dev(b,makeGH([T('a','Uno',{due:day(-2),requester:'Laura'}),T('b','Dos',{due:day(-1)})]),{viewport:{width:384,height:832},isMobile:true,hasTouch:true}));
const sz=await p.evaluate(()=>({chip:document.querySelector('#chips .chip').getBoundingClientRect().height,gbtn:document.querySelector('.ghead .gbtn').getBoundingClientRect().height,faint:getComputedStyle(document.documentElement).getPropertyValue('--faint').trim()}));
ok(sz.chip>=40&&sz.gbtn>=44&&sz.faint==='#647083','touch targets ≥40/44 px and darker gray: '+JSON.stringify(sz));
ok(await p.evaluate(()=>document.querySelector('#chips .chip.on').getAttribute('aria-pressed'))==='true','aria-pressed on chips');
await ctx.close();
await b.close();console.log('fails',L.fails)})();
