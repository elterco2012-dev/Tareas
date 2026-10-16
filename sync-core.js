// Compartido por la página (index.html) y el service worker (sw.js): cómo se aplican los cambios
// sobre tareas.json, cómo se arma el mensaje de cada subida y dónde quedan los cambios para subir
// en segundo plano. Todo lo que está acá tiene que funcionar en los dos lados.
'use strict';
// La versión de la app: tiene que ser la misma que la de index.html y sw.js (si no, la página recarga una vez)
const CORE_VERSION='2026.10.16-4';

// ---- Cambios: cada acción es una operación que se puede reaplicar sobre la última versión ----
// cmp: orden de las pendientes, solo para 'move' (de una versión vieja); sin cmp, 'move' no hace nada
function applyOp(a,op,cmp){
  const item=op.id?a.find(x=>x.id===op.id):null;
  switch(op.type){
    case 'add':
      // La próxima de una tarea que se repite se agrega una sola vez, aunque dos dispositivos la terminen
      // (si la que había quedó en la papelera, no cuenta; y la que vuelve directo a la papelera tampoco)
      if(op.task.repeatOf&&!op.task.deletedAt&&a.some(x=>x.repeatOf===op.task.repeatOf&&x.id!==op.task.id&&!x.deletedAt))break;
      if(!a.some(x=>x.id===op.task.id)){
        const order=op.task.order??(Math.max(-1,...a.filter(t=>!t.done).map(t=>Number(t.order)||0))+1);
        a.push({...op.task,order});
      }
      break;
    case 'done':
      if(item&&!!item.done!==op.done){item.done=op.done;item.completedAt=op.done?op.at:null}
      break;
    case 'edit':
      if(item)Object.assign(item,op.patch);
      break;
    case 'delete': {
      const i=a.findIndex(x=>x.id===op.id);
      // onlyDone (archivo): si mientras tanto alguien la volvió a pendientes, no se borra
      if(i>=0&&!(op.onlyDone&&!a[i].done))a.splice(i,1);
      break;
    }
    case 'move': {
      // De la versión anterior (↑↓): se mantiene para subir cambios que hayan quedado pendientes
      if(!item||!cmp)break;
      const d=item.due||null;
      const list=a.filter(x=>!x.done&&(x.due||null)===d).sort(cmp);
      const pos=x=>{const k=op.ids.indexOf(x.id);return k<0?op.ids.length+list.indexOf(x):k};
      list.sort((x,y)=>pos(x)-pos(y)).forEach((x,k)=>x.order=k);
      break;
    }
  }
}
function applyAll(base,ops,cmp){
  const a=structuredClone(base);
  for(const op of ops){try{applyOp(a,op,cmp)}catch{}}
  return a;
}

// Mensaje de la subida, para que el historial de GitHub se entienda: "+ Llamar al banco · cel",
// "✓ Mandar remitos · pc", "3 cambios · cel"
function commitMessage(ops,base,next,src){
  const by=(arr,id)=>arr.find(x=>x.id===id);
  const name=id=>{const t=by(next,id)||by(base,id);return t?String(t.title).slice(0,60):'tarea'};
  let m;
  if(ops.length===1){
    const o=ops[0];
    if(o.type==='add')m='+ '+String(o.task.title).slice(0,60);
    else if(o.type==='done')m=(o.done?'✓ ':'↺ ')+name(o.id);
    else if(o.type==='delete')m='✕ '+name(o.id);
    else if(o.type==='edit'&&o.patch&&'deletedAt' in o.patch)m=(o.patch.deletedAt?'Papelera: ':'Recuperada: ')+name(o.id);
    else m='✎ '+name(o.id);
  }else m=ops.length+' cambios';
  return m+(src?' · '+src:'');
}

// ---- Lo que queda para subir en segundo plano (IndexedDB: el service worker no lee localStorage) ----
// 'pendiente': {cfg, ops} que el service worker sube cuando vuelve la conexión, aunque la app esté cerrada.
// 'enviadas': ids de los cambios que ya subió el service worker; la página los saca de su cola.
function idb(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('mis-tareas',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('kv');
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  });
}
async function idbDo(mode,fn){
  const db=await idb();
  try{
    return await new Promise((res,rej)=>{
      const tx=db.transaction('kv',mode),st=tx.objectStore('kv'),q=fn(st);
      tx.oncomplete=()=>res(q&&q.result);tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);
    });
  }finally{db.close()}
}
function idbGet(k){return idbDo('readonly',st=>st.get(k)).catch(()=>undefined)}
function idbSet(k,v){return idbDo('readwrite',st=>st.put(v,k))}
function idbDel(k){return idbDo('readwrite',st=>st.delete(k)).catch(()=>{})}
// La página y el service worker no suben a la vez
function withSyncLock(fn){return self.navigator&&navigator.locks?navigator.locks.request('tareas-sync',fn):fn()}

function utf8b64(s){const a=new TextEncoder().encode(s);let b='';for(const x of a)b+=String.fromCharCode(x);return btoa(b)}
function b64utf8(s){const b=atob(s.replace(/\s/g,''));return new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0)))}
