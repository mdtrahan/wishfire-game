import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trustFixture,owners,gain} from './fixtures/lampTrust.mjs';
import {lampHeroRoster} from '../web-runner/src/core/lampHeroRoster.mjs';
import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';
import {conveyorDisposalPreview} from '../web-runner/src/core/lampConveyor.mjs';
function storageFixture(save,heroes){
 const values=new Map([[EQUIPMENT_SAVE_KEY,JSON.stringify(save)]]),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},globals={HeroProgress:heroes,goldTotal:save.gold};
 return{values,globals,store:createEquipmentStorage({globals,storage,locks:{request:(_k,fn)=>fn()},now:()=>100000,reportError:()=>{}})};
}
function* permutations(values){if(!values.length){yield[];return;}for(const [n,value]of values.entries())for(const rest of permutations(values.filter((_,i)=>i!==n)))yield[value,...rest];}
test('all 120 save orders preserve canonical recipients and Kaja upgrade protection',async()=>{
 const fixture=trustFixture('kaja');let count=0;
 for(const order of permutations(Object.keys(fixture.heroes.heroes))){
  const heroes=structuredClone(fixture.heroes),save=structuredClone(fixture.save);heroes.heroes=Object.fromEntries(order.map(id=>[id,heroes.heroes[id]]));
  const f=storageFixture(save,heroes);await f.store.sync();assert.deepEqual(lampHeroRoster(heroes).map(h=>h.heroInstanceKey),owners);
  assert.ok(gain(save,heroes.heroes.Kojonn,fixture.selected)>0);
  const bytes=f.values.get(EQUIPMENT_SAVE_KEY);await assert.rejects(f.store.queueDisposal(fixture.selected.instanceId),/still improves/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),bytes);
  assert.throws(()=>f.store.disposalPreview([fixture.selected.instanceId]),/still improves/);
  const preview=conveyorDisposalPreview({...save,lamp:{...save.lamp,pending:[],discarded:[fixture.selected.instanceId]}},[heroes.heroes.Falie],[fixture.selected.instanceId]);
  await assert.rejects(f.store.dismantle(preview),/still improves/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),bytes);
  const receipts=await f.store.autoEquip();assert.equal(receipts.length,1);assert.equal(receipts[0].heroId,'Kojonn');assert.equal(f.store.data.loadouts.Kojonn.hat,fixture.selected.instanceId);assert.deepEqual(f.store.data.loadouts['falie#1'],save.loadouts['falie#1']);count++;
 }
 assert.equal(count,120);
});
test('missing or mismatched canonical records block every gear transaction without writes',async()=>{
 for(const damage of ['missing','mismatch']){
  const {save,heroes,selected}=trustFixture('mixed'),f=storageFixture(save,heroes);await f.store.sync();
  if(damage==='missing')delete heroes.heroes.Kojonn;else heroes.heroes.Kojonn.heroInstanceKey='kojonn#1';
  const before=[...f.values];
  for(const call of [()=>f.store.sync(),()=>f.store.equip('Falie',selected.instanceId),()=>f.store.autoEquip(),()=>f.store.queueDisposal(selected.instanceId),()=>f.store.dismantle({ids:[selected.instanceId]})])await assert.rejects(call(),/missing or invalid/);
  assert.throws(()=>f.store.disposalPreview(),/missing or invalid/);assert.deepEqual([...f.values],before);
 }
});
test('reclassification preserves owned gear, copy loadouts, balances and every item byte',async()=>{
 const {save,heroes,selected}=trustFixture('kaja');save.lamp.pending=[];save.lamp.discarded=[selected.instanceId];save.lamp.disposalRequested=[selected.instanceId];
 const copyItem=structuredClone(save.items.find(i=>i.instanceId===save.loadouts['falie#1'].hat));
 const f=storageFixture(save,heroes);await f.store.sync();const after=f.store.data;
 assert.deepEqual(after.items,save.items);assert.deepEqual(after.loadouts,save.loadouts);assert.equal(after.gold,save.gold);assert.equal(after.partyEXP,save.partyEXP);assert.equal(after.lamp.essence,save.lamp.essence);
 assert.deepEqual(after.lamp.pending,[selected.instanceId]);assert.deepEqual(after.lamp.discarded,[]);assert.deepEqual(after.lamp.disposalRequested,[]);
 await assert.rejects(f.store.equip('falie#1',selected.instanceId),/not a lamp equipment owner/);
 await f.store.autoEquip();assert.deepEqual(f.store.data.loadouts['falie#1'],save.loadouts['falie#1']);assert.deepEqual(f.store.data.items.find(i=>i.instanceId===copyItem.instanceId),copyItem);
});

test('commit guard routes CP equipment roster and proof changes through real gameplay',()=>{
 const hook=readFileSync(new URL('../.beads/hooks/pre-commit',import.meta.url),'utf8'),pattern=new RegExp(hook.match(/LAMP_GAMEPLAY_OWNER_PATTERN='([^']+)'/)[1]);
 for(const path of ['.beads/hooks/pre-commit','package.json','web-runner/app.js','web-runner/src/core/lampGear.mjs','web-runner/src/core/lampConveyor.mjs','web-runner/src/core/lampHeroRoster.mjs','web-runner/src/core/equipment.mjs','web-runner/src/core/combatPower.mjs','web-runner/src/core/heroProgression.mjs','web-runner/src/core/heroDefinitions.mjs','web-runner/systems/equipmentStorage.mjs','web-runner/systems/renderHeroScreen.js','web-runner/systems/heroGearUI.mjs','tests/lampAutoEquipGameplay.test.mjs','tests/lampRoster.test.mjs','tests/fixtures/lampTrust.mjs'])assert.ok(pattern.test(path),path+' must run gameplay proof');
 assert.equal(pattern.test('README.md'),false);assert.match(hook,/node --test --test-concurrency=1 tests\/lampAutoEquipGameplay\.test\.mjs tests\/lampRoster\.test\.mjs/);
});
