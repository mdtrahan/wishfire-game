import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';
import {createHeroProgressStore} from '../web-runner/src/core/heroProgression.mjs';
import {createLampEconomy,generateLampItem,lampStoredCount,lampCapacity,lampItemCPGain,salvageValue} from '../web-runner/src/core/lampGear.mjs';
import {CONVEYOR_TRAVEL_MS,conveyorItemAge,validateConveyorState,conveyorReviewCandidates,planConveyorAutoEquip} from '../web-runner/src/core/lampConveyor.mjs';

function fixture({full=false,equipped=true}={}){
 const heroes=createHeroProgressStore();for(const h of Object.values(heroes.heroes))h.currentLevel=5;
 const initial=createLampEconomy(42),stats=n=>({ATK:n,DEF:n,MAG:n,RES:n,HP:n});
 if(equipped)for(const h of Object.values(heroes.heroes))for(const type of ['hat','body','boots']){
  const i={...generateLampItem(42,0,0),instanceId:`owned:${h.heroInstanceKey}:${type}`,type,stats:stats(1000)};
  initial.items.push(i);(initial.loadouts[h.heroInstanceKey]||={})[type]=i.instanceId;
 }
 if(full)for(let n=0;n<20;n++){const i=generateLampItem(42,n,0);initial.items.push(i);initial.lamp.pending.push(i.instanceId);initial.lamp.sequence++;}
 const values=new Map([[EQUIPMENT_SAVE_KEY,JSON.stringify(initial)]]);let clock=100000,fail=false,chain=Promise.resolve();
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){if(fail)throw Error('disk full');values.set(k,v);}};
 const locks={request:(key,fn)=>{const result=chain.then(fn);chain=result.catch(()=>{});return result;}};
 function tab(checkpointValues=new Map()){const checkpointStorage={getItem:k=>checkpointValues.get(k)??null,setItem:(k,v)=>checkpointValues.set(k,v)};const globals={goldTotal:0,HeroProgress:structuredClone(heroes)};return{globals,checkpointValues,reload:()=>tab(checkpointValues),store:createEquipmentStorage({globals,storage,checkpointStorage,locks,now:()=>clock,reportError:()=>{}})};}
 const active=tab(),{store,globals}=active;
 return{store,globals,storage,values,tab,reload:active.reload,checkpointValues:active.checkpointValues,advance:n=>clock+=n,fail:v=>fail=v,stats};
}
function invariant(data){
 validateConveyorState(data);assert.ok(lampStoredCount(data)<=lampCapacity(data));
 const permanent=data.items.map(i=>i.instanceId),assigned=Object.values(data.loadouts).flatMap(Object.values);
 assert.equal(new Set(permanent).size,permanent.length);assert.equal(new Set(assigned).size,assigned.length);
 if(data.lamp.reviewHold)assert.ok(!permanent.includes(data.lamp.reviewHold.item.instanceId));
}

test('full automatic flow keeps issuing equipment without storage or EXP; a tapped emission is durably held exactly once',async()=>{
 const f=fixture({full:true});await f.store.sync();
 const item=await f.store.tickConveyor();assert.equal(item.rewardEXP,0);assert.equal(f.store.data.partyEXP,0);assert.equal(lampStoredCount(f.store.data),20);
 const results=await Promise.all([f.store.collect(item.instanceId),f.store.collect(item.instanceId)]);
 assert.equal(results.filter(r=>r.saved).length,1);assert.equal(results.reduce((n,r)=>n+r.exp,0),0);assert.equal(f.store.data.lamp.reviewHold.item.instanceId,item.instanceId);assert.equal(f.store.data.partyEXP,0);invariant(f.store.data);
 const reload=f.tab();await reload.store.sync();assert.equal(reload.store.data.lamp.reviewHold.item.instanceId,item.instanceId);
 assert.ok(Object.values(reload.globals.HeroProgress.heroes).every(h=>h.lampEXPClaimed===0));await reload.store.refresh();assert.equal(reload.store.data.partyEXP,0);
 f.advance(5000);const next=await f.store.tickConveyor();assert.equal(next.rewardEXP,0);await assert.rejects(f.store.collect(next.instanceId),/Resolve the held item/);
 assert.equal(f.store.data.lamp.reviewHold.item.instanceId,item.instanceId);invariant(f.store.data);
});
test('held positive-CP replacement destroys displaced gear without Essence or overflow',async()=>{
 const f=fixture({full:true,equipped:false});await f.store.sync();const emitted=await f.store.generate();await f.store.collect(emitted.instanceId);
 const ready=structuredClone(f.store.data),weak={...emitted,instanceId:'weak-current',stats:f.stats(1)};ready.items.push(weak);ready.loadouts.Falie={[emitted.type]:weak.instanceId};f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(ready));await f.store.refresh();
 const hero='Falie',old=f.store.data.loadouts[hero][emitted.type],bank=f.store.data.lamp.essence;
 const receipt=await f.store.equip(hero,emitted.instanceId);assert.ok(receipt.cpChange>0);
 assert.equal(f.store.data.loadouts[hero][emitted.type],emitted.instanceId);assert.equal(f.store.data.lamp.reviewHold,null);
 assert.ok(!f.store.data.items.some(i=>i.instanceId===old));assert.equal(f.store.data.lamp.essence,bank);invariant(f.store.data);
});

test('held gear fills an empty slot and capacity resumes automatically after AUTO equip',async()=>{
 const f=fixture({full:true,equipped:false});await f.store.sync();
 const emitted=await f.store.tickConveyor();await f.store.collect(emitted.instanceId);await f.store.equip('Falie',emitted.instanceId);
 assert.equal(f.store.data.lamp.reviewHold,null);assert.equal(lampStoredCount(f.store.data),20);invariant(f.store.data);
 await f.store.autoEquip();assert.ok(lampStoredCount(f.store.data)<20);f.advance(5000);
 assert.equal((await f.store.tickConveyor()).rewardEXP,0);invariant(f.store.data);
});
test('confirmed disposal preserves newer automatic arrivals and awards only selected Essence, once',async()=>{
 const f=fixture();await f.store.sync();const first=await f.store.tickConveyor();
 const preview=f.store.disposalPreview(),exp=f.store.data.partyEXP;f.advance(5000);const later=await f.store.tickConveyor();
 const result=await f.store.dismantle(preview);assert.equal(result.count,1);assert.equal(result.essence,salvageValue(first));
 assert.ok(f.store.data.items.some(i=>i.instanceId===later.instanceId));assert.ok(!f.store.data.items.some(i=>i.instanceId===first.instanceId));
 assert.equal(f.store.data.partyEXP,exp);const saved=f.values.get(EQUIPMENT_SAVE_KEY);await assert.rejects(f.store.dismantle(preview),/Disposal changed/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);invariant(f.store.data);
});
test('explicit disposal rejects a missed upgrade without spending or changing ownership',async()=>{
 const f=fixture({equipped:false});await f.store.sync();const i=await f.store.generate();
 const r=await f.store.equip('Falie',i.instanceId);assert.ok(r.cpChange>0);
 const data=structuredClone(f.store.data),upgrade={...i,instanceId:'missed',stats:f.stats(10000)};
 data.items.push(upgrade);data.lamp.pending.push(upgrade.instanceId);f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.refresh();
 const saved=f.values.get(EQUIPMENT_SAVE_KEY);assert.throws(()=>f.store.disposalPreview([upgrade.instanceId]),/still improves/);
 await assert.rejects(f.store.dismantle({ids:[upgrade.instanceId],signature:JSON.stringify([upgrade]),legacy:'salvage:0:0'}),/still improves/);
 assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);invariant(f.store.data);
});

test('a freed cache slot is reserved for the held item before a concurrent automatic collection',async()=>{
 const f=fixture({full:true});await f.store.sync();const i=await f.store.tickConveyor();await f.store.collect(i.instanceId);
 const selected=f.store.data.lamp.discarded[0],preview=f.store.disposalPreview([selected]);f.advance(5000);
 const [removed,auto]=await Promise.all([f.store.dismantle(preview),f.store.tickConveyor()]);assert.equal(removed.count,1);assert.equal(auto.rewardEXP,0);
 assert.equal(f.store.data.lamp.reviewHold,null);assert.ok(f.store.data.items.some(x=>x.instanceId===i.instanceId));assert.equal(lampStoredCount(f.store.data),20);assert.equal(f.store.data.partyEXP,0);invariant(f.store.data);
});
test('two tabs collect the same passing item under the shared lock with one durable item and no EXP',async()=>{
 const f=fixture({full:true}),other=f.tab();await Promise.all([f.store.sync(),other.store.sync()]);const i=await f.store.generate();
 const receipts=await Promise.all([f.store.collect(i.instanceId),other.store.collect(i.instanceId)]);assert.equal(receipts.filter(r=>r.saved).length,1);assert.equal(receipts.reduce((n,r)=>n+r.exp,0),0);
 await Promise.all([f.store.refresh(),other.store.refresh()]);assert.equal(f.store.data.partyEXP,0);assert.deepEqual(f.store.data,other.store.data);invariant(f.store.data);
 const saved=f.values.get(EQUIPMENT_SAVE_KEY);await f.store.collect(i.instanceId);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);
});
test('failed manual collection, equip and dismantling leave items and rewards unchanged',async()=>{
 const f=fixture({full:true});await f.store.sync();const i=await f.store.generate(),saved=f.values.get(EQUIPMENT_SAVE_KEY);
 f.fail(true);await assert.rejects(f.store.collect(i.instanceId),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);assert.equal(f.store.data.partyEXP,0);assert.ok(Object.values(f.globals.HeroProgress.heroes).every(h=>!h.lampEXPClaimed));
 f.fail(false);await f.store.collect(i.instanceId);const ready=structuredClone(f.store.data),old=ready.loadouts.Falie[i.type];delete ready.loadouts.Falie[i.type];ready.items=ready.items.filter(x=>x.instanceId!==old);f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(ready));await f.store.refresh();const protectedSave=f.values.get(EQUIPMENT_SAVE_KEY),heroes=structuredClone(f.globals.HeroProgress);
 f.fail(true);await assert.rejects(f.store.equip('Falie',i.instanceId),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),protectedSave);assert.deepEqual(f.globals.HeroProgress,heroes);
 await assert.rejects(f.store.dismantle(f.store.disposalPreview()),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),protectedSave);
 f.fail(false);invariant(f.store.data);
});
test('expired or confirmed-dismantled emissions cannot be collected again',async()=>{
 const f=fixture({full:true});await f.store.sync();const i=await f.store.generate();f.advance(CONVEYOR_TRAVEL_MS);await assert.rejects(f.store.collect(i.instanceId),/passed/);assert.equal(f.store.data.partyEXP,0);
 const next=await f.store.generate();await f.store.collect(next.instanceId);await f.store.dismantle(f.store.disposalPreview([next.instanceId]));await assert.rejects(f.store.collect(next.instanceId),/passed/);assert.equal(f.store.data.partyEXP,0);invariant(f.store.data);
});
test('stale preview rejects edited items and a newly useful CP classification',async()=>{
 const f=fixture();await f.store.sync();const i=await f.store.generate(),preview=f.store.disposalPreview();
 const changed=structuredClone(f.store.data);changed.items.find(x=>x.instanceId===i.instanceId).stats.ATK++;f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(changed));await f.store.refresh();
 const saved=f.values.get(EQUIPMENT_SAVE_KEY);await assert.rejects(f.store.dismantle(preview),/Disposal changed/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);
 const useful=structuredClone(f.store.data);useful.items.find(x=>x.instanceId===i.instanceId).stats=f.stats(10000);f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(useful));await f.store.refresh();
 assert.ok(f.store.data.lamp.pending.includes(i.instanceId));await assert.rejects(f.store.dismantle(preview),/still improves/);invariant(f.store.data);
});
test('AUTO planner recomputes current CP gains and commits unique sequential assignments',async()=>{
 const f=fixture({full:true,equipped:false});await f.store.sync();const roster=Object.values(f.globals.HeroProgress.heroes),before=structuredClone(f.store.data);
 const expectedFirst=conveyorReviewCandidates(before,roster)[0].item.instanceId;
 const plan=planConveyorAutoEquip(before,roster),first=plan.changes[0];assert.equal(first.item.instanceId,expectedFirst);
 assert.ok(conveyorReviewCandidates(plan.working,roster).every(c=>c.bestGain<=0));assert.deepEqual(before,f.store.data);
 await f.store.autoEquip();assert.deepEqual(f.store.data.loadouts,plan.working.loadouts);assert.equal(f.store.data.partyEXP,0);invariant(f.store.data);
});
test('malformed issued/held save is rejected without overwriting original provenance',async()=>{
 for(const mutate of [d=>{d.lamp.reviewHold={item:d.items[0],disposal:false};},d=>{d.lamp.emissions=[{item:d.items[0],issuedAt:1,collected:false}];},d=>{d.lamp.disposalRequested=['missing'];}]){
  const f=fixture({full:true}),d=JSON.parse(f.values.get(EQUIPMENT_SAVE_KEY));mutate(d);const raw=JSON.stringify(d);f.values.set(EQUIPMENT_SAVE_KEY,raw);await assert.rejects(f.store.sync(),/invalid/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),raw);
 }
});

test('new lamp actions preserve historically earned EXP and its replay receipts',async()=>{
 const f=fixture(),old=JSON.parse(f.values.get(EQUIPMENT_SAVE_KEY));old.partyEXP=100;f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(old));
 for(const hero of Object.values(f.globals.HeroProgress.heroes)){hero.currentEXP=40;hero.lampEXPClaimed=100;}
 await f.store.sync();const earned=Object.values(f.globals.HeroProgress.heroes).map(h=>[h.currentLevel,h.currentEXP,h.lampEXPClaimed]);
 const item=await f.store.generate();await f.store.collect(item.instanceId);await f.store.markGuide('comparison');f.advance(5000);await f.store.tickConveyor();await f.store.dismantle(f.store.disposalPreview());await f.store.refresh();
 assert.equal(f.store.data.partyEXP,100);assert.deepEqual(Object.values(f.globals.HeroProgress.heroes).map(h=>[h.currentLevel,h.currentEXP,h.lampEXPClaimed]),earned);invariant(f.store.data);
});

test('automatic creation ignores legacy Auto preference and hero-level gates, with one shared five-second roll',async()=>{
 const f=fixture({equipped:false}),other=f.tab();
 for(const hero of Object.values(f.globals.HeroProgress.heroes))hero.currentLevel=1;
 await Promise.all([f.store.sync(),other.store.sync()]);
 assert.equal(f.store.data.lamp.autoEnabled,false);
 const results=await Promise.all([f.store.tickConveyor(),other.store.tickConveyor()]);
 assert.equal(results.filter(Boolean).length,1);assert.equal(lampStoredCount(f.store.data),1);
 assert.equal(await f.store.tickConveyor(),null);f.advance(4999);assert.equal(await f.store.tickConveyor(),null);
 f.advance(1);assert.ok(await f.store.tickConveyor());f.advance(600000);assert.ok(await f.store.tickConveyor());
 assert.equal(f.store.data.lamp.sequence,3);assert.equal(f.store.data.partyEXP,0);invariant(f.store.data);
});

test('menu or departure cancels a queued creation before the shared lock is acquired',async()=>{
 const f=fixture();await f.store.sync();const before=structuredClone(f.store.data);let active=true;
 const queued=f.store.tickConveyor({},()=>active);active=false;assert.equal(await queued,null);
 assert.equal(f.store.data.lamp.sequence,before.lamp.sequence);assert.deepEqual(f.store.data.items,before.items);assert.equal(f.store.data.partyEXP,0);
 active=true;assert.ok(await f.store.tickConveyor({},()=>active));invariant(f.store.data);
});


test('production deferred emission collects individual arrivals after full-cache dismantling, once across tabs',async()=>{
 const f=fixture({full:true});await f.store.sync();
 const first=await f.store.tickConveyor({},()=>true,{deferCollection:true});f.advance(5000);
 const second=await f.store.tickConveyor({},()=>true,{deferCollection:true});
 assert.equal(lampStoredCount(f.store.data),20);assert.ok(f.store.data.lamp.emissions.every(e=>!e.collected));
 await f.store.dismantle(f.store.disposalPreview());assert.equal(lampStoredCount(f.store.data),0);
 await f.store.sync();assert.equal(lampStoredCount(f.store.data),0,'review/sync cannot save approaching gear');
 const other=f.tab();await other.store.sync();
 const receipts=await Promise.all([f.store.collectAvailable([first.instanceId,first.instanceId]),other.store.collectAvailable([first.instanceId])]);
 assert.equal(receipts.flat().filter(r=>r.saved).length,1);await f.store.refresh();assert.equal(lampStoredCount(f.store.data),1);
 assert.equal(f.store.data.items.some(i=>i.instanceId===second.instanceId),false);
 await f.store.dismantle(f.store.disposalPreview());await f.store.collectAvailable([first.instanceId,second.instanceId]);
 assert.equal(lampStoredCount(f.store.data),1);assert.ok(f.store.data.items.some(i=>i.instanceId===second.instanceId));assert.equal(f.store.data.partyEXP,0);invariant(f.store.data);
});
test('automatic arrival respects latest capacity, expiration and failed atomic saves',async()=>{
 const f=fixture({full:true});await f.store.sync();const first=await f.store.tickConveyor({},()=>true,{deferCollection:true});
 const receipt=await f.store.collectAvailable([first.instanceId]);assert.equal(receipt[0].saved,false);assert.ok(!f.store.data.lamp.reviewHold);
 await f.store.dismantle(f.store.disposalPreview());const before=f.values.get(EQUIPMENT_SAVE_KEY);f.fail(true);
 await assert.rejects(f.store.collectAvailable([first.instanceId]),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),before);
 f.fail(false);await f.store.collectAvailable([first.instanceId]);assert.equal(lampStoredCount(f.store.data),1);
 f.advance(5000);const later=await f.store.tickConveyor({},()=>true,{deferCollection:true});f.advance(CONVEYOR_TRAVEL_MS);
 assert.deepEqual(await f.store.collectAvailable([later.instanceId,'missing']),[]);assert.equal(lampStoredCount(f.store.data),1);invariant(f.store.data);
});


test('active conveyor time preserves gaps and collection through long pauses and reload',async()=>{
 const f=fixture();await f.store.sync();await f.store.setConveyorActive(true);
 const first=await f.store.tickConveyor({},()=>true,{deferCollection:true});
 f.advance(5000);await f.store.setConveyorActive(true);
 const second=await f.store.tickConveyor({},()=>true,{deferCollection:true});
 const ages=()=>f.store.data.lamp.emissions.map(e=>conveyorItemAge(f.store.data.lamp,e,f.store.time(),f.store.conveyorTime()));
 assert.deepEqual(ages(),[5000,0]);
 await f.store.setConveyorActive(false);const checkpoint=f.store.conveyorTime();
 f.advance(60000);await f.store.setConveyorActive(false);
 assert.deepEqual(ages(),[5000,0]);
 const other=f.tab();await other.store.sync();await other.store.setConveyorActive(true);
 assert.equal(other.store.conveyorTime(),checkpoint,'reload resumes the saved active coordinate');
 assert.equal(other.store.data.lamp.emissions[1].issuedActiveMs-other.store.data.lamp.emissions[0].issuedActiveMs,5000);
 const collected=await other.store.collectAvailable([first.instanceId,second.instanceId]);
 assert.equal(collected.filter(r=>r.saved).length,2,'wall-clock pause never expires active emissions');
 const third=await other.store.tickConveyor({},()=>true,{deferCollection:true});assert.equal(third,null,'resume preserves the remaining five-second cadence');
 f.advance(5000);await other.store.setConveyorActive(true);
 const expired=await other.store.tickConveyor({},()=>true,{deferCollection:true});
 f.advance(CONVEYOR_TRAVEL_MS);await other.store.setConveyorActive(true);
 await assert.rejects(other.store.collect(expired.instanceId),/passed/);
});
test('supported wall-clock saves migrate existing emission ages once and reject malformed active clocks',async()=>{
 const f=fixture();await f.store.sync();const item=await f.store.tickConveyor({},()=>true,{deferCollection:true});
 f.advance(3000);await f.store.setConveyorActive(true);
 const e=f.store.data.lamp.emissions[0];assert.equal(conveyorItemAge(f.store.data.lamp,e,f.store.time()),3000);
 await f.store.setConveyorActive(false);f.advance(60000);await f.store.setConveyorActive(false);
 assert.equal(conveyorItemAge(f.store.data.lamp,e,f.store.time()),3000);
 assert.equal((await f.store.collect(item.instanceId)).saved,true);
 for(const mutate of [d=>{d.lamp.conveyorActiveMs=-1;},d=>{d.lamp.conveyorActiveMs=NaN;},d=>{d.lamp.emissions[0].issuedActiveMs=d.lamp.conveyorActiveMs+1;},d=>{delete d.lamp.conveyorActiveMs;}]){
  const bad=structuredClone(f.store.data);mutate(bad);assert.throws(()=>validateConveyorState(bad),/invalid/);
 }
});
test('failed active-time checkpoint preserves the durable save and can retry',async()=>{
 const f=fixture();await f.store.sync();await f.store.setConveyorActive(true);
 const saved=f.values.get(EQUIPMENT_SAVE_KEY);f.advance(2000);await f.store.setConveyorActive(true);f.fail(true);
 await assert.rejects(f.store.setConveyorActive(false),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);
 f.fail(false);await f.store.finishReview();assert.equal(f.store.data.lamp.conveyorActiveMs,f.store.conveyorTime());
});

test('a full-cache item remains manually collectible after a long active-clock pause',async()=>{
 const f=fixture({full:true});await f.store.sync();await f.store.setConveyorActive(true);
 const item=await f.store.tickConveyor({},()=>true,{deferCollection:true});
 f.advance(2000);await f.store.setConveyorActive(true);await f.store.setConveyorActive(false);
 f.advance(60000);const result=await f.store.collect(item.instanceId);
 assert.equal(result.saved,true);assert.equal(result.held,true);assert.equal(result.exp,0);invariant(f.store.data);
});
test('concurrent active-clock checkpoints preserve one monotonic coordinate',async()=>{
 const f=fixture(),other=f.tab();await Promise.all([f.store.sync(),other.store.sync()]);
 await Promise.all([f.store.setConveyorActive(true),other.store.setConveyorActive(true)]);
 const start=f.store.conveyorTime();f.advance(5000);
 await Promise.all([f.store.setConveyorActive(true),other.store.setConveyorActive(true)]);
 await Promise.all([f.store.setConveyorActive(false),other.store.setConveyorActive(false)]);
 assert.equal(JSON.parse(f.values.get(EQUIPMENT_SAVE_KEY)).lamp.conveyorActiveMs,start+5000);
});

test('same-tab reload restores the synchronous clock checkpoint when the exit transaction is lost',async()=>{
 const f=fixture();await f.store.sync();await f.store.setConveyorActive(true);
 await f.store.tickConveyor({},()=>true,{deferCollection:true});const durable=f.values.get(EQUIPMENT_SAVE_KEY);
 f.advance(1200);await f.store.setConveyorActive(true);f.fail(true);
 await assert.rejects(f.store.setConveyorActive(false),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),durable);
 f.fail(false);f.advance(60000);const reloaded=f.reload();await reloaded.store.sync();await reloaded.store.setConveyorActive(true);
 assert.equal(reloaded.store.conveyorTime(),f.store.conveyorTime());
 assert.equal(conveyorItemAge(reloaded.store.data.lamp,reloaded.store.data.lamp.emissions[0],reloaded.store.time()),1200);
});
test('session clock rejects malformed metadata and checkpoints belonging to another emission history',async()=>{
 for(const mutate of [c=>{c.sequence++;},c=>{c.seed++;},c=>{c.lastActivationAt++;},c=>{c.activeMs=-1;},c=>{c.activeMs=1.5;}]){
  const f=fixture();await f.store.sync();await f.store.setConveyorActive(true);await f.store.setConveyorActive(false);
  const [key,value]=[...f.checkpointValues][0],checkpoint=JSON.parse(value);mutate(checkpoint);f.checkpointValues.set(key,JSON.stringify(checkpoint));
  const reloaded=f.reload();await reloaded.store.sync();await reloaded.store.setConveyorActive(true);
  assert.equal(reloaded.store.conveyorTime(),f.store.data.lamp.conveyorActiveMs);
 }
});
