'use strict';
// Versión de la app y huella de sus archivos. El service worker guarda la app en una caché por versión: si cambia
// algún archivo de la app y la versión no, los dispositivos se quedarían con la copia vieja. Por eso
// tests/suites/version.js compara la huella guardada en sw.js con la de los archivos, y
//   npm run nueva-version
// sube la versión (en sw.js, index.html y sync-core.js) y guarda la huella nueva.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..','..');
const VER='\\d{4}\\.\\d{1,2}\\.\\d{1,2}-\\d+';
const read=f=>fs.readFileSync(path.join(ROOT,f));
const text=f=>read(f).toString('utf8').replace(/\r\n/g,'\n');
// Lo que guarda el service worker: se lee de SHELL en sw.js ('./' es index.html; sin el ?v=), así no hay dos listas
function shellFiles(){
  const m=text('sw.js').match(/const SHELL=\[([^\]]*)\]/);
  if(!m)throw new Error('No encontré SHELL en sw.js');
  return [...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1].replace(/^\.\//,'')).map(f=>f===''?'index.html':f.replace(/\?.*$/,''));
}
const FILES=shellFiles();
// CSP de index.html: los <script> que van dentro de la página se permiten por su hash (sha256). Cambian con cada
// cambio del código (y de la versión, que está adentro), así que se recalculan junto con ella
const CSP_RE=/(<meta http-equiv="Content-Security-Policy" content="[^"]*?script-src 'self')((?: 'sha256-[A-Za-z0-9+\/=]+')*)/;
const HASH_RE=/'sha256-[A-Za-z0-9+\/=]+'/g;
function cspNeeded(html){
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>"'sha256-"+crypto.createHash('sha256').update(m[1],'utf8').digest('base64')+"'");
}
function cspCurrent(html){const m=html.match(CSP_RE);return m?(m[2].match(HASH_RE)||[]):null}
function setCsp(){
  const p=path.join(ROOT,'index.html'),s=fs.readFileSync(p,'utf8');
  if(!CSP_RE.test(s))throw new Error('No encontré la CSP en index.html');
  fs.writeFileSync(p,s.replace(CSP_RE,(m,a)=>a+' '+cspNeeded(s.replace(/\r\n/g,'\n')).join(' ')));
}
function fingerprint(){
  const h=crypto.createHash('sha256');
  for(const f of FILES){
    // En los de texto, sin la versión misma (si no, cambiar la versión cambiaría la huella) ni los fines de línea
    // (ni los hashes de la CSP, que dependen de la versión y salen del mismo código)
    const b=/\.(html|js|svg)$/.test(f)?Buffer.from(text(f).replace(new RegExp(VER,'g'),'VERSION').replace(HASH_RE,"'sha256-'")):read(f);
    h.update(f+'\0');h.update(b);h.update('\0');
  }
  return h.digest('hex').slice(0,16);
}
function versions(){
  const m=(f,re)=>(text(f).match(re)||[])[1]||null;
  return {
    sw:m('sw.js',/const VERSION='([^']+)'/),huella:m('sw.js',/huella: ([0-9a-f]{16})/),
    page:m('index.html',/const APP_VERSION='([^']+)'/),script:m('index.html',/src="sync-core\.js\?v=([^"]+)"/),
    core:m('sync-core.js',/const CORE_VERSION='([^']+)'/),
    csp:cspCurrent(text('index.html')),cspNeeded:cspNeeded(text('index.html')),
  };
}
// La versión de hoy, en la hora de Buenos Aires: AAAA.M.D-n (n = 1, 2, … si hay más de una en el día).
// Siempre más nueva que la actual (aunque se corra desde una máquina con otra hora).
function nextVersion(cur,now=new Date()){
  const [y,m,d]=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
  const today=y+'.'+m+'.'+d;
  const [cd,cn]=String(cur||'').split('-');
  const key=v=>v.split('.').map(Number).reduce((a,x)=>a*1000+x,0);
  if(cd&&/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(cd)&&key(cd)>=key(today))return cd+'-'+((+cn||0)+1);
  return today+'-1';
}
function setVersion(v){
  const put=(f,re,to)=>{const p=path.join(ROOT,f),s=fs.readFileSync(p,'utf8');if(!re.test(s))throw new Error('No encontré la versión en '+f);fs.writeFileSync(p,s.replace(re,to))};
  put('sw.js',/const VERSION='[^']+'/,"const VERSION='"+v+"'");
  put('index.html',/const APP_VERSION='[^']+'/,"const APP_VERSION='"+v+"'");
  put('index.html',/src="sync-core\.js\?v=[^"]+"/,'src="sync-core.js?v='+v+'"');
  put('sync-core.js',/const CORE_VERSION='[^']+'/,"const CORE_VERSION='"+v+"'");
  setCsp();
  put('sw.js',/huella: [0-9a-f]{16}/,'huella: '+fingerprint());
}
module.exports={FILES,fingerprint,versions,nextVersion,setVersion,cspNeeded};
if(require.main===module){
  const v=versions();
  if(process.argv.includes('--bump')){const n=nextVersion(v.sw);setVersion(n);console.log('Versión '+n+' · huella '+fingerprint())}
  else console.log(JSON.stringify({...v,huellaActual:fingerprint()},null,1));
}
