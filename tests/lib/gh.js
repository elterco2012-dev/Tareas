'use strict';
// GitHub falso y "dispositivos" con la app abierta, para las pruebas que sincronizan.
// makeGH() guarda tareas.json (items/sha) y otros archivos (files: archivo/AAAA.json, ajustes.json);
// mock() atiende api.github.com con ctx.route; device() abre la app ya conectada a ese GitHub.
const H=require('./harness');
const {sleep,ok,day,TZ}=H;

// Opcionales: missing (tareas.json no existe: 404, se crea con un PUT sin sha), raw (texto de tareas.json tal cual, por
// ejemplo dañado), repo (lo que responde el repositorio: {private:false} para uno público), mode 'ratelimit' (403 por
// límite de consultas), big (archivos de más de 1 MB: GitHub no manda el contenido y hay que pedirlo crudo), failPut
// (rutas que responden 500 al guardar). archivo/ se lista con lo que haya en files.
function makeGH(items){return {items:items||[],sha:1,mode:'ok',files:{},big:new Set(),failPut:new Set()}}
async function mock(ctx,gh){
  await ctx.route('https://api.github.com/**',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(gh.mode==='offline')return route.abort('internetdisconnected');
    if(gh.mode==='ratelimit')return route.fulfill({status:403,headers:{'x-ratelimit-remaining':'0','access-control-expose-headers':'x-ratelimit-remaining'},body:'{}'});
    const m=u.pathname.match(/\/contents\/(.+)$/);const path=m?decodeURIComponent(m[1]):null;
    const raw=/raw/.test(req.headers()['accept']||'');
    if(path==='archivo'&&req.method()==='GET'){
      const list=Object.keys(gh.files).filter(k=>k.startsWith('archivo/')).map(k=>({type:'file',name:k.slice(8)}));
      return list.length?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(list)}):route.fulfill({status:404,body:'{}'});
    }
    if(path&&gh.failPut.has(path)&&req.method()==='PUT')return route.fulfill({status:500,body:'{}'});
    if(path&&gh.big.has(path)&&req.method()==='GET'){
      const txt=path==='tareas.json'?JSON.stringify(gh.items):gh.files[path]&&gh.files[path].content;
      if(txt==null)return route.fulfill({status:404,body:'{}'});
      if(raw)return route.fulfill({status:200,contentType:'application/vnd.github.raw',body:txt});
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:'',encoding:'none',size:txt.length,sha:String(path==='tareas.json'?gh.sha:gh.files[path].sha)})});
    }
    if(path==='tareas.json'&&gh.missing){
      if(req.method()!=='PUT')return route.fulfill({status:404,body:'{}'});
      const body=JSON.parse(req.postData());if(body.sha)return route.fulfill({status:422,body:'{}'});
      gh.items=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));gh.missing=false;gh.sha++;gh.puts=(gh.puts||0)+1;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.sha)}})});
    }
    if(path&&path!=='tareas.json'){ // otros archivos (archivo/AAAA.json)
      const f=gh.files[path];
      if(req.method()==='PUT'){const b=JSON.parse(req.postData());if(f&&String(b.sha)!==String(f.sha)||!f&&b.sha)return route.fulfill({status:409,body:'{}'});
        gh.files[path]={content:Buffer.from(b.content,'base64').toString('utf8'),sha:(f?f.sha+1:1)};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.files[path].sha)}})})}
      if(!f)return route.fulfill({status:404,body:'{}'});
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from(f.content).toString('base64'),sha:String(f.sha)})});
    }
    if(!path)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(gh.repo||{})});
    if(req.method()==='PUT'){if(gh.putDelay)await sleep(gh.putDelay);const body=JSON.parse(req.postData());if(String(body.sha)!==String(gh.sha))return route.fulfill({status:409,body:'{}'});
      gh.items=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));gh.sha++;gh.puts=(gh.puts||0)+1;delete gh.raw;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.sha)}})})}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from(gh.raw!=null?gh.raw:JSON.stringify(gh.items)).toString('base64'),sha:String(gh.sha)})});
  });
}
async function device(b,gh,opts={},url,init){
  const {colorScheme,...rest}=opts;
  const ctx=await b.newContext({timezoneId:TZ,colorScheme:colorScheme||'light',...rest});await mock(ctx,gh);
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  await p.addInitScript(()=>{if(!sessionStorage.getItem('i')){sessionStorage.setItem('i','1');localStorage.setItem('githubTasksConfig',JSON.stringify({owner:'u',repo:'r',token:'x'}))}
    window.__opened=[];window.open=u=>{window.__opened.push(u);return null}});
  if(init)await p.addInitScript(init);
  await p.goto(url||await H.appUrl());await sleep(500);return {ctx,p};
}
// Tarea con los campos de siempre; createdAt = el instante de referencia
const T=(id,title,o={})=>({id,title,priority:'Media',order:0,done:false,due:null,notes:'',requester:'',createdAt:H.date().toISOString(),completedAt:null,...o});

module.exports={...H,launch:H.launch,sleep,ok,mock,device,makeGH,day,T,TZ,get fails(){return H.fails}};
