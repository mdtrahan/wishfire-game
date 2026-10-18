import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHeroProgressStore} from '../web-runner/src/core/heroProgression.mjs';
import {createLampEconomy,generateLampItem,lampGearCP,lampItemCPGain,lampReviewCandidates,selectAutoEquipHero,planLampAutoEquip,validateLampEconomy} from '../web-runner/src/core/lampGear.mjs';
import {classifyConveyorCache,conveyorReviewCandidates,planConveyorAutoEquip} from '../web-runner/src/core/lampConveyor.mjs';
import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';

function generatedFixture(owned,selected){
 const data=createLampEconomy(42),hero=createHeroProgressStore().heroes.Falie;
 const roll=n=>generateLampItem(42,n,n%70),equipped=owned.map(roll),item=roll(selected);
 data.items=[...equipped,item];data.loadouts.Falie=Object.fromEntries(equipped.map(i=>[i.type,i.instanceId]));
 data.lamp.pending=[item.instanceId];data.lamp.sequence=Math.max(...owned,selected)+1;data.lamp.highestOrdinal=69;
 validateLampEconomy(data);return{data,hero,item};
}

test('a generated 7.0 to 10.6 slot upgrade stays eligible despite a negative whole-hero CP change',()=>{
 const {data,hero,item}=generatedFixture([368,421,121],180),current=data.items.find(i=>i.instanceId===data.loadouts.Falie.hat);
 assert.equal(lampGearCP(current),7);assert.equal(lampGearCP(item),10.6);assert.equal(lampItemCPGain(data,item,hero),-.9);
 const candidate=lampReviewCandidates(data,[hero])[0];assert.equal(candidate.gains[0].cpGain,3.6);assert.equal(candidate.bestGain,3.6);
 assert.equal(selectAutoEquipHero(data,item,[hero]),'Falie');
 for(const plan of [planLampAutoEquip(data,[hero]),planConveyorAutoEquip(data,[hero])])assert.equal((plan.working||plan).loadouts.Falie.hat,item.instanceId);
});

test('a generated 12.1 to 9.4 slot downgrade stays red despite a positive whole-hero CP change',()=>{
 const {data,hero,item}=generatedFixture([35,76,135],85),current=data.items.find(i=>i.instanceId===data.loadouts.Falie.body);
 assert.equal(lampGearCP(current),12.1);assert.equal(lampGearCP(item),9.4);assert.equal(lampItemCPGain(data,item,hero),2.4);
 const candidate=lampReviewCandidates(data,[hero])[0];assert.equal(candidate.gains[0].cpGain,-2.7);assert.equal(candidate.bestGain,0);
 assert.equal(selectAutoEquipHero(data,item,[hero]),null);assert.deepEqual(planConveyorAutoEquip(data,[hero]).changes,[]);
 classifyConveyorCache(data,[hero]);assert.deepEqual(data.lamp.pending,[]);assert.deepEqual(data.lamp.discarded,[item.instanceId]);
 assert.equal(conveyorReviewCandidates(data,[hero])[0].bestGain,0,'discarded inspection uses the same slot rule');
});

test('four green heroes compete for one hat: +13.6, +15, +6, +11.9 assigns Hondo once',()=>{
 const heroes=Object.values(createHeroProgressStore().heroes),data=createLampEconomy(42);
 const item=(n,atk,hp)=>({...generateLampItem(42,n,0),type:'hat',stats:{ATK:atk,DEF:1,MAG:1,RES:1,HP:hp}});
 const current=[item(0,6,59),item(1,2,70),item(2,5,92),item(3,1,86)],hat=item(4,3,123);
 data.items=[...current,hat];data.lamp.sequence=5;data.lamp.pending=[hat.instanceId];
 heroes.forEach((h,n)=>data.loadouts[h.heroInstanceKey]={hat:current[n].instanceId});validateLampEconomy(data);
 const candidate=lampReviewCandidates(data,heroes)[0];assert.deepEqual(candidate.gains.map(g=>g.cpGain),[13.6,15,6,11.9]);
 assert.ok(candidate.gains.every(g=>g.cpGain>0),'every hero can independently show green');
 assert.equal(candidate.bestHeroId,'Huun');
 const plan=planConveyorAutoEquip(data,heroes);assert.equal(plan.changes.length,1);assert.equal(plan.changes[0].heroId,'Huun');
 assert.equal(Object.values(plan.working.loadouts).filter(slots=>slots.hat===hat.instanceId).length,1);
 assert.equal(conveyorReviewCandidates(plan.working,heroes).length,0);validateLampEconomy(plan.working);
});

test('equal slot CP is ineligible, while an empty matching slot accepts the item',()=>{
 const {data,hero,item}=generatedFixture([35,76,135],85),current=data.items.find(i=>i.instanceId===data.loadouts.Falie.body);
 item.stats={...current.stats};assert.equal(lampReviewCandidates(data,[hero])[0].gains[0].cpGain,0);
 assert.equal(selectAutoEquipHero(data,item,[hero]),null);assert.deepEqual(planConveyorAutoEquip(data,[hero]).changes,[]);
 delete data.loadouts.Falie.body;assert.equal(selectAutoEquipHero(data,item,[hero]),'Falie');
});

test('the smallest canonical +0.1 slot gain is eligible in the production planner',()=>{
 const {data,hero,item}=generatedFixture([0],352);
 assert.equal(lampReviewCandidates(data,[hero])[0].bestGain,.1);
 assert.equal(planConveyorAutoEquip(data,[hero]).working.loadouts.Falie.body,item.instanceId);
});

test('production Auto-Equip saves slot upgrades and reports the actual signed whole-hero CP receipt',async()=>{
 const {data,hero,item}=generatedFixture([368,421,121],180),values=new Map([[EQUIPMENT_SAVE_KEY,JSON.stringify(data)]]);
 const globals={goldTotal:0,HeroProgress:{...createHeroProgressStore(),heroes:{Falie:hero}}};
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const store=createEquipmentStorage({globals,storage,locks:{request:(_key,fn)=>fn()},now:()=>100000,reportError:()=>{}});
 await store.sync();const results=await store.autoEquip();assert.equal(results.length,1);assert.equal(results[0].cpChange,-.9);
 assert.equal(Math.round((results[0].cpAfter-results[0].cpBefore)*10)/10,-.9);
 const saved=JSON.parse(values.get(EQUIPMENT_SAVE_KEY));assert.equal(saved.loadouts.Falie.hat,item.instanceId);validateLampEconomy(saved);
 assert.equal(globals.HeroProgress.heroes.Falie.combatPower,results[0].cpAfter);
});
