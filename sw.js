// Permite abrir la app sin conexión y al instante: responde con la copia guardada y, en paralelo,
// trae la versión nueva de la red para la próxima vez. No toca las llamadas a GitHub.
const CACHE='tareas-v8';
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
  e.respondWith(caches.match(key,{ignoreSearch:true}).then(cached=>cached||net));
});
