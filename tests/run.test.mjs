// Corre todas las suites (tests/suites/*.js y tests/workflows/*.mjs) con node:test.
// Cada suite es un script que imprime "OK  …" / "FAIL …": corre en su propio proceso y la prueba falla
// si termina con error, si imprime algún FAIL o si no imprime ningún OK. Se corren de a varias a la vez.
//   npm test                                                  todas
//   node --test --test-name-pattern=voz tests/run.test.mjs    solo las que tienen "voz" en el nombre
//   TEST_CONCURRENCY=1 npm test                               de a una
//   node tests/suites/voz.js                                  una sola, con toda su salida
import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const list=(dir,re)=>fs.readdirSync(path.join(here,dir)).filter(f=>re.test(f)).sort().map(f=>path.join(dir,f));
const SUITES=[...list('suites',/\.js$/),...list('workflows',/^(?!fakedate).*\.mjs$/)];
const CONCURRENCY=Number(process.env.TEST_CONCURRENCY)||Math.max(1,Math.min(4,(os.availableParallelism?.()||2)-1));
const TIMEOUT=Number(process.env.SUITE_TIMEOUT_MS)||6*60*1000;

function runSuite(rel){
  return new Promise(resolve=>{
    const child=spawn(process.execPath,[path.join(here,rel)],{cwd:path.join(here,'..'),env:{...process.env},stdio:['ignore','pipe','pipe']});
    let out='';
    child.stdout.on('data',d=>{out+=d});child.stderr.on('data',d=>{out+=d});
    const timer=setTimeout(()=>{out+='\n[se cortó: más de '+TIMEOUT/1000+' s]\n';child.kill('SIGKILL')},TIMEOUT);
    child.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,out})});
  });
}

describe('suites',{concurrency:CONCURRENCY},()=>{
  for(const rel of SUITES){
    it(rel,{timeout:TIMEOUT+30000},async t=>{
      const t0=Date.now();
      const {code,signal,out}=await runSuite(rel);
      const lines=out.split('\n');
      const passed=lines.filter(l=>l.startsWith('OK')).length;
      const failed=lines.filter(l=>l.startsWith('FAIL'));
      t.diagnostic(passed+' OK, '+failed.length+' FAIL, '+((Date.now()-t0)/1000).toFixed(1)+' s');
      const problem=code!==0?'salió con '+(signal||'código '+code):failed.length?failed.length+' FAIL':passed===0?'ningún OK':null;
      if(problem){
        const tail=lines.filter(l=>!l.startsWith('OK')).slice(-40).join('\n');
        assert.fail(rel+': '+problem+'\n'+(failed.length?failed.join('\n')+'\n--- resto de la salida ---\n':'')+tail);
      }
    });
  }
});
