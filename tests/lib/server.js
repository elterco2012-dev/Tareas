'use strict';
// Servidor estático mínimo: sirve la raíz del repo bajo /Tareas/, como GitHub Pages
// (https://<usuario>.github.io/Tareas/). Sin dependencias.
const http=require('http');
const fs=require('fs');
const path=require('path');

const TYPES={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon',
  '.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8',
};

// Arranca en un puerto libre de 127.0.0.1. Devuelve {server, origin, url} (url = origin + '/Tareas/').
function start(root,prefix='/Tareas/'){
  root=path.resolve(root);
  const server=http.createServer((req,res)=>{
    let u;
    try{u=new URL(req.url,'http://x')}catch{res.writeHead(400);return res.end()}
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
    if(u.pathname+'/'===prefix){res.writeHead(301,{Location:prefix+u.search});return res.end()}
    if(!u.pathname.startsWith(prefix)){res.writeHead(404);return res.end('not found')}
    let rel;
    try{rel=decodeURIComponent(u.pathname.slice(prefix.length))}catch{res.writeHead(400);return res.end()}
    let file=path.resolve(root,rel);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
    fs.stat(file,(err,st)=>{
      if(!err&&st.isDirectory()){file=path.join(file,'index.html');st=fs.existsSync(file)?fs.statSync(file):null}
      else if(err)st=null;
      if(!st||!st.isFile()){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('not found')}
      res.writeHead(200,{'Content-Type':TYPES[path.extname(file).toLowerCase()]||'application/octet-stream','Content-Length':st.size,'Cache-Control':'no-cache'});
      if(req.method==='HEAD')return res.end();
      fs.createReadStream(file).pipe(res);
    });
  });
  // Que el servidor no mantenga vivo el proceso: termina cuando termina la prueba
  server.on('connection',s=>s.unref());
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      server.unref();
      const origin='http://127.0.0.1:'+server.address().port;
      resolve({server,origin,url:origin+prefix});
    });
  });
}

module.exports={start};

// node tests/lib/server.js → sirve el repo para mirarlo a mano
if(require.main===module){
  start(path.join(__dirname,'..','..')).then(({server,url})=>{server.ref();console.log('Sirviendo en '+url)});
}
