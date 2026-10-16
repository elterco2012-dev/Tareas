'use strict';
// Versión de la app y huella de sus archivos. El service worker guarda la app en una caché por versión: si cambia
// algún archivo de la app y la versión no, los dispositivos se quedarían con la copia vieja. Por eso
// tests/suites/version.js compara la huella guardada en sw.js con la de los archivos, y
//   npm run nueva-version
// sube la versión (en sw.js, index.html y sync-core.js) y guarda la huella nueva.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..','..');
// Lo que guarda el service worker (el manifest no: Chrome lo revisa por su cuenta)
const FILES=['index.html','sync-core.js','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png'];
const VER='\\d{4}\\.\\d{1,2}\\.\\d{1,2}-\\d+';
const read=f=>fs.readFileSync(path.join(ROOT,f));
const text=f=>read(f).toString('utf8').replace(/\r\n/g,'\n');
function fingerprint(){
  const h=crypto.createHash('sha256');
  for(const f of FILES){
    // En los de texto, sin la versión misma (si no, cambiar la versión cambiaría la huella) ni los fines de línea
    const b=/\.(html|js|svg)$/.test(f)?Buffer.from(text(f).replace(new RegExp(VER,'g'),'VERSION')):read(f);
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
  };
}
// La versión de hoy: AAAA.M.D-n (n = 1, 2, … si hay más de una en el día)
function nextVersion(cur,now=new Date()){
  const today=now.getFullYear()+'.'+(now.getMonth()+1)+'.'+now.getDate();
  const [d,n]=String(cur||'').split('-');
  return today+'-'+(d===today?(+n||0)+1:1);
}
function setVersion(v){
  const put=(f,re,to)=>{const p=path.join(ROOT,f),s=fs.readFileSync(p,'utf8');if(!re.test(s))throw new Error('No encontré la versión en '+f);fs.writeFileSync(p,s.replace(re,to))};
  put('sw.js',/const VERSION='[^']+'/,"const VERSION='"+v+"'");
  put('index.html',/const APP_VERSION='[^']+'/,"const APP_VERSION='"+v+"'");
  put('index.html',/src="sync-core\.js\?v=[^"]+"/,'src="sync-core.js?v='+v+'"');
  put('sync-core.js',/const CORE_VERSION='[^']+'/,"const CORE_VERSION='"+v+"'");
  put('sw.js',/huella: [0-9a-f]{16}/,'huella: '+fingerprint());
}
module.exports={FILES,fingerprint,versions,nextVersion,setVersion};
if(require.main===module){
  const v=versions();
  if(process.argv.includes('--bump')){const n=nextVersion(v.sw);setVersion(n);console.log('Versión '+n+' · huella '+fingerprint())}
  else console.log(JSON.stringify({...v,huellaActual:fingerprint()},null,1));
}
