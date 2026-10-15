// Intérprete: casos de tests/data/parse-casos.js (día con hora corta, horas sin "a las", "acordame",
// "avisame", "al mediodía", "el 15", números que no son horas y las regresiones de siempre).
const H=require('../lib/harness');
const cases=require('../data/parse-casos.js');
(async()=>{
const b=await H.launch();
const ctx=await b.newContext();await ctx.route('https://api.github.com/**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(await H.appUrl());await p.waitForTimeout(300);
H.ok(await p.evaluate(()=>ymd(new Date()))==='2026-10-14','clock on the reference day');
const res=await p.evaluate(cs=>cs.map(c=>{const r=parse(c.text);return {title:r.title,due:r.due||null,time:r.time?timeLabel(r.time):null,remind:!!r.remind,
  priority:r.priority&&r.priority!=='Media'?r.priority:null,requester:r.requester||null}}),cases);
const KEYS=['title','due','time','remind','priority','requester'];
cases.forEach((c,i)=>{
  const r=res[i],e={title:c.title,due:c.due??null,time:c.time??null,remind:!!c.remind,priority:c.priority??null,requester:c.requester??null};
  const bad=KEYS.filter(k=>e[k]!==r[k]);
  H.ok(!bad.length,'['+c.group+'] '+c.text+(bad.length?'\n      got '+JSON.stringify(r)+'\n      exp '+JSON.stringify(e):''));
});
H.ok(errs.length===0,'no page errors '+errs);
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
