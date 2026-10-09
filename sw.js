// Permite abrir la app sin conexión. Siempre intenta traer la última versión de la red;
// si no hay señal (o tarda más de 3 s) usa la copia guardada. No toca las llamadas a GitHub.
const CACHE='tareas-v2';
const SHELL=['./','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'];

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
  e.respondWith(caches.match(key,{ignoreSearch:true}).then(cached=>{
    if(!cached)return net;
    const slow=new Promise(r=>setTimeout(()=>r(cached),3000));
    // Si el servidor responde con error, también se usa la copia guardada
    return Promise.race([net.then(r=>r.ok?r:cached,()=>cached),slow]);
  }));
});
