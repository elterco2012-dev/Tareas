// Service worker de Mis tareas. Guarda la app (la página, sync-core.js y los íconos) en una caché propia de
// cada versión y la sirve desde ahí: abre al instante y sin conexión, y la página y su núcleo son siempre de
// la misma versión. Para publicar cambios se sube VERSION (npm run nueva-version; una prueba lo exige): Chrome ve
// que sw.js cambió, arma la versión nueva en otra caché y la app avisa "Hay una versión nueva".
// No toca las llamadas a GitHub ni el manifest (Chrome lo revisa por su cuenta).
const VERSION='2026.10.21-5';
// Huella de los archivos de la app; la calcula y la revisa tests/lib/huella.js. huella: 00cce0f5466fb07e
importScripts('sync-core.js?v='+VERSION);
const CACHE='tareas-'+VERSION;
const SHELL=['./','./sync-core.js?v='+VERSION,'./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'];
const CORE_PATH=new URL('./sync-core.js',self.registration.scope).pathname;
const abs=u=>new URL(u,self.registration.scope).href;
const SHELL_URLS=new Set(SHELL.map(abs));
// La app se abre en la raíz o en index.html, con o sin parámetros (?nueva=1, ?voz=1, lo compartido)
const APP_PATHS=new Set(['./','./index.html'].map(u=>new URL(abs(u)).pathname));

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    // Todo directo de la red (sin la caché del navegador), así la versión nueva no se arma con un archivo viejo.
    // La página, con su versión en la dirección (GitHub Pages la ignora) y revisada: si llegara una vieja,
    // no se instala (ni se crea su caché) y Chrome lo vuelve a intentar más tarde.
    const page=await fetch(new Request('./?v='+VERSION,{cache:'reload'}));
    if(!page.ok||!(await page.clone().text()).includes("APP_VERSION='"+VERSION+"'"))throw new Error('La página no es de la versión '+VERSION);
    const c=await caches.open(CACHE);
    await c.addAll(SHELL.slice(1).map(u=>new Request(u,{cache:'reload'})));
    await c.put(abs('./'),page);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('tareas-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// De la caché de esta versión; si falta (otro sitio de github.io borró las cachés, por ejemplo), de la red, y se guarda
async function fromCache(key,req){
  const c=await caches.open(CACHE);
  const hit=await c.match(key);
  if(hit)return hit;
  const res=await fetch(req);
  if(res.ok&&!res.redirected)await c.put(key,res.clone());
  return res;
}
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin!==location.origin)return;
  if(req.mode==='navigate'){
    // Otra página del sitio (el manifest, un archivo) va directo a la red y no pisa la copia de la app
    if(!APP_PATHS.has(u.pathname))return;
    // Los parámetros (lo compartido desde WhatsApp, por ejemplo) no viajan a la red: se pide la app sola
    e.respondWith(fromCache(abs('./'),new Request(abs('./'),{cache:'no-cache'})));
    return;
  }
  // Los archivos de la app; sync-core.js de cualquier versión, así el que pida la página siempre queda guardado con ella
  if(SHELL_URLS.has(u.href)||u.pathname===CORE_PATH)e.respondWith(fromCache(u.href,req));
});
// La página pregunta qué versión está lista (para avisar que hay una nueva)
self.addEventListener('message',e=>{if(e.data&&e.data.type==='version'&&e.source)e.source.postMessage({type:'version',version:VERSION})});

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
    // tareas.json desapareció o quedó vacío y la página tenía tareas: no se sube nada (la página lo avisa y ofrece arreglarlo)
    if(!sha&&snap.had>0||sha&&!items.length&&snap.had>=3)return;
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
