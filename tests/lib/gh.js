'use strict';
// GitHub falso y "dispositivos" con la app abierta, para las pruebas que sincronizan.
// makeGH() guarda tareas.json (items/sha) y otros archivos (files: archivo/AAAA.json, ajustes.json);
// mock() atiende api.github.com con ctx.route; device() abre la app ya conectada a ese GitHub.
const H=require('./harness');
const {sleep,ok,day,TZ}=H;

function makeGH(items){return {items:items||[],sha:1,mode:'ok',files:{}}}
async function mock(ctx,gh){
  await ctx.route('https://api.github.com/**',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(gh.mode==='offline')return route.abort('internetdisconnected');
    const m=u.pathname.match(/\/contents\/(.+)$/);const path=m?decodeURIComponent(m[1]):null;
    if(path&&path!=='tareas.json'){ // otros archivos (archivo/AAAA.json)
      const f=gh.files[path];
      if(req.method()==='PUT'){const b=JSON.parse(req.postData());if(f&&String(b.sha)!==String(f.sha)||!f&&b.sha)return route.fulfill({status:409,body:'{}'});
        gh.files[path]={content:Buffer.from(b.content,'base64').toString('utf8'),sha:(f?f.sha+1:1)};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.files[path].sha)}})})}
      if(!f)return route.fulfill({status:404,body:'{}'});
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from(f.content).toString('base64'),sha:String(f.sha)})});
    }
    if(!path)return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    if(req.method()==='PUT'){if(gh.putDelay)await sleep(gh.putDelay);const body=JSON.parse(req.postData());if(String(body.sha)!==String(gh.sha))return route.fulfill({status:409,body:'{}'});
      gh.items=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));gh.sha++;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:String(gh.sha)}})})}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:Buffer.from(JSON.stringify(gh.items)).toString('base64'),sha:String(gh.sha)})});
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
