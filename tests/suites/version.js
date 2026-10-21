// Versión: la misma en sw.js, index.html y sync-core.js, y subida cada vez que cambian los archivos de la app
// (si no, los dispositivos se quedan con la copia vieja de la caché). Para subirla: npm run nueva-version
const V=require('../lib/huella');
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c){fails++;process.exitCode=1}};
const v=V.versions();
ok(v.sw&&v.sw===v.page&&v.page===v.script&&v.script===v.core,'same version in sw.js, index.html (constant and script tag) and sync-core.js: '+JSON.stringify(v));
ok(/^\d{4}\.\d{1,2}\.\d{1,2}-\d+$/.test(v.sw||''),'version looks like AAAA.M.D-n: '+v.sw);
const now=V.fingerprint();
ok(v.huella===now,'app files changed without a new version: run "npm run nueva-version" (saved '+v.huella+', now '+now+')');
// La CSP de index.html permite los <script> de la página por su hash: si no coinciden, el navegador no corre la app
ok(Array.isArray(v.csp)&&v.cspNeeded.length===2&&JSON.stringify(v.csp)===JSON.stringify(v.cspNeeded),'CSP hashes match the inline scripts of index.html (run "npm run nueva-version"): '+JSON.stringify(v.csp)+' vs '+JSON.stringify(v.cspNeeded));
// (las fechas, a las 15:00 de Buenos Aires)
const ba=(y,m,d)=>new Date(Date.UTC(y,m-1,d,18));
ok(V.nextVersion('2026.10.16-1',ba(2026,10,16))==='2026.10.16-2'&&V.nextVersion('2026.10.15-3',ba(2026,10,16))==='2026.10.16-1','next version');
ok(V.nextVersion('2026.10.17-1',ba(2026,10,16))==='2026.10.17-2','never older than the current one (bumped from a machine already on the next day)');
ok(V.nextVersion('2026.10.16-1',new Date(Date.UTC(2026,9,17,1)))==='2026.10.16-2','uses the Buenos Aires date (01:00 UTC is still the 16th there)');
ok(V.FILES.includes('index.html')&&V.FILES.includes('sync-core.js')&&V.FILES.some(f=>f.startsWith('icons/')),'fingerprint covers what the service worker caches: '+V.FILES.join(', '));
console.log('fails',fails);
