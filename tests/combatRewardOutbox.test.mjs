import {createCombatProgression} from '../web-runner/systems/combatProgression.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCombatAuthorityDriver} from '../web-runner/src/core/combatAuthorityDriver.mjs';
import {createCombatBridge} from '../web-runner/src/core/combatBridge.mjs';
import {createCombatRewardOutbox} from '../web-runner/systems/combatRewardOutbox.mjs';
import {attachHeroProgress,settleBattleEXP,createHeroProgressStore} from '../web-runner/src/core/heroProgression.mjs';
import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';
const wasm=new WebAssembly.Module(readFileSync(new URL('../web-runner/assets/simulation_core.wasm',import.meta.url)));
const key='orka.hero_progress.v2';
function combat({cleanup=false}={}){
 const bridge=createCombatBridge(new WebAssembly.Instance(wasm));
 const stats=(hp,atk)=>({hp,atk,def:5,speed:100,reach:80,interval:.5,evade:0,special:10});
 const config={encounter_id:'outbox-proof',seed:'7',geometry:{floor:{min:{x:96,y:40},max:{x:864,y:1592}},viewport_world:{x:720,y:1280},formation_origin:{x:480,y:800},screen_bound:false},heroes:[{instance_id:'fara-1',definition_id:'slice.hero.fara',slot:0,formation_offset:{x:0,y:0},stats:stats(1000,100),hp:1000}],enemies:[{spawn_key:'90',definition_id:'slice.enemy.orc',position:{x:480,y:700},stats:stats(40,0),hp:40}]};
 const created=bridge.create(config);let last=created;
 if(cleanup){bridge.end(created.world,config.encounter_id,'0','host_stage_transition');return{bridge,world:created.world,batch:bridge.inspect(created.world)};}
 for(let i=0;i<900&&!last.events.some(e=>e.body.kind==='died');i++)last=bridge.step(created.world,{encounter_id:config.encounter_id,expected_previous_step:last.snapshot.step});
 const batch=bridge.inspect(created.world);assert.ok(batch.events.some(e=>e.body.kind==='died'));
 return{bridge,world:created.world,batch};
}
function host(values=new Map(),failure='',withProgression=false){
 const g={HeroProgress:createHeroProgressStore(JSON.parse(values.get(key)||'null')),goldTotal:0,ProgressionBattle:{id:'battle',participants:[],defeated:{},defeatedGold:{}}};
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){if(typeof failure==='function'?failure(k):failure===k)throw Error('injected save failure');values.set(k,v);}};
 const source=readFileSync(new URL('../web-runner/systems/heroProgressStorage.js',import.meta.url),'utf8');
 const progress=new Function('window','attachHeroProgress','createHeroProgressStore','settleBattleEXP',source.replace(/^import .*\n/gm,'').replace(/export /g,'')+';return {persistHeroProgressIfDirty};')({localStorage:storage},attachHeroProgress,createHeroProgressStore,settleBattleEXP);
 const save=()=>progress.persistHeroProgressIfDirty({stateGlobals:g});
 const equipment=createEquipmentStorage({globals:g,storage,locks:{request:(_k,fn)=>Promise.resolve().then(fn)},now:()=>0,seed:()=>42,reportError:()=>{}});
 const progression=withProgression?createCombatProgression({globals:g,storage,equipmentProgress:equipment,getHeroes:()=>Object.values(g.HeroProgress.heroes).map(hero=>({...hero,kind:'hero'})),now:()=>1000,reportError:()=>{}}):undefined;
 const outbox=createCombatRewardOutbox({globals:g,persistProgress:save,equipmentProgress:equipment,progression});
 return{g,outbox,equipment,progression,values,save,setFailure:v=>failure=v};
}
const enemy=()=>({kind:'enemy',uid:90,enemyRole:'boss'});
for(const crash of ['before outbox save','after outbox save','after equipment commit','before ack'])test(`real WASM replay grants once: crash ${crash}`,async()=>{
 const f=combat(),h=host();await h.equipment.sync();
 if(crash==='before outbox save'){
  h.setFailure(key);assert.throws(()=>h.outbox.consumeBatch(f.batch.snapshot,f.batch.events,enemy),/save failure/);assert.equal(h.equipment.data.lamp.killPoints,0);h.setFailure('');
 }else{
  h.outbox.consumeBatch(f.batch.snapshot,f.batch.events,enemy);
  if(crash==='after equipment commit'){
   h.setFailure(k=>k===key&&JSON.parse(h.values.get(EQUIPMENT_SAVE_KEY)).lamp.killPoints===5);
   await assert.rejects(h.outbox.settlePendingReceipts(),/save failure/);h.setFailure('');
   assert.equal(JSON.parse(h.values.get(EQUIPMENT_SAVE_KEY)).lamp.killPoints,5);
   assert.equal(JSON.parse(h.values.get(key)).combatRewardOutbox.streams['outbox-proof'].pending.length,1);
  }
  if(crash==='before ack')await h.outbox.settlePendingReceipts();
 }
 const reloaded=host(h.values);
 reloaded.outbox.consumeBatch(f.batch.snapshot,f.batch.events,enemy);
 await reloaded.outbox.settlePendingReceipts();
 reloaded.outbox.consumeBatch(f.batch.snapshot,f.batch.events,enemy);await reloaded.outbox.settlePendingReceipts();
 assert.equal(reloaded.equipment.data.lamp.killPoints,5);assert.equal(reloaded.equipment.data.gold,0);assert.equal(reloaded.equipment.data.partyEXP,0);assert.equal(reloaded.equipment.data.lamp.essence,0);
 const ack=f.bridge.ack(f.world,f.batch.snapshot.encounter_id,f.batch.snapshot.last_event_sequence);
 assert.equal(ack.acknowledged_sequence,f.batch.snapshot.last_event_sequence);assert.deepEqual(f.bridge.inspect(f.world,ack.acknowledged_sequence).events,[]);
 f.bridge.destroy(f.world);
});
test('batch validation is atomic for gaps, unknown kinds, collisions and overflow',async()=>{
 const f=combat(),h=host();await h.equipment.sync();
 for(const alter of [events=>events.slice(1),events=>events.map((e,i)=>i?e:{...e,body:{kind:'unknown_gameplay',data:{}}})]){
  assert.throws(()=>h.outbox.consumeBatch(f.batch.snapshot,alter(f.batch.events),enemy));assert.equal(h.values.has(key),false);
 }
 h.outbox.consumeBatch(f.batch.snapshot,f.batch.events,enemy);const saved=h.values.get(key);
 const changed=structuredClone(f.batch.events);changed.at(-1).body.data.bad=true;
 assert.throws(()=>h.outbox.consumeBatch(f.batch.snapshot,changed,enemy),/collision/);assert.equal(h.values.get(key),saved);
 assert.throws(()=>h.outbox.consumeBatch({...f.batch.snapshot,state:'event_overflow'},[],enemy),/overflow/);
 assert.throws(()=>f.bridge.ack(f.world,f.batch.snapshot.encounter_id,String(BigInt(f.batch.snapshot.last_event_sequence)+1n)),/cursor/);
 f.bridge.destroy(f.world);
});
test('ordinary death and cleanup/despawn mint no currency; saved outbox corruption fails closed',async()=>{
 const f=combat(),h=host();await h.equipment.sync();h.outbox.consumeBatch(f.batch.snapshot,f.batch.events,()=>({...enemy(),enemyRole:'fodder'}));await h.outbox.settlePendingReceipts();
 assert.equal(h.equipment.data.lamp.killPoints,0);
 const cleanup=combat({cleanup:true}),clean=host();
 clean.outbox.consumeBatch(cleanup.batch.snapshot,cleanup.batch.events,()=>{throw Error('cleanup resolved a reward');});await clean.outbox.settlePendingReceipts();
 assert.equal(clean.equipment.data.lamp.killPoints,0);assert.equal(clean.equipment.data.lamp.essence,0);assert.equal(clean.equipment.data.gold,0);assert.equal(clean.equipment.data.partyEXP,0);cleanup.bridge.destroy(cleanup.world);
 const saved=JSON.parse(h.values.get(key));saved.combatRewardOutbox.streams['outbox-proof'].sequence='broken';assert.throws(()=>createHeroProgressStore(saved),/outbox/);
 f.bridge.destroy(f.world);
});

test('retired encounters reject stale deliveries after bounded cursor compaction',async()=>{
 const f=combat(),h=host();await h.equipment.sync();h.outbox.consumeBatch(f.batch.snapshot,f.batch.events,enemy);await h.outbox.settlePendingReceipts();
 for(let i=0;i<70;i++)h.outbox.beginEncounter(`fresh-${i}`);
 assert.equal(Object.keys(h.g.HeroProgress.combatRewardOutbox.streams).length,0);
 assert.throws(()=>h.outbox.consumeBatch(f.batch.snapshot,f.batch.events,enemy),/Unknown Rust encounter/);assert.equal(h.equipment.data.lamp.killPoints,5);f.bridge.destroy(f.world);
});

test('failed destination saves retain durable receipts for reload',async()=>{
 const f=combat(),h=host();await h.equipment.sync();h.outbox.consumeBatch(f.batch.snapshot,f.batch.events,enemy);h.setFailure(EQUIPMENT_SAVE_KEY);
 await assert.rejects(h.outbox.settlePendingReceipts(),/save failure/);
 assert.equal(JSON.parse(h.values.get(key)).combatRewardOutbox.streams['outbox-proof'].pending.length,1);
 const replay=host(h.values);await replay.outbox.settlePendingReceipts();assert.equal(replay.equipment.data.lamp.killPoints,5);f.bridge.destroy(f.world);
});
test('real WASM ack prunes only the consumed prefix and preserves absolute sequence and gameplay',()=>{
 const f=combat(),{bridge,world,batch}=f,cursor=batch.snapshot.last_event_sequence;
 bridge.ack(world,batch.snapshot.encounter_id,cursor);
 assert.equal(bridge.inspect(world,cursor).snapshot.gameplay_hash,batch.snapshot.gameplay_hash);
 assert.deepEqual(bridge.ack(world,batch.snapshot.encounter_id,cursor),{acknowledged_sequence:cursor});
 assert.throws(()=>bridge.inspect(world,'0'),/cursor/);
 assert.throws(()=>bridge.ack(world,'wrong-encounter',cursor),/cursor/);
 const ended=bridge.end(world,batch.snapshot.encounter_id,batch.snapshot.step,'host_stage_transition');
 assert.equal(ended.events[0].sequence,String(BigInt(cursor)+1n));
 assert.equal(ended.snapshot.acknowledged_event_sequence,cursor);assert.ok(bridge.inspect(world,cursor).events.length>0);
 bridge.destroy(world);
});

test('driver repairs a gapped delivery from retained real-WASM events before ack',async()=>{
 const f=combat(),h=host(),errors=[];
 const driver=createCombatAuthorityDriver({bridge:{...f.bridge,create:()=>({world:f.world,...f.batch})},consume:(snapshot,events)=>h.outbox.consumeBatch(snapshot,events,enemy),onError:error=>errors.push(error)});
 driver.start({encounter_id:f.batch.snapshot.encounter_id});
 const ended=f.bridge.end(f.world,f.batch.snapshot.encounter_id,f.batch.snapshot.step,'host_stage_transition');
 driver.accept({...ended,events:ended.events.slice(1)});
 assert.deepEqual(errors,[]);assert.equal(h.g.HeroProgress.combatRewardOutbox.streams['outbox-proof'].sequence,ended.snapshot.last_event_sequence);
 assert.deepEqual(f.bridge.inspect(f.world,ended.snapshot.last_event_sequence).events,[]);await h.outbox.settlePendingReceipts();assert.equal(h.equipment.data.lamp.killPoints,5);driver.stop();
});

test('reload settlement preserves independent COT Essence receipt identity',async()=>{
 const values=new Map([['orka.combat_progression.v1',JSON.stringify({seed:99,objective:{id:'fixed-gear',type:'gear_collect',target:1,progress:0,seed:99}})]]),h=host(values,'',true);
 const objective=h.progression.state().objective;
 for(let i=0;i<objective.target;i++)h.progression.record({id:`gear-${i}`,type:objective.type});
 assert.equal(h.progression.claimObjective(objective.id).ok,true);await h.outbox.settlePendingReceipts();assert.equal(h.equipment.data.lamp.essence,2);
 const replay=host(values,'',true);await replay.outbox.settlePendingReceipts();await replay.outbox.settlePendingReceipts();
 assert.equal(replay.equipment.data.lamp.essence,2);assert.equal(replay.equipment.data.lamp.killPoints,0);assert.equal(replay.equipment.data.gold,0);assert.equal(replay.equipment.data.partyEXP,0);
});
