'use strict';
// Base común de las pruebas: navegador, servidor de la app, reloj fijo y ok().
//
// Reloj: todas las pruebas usan el mismo instante de referencia, REF = miércoles 14/10/2026 10:00 en
// Buenos Aires (13:00Z). Cada contexto que se crea con el navegador de launch() trae instalado el reloj de
// Playwright en REF (context.clock.install): el tiempo corre normal desde ahí y se puede saltar con
// page.clock.fastForward(). Del lado de Node, now()/day()/ago() calculan desde REF, nunca desde la hora real.
const fs=require('fs');
const path=require('path');
const {chromium,devices}=require('playwright');
const server=require('./server');

const ROOT=path.resolve(__dirname,'..','..');
const TZ='America/Argentina/Buenos_Aires';
const REF_ISO='2026-10-14T13:00:00.000Z';
const REF=Date.parse(REF_ISO);
const DAY=864e5;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// "Ahora" del lado de Node (para armar datos de prueba)
const now=()=>REF;
const date=(offsetMs=0)=>new Date(REF+offsetMs);
// Fecha ISO de hace n días (n puede tener decimales)
const ago=n=>new Date(REF-n*DAY).toISOString();
// AAAA-MM-DD de hoy + n días, en la hora de Buenos Aires (sin horario de verano: sumar días es seguro)
const ymdFmt=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'});
const day=n=>ymdFmt.format(new Date(REF+n*DAY));

// ok() estilo de siempre: imprime OK/FAIL y marca la salida con error si falló
let fails=0;
function ok(c,m){console.log((c?'OK  ':'FAIL')+' '+m);if(!c){fails++;process.exitCode=1}}

// Espera a que fn() devuelva algo verdadero (en vez de dormir de más). Devuelve el último valor.
async function until(fn,{timeout=5000,interval=50}={}){
  const end=Date.now()+timeout;let v;
  for(;;){v=await fn();if(v||Date.now()>=end)return v;await sleep(interval)}
}

// Servidor de la app (uno por proceso, en un puerto libre): http://127.0.0.1:<puerto>/Tareas/
let served=null;
const serve=()=>served||(served=server.start(ROOT));
const appUrl=async()=>(await serve()).url;
const appOrigin=async()=>(await serve()).origin;

// Opciones por defecto de cada contexto: zona horaria de Buenos Aires, sin service worker (como abrir
// index.html con file://, así los pedidos a api.github.com siempre pasan por los mocks) y reloj en REF.
// Opciones propias: clock (false = sin reloj falso; o un instante distinto de REF).
// Las pruebas del service worker pasan serviceWorkers:'allow'.
async function setupContext(ctx,clock){
  if(clock!==false)await ctx.clock.install({time:clock===undefined?REF:clock});
  return ctx;
}
function withDefaults(b){
  const orig=b.newContext.bind(b);
  b.newContext=async(o={})=>{
    const {clock,...rest}=o;
    return setupContext(await orig({timezoneId:TZ,serviceWorkers:'block',...rest}),clock);
  };
  return b;
}

// Chromium de Playwright; si no está instalado, CHROMIUM_PATH o el de /opt/pw-browsers
const FALLBACK=()=>process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium';
async function launchRaw(fn,opts){
  try{return await fn(opts)}
  catch(e){
    const alt=FALLBACK();
    if(opts.executablePath||!/Executable doesn't exist/i.test(String(e&&e.message))||!fs.existsSync(alt))throw e;
    return await fn({...opts,executablePath:alt});
  }
}
async function launch(opts={}){return withDefaults(await launchRaw(o=>chromium.launch(o),opts))}
// Perfil persistente (no incógnito), con las mismas opciones por defecto
async function launchPersistent(userDataDir,opts={}){
  const {clock,...rest}=opts;
  return setupContext(await launchRaw(o=>chromium.launchPersistentContext(userDataDir,o),{timezoneId:TZ,serviceWorkers:'block',...rest}),clock);
}

// Capturas y otros archivos de salida: tests/artifacts/<prueba>/ (ignorado por git)
function out(name){
  const suite=path.basename((require.main&&require.main.filename)||'prueba').replace(/\.[cm]?js$/,'');
  const dir=path.join(process.env.TAREAS_ARTIFACTS||path.join(ROOT,'tests','artifacts'),suite);
  fs.mkdirSync(dir,{recursive:true});
  return path.join(dir,name);
}
const repoFile=rel=>path.join(ROOT,rel);
const readRepo=rel=>fs.readFileSync(repoFile(rel),'utf8');

module.exports={chromium,devices,launch,launchPersistent,appUrl,appOrigin,serve,ok,sleep,until,
  now,date,ago,day,TZ,REF,REF_ISO,DAY,ROOT,out,repoFile,readRepo,get fails(){return fails}};
