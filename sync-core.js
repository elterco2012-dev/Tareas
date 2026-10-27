// Compartido por la página (index.html) y el service worker (sw.js): cómo se aplican los cambios
// sobre tareas.json, cómo se arma el mensaje de cada subida y dónde quedan los cambios para subir
// en segundo plano. Todo lo que está acá tiene que funcionar en los dos lados.
'use strict';
// La versión de la app: tiene que ser la misma que la de index.html y sw.js (si no, la página recarga una vez)
const CORE_VERSION='2026.10.27-2';

// ---- Cambios: cada acción es una operación que se puede reaplicar sobre la última versión ----
// Cambios cruzados: cada edición de estos campos lleva lo que había antes (prev), cuándo se hizo (at) y anota en la
// tarea cuándo se cambió cada campo (edited: {campo: fecha}). Si al subirla GitHub ya tiene en un campo otro valor,
// puesto después en otro dispositivo, en ese campo gana el otro (el más nuevo) y queda anotado en lost para avisar.
// Si así no se aplica ningún campo de la edición, tampoco se aplica lo que dependía de ellos (orden, pateada…).
const CONFLICT_KEYS=['title','notes','due','time','priority','requester','repeat','waiting','waitingOn','followUp','kind'];
const sameVal=(a,b)=>a===b||a==null&&b==null||JSON.stringify(a)===JSON.stringify(b);
// cmp: orden de las pendientes, solo para 'move' (de una versión vieja); sin cmp, 'move' no hace nada
function applyOp(a,op,cmp){
  const item=op.id?a.find(x=>x&&x.id===op.id):null;
  switch(op.type){
    case 'add':
      // La próxima de una tarea que se repite se agrega una sola vez, aunque dos dispositivos la terminen
      // (si la que había quedó en la papelera, no cuenta; y la que vuelve directo a la papelera tampoco)
      if(op.task.repeatOf&&!op.task.deletedAt&&a.some(x=>x&&x.repeatOf===op.task.repeatOf&&x.id!==op.task.id&&!x.deletedAt))break;
      if(!a.some(x=>x&&x.id===op.task.id)){
        const order=op.task.order??(Math.max(-1,...a.filter(t=>t&&!t.done).map(t=>Number(t.order)||0))+1);
        a.push({...op.task,order});
      }
      break;
    case 'done':
      if(item&&!!item.done!==op.done){item.done=op.done;item.completedAt=op.done?op.at:null;if(!op.done&&op.whenAt)item.whenAt=op.whenAt}
      break;
    case 'edit': {
      if(!item)break;
      const ed=item.edited&&typeof item.edited==='object'?item.edited:{},patch={},keys=[],prev=op.prev||{};
      for(const k in op.patch){
        if(k==='edited')continue;
        // Lo cambió el otro dispositivo, después, y a otro valor que el de este cambio
        if(op.at&&k in prev&&ed[k]>op.at&&!sameVal(item[k],prev[k])&&!sameVal(item[k],op.patch[k])){keys.push(k);continue}
        patch[k]=op.patch[k];
      }
      const own=Object.keys(prev).filter(k=>k in op.patch);
      if(keys.length&&keys.length===own.length)return {skipped:keys,applied:[]};
      Object.assign(item,patch);
      if(op.patch.edited){
        const m={...ed};
        for(const k in op.patch.edited)if(k in patch&&!(m[k]>op.patch.edited[k]))m[k]=op.patch.edited[k];
        item.edited=m;
      }
      return {skipped:keys,applied:Object.keys(patch)};
    }
    case 'delete': {
      const i=a.findIndex(x=>x&&x.id===op.id);
      // onlyDone (archivo): si mientras tanto alguien la volvió a pendientes, no se borra
      if(i>=0&&!(op.onlyDone&&!a[i].done))a.splice(i,1);
      break;
    }
    case 'move': {
      // De la versión anterior (↑↓): se mantiene para subir cambios que hayan quedado pendientes
      if(!item||!cmp)break;
      const d=item.due||null;
      const list=a.filter(x=>x&&!x.done&&(x.due||null)===d).sort(cmp);
      const pos=x=>{const k=op.ids.indexOf(x.id);return k<0?op.ids.length+list.indexOf(x):k};
      list.sort((x,y)=>pos(x)-pos(y)).forEach((x,k)=>x.order=k);
      break;
    }
  }
}
// lost (opcional): ahí se anotan los campos de cambios de este dispositivo que no se aplicaron (ver arriba), salvo que
// un cambio posterior de la misma subida haya puesto ese campo igual
function applyAll(base,ops,cmp,lost){
  const a=structuredClone(base),miss=new Map();
  for(const op of ops){
    let r;try{r=applyOp(a,op,cmp)}catch{}
    if(!r||!lost)continue;
    const m=miss.get(op.id)||new Set();
    r.applied.forEach(k=>m.delete(k));r.skipped.forEach(k=>m.add(k));
    miss.set(op.id,m);
  }
  if(lost)for(const [id,m] of miss)if(m.size)lost.push({id,keys:[...m]});
  return a;
}

// Mensaje de la subida, para que el historial de GitHub se entienda: "+ Llamar al banco · cel",
// "✓ Mandar remitos · pc", "3 cambios · cel"
function commitMessage(ops,base,next,src){
  const by=(arr,id)=>arr.find(x=>x&&x.id===id);
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
