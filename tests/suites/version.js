// Versión: la misma en sw.js, index.html y sync-core.js, y subida cada vez que cambian los archivos de la app
// (si no, los dispositivos se quedan con la copia vieja de la caché). Para subirla: npm run nueva-version
const V=require('../lib/huella');
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c){fails++;process.exitCode=1}};
const v=V.versions();
ok(v.sw&&v.sw===v.page&&v.page===v.script&&v.script===v.core,'same version in sw.js, index.html (constant and script tag) and sync-core.js: '+JSON.stringify(v));
ok(/^\d{4}\.\d{1,2}\.\d{1,2}-\d+$/.test(v.sw||''),'version looks like AAAA.M.D-n: '+v.sw);
const now=V.fingerprint();
ok(v.huella===now,'app files changed without a new version: run "npm run nueva-version" (saved '+v.huella+', now '+now+')');
ok(V.nextVersion('2026.10.16-1',new Date(2026,9,16))==='2026.10.16-2'&&V.nextVersion('2026.10.15-3',new Date(2026,9,16))==='2026.10.16-1','next version');
console.log('fails',fails);
