import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHeroProgressStore} from '../web-runner/src/core/heroProgression.mjs';
import {createLampEconomy,generateLampItem,lampGearCP,lampItemCPGain,lampReviewCandidates,selectAutoEquipHero,planLampAutoEquip,validateLampEconomy,equipLampItem} from '../web-runner/src/core/lampGear.mjs';
import {classifyConveyorCache,conveyorReviewCandidates,planConveyorAutoEquip,equipConveyorItem,queueConveyorDisposal,conveyorDisposalPreview,dismantleConveyorItems} from '../web-runner/src/core/lampConveyor.mjs';
import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';
function generatedFixture(owned,selected){
 const data=createLampEconomy(42),hero=createHeroProgressStore().heroes.Falie,roll=n=>generateLampItem(42,n,n%70),equipped=owned.map(roll),item=roll(selected);
 data.items=[...equipped,item];data.loadouts.Falie=Object.fromEntries(equipped.map(i=>[i.type,i.instanceId]));data.lamp.pending=[item.instanceId];data.lamp.sequence=Math.max(...owned,selected)+1;data.lamp.highestOrdinal=69;
 validateLampEconomy(data);return{data,hero,item};
}
function interactionFixture(){
 const data=createLampEconomy(42),hero=createHeroProgressStore().heroes.Falie,make=(n,type,stats)=>({...generateLampItem(42,n,0),type,stats:{ATK:1,DEF:1,MAG:1,RES:1,HP:1,...stats}});
 const hat=make(0,'hat',{MAG:200}),body=make(1,'body',{}),hatUp=make(2,'hat',{DEF:200,RES:200,HP:2000}),bodyUp=make(3,'body',{ATK:10});bodyUp.rarity='legendary';
 data.items=[hat,body,hatUp,bodyUp];data.lamp.sequence=4;data.loadouts.Falie={hat:hat.instanceId,body:body.instanceId};data.lamp.pending=[bodyUp.instanceId,hatUp.instanceId];validateLampEconomy(data);return{data,hero,hatUp,bodyUp};
}
test('an item that lowers actual hero CP is red and cannot be equipped even when its standalone score is higher',()=>{
 const {data,hero,item}=generatedFixture([368,421,121],180);assert.equal(lampGearCP(item),10.6);assert.equal(lampItemCPGain(data,item,hero),-.9);
 assert.equal(lampReviewCandidates(data,[hero])[0].gains[0].cpGain,-.9);assert.equal(selectAutoEquipHero(data,item,[hero]),null);
 assert.deepEqual(planConveyorAutoEquip(data,[hero]).changes,[]);assert.deepEqual(planLampAutoEquip(data,[hero]).changes,[]);
 const before=structuredClone(data);assert.throws(()=>equipLampItem(data,'Falie',item.instanceId,hero),/does not increase/);assert.deepEqual(data,before);
});
test('an actual +2.4 hero CP improvement is green, assigned once and excluded from every disposal path',()=>{
 const {data,hero,item}=generatedFixture([35,76,135],85);assert.equal(lampItemCPGain(data,item,hero),2.4);assert.equal(lampReviewCandidates(data,[hero])[0].bestGain,2.4);
 assert.equal(planConveyorAutoEquip(data,[hero]).working.loadouts.Falie.body,item.instanceId);
 assert.deepEqual(conveyorDisposalPreview(data,[hero]).ids,[]);
 const before=structuredClone(data);assert.throws(()=>queueConveyorDisposal(data,item.instanceId,[hero]),/still improves/);
 assert.throws(()=>conveyorDisposalPreview(data,[hero],[item.instanceId]),/still improves/);assert.deepEqual(data,before);
});
test('four actual green gains +13.6, +15, +6, +11.9 choose Hondo and consume the hat once',()=>{
 const heroes=Object.values(createHeroProgressStore().heroes),data=createLampEconomy(42),make=(n,mag,hp)=>({...generateLampItem(42,n,0),type:'hat',stats:{ATK:1,DEF:10,MAG:mag,RES:10,HP:hp}});
 const current=[make(0,6,87),make(1,19,90),make(2,3,118),make(3,5,92)],hat={...make(4,15,80),stats:{ATK:15,DEF:10,MAG:15,RES:10,HP:80}};
 data.items=[...current,hat];data.lamp.sequence=5;data.lamp.pending=[hat.instanceId];heroes.forEach((h,n)=>data.loadouts[h.heroInstanceKey]={hat:current[n].instanceId});validateLampEconomy(data);
 const candidate=lampReviewCandidates(data,heroes)[0];assert.deepEqual(candidate.gains.map(g=>g.cpGain),[13.6,15,6,11.9]);assert.equal(candidate.bestHeroId,'Huun');
 const plan=planConveyorAutoEquip(data,heroes);assert.equal(plan.changes.length,1);assert.equal(plan.changes[0].heroId,'Huun');assert.equal(Object.values(plan.working.loadouts).filter(l=>l.hat===hat.instanceId).length,1);
});
test('Auto re-sorts and re-compares every remaining item after each actual CP improvement',()=>{
 const {data,hero,hatUp,bodyUp}=interactionFixture();assert.equal(lampItemCPGain(data,bodyUp,hero),0);
 const plan=planConveyorAutoEquip(data,[hero]);assert.deepEqual(plan.changes.map(c=>c.item.instanceId),[hatUp.instanceId,bodyUp.instanceId]);
 const replay=structuredClone(data);for(const change of plan.changes){assert.ok(lampItemCPGain(replay,change.item,hero)>0);equipConveyorItem(replay,'Falie',change.item.instanceId,hero);}
 assert.ok(conveyorReviewCandidates(plan.working,[hero]).every(c=>c.bestGain<=0));
 assert.deepEqual(planLampAutoEquip(data,[hero]).loadouts,plan.working.loadouts);
});
test('a green item becomes dismantleable only after a better equipped item makes it red',()=>{
 const {data,hero,item}=generatedFixture([35,76,135],85),better={...item,instanceId:'lamp:42:600',sequence:600,stats:Object.fromEntries(Object.keys(item.stats).map(k=>[k,1000]))};
 data.items.push(better);data.lamp.pending.push(better.instanceId);data.lamp.sequence=601;
 assert.ok(lampItemCPGain(data,item,hero)>0);assert.throws(()=>queueConveyorDisposal(data,item.instanceId,[hero]),/still improves/);
 const plan=planConveyorAutoEquip(data,[hero]);assert.equal(plan.changes[0].item.instanceId,better.instanceId);assert.ok(lampItemCPGain(plan.working,item,hero)<0);
 const preview=conveyorDisposalPreview(plan.working,[hero]);assert.deepEqual(preview.ids,[item.instanceId]);assert.equal(dismantleConveyorItems(plan.working,preview,[hero]).count,1);
});
test('Auto revisits an item passed over before a later equip makes it a +29.3 upgrade',()=>{
 const data=createLampEconomy(42),hero=createHeroProgressStore().heroes.Falie;
 const specs=[
  [0,'hat',{ATK:7,DEF:118,MAG:73,RES:8,HP:179}],
  [1,'body',{ATK:74,DEF:13,MAG:100,RES:15,HP:158}],
  [2,'boots',{ATK:81,DEF:120,MAG:3,RES:82,HP:1197}],
  [4,'body',{ATK:35,DEF:114,MAG:53,RES:44,HP:999}],
  [12,'hat',{ATK:43,DEF:74,MAG:101,RES:68,HP:367}],
  [13,'body',{ATK:70,DEF:113,MAG:72,RES:91,HP:794}],
 ];
 data.items=specs.map(([n,type,stats])=>({...generateLampItem(42,n,0),type,stats}));data.lamp.sequence=14;
 data.loadouts.Falie={hat:'lamp:42:0',body:'lamp:42:1',boots:'lamp:42:2'};data.lamp.pending=['lamp:42:4','lamp:42:12','lamp:42:13'];validateLampEconomy(data);
 assert.deepEqual(conveyorReviewCandidates(data,[hero]).map(c=>c.item.sequence),[4,13,12]);
 const replay=structuredClone(data);equipConveyorItem(replay,'Falie','lamp:42:4',hero);assert.equal(selectAutoEquipHero(replay,data.items[5],[hero]),null);
 equipConveyorItem(replay,'Falie','lamp:42:12',hero);assert.equal(lampItemCPGain(replay,data.items[5],hero),29.3);
 const plan=planConveyorAutoEquip(data,[hero]);assert.deepEqual(plan.changes.map(c=>c.item.sequence),[4,12,13]);
 assert.ok(conveyorReviewCandidates(plan.working,[hero]).every(c=>c.bestGain<=0));assert.deepEqual(planLampAutoEquip(data,[hero]).loadouts,plan.working.loadouts);
});
test('dismantling rechecks actual CP when another legal equip makes a reviewed red item green',()=>{
 const {data,hero,hatUp,bodyUp}=interactionFixture(),preview=conveyorDisposalPreview(data,[hero],[bodyUp.instanceId]);
 equipConveyorItem(data,'Falie',hatUp.instanceId,hero);assert.ok(lampItemCPGain(data,bodyUp,hero)>0);
 const before=structuredClone(data);assert.throws(()=>dismantleConveyorItems(data,preview,[hero]),/still improves/);assert.deepEqual(data,before);
});
test('zero actual CP change is red and cannot be equipped',()=>{
 const {data,hero,bodyUp}=interactionFixture();assert.equal(lampItemCPGain(data,bodyUp,hero),0);const before=structuredClone(data);
 assert.throws(()=>equipConveyorItem(data,'Falie',bodyUp.instanceId,hero),/does not increase/);assert.deepEqual(data,before);
});
test('production storage rejects CP loss atomically and saves factual positive receipts',async()=>{
 for(const [owned,selected,expected] of [[[368,421,121],180,-.9],[[35,76,135],85,2.4]]){
  const {data,hero,item}=generatedFixture(owned,selected),values=new Map([[EQUIPMENT_SAVE_KEY,JSON.stringify(data)]]),globals={goldTotal:0,HeroProgress:{...createHeroProgressStore(),heroes:{Falie:hero}}};
  const store=createEquipmentStorage({globals,storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},locks:{request:(_k,fn)=>fn()},now:()=>100000,reportError:()=>{}});await store.sync();
  if(expected<0){const before=values.get(EQUIPMENT_SAVE_KEY);await assert.rejects(store.equip('Falie',item.instanceId),/does not increase/);assert.equal(values.get(EQUIPMENT_SAVE_KEY),before);assert.deepEqual(await store.autoEquip(),[]);}
  else{const [receipt]=await store.autoEquip();assert.equal(receipt.cpChange,expected);assert.ok(receipt.cpAfter>receipt.cpBefore);assert.equal(globals.HeroProgress.heroes.Falie.combatPower,receipt.cpAfter);}
 }
});

test('a saved disposal request cannot keep a currently green item in discarded storage',()=>{
 const {data,hero,item}=generatedFixture([35,76,135],85);data.lamp.pending=[];data.lamp.discarded=[item.instanceId];data.lamp.disposalRequested=[item.instanceId];
 classifyConveyorCache(data,[hero]);assert.deepEqual(data.lamp.pending,[item.instanceId]);assert.deepEqual(data.lamp.discarded,[]);assert.deepEqual(data.lamp.disposalRequested,[]);
 assert.deepEqual(conveyorDisposalPreview(data,[hero]).ids,[]);
});
test('Auto retains every equipped slot until a same-hero upgrade and never transfers equipped gear',()=>{
 const data=createLampEconomy(42),heroes=Object.values(createHeroProgressStore().heroes),slots={hat:[],body:[],boots:[]};let sequence=0;
 while(Object.values(slots).some(items=>items.length<4)){const item=generateLampItem(42,sequence++,0);if(slots[item.type].length<4){slots[item.type].push(item);data.items.push(item);}}
 for(const [index,hero] of heroes.entries())data.loadouts[hero.heroInstanceKey]=Object.fromEntries(Object.entries(slots).map(([slot,items])=>[slot,items[index].instanceId]));
 for(let count=0;count<20;count++){const item=generateLampItem(42,sequence++,5);data.items.push(item);data.lamp.pending.push(item.instanceId);}
 data.lamp.sequence=sequence;data.lamp.highestOrdinal=5;validateLampEconomy(data);
 const before=structuredClone(data),plan=planConveyorAutoEquip(data,heroes),replay=structuredClone(data),originallyEquipped=new Set(Object.values(data.loadouts).flatMap(Object.values));
 assert.ok(plan.changes.length>0);
 for(const change of plan.changes){
  const hero=heroes.find(h=>h.heroInstanceKey===change.heroId),old=structuredClone(replay.loadouts);
  assert.ok(!originallyEquipped.has(change.item.instanceId),'Auto takes items only from the cache');assert.ok(lampItemCPGain(replay,change.item,hero)>0);
  equipConveyorItem(replay,change.heroId,change.item.instanceId,hero);
  for(const member of heroes)for(const [slot,id] of Object.entries(old[member.heroInstanceKey])){
   assert.equal(replay.loadouts[member.heroInstanceKey][slot],member===hero&&slot===change.item.type?change.item.instanceId:id,'only the upgraded hero and slot may change');
  }
 }
 assert.deepEqual(replay.loadouts,plan.working.loadouts);assert.deepEqual(planLampAutoEquip(data,heroes).loadouts,plan.working.loadouts);
 assert.deepEqual(data,before,'planning never changes the input save');
 const foreignId=data.loadouts.Falie.hat,foreign=data.items.find(i=>i.instanceId===foreignId);foreign.stats=Object.fromEntries(Object.keys(foreign.stats).map(k=>[k,1000]));
 assert.ok(lampItemCPGain(data,foreign,heroes[1])>0);const manualBefore=structuredClone(data);
 assert.throws(()=>equipConveyorItem(data,'Huun',foreignId,heroes[1]),/no longer available/);assert.deepEqual(data,manualBefore,'even an improving equipped item cannot transfer to another hero');
});
