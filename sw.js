// Permite abrir la app sin conexión y al instante: responde con la copia guardada y, en paralelo,
// trae la versión nueva de la red para la próxima vez. No toca las llamadas a GitHub.
importScripts('sync-core.js');
const CACHE='tareas-v8';
const SHELL=['./','./sync-core.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('tareas-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  const key=req.mode==='navigate'?'./':req;
  const net=fetch(req).then(res=>{
    if(res.ok&&!res.redirected){const copy=res.clone();caches.open(CACHE).then(c=>c.put(key,copy))}
    return res;
  });
  e.waitUntil(net.catch(()=>{}));
  e.respondWith(caches.match(key,{ignoreSearch:true}).then(cached=>cached||net));
});

// ---- Subir en segundo plano ----
// La página deja en IndexedDB la conexión y los cambios sin subir y registra 'subir'. Chrome despierta
// este código cuando vuelve la conexión, aunque la app esté cerrada. Si falla por falta de red, Chrome
// lo reintenta más tarde; si GitHub rechaza el token, no insiste (la app lo va a avisar al abrirla).
self.addEventListener('sync',e=>{if(e.tag==='subir')e.waitUntil(withSyncLock(subirPendientes))});
async function subirPendientes(){
  const snap=await idbGet('pendiente');
  if(!snap||!snap.cfg||!Array.isArray(snap.ops))return;
  const sent=new Set(await idbGet('enviadas')||[]);
  const ops=snap.ops.filter(o=>!sent.has(o.opId));
  if(!ops.length||ops.some(o=>o.type==='move'))return;   // 'move' (versión vieja) lo sube la página
  const c=snap.cfg,url='https://api.github.com/repos/'+encodeURIComponent(c.owner)+'/'+encodeURIComponent(c.repo)+'/contents/tareas.json';
  const h={'Accept':'application/vnd.github+json','Authorization':'Bearer '+c.token,'X-GitHub-Api-Version':'2022-11-28'};
  for(let i=0;i<5;i++){
    const r=await fetch(url,{headers:h,cache:'no-store'});
    let items=[],sha=null;
    if(r.ok){const j=await r.json();items=JSON.parse(b64utf8(j.content));sha=j.sha;if(!Array.isArray(items))return}
    else if(r.status!==404){if(r.status>=500)throw new Error('GitHub '+r.status);return}
    const next=applyAll(items,ops);
    const w=await fetch(url,{method:'PUT',headers:{...h,'Content-Type':'application/json'},
      body:JSON.stringify({message:commitMessage(ops,items,next,(snap.src||'')+' (segundo plano)'),content:utf8b64(JSON.stringify(next,null,2)),...(sha?{sha}:{})})});
    if(w.status===409||w.status===422)continue;
    if(!w.ok){if(w.status>=500)throw new Error('GitHub '+w.status);return}
    await idbSet('enviadas',[...sent,...ops.map(o=>o.opId)]);
    await idbDel('pendiente');
    const cl=await self.clients.matchAll({includeUncontrolled:true});
    cl.forEach(x=>x.postMessage({type:'subido'}));
    return;
  }
  throw new Error('Conflictos al subir');
}
