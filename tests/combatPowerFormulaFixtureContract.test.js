const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

test('canonical CP derives capability from the full stat projection',async()=>{
 const {computeCombatPower}=await import('../web-runner/src/core/combatPower.mjs');
 const base={level:1,maxHP:100,stats:{ATK:10,MAG:4,DEF:5,RES:4,SPD:10}};
 assert.ok(computeCombatPower({...base,stats:{...base.stats,ATK:14}})>computeCombatPower(base));
 assert.ok(computeCombatPower({...base,stats:{...base.stats,DEF:12}})>computeCombatPower(base));
 assert.equal(computeCombatPower({...base,CombatPower:9999}),computeCombatPower(base));
});

test('function-bank mirrors delegate CP to the canonical owner',()=>{
 for(const rel of ['Scripts/functionBank.js','web-runner/modules/functionBank.js']){
  const src=fs.readFileSync(path.join(__dirname,'..',rel),'utf8');
  assert.match(src,/import \{ computeCombatPower as canonicalCombatPower \}/);
  assert.match(src,/return canonicalCombatPower\(\{ maxHP: hp, level, stats:/);
  assert.doesNotMatch(src,/\(a \+ d \+ \(h \/ 10\)\)/);
 }
});
