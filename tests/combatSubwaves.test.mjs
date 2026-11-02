import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { authorSubwaves, bindAuthoredSubwaves, subwaveReady } from '../web-runner/src/core/continuousCombatSubwaves.mjs';
import { buildChapterOneSubwaveStages, buildContinuousCombatSpawnPlan, createContinuousCombatStageState } from '../web-runner/src/core/continuousCombatStage.mjs';
import { drawSliceActorBars } from '../web-runner/systems/rustCombatWorldHud.mjs';
const columns=JSON.parse(fs.readFileSync(new URL('../web-runner/assets/enemies.json',import.meta.url))).data;
const rows=columns[0].slice(1).map((_,i)=>Object.fromEntries(columns.map(c=>[c[0][0],c[i+1][0]]))).filter(r=>r.name);
const totals=keys=>Object.fromEntries([...new Set(keys)].sort().map(k=>[k,keys.filter(v=>v===k).length]));
test('every Chapter 1 wave authors 3–5 enemies per subwave and preserves seeded totals and compositions',()=>{
 for(const seed of [1,7,1337])for(const partyCP of [0,100000]){
  const stages=buildChapterOneSubwaveStages(rows,{seed,partyCP});assert.equal(stages.length,1);assert.equal(stages[0].waves.length,10);
  for(const [wave,authored]of stages[0].waves.entries()){
   const keys=authored.subwaves.flatMap(s=>s.flatMap(e=>Array(e.count).fill(e.key)));
   const plan=buildContinuousCombatSpawnPlan(rows,{...createContinuousCombatStageState(seed),wave:wave+1,transitions:wave},{partyCP});
   assert.deepEqual(totals(keys),totals(plan.map(e=>e.row.name)));
   for(const subwave of authored.subwaves){const n=subwave.reduce((n,e)=>n+e.count,0);assert.ok(n>=3&&n<=5);}
  }
 }
});
test('subwave release follows the previous cohort at one survivor or exactly ten combat seconds',()=>{
 const actors=Array.from({length:18},(_,i)=>({uid:i+1,name:i%2?'Skeleton':'Gobloc'}));
 const groups=bindAuthoredSubwaves(authorSubwaves(actors.map(a=>a.name)),actors);
 assert.equal(groups.flat().length,actors.length);assert.equal(new Set(groups.flat()).size,actors.length);
 const previous=groups[0],living=new Set(previous.map(a=>String(a.uid)));
 assert.equal(subwaveReady(previous,living,9.999),false);assert.equal(subwaveReady(previous,living,10),true);
 assert.equal(subwaveReady(previous,new Set(previous.slice(0,2).map(a=>String(a.uid))),0),false);
 assert.equal(subwaveReady(previous,new Set([String(previous[0].uid)]),0),true);
 assert.throws(()=>bindAuthoredSubwaves([[{key:'Missing',count:1}]],actors),/missing/);
});
test('hero world bars draw snapshot Groove immediately below slice HP geometry',()=>{
 const rects=[],fills=[];let fillStyle,current;
 const ctx=new Proxy({}, {get:(_target,key)=>key==='roundRect'?(...r)=>{current=r.slice(0,4);}:key==='fillRect'?(...r)=>rects.push({r,fillStyle}):key==='fill'?()=>fills.push({r:current,fillStyle}):()=>{},set:(_target,key,value)=>{if(key==='fillStyle')fillStyle=value;return true;}});
 drawSliceActorBars(ctx,{actors:[{kind:'fara',team:'hero',hp:50,max_hp:100,groove:'super',meter:1.5,pos:{x:100,y:200}}]},{zoom:.5,x:x=>x,y:y=>y},1,0,0);
 assert.deepEqual(rects.map(r=>r.r),[[91.5,208,17,1.5],[91.5,210.5,17,1],[91.5,210.5,8.5,1]]);
 assert.deepEqual(fills,[{r:[91.5,208,8.5,1.5],fillStyle:'#35B9E7'}]);
});
