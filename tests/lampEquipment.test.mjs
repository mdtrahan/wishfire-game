import {RARITIES} from '../web-runner/src/core/equipment.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LAMP_CONFIG,LAMP_CAPACITY_TIERS,generateLampItem,createLampEconomy,activateLamp,lampStoredCount,lampCapacity,lampItemCPGain,lampGearCP,sortedLampItems,selectLampUpgrades,lampReviewCandidates,planLampAutoEquip,finishLampReview,lampStageCost,purchaseLampStage,upgradeLamp,completeLampUpgrade,validateLampEconomy,compareLampItem,selectAutoEquipHero,equipLampItem,dismantleLampItems,migrateLegacyEquipment,migrateLampEconomy,migrateFourStatLamp,migrateDraftLamp,salvageValue,GEAR_ARCHETYPES} from '../web-runner/src/core/lampGear.mjs';
import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';
import {createHeroProgressStore,newHeroProgress} from '../web-runner/src/core/heroProgression.mjs';
import {computeCombatPower} from '../web-runner/src/core/combatPower.mjs';
const preview=d=>[...d.lamp.pending,...(d.lamp.discarded||[]),'salvage:'+d.lamp.salvage.count+':'+d.lamp.salvage.gold];
function fixture(initial={},options={}){const values=new Map(Object.entries(initial));let fail=false,chain=Promise.resolve(),clock=1000;
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){if(fail)throw Error('disk full');values.set(k,v);}};
 const locks={request:(key,fn)=>{const next=chain.then(fn);chain=next.catch(()=>{});return next;}};
 const globals={goldTotal:0,HeroProgress:createHeroProgressStore()};const store=createEquipmentStorage({globals,storage,locks,getActors:options.getActors,seed:()=>42,now:()=>clock,reportError:()=>{},onGearCollected:options.onGearCollected});
 return{values,storage,locks,globals,store,setFail:v=>fail=v,setClock:v=>clock=v};}

test('canonical equipped gear reaches the deployed hero instance',async()=>{
 const actor={...newHeroProgress('Falie','falie#1'),kind:'hero',uid:1};
 const f=fixture({}, {getActors:()=>[actor]});
 f.globals.HeroProgress.heroes['falie#1']=newHeroProgress('Falie','falie#1');
 await f.store.sync();
 const item=await f.store.generate();
 await f.store.equip('Falie',item.instanceId);
 assert.equal(f.store.data.loadouts.Falie.body,item.instanceId);
 assert.equal(f.store.data.loadouts['falie#1'],undefined);
 assert.equal(actor.stats.ATK,7+item.stats.ATK);
 assert.equal(actor.maxHP,75+item.stats.HP);
 assert.equal(f.globals.HeroProgress.heroes['falie#1'].maxHP,actor.maxHP);
 const restored={...newHeroProgress('Falie','falie#1'),kind:'hero',uid:1};
 const reload=fixture(Object.fromEntries(f.values),{getActors:()=>[restored]});
 await reload.store.sync();
 assert.equal(reload.store.data.loadouts.Falie.body,item.instanceId);
 assert.equal(restored.stats.ATK,actor.stats.ATK);
 assert.equal(restored.maxHP,actor.maxHP);
});

test('instance loadouts override canonical gear and duplicate clones do not share it',async()=>{
 const first={...newHeroProgress('Falie','falie#1'),kind:'hero',uid:1};
 const second={...newHeroProgress('Falie','falie#2'),kind:'hero',uid:2};
 const f=fixture({}, {getActors:()=>[first,second]});
 f.globals.HeroProgress.heroes['falie#1']=newHeroProgress('Falie','falie#1');
 f.globals.HeroProgress.heroes['falie#2']=newHeroProgress('Falie','falie#2');
 await f.store.sync();
 const canonicalItem=await f.store.generate();
 await f.store.equip('Falie',canonicalItem.instanceId);
 assert.deepEqual(first.equipmentStats,canonicalItem.stats);
 assert.deepEqual(second.equipmentStats??{},{});
 f.setClock(3001);
 const instanceItem=await f.store.generate();
 await f.store.equip('falie#1',instanceItem.instanceId);
 assert.deepEqual(first.equipmentStats,instanceItem.stats);
 assert.deepEqual(second.equipmentStats??{},{});
 const saved=structuredClone(f.store.data);
 saved.loadouts['falie#1']={};
 saved.lamp.discarded.push(instanceItem.instanceId);
 f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(saved));
 await f.store.refresh();
 assert.deepEqual(first.equipmentStats,{});
 assert.deepEqual(second.equipmentStats??{},{});
 assert.deepEqual(f.globals.HeroProgress.heroes.Falie.equipmentStats,canonicalItem.stats);
});

test('automatic conveyor collection commits gear events and retries them after reload',async()=>{
 let failEvent=true;const received=[];
 const f=fixture({}, {onGearCollected:event=>{if(failEvent)throw Error('COT save failed');received.push(event.item.instanceId);return{changed:true};}});
 await f.store.sync();f.setClock(100000);
 const emitted=await f.store.tickConveyor({},()=>true,{deferCollection:true});
 f.setClock(116000);
 const arrivals=await f.store.collectAvailable([emitted.instanceId]);
 assert.equal(arrivals[0].saved,true);assert.equal(f.store.data.pendingGearCollections[0].id,emitted.instanceId);
 failEvent=false;
 const reopened=createEquipmentStorage({globals:f.globals,storage:f.storage,locks:f.locks,now:()=>116000,reportError:()=>{},onGearCollected:event=>{received.push(event.item.instanceId);return{changed:true};}});
 await reopened.sync();
 assert.deepEqual(received,[emitted.instanceId]);assert.deepEqual(reopened.data.pendingGearCollections,[]);
 assert.deepEqual(await reopened.collectAvailable([emitted.instanceId]),[]);assert.deepEqual(received,[emitted.instanceId]);
});

test('successful immediate auto collections emit once while full or duplicate arrivals do not',async()=>{
 const events=[];const f=fixture({}, {onGearCollected:event=>{events.push(event.item.instanceId);return{changed:true};}});
 await f.store.sync();f.setClock(100000);
 const generated=await f.store.generate();
 f.setClock(100000+LAMP_CONFIG.autoIntervalMs);
 const automatic=await f.store.tickConveyor({},()=>true);
 assert.deepEqual(events,[generated.instanceId,automatic.instanceId]);
 const full=createLampEconomy(42,0);
 for(let n=0;n<lampCapacity(full);n++){const item=generateLampItem(42,n,0);full.items.push(item);full.lamp.pending.push(item.instanceId);}
 full.lamp.sequence=full.items.length;full.lamp.lastActivationAt=1000;
 const fullFixture=fixture({[EQUIPMENT_SAVE_KEY]:JSON.stringify(full)}, {onGearCollected:event=>{events.push(event.item.instanceId);return{changed:true};}});
 await fullFixture.store.sync();fullFixture.setClock(100000);
 const held=await fullFixture.store.tickConveyor({},()=>true);
 assert.equal(held.rewardEXP,0);assert.equal(fullFixture.store.data.items.length,lampCapacity(full));
 assert.equal(events.length,2);
});

test('guide actions persist once without awarding resources or changing earned progression',async()=>{
 const f=fixture();await f.store.sync();
 await assert.rejects(f.store.markGuide('storage'),/stored equipment/);await assert.rejects(f.store.markGuide('comparison'),/stored equipment/);await assert.rejects(f.store.markGuide('invented'),/Unknown/);
 f.setFail(true);const saved=f.values.get(EQUIPMENT_SAVE_KEY);await assert.rejects(f.store.markGuide('preview'),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);assert.equal(f.store.data.lamp.guide,undefined);f.setFail(false);
 await f.store.generate();const before=structuredClone(f.store.data),heroes=structuredClone(f.globals.HeroProgress.heroes);
 await Promise.all(['storage','comparison','preview','storage','preview'].map(step=>f.store.markGuide(step)));
 assert.equal(f.store.data.lamp.guide,7);const after=structuredClone(f.store.data);delete after.lamp.guide;assert.deepEqual(after,before);assert.deepEqual(f.globals.HeroProgress.heroes,heroes);
 const reopened=createEquipmentStorage({globals:f.globals,storage:f.storage,locks:f.locks,reportError:()=>{}});await reopened.sync();assert.equal(reopened.data.lamp.guide,7);await reopened.markGuide('preview');assert.deepEqual(reopened.data,f.store.data);assert.deepEqual(f.globals.HeroProgress.heroes,heroes);
 for(const guide of [-1,8,1.5,'1']){const invalid=structuredClone(before);invalid.lamp.guide=guide;assert.throws(()=>validateLampEconomy(invalid),/invalid/);}
});

test('four paid stages start saved construction; expiry commits promotion atomically',async()=>{
 const data=createLampEconomy(42);activateLamp(data,{},0);data.lamp.essence=400;
 const f=fixture({[EQUIPMENT_SAVE_KEY]:JSON.stringify(data)});await f.store.sync();
 const heroes=structuredClone(f.globals.HeroProgress.heroes),gear=structuredClone(f.store.data.items),saved=f.values.get(EQUIPMENT_SAVE_KEY);
 await assert.rejects(f.store.upgrade(0),/four upgrade stages/);
 assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved,'bank alone grants no stage or level');
 f.setFail(true);await assert.rejects(f.store.purchaseStage(0,0),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);assert.equal(f.store.data.lamp.essence,400);
 f.setFail(false);const purchases=await Promise.allSettled([f.store.purchaseStage(0,0),f.store.purchaseStage(0,0)]);
 assert.equal(purchases.filter(r=>r.status==='fulfilled').length,1);assert.match(purchases.find(r=>r.status==='rejected').reason.message,/upgrade changed/);
 assert.equal(f.store.data.lamp.essence,300);assert.equal(f.store.data.lamp.upgradeStage,1);assert.equal(f.store.data.lamp.capacityTier,0);
 const restarted=createEquipmentStorage({globals:f.globals,storage:f.storage,locks:f.locks,now:()=>11000,reportError:()=>{}});await restarted.sync();
 assert.equal(restarted.data.lamp.upgradeStage,1);assert.equal(restarted.data.lamp.capacityTier,0);
 for(let stage=1;stage<4;stage++){await restarted.purchaseStage(0,stage);assert.equal(restarted.data.lamp.capacityTier,0);}
 assert.equal(restarted.data.lamp.upgradeStage,4);assert.equal(restarted.data.lamp.essence,0);
 await assert.rejects(restarted.purchaseStage(0,4),/already purchased/);
 assert.equal(restarted.data.lamp.upgradeEndsAt,11000+LAMP_CONFIG.upgradeDurationMs);
 await assert.rejects(restarted.upgrade(0),/under construction/);
 f.setClock(restarted.data.lamp.upgradeEndsAt-1);await f.store.refresh();assert.equal(f.store.data.lamp.capacityTier,0);
 const ready=f.values.get(EQUIPMENT_SAVE_KEY);f.setFail(true);f.setClock(restarted.data.lamp.upgradeEndsAt);await assert.rejects(f.store.sync(),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),ready);assert.equal(f.store.data.lamp.capacityTier,0);f.setFail(false);
 await f.store.sync();await restarted.refresh();
 assert.equal(restarted.data.lamp.capacityTier,1);assert.equal(restarted.data.lamp.upgradeStage,0);assert.equal(restarted.data.lamp.essence,0);
 assert.deepEqual(restarted.data.items,gear);assert.deepEqual(f.globals.HeroProgress.heroes,heroes);assert.equal(restarted.data.partyEXP,0);
 const poor=fixture();await poor.store.sync();const before=JSON.stringify(poor.store.data);await assert.rejects(poor.store.purchaseStage(0,0),/Need 100 more essence/);assert.equal(JSON.stringify(poor.store.data),before);
 const max=createLampEconomy(42);max.lamp.capacityTier=LAMP_CONFIG.lampLevels-1;
 assert.throws(()=>upgradeLamp(max),/fully upgraded/);assert.throws(()=>purchaseLampStage(max),/fully upgraded/);
 for(const stage of [-1,5,1.5,'1']){const invalid=structuredClone(data);invalid.lamp.upgradeStage=stage;assert.throws(()=>validateLampEconomy(invalid),/invalid/);}
});

test('current v5 earned lamp level and bank load without inferring purchased stages',async()=>{
 const data=createLampEconomy(42);data.lamp.capacityTier=1;data.lamp.essence=100000;delete data.lamp.upgradeStage;
 const f=fixture({[EQUIPMENT_SAVE_KEY]:JSON.stringify(data)});await f.store.sync();assert.deepEqual(f.store.data,data);
 await assert.rejects(f.store.upgrade(1),/four upgrade stages/);assert.deepEqual(f.store.data,data);
});

test('seed and sequence reproduce exact gear; quality never rerolls on comparison',()=>{
 for(let sequence=0;sequence<200;sequence++){const i=generateLampItem(42,sequence,9);assert.deepEqual(i,generateLampItem(42,sequence,9));assert.ok(['hat','body','boots'].includes(i.type));assert.deepEqual(Object.keys(i.stats),['ATK','DEF','MAG','RES','HP']);assert.ok(Object.values(i.stats).every(n=>n>=1));}
 assert.notDeepEqual(generateLampItem(42,1,0),generateLampItem(42,2,0));
});
test('new Epic and Legendary rolls clear same-ordinal lower-rarity stat ceilings for every slot',()=>{
 const heroes=Object.values(createHeroProgressStore().heroes),scale=1,lowerQuality=1.42,epicQuality=1.7,weights={common:0,uncommon:0,rare:0,epic:100,legendary:0};
 for(const type of ['hat','body','boots']){
  let epic;for(let seed=0;seed<20000;seed++){const item=generateLampItem(seed,0,0,weights);if(item.type===type){epic=item;break;}}assert.ok(epic,`found Epic ${type}`);
  const data=createLampEconomy(1);for(const hero of heroes){const id='rare:'+hero.heroInstanceKey,stats=Object.fromEntries(['ATK','DEF','MAG','RES','HP'].map(stat=>[stat,Math.ceil(Math.max(...GEAR_ARCHETYPES.filter(entry=>entry.type===type).map(entry=>entry.stats[stat]))*scale*lowerQuality*1.2)]));data.items.push({...GEAR_ARCHETYPES.find(entry=>entry.type===type),instanceId:id,rarity:'rare',level:1,sequence:0,ordinal:0,stats});data.loadouts[hero.heroInstanceKey]={[type]:id};}
  let legendary;for(let seed=0;seed<20000;seed++){const item=generateLampItem(seed,0,0,{common:0,uncommon:0,rare:0,epic:0,legendary:100});if(item.type===type){legendary=item;break;}}assert.ok(legendary,`found Legendary ${type}`);
  for(const stat of ['ATK','DEF','MAG','RES','HP']){const maxRare=Math.ceil(Math.max(...GEAR_ARCHETYPES.filter(entry=>entry.type===type).map(entry=>entry.stats[stat]))*scale*lowerQuality*1.2);assert.ok(epic.stats[stat]>maxRare,`${type} ${stat} Epic exceeds every lower rarity`);const maxEpic=Math.max(maxRare+1,...GEAR_ARCHETYPES.filter(entry=>entry.type===type).map(entry=>Math.ceil(entry.stats[stat]*scale*epicQuality*1.2)));assert.ok(legendary.stats[stat]>maxEpic,`${type} ${stat} Legendary exceeds the Epic envelope`);}
  assert.ok(heroes.every(hero=>lampItemCPGain(data,epic,hero)>0),`${type} Epic improves every hero over worst-case lower-rarity gear`);
 }
});
test('restart retains stored gear and EXP without an emission toggle',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});
 for(const h of Object.values(f.globals.HeroProgress.heroes))h.currentLevel=5;
 const saved=structuredClone(f.store.data);
 const restart=createEquipmentStorage({globals:f.globals,storage:f.storage,locks:f.locks,now:()=>11000});
 await restart.sync();assert.equal(restart.data.lamp.autoEnabled,false);
 assert.deepEqual(restart.data.items,saved.items);assert.deepEqual(restart.data.lamp.pending,saved.lamp.pending);
 assert.ok(await restart.tickConveyor({}));assert.equal(restart.data.partyEXP,saved.partyEXP+LAMP_CONFIG.drawEXP);
 assert.equal(restart.data.lamp.sequence,saved.lamp.sequence+1);
});
test('map progression persists through lower-stage attempts; stock cap spends nothing',()=>{
 const d=createLampEconomy(42,1000);activateLamp(d,{region:3,stage:5},100);const first=d.items[0];activateLamp(d,{region:1,stage:1},2100);assert.equal(d.items[1].ordinal,first.ordinal);
 while(d.lamp.pending.length<LAMP_CONFIG.capacity)activateLamp(d,{},d.lamp.lastActivationAt+2000);
 const before=JSON.stringify(d);assert.throws(()=>activateLamp(d,{},400),/full/);assert.equal(JSON.stringify(d),before);
});
test('single item has different signed comparisons across four heroes and allows tradeoffs',()=>{
 const d=createLampEconomy(1),candidate={...generateLampItem(1,0,0),instanceId:'new',type:'body',stats:{ATK:5,DEF:3,MAG:1,RES:1,HP:0}};d.items=[candidate];d.lamp.pending=['new'];
 for(const[id,stats]of Object.entries({Falie:{ATK:10,DEF:2,MAG:1,RES:1},Huun:{ATK:1,DEF:1,MAG:1,RES:1},Runa:{ATK:3,DEF:4,MAG:1,RES:1},Kojonn:{ATK:5,DEF:3,MAG:1,RES:1}})){const current={...candidate,instanceId:id,stats:{...stats,HP:0}};d.items.push(current);d.loadouts[id]={body:id};}
 assert.deepEqual(compareLampItem(d,candidate,'Falie').deltas,{ATK:-5,DEF:1,MAG:0,RES:0,HP:0});assert.equal(compareLampItem(d,candidate,'Huun').upgrade,true);assert.equal(compareLampItem(d,candidate,'Runa').upgrade,false);assert.equal(compareLampItem(d,candidate,'Kojonn').upgrade,false);
 const before=structuredClone(d);assert.throws(()=>equipLampItem(d,'Falie','new',createHeroProgressStore().heroes.Falie),/does not increase/);assert.deepEqual(d,before);equipLampItem(d,'Huun','new',createHeroProgressStore().heroes.Huun);assert.equal(d.loadouts.Huun.body,'new');assert.equal(d.lamp.salvage.count,0);assert.ok(!d.items.some(i=>i.instanceId==='Huun'));assert.ok(!d.lamp.discarded.includes('Huun'));assert.throws(()=>equipLampItem(d,'Falie','Huun'),/no longer/);assert.throws(()=>equipLampItem(d,'Huun','new'),/no longer/);validateLampEconomy(d);
});
test('confirmed dismantling consumes its displayed pieces and preserves later raw arrivals',()=>{
 const d=createLampEconomy(2);activateLamp(d,{},0);const id=d.lamp.pending[0];equipLampItem(d,'Falie',id,createHeroProgressStore().heroes.Falie);d.items.find(i=>i.instanceId===id).stats={ATK:1000,DEF:1000,MAG:1000,RES:1000,HP:1000};for(const type of ['hat','body','boots'])if(!d.loadouts.Falie[type]){const i={...d.items[0],instanceId:'strong:'+type,type};d.items.push(i);d.loadouts.Falie[type]=i.instanceId;}activateLamp(d,{},2000);finishLampReview(d);const expected=preview(d);activateLamp(d,{},4000);const arrival=d.lamp.pending.at(-1);
 assert.throws(()=>dismantleLampItems(d,expected),/Current heroes are required/);
 const result=dismantleLampItems(d,expected,[createHeroProgressStore().heroes.Falie]);assert.equal(result.count,1);assert.deepEqual(d.lamp.pending,[arrival]);assert.ok(d.items.some(i=>i.instanceId===id));assert.ok(d.items.some(i=>i.instanceId===arrival));validateLampEconomy(d);
 const before=JSON.stringify(d);assert.throws(()=>dismantleLampItems(d,expected,[createHeroProgressStore().heroes.Falie]),/changed/);assert.equal(JSON.stringify(d),before);
});
test('salvage Essence is bounded per item',()=>{
 for(let n=0;n<1000;n++)assert.ok(salvageValue(generateLampItem(7,n,0))<=5);
});
test('free generation and reload preserve rolls, pending items and assignment',async()=>{
 const f=fixture();await f.store.sync();assert.equal(f.globals.goldTotal,0);await f.store.generate({region:2,stage:1});const id=f.store.data.lamp.pending[0];await f.store.equip('Falie',id);
 const globals={goldTotal:0,HeroProgress:createHeroProgressStore()};const next=createEquipmentStorage({globals,storage:f.storage,locks:f.locks,seed:()=>999,now:()=>10000});await next.sync();assert.equal(globals.goldTotal,0);assert.equal(next.data.lamp.seed,42);assert.equal(next.data.loadouts.Falie[next.data.items[0].type],id);
});
test('failed durable writes never spend, display a rolled item, or mutate runtime stats',async()=>{
 const f=fixture();await f.store.sync();f.setFail(true);await assert.rejects(f.store.generate({}),/disk full/);assert.equal(f.globals.goldTotal,0);assert.equal(f.store.data.items.length,0);assert.equal(JSON.parse(f.values.get(EQUIPMENT_SAVE_KEY)).gold,0);
});
test('concurrent Auto calls produce one item per interval and no background catch-up burst',async()=>{
 const f=fixture();await f.store.sync();for(const hero of Object.values(f.globals.HeroProgress.heroes))hero.currentLevel=5;for(let n=0;n<6;n++){f.setClock(f.store.time()+2000);await f.store.generate({});}f.setClock(f.store.time()+5000);
 const results=await Promise.all([f.store.tickConveyor({}),f.store.tickConveyor({})]);assert.equal(results.filter(Boolean).length,1);assert.equal(f.store.data.lamp.sequence,7);f.setClock(999999);await f.store.tickConveyor({});assert.equal(f.store.data.lamp.sequence,8);
});
test('same item cannot be equipped twice under concurrent clicks',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const id=f.store.data.lamp.pending[0];const r=await Promise.allSettled([f.store.equip('Falie',id),f.store.equip('Huun',id)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);validateLampEconomy(f.store.data);
});
test('equipping raises canonical stats but cannot heal or revive',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const hero=f.globals.HeroProgress.heroes.Falie;hero.hp=0;await f.store.equip('Falie',f.store.data.lamp.pending[0]);assert.equal(hero.hp,0);assert.ok(Object.keys(hero.equipmentStats).length);hero.hp=1;await f.store.refresh();assert.equal(hero.hp,1);
});
test('legacy migration preserves Gold and supported equipped stats; surplus salvages once',async()=>{
 const old={version:1,gold:50,market:{seed:1,epoch:0,lastSeen:0},items:[{instanceId:'hat',equipmentId:'warden-helm'},{instanceId:'sword',equipmentId:'iron-sword'}],loadouts:{Falie:{head:'hat',weapon:'sword'}},settledGoldRewards:['receipt']};
 const raw=JSON.stringify(old),f=fixture({'wishfire.equipment-economy.v1':raw});await f.store.sync();assert.equal(f.store.data.loadouts.Falie.hat,'hat');assert.deepEqual(f.store.data.items[0].stats,{ATK:0,DEF:3,MAG:0,RES:1,HP:0});assert.equal(f.globals.goldTotal,51);assert.deepEqual(f.store.data.settledGoldRewards,['receipt']);assert.equal(f.values.get('wishfire.equipment-economy.v1'),raw);await f.store.refresh();assert.equal(f.globals.goldTotal,51);
});
test('malformed legacy and v2 saves are preserved rather than reset',async()=>{
 for(const[key,raw]of [['wishfire.equipment-economy.v1','{"version":1,"gold":10}'],[EQUIPMENT_SAVE_KEY,'{"version":2,"gold":10}']]){const f=fixture({[key]:raw});await assert.rejects(f.store.sync());assert.equal(f.values.get(key),raw);assert.equal(f.store.data,undefined);}
 assert.throws(()=>migrateLegacyEquipment({version:1,gold:0,items:[],loadouts:{}},3));
});
test('pending Gold receipt replay remains idempotent across equipment reload',async()=>{
 const f=fixture();f.globals.goldTotal=17;f.globals.PendingGoldSettlements={battle:17};await f.store.sync();assert.equal(f.globals.goldTotal,17);assert.deepEqual(f.store.data.settledGoldRewards,['battle']);
 const globals={goldTotal:17,PendingGoldSettlements:{battle:17},HeroProgress:createHeroProgressStore()};const next=createEquipmentStorage({globals,storage:f.storage,locks:f.locks});await next.sync();assert.equal(globals.goldTotal,17);assert.deepEqual(globals.PendingGoldSettlements,{});
});
test('corrupt ownership, duplicate assignments and unsupported stats fail validation',()=>{
 const d=createLampEconomy(1);activateLamp(d,{},0);const duplicate=structuredClone(d);duplicate.lamp.pending.push(duplicate.lamp.pending[0]);assert.throws(()=>validateLampEconomy(duplicate));const invalid=structuredClone(d);invalid.items[0].stats.FLOW=1;assert.throws(()=>validateLampEconomy(invalid));
});

test('native victories cannot grant idle Gold or hero EXP',async()=>{
 const h=await import('../web-runner/src/core/heroProgression.mjs');const {rulesContext,settleVictory}=await import('../web-runner/modules/heroCommands.mjs');const hero=h.newHeroProgress('Falie');hero.kind='hero';hero.uid=100;
 const g={goldTotal:5,HeroProgress:h.createHeroProgressStore(),ProgressionBattle:{id:'gold-test',participants:['Falie'],defeated:{}},NativeBattleEnded:true};
 const ctx={state:{globals:g,entities:[hero]},callFunction:()=>{}};const rules=rulesContext(ctx);rules.onKO({kind:'enemy',uid:1,expValue:10,goldValue:17});rules.onKO({kind:'enemy',uid:2,expValue:20});
 settleVictory(ctx);settleVictory(ctx);assert.equal(g.goldTotal,5);assert.equal(hero.currentEXP,0);assert.equal(g.ProgressionBattle.goldReward,0);
});

test('draft saves keep identity, Gold and assigned gear while dropping retired SPD stats',async()=>{
 const old=createLampEconomy(42,10);activateLamp(old,{},0);old.version=2;old.items[0].stats={MAG:7,RES:2,SPD:3};old.loadouts.Runa={[old.items[0].type]:old.items[0].instanceId};old.lamp.pending=[];
 const raw=JSON.stringify(old),f=fixture({'wishfire.equipment-economy.v2':raw});await f.store.sync();
 assert.equal(f.store.data.gold,old.gold);assert.equal(f.store.data.items[0].stats.MAG,7);assert.deepEqual(Object.keys(f.store.data.items[0].stats),['ATK','DEF','MAG','RES','HP']);assert.equal(f.values.get('wishfire.equipment-economy.v2'),raw);assert.equal(f.store.data.loadouts.Runa[old.items[0].type],old.items[0].instanceId);
});

test('Auto Equip chooses greatest actual CP gain, then lowest total hero CP, then party order',()=>{
 const data=createLampEconomy(1),baseHero=Object.values(createHeroProgressStore().heroes)[0],h1={...baseHero,heroInstanceKey:'H1'},h2={...baseHero,heroInstanceKey:'H2'};
 const candidate={instanceId:'candidate',type:'body',stats:{ATK:1000,DEF:1000,MAG:1000,RES:1000,HP:1000}},bodyLow={instanceId:'body-low',type:'body',stats:{ATK:1,DEF:1,MAG:1,RES:1,HP:1}},bodyHigh={...bodyLow,instanceId:'body-high',stats:{ATK:20,DEF:20,MAG:20,RES:20,HP:20}},hatBoost={instanceId:'hat-boost',type:'hat',stats:{ATK:500,DEF:500,MAG:500,RES:500,HP:500}};
 data.items=[candidate,bodyLow,bodyHigh,hatBoost];data.lamp.pending=['candidate'];data.loadouts[h1.heroInstanceKey]={body:'body-low',hat:'hat-boost'};data.loadouts[h2.heroInstanceKey]={body:'body-high'};
 assert.equal(selectAutoEquipHero(data,candidate,[h1,h2]),h1.heroInstanceKey,'slot CP wins before total hero CP');
 data.items.push({...bodyLow,instanceId:'body-tie'});data.loadouts[h1.heroInstanceKey]={body:'body-tie'};data.loadouts[h2.heroInstanceKey]={body:'body-tie'};h1.kit={control:100};assert.equal(lampItemCPGain(data,candidate,h1),lampItemCPGain(data,candidate,h2));
 assert.equal(selectAutoEquipHero(data,candidate,[h1,h2]),h2.heroInstanceKey,'equal slot CP favors lower total hero CP');
 h1.kit=undefined;data.loadouts[h1.heroInstanceKey]={body:'body-tie'};delete data.loadouts[h1.heroInstanceKey].hat;data.loadouts[h2.heroInstanceKey]={body:'body-tie'};
 assert.equal(selectAutoEquipHero(data,candidate,[h1,h2]),h1.heroInstanceKey,'full tie follows party order');
 assert.equal(selectAutoEquipHero(data,candidate,[h2,h1]),h2.heroInstanceKey,'party order remains the final tie-break');
 const bodyMax={...candidate,instanceId:'body-max'};data.items.push(bodyMax);data.loadouts[h1.heroInstanceKey].body='body-max';data.loadouts[h2.heroInstanceKey].body='body-max';const snapshot=JSON.stringify(data);assert.equal(selectAutoEquipHero(data,candidate,[h1,h2]),null);assert.equal(JSON.stringify(data),snapshot);
 assert.equal(selectAutoEquipHero(data,candidate,[]),null);
});

test('Auto recomputes actual hero CP after gear changes and accepts +0.1',()=>{
 const hero=createHeroProgressStore().heroes.Falie,data=createLampEconomy(1),current={instanceId:'cur',type:'hat',stats:{ATK:0,DEF:0,MAG:200,RES:0,HP:0}},hat={instanceId:'hat-up',type:'hat',stats:{ATK:0,DEF:200,MAG:0,RES:200,HP:2000}},body={instanceId:'body-up',type:'body',stats:{ATK:10,DEF:0,MAG:0,RES:0,HP:0}};
 data.items=[current,hat,body];data.loadouts.Falie={hat:'cur'};data.lamp.pending=['body-up','hat-up'];assert.equal(lampItemCPGain(data,body,hero),0);assert.ok(lampItemCPGain(data,hat,hero)>0);
 const plan=planLampAutoEquip(data,[hero]);assert.equal(plan.loadouts.Falie.hat,'hat-up');assert.equal(plan.loadouts.Falie.body,'body-up');
 const tiny={...createLampEconomy(1),items:[{instanceId:'current',type:'body',stats:{ATK:38,DEF:55,MAG:33,RES:82,HP:78}},{instanceId:'tiny',type:'body',stats:{ATK:79,DEF:47,MAG:76,RES:23,HP:85}}],loadouts:{Falie:{body:'current'}}};tiny.lamp.pending=['tiny'];const gain=lampItemCPGain(tiny,tiny.items[1],hero);assert.equal(gain,0.1);assert.equal(lampReviewCandidates(tiny,[hero])[0].bestGain,0.1);assert.equal(planLampAutoEquip(tiny,[hero]).loadouts.Falie.body,'tiny');
});

test('four-stat saves migrate once without rerolling items; equip fills gained max HP and reports actual CP',async()=>{
 const old=createLampEconomy(42,1000);old.version=3;activateLamp(old,{},0);for(const i of old.items)delete i.stats.HP;
 const raw=JSON.stringify(old),f=fixture({'wishfire.equipment-economy.v3':raw});await f.store.sync();assert.equal(f.store.data.version,5);assert.equal(f.store.data.items[0].stats.HP,0);assert.equal(f.values.get('wishfire.equipment-economy.v3'),raw);assert.equal(f.store.data.gold,old.gold);
 f.setClock(2000);await f.store.generate({});const hero=f.globals.HeroProgress.heroes.Falie,hp=hero.hp,maxHP=hero.maxHP;
 const result=await f.store.equip('Falie',f.store.data.lamp.pending.at(-1));assert.ok(hero.maxHP>maxHP);assert.equal(hero.hp,Math.min(hero.maxHP,hp+hero.maxHP-maxHP));assert.equal(result.cpAfter,hero.combatPower);assert.equal(result.cpChange,Math.round((result.cpAfter-result.cpBefore)*10)/10);
});

test('manual and AUTO draws never grant new EXP; full cache continues issuing gear',async()=>{
 const f=fixture();await f.store.sync();
 await f.store.generate({});assert.equal(f.store.data.partyEXP,0);assert.ok(Object.values(f.globals.HeroProgress.heroes).every(h=>h.currentEXP===0));
 await f.store.equip('Falie',f.store.data.lamp.pending[0]);assert.equal(f.store.data.partyEXP,0);
 await f.store.sync();assert.ok(Object.values(f.globals.HeroProgress.heroes).every(h=>h.currentEXP===0));
 const recovered={goldTotal:0,HeroProgress:createHeroProgressStore()};const reload=createEquipmentStorage({globals:recovered,storage:f.storage,locks:f.locks});await reload.sync();assert.ok(Object.values(recovered.HeroProgress.heroes).every(h=>h.currentEXP===0));
 const saved=createHeroProgressStore(JSON.parse(JSON.stringify(recovered.HeroProgress)));const again={goldTotal:0,HeroProgress:saved};const second=createEquipmentStorage({globals:again,storage:f.storage,locks:f.locks});await second.sync();assert.ok(Object.values(again.HeroProgress.heroes).every(h=>h.currentEXP===0));
 for(const hero of Object.values(f.globals.HeroProgress.heroes))hero.currentLevel=5;
 while(lampStoredCount(f.store.data)<LAMP_CONFIG.capacity){f.setClock(f.store.time()+5000);await f.store.tickConveyor({});}
 assert.equal(f.store.data.lamp.autoEnabled,false);const exp=f.store.data.partyEXP;f.setClock(f.store.time()+5000);assert.equal((await f.store.tickConveyor({})).rewardEXP,0);assert.equal(f.store.data.partyEXP,exp);
 const restarted=createEquipmentStorage({globals:f.globals,storage:f.storage,locks:f.locks,reportError:()=>{}});await restarted.sync();assert.equal(restarted.data.lamp.autoEnabled,false,'first reload sync preserves the saved Auto preference at capacity');
 assert.equal(restarted.data.lamp.autoEnabled,false);const unsaved=await restarted.generate({});assert.equal(unsaved.rewardEXP,0);assert.equal(restarted.data.partyEXP,exp);
 await f.store.autoEquip();await f.store.dismantle(f.store.disposalPreview());assert.equal(f.store.data.partyEXP,exp);
 assert.equal(f.store.data.partyEXP,exp);assert.equal(f.store.data.lamp.autoEnabled,false);assert.equal(lampStoredCount(f.store.data),0);
});

test('full-cache legacy migrations retain an enabled Auto preference',()=>{
 const full=createLampEconomy(77);
 for(let n=0;n<LAMP_CONFIG.capacity;n++)activateLamp(full,{},n*LAMP_CONFIG.minEmissionIntervalMs);
 full.lamp.autoEnabled=true;
 const versionFour=structuredClone(full);versionFour.version=4;delete versionFour.partyEXP;
 const versionThree=structuredClone(versionFour);versionThree.version=3;for(const item of versionThree.items)delete item.stats.HP;
 const versionTwo=structuredClone(versionFour);versionTwo.version=2;for(const item of versionTwo.items)item.stats={ATK:item.stats.ATK,DEF:item.stats.DEF,MAG:item.stats.MAG,RES:item.stats.RES,HP:item.stats.HP,SPD:0};
 for(const migrated of [migrateLampEconomy(versionFour),migrateFourStatLamp(versionThree),migrateDraftLamp(versionTwo)]){
  assert.equal(migrated.lamp.pending.length,LAMP_CONFIG.capacity);
  assert.equal(migrated.lamp.autoEnabled,true);
 }
});

test('dismantling essence buys saved capacity upgrades; upgrade never grants EXP or resumes Auto',async()=>{
 const initial=createLampEconomy(42);for(const hero of Object.values(createHeroProgressStore().heroes))for(const type of ['hat','body','boots']){const base=GEAR_ARCHETYPES.find(entry=>entry.type===type),id='strong:'+hero.heroInstanceKey+':'+type;initial.items.push({...base,instanceId:id,rarity:'common',level:1,sequence:0,ordinal:0,stats:{ATK:10000,DEF:10000,MAG:10000,RES:10000,HP:10000}});(initial.loadouts[hero.heroInstanceKey]||={})[type]=id;}
 const f=fixture({[EQUIPMENT_SAVE_KEY]:JSON.stringify(initial)});await f.store.sync();await assert.rejects(f.store.purchaseStage(),/essence/);
 while(f.store.data.lamp.essence<LAMP_CAPACITY_TIERS[0].cost){for(let i=0;i<LAMP_CONFIG.capacity;i++){f.setClock(f.store.time()+2000);await f.store.generate({});}await f.store.dismantle(preview(f.store.data));}const exp=f.store.data.partyEXP;
 for(let stage=0;stage<4;stage++)await f.store.purchaseStage(0,stage);
 assert.equal(f.store.data.lamp.capacityTier,0);f.setClock(f.store.data.lamp.upgradeEndsAt);await f.store.sync();assert.equal(f.store.data.lamp.capacityTier,1);assert.equal(f.store.data.partyEXP,exp);assert.equal(f.store.data.lamp.autoEnabled,false);
 for(let i=0;i<30;i++){f.setClock(f.store.time()+2000);await f.store.generate({});}f.setClock(f.store.time()+2000);assert.equal((await f.store.generate({})).rewardEXP,0);assert.equal(lampStoredCount(f.store.data),30);validateLampEconomy(f.store.data);
 const next=createEquipmentStorage({globals:{goldTotal:0,HeroProgress:createHeroProgressStore()},storage:f.storage,locks:f.locks});await next.sync();assert.equal(next.data.lamp.capacityTier,1);
});

test('manual and Auto both reject CP-decreasing replacements',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const data=structuredClone(f.store.data),candidate=data.items[0];
 for(const hero of Object.values(f.globals.HeroProgress.heroes)){const current={...candidate,instanceId:'strong:'+hero.heroInstanceKey,stats:Object.fromEntries(Object.keys(candidate.stats).map(k=>[k,candidate.stats[k]+100]))};data.items.push(current);data.loadouts[hero.heroInstanceKey]={[candidate.type]:current.instanceId};}
 f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.refresh();const before=f.values.get(EQUIPMENT_SAVE_KEY);await assert.rejects(f.store.equip('Falie',candidate.instanceId),/does not increase/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),before);
 const auto=await f.store.autoEquip();assert.equal(auto.length,0);assert.equal(f.store.data.loadouts.Falie[candidate.type],'strong:Falie');assert.ok(f.store.data.items.some(i=>i.instanceId==='strong:Falie'));
});

test('weaker gear stays visible through refresh until explicit resource conversion',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const data=structuredClone(f.store.data),candidate=data.items[0];
 for(const h of Object.values(f.globals.HeroProgress.heroes)){const owned={...candidate,instanceId:'owned:'+h.heroInstanceKey,stats:Object.fromEntries(Object.keys(candidate.stats).map(k=>[k,1000]))};data.items.push(owned);data.loadouts[h.heroInstanceKey]={[candidate.type]:owned.instanceId};}
 f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.refresh();
 assert.deepEqual(f.store.data.items,data.items);assert.deepEqual(f.store.data.lamp.pending,[]);assert.deepEqual(f.store.data.lamp.discarded,[candidate.instanceId]);assert.equal(f.store.data.lamp.essence,0);
 await f.store.refresh();assert.deepEqual(f.store.data.items,data.items);
 const exp=f.store.data.partyEXP,saved=f.values.get(EQUIPMENT_SAVE_KEY);f.setFail(true);await assert.rejects(f.store.dismantle(preview(f.store.data)),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);f.setFail(false);const result=await f.store.dismantle(preview(f.store.data));assert.equal(result.count,1);assert.equal(f.store.data.lamp.essence,result.essence);assert.equal(f.store.data.partyEXP,exp);assert.equal(f.store.data.items.length,4);
});

test('full cache emits unsaved gear and resumes collection after confirmed disposal',async()=>{
 const f=fixture(),data=createLampEconomy(42);
 for(const hero of Object.values(f.globals.HeroProgress.heroes)){hero.currentLevel=5;for(const type of ['hat','body','boots']){const owned={...generateLampItem(42,0,0),instanceId:hero.heroInstanceKey+':'+type,type,stats:{ATK:1000,DEF:1000,MAG:1000,RES:1000,HP:1000}};data.items.push(owned);(data.loadouts[hero.heroInstanceKey]||={})[type]=owned.instanceId;}}
 f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.sync();
 for(let n=0;n<LAMP_CONFIG.capacity;n++){f.setClock(f.store.time()+5000);await f.store.tickConveyor({});}
 assert.equal(f.store.data.lamp.discarded.length,LAMP_CONFIG.capacity);assert.equal(f.store.data.items.length,12+LAMP_CONFIG.capacity);assert.equal(f.store.data.lamp.salvage.count,0);assert.equal(f.store.data.lamp.autoEnabled,false);const exp=f.store.data.partyEXP;
 f.setClock(f.store.time()+5000);assert.equal((await f.store.tickConveyor({})).rewardEXP,0);assert.equal(f.store.data.partyEXP,exp);f.setClock(f.store.time()+2000);assert.equal((await f.store.generate({})).rewardEXP,0);
 await f.store.dismantle(preview(f.store.data));assert.equal(lampStoredCount(f.store.data),0);assert.equal(f.store.data.lamp.autoEnabled,false);
 f.setClock(f.store.time()+5000);const resumed=await f.store.tickConveyor({});assert.ok(resumed);assert.equal(f.store.data.lamp.discarded.length,1);assert.equal(f.store.data.lamp.autoEnabled,false);assert.equal(f.store.data.partyEXP,exp+LAMP_CONFIG.drawEXP);
 assert.equal(f.store.data.lamp.autoEnabled,false,'legacy Auto preference is inert');
});

test('ordinary first hero KO restores the squad with equipment unchanged',async()=>{
 const {createQuestCombatSession,recoverContinuousOrdinaryDefeatIfNeeded}=await import('../web-runner/systems/questCombatSession.mjs');
 const f=fixture(),heroes=Object.values(f.globals.HeroProgress.heroes);
 heroes.forEach((hero,index)=>Object.assign(hero,{kind:'hero',uid:index+1,maxHP:42,hp:index===0?0:24,isAlive:index!==0,currentLevel:5}));
 f.globals.ContinuousCombatStageLoop=1;
 f.globals.ContinuousCombatStage={seed:42,region:1,stage:1,wave:2,bossAvailable:false,bossArmed:false,bossActive:false,transitions:1,clearedBosses:0,clearedPackMask:0,spawnedPackMask:0,nextEmissionAt:0,lastUpdatedAt:0,spawnSerial:0};
 f.globals.EnemyData=[];f.globals.time=20;
 await f.store.sync();
 const state={globals:f.globals,entities:heroes},gameState={};
 const session=createQuestCombatSession({state,gameState,call(){},sync:()=>f.store.sync()});
 const equipmentBefore=JSON.stringify(f.store.data.items);
 assert.equal(recoverContinuousOrdinaryDefeatIfNeeded({state,session}),true,'the first hero KO reaches the recovery owner');
 assert.deepEqual(heroes.map(hero=>hero.hp),[42,42,42,42]);
 assert.ok(heroes.every(hero=>hero.isAlive));
 assert.equal(f.store.data.lamp.autoEnabled,false);
 await f.store.sync();
 assert.equal(JSON.stringify(f.store.data.items),equipmentBefore);
 assert.equal(JSON.parse(f.values.get(EQUIPMENT_SAVE_KEY)).lamp.autoEnabled,false,'the ordinary recovery checkpoint retains enabled Auto');
 const reloaded=createEquipmentStorage({globals:f.globals,storage:f.storage,locks:f.locks,reportError:()=>{}});
 await reloaded.sync();assert.equal(reloaded.data.lamp.autoEnabled,false,'recovery does not need a persisted emission toggle');
});

test('persisted two-second emission gate rejects spam, reload bypass and mixed manual/Auto draws',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const first=structuredClone(f.store.data),saved=f.values.get(EQUIPMENT_SAVE_KEY);
 const spam=await Promise.allSettled([f.store.generate({}),f.store.generate({})]);assert.ok(spam.every(r=>r.status==='rejected'));assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);
 const reload=createEquipmentStorage({globals:f.globals,storage:f.storage,locks:f.locks,now:()=>first.lamp.lastActivationAt+1999});await reload.sync();await assert.rejects(reload.generate({}),/preparing/);assert.equal(reload.data.lamp.sequence,1);assert.equal(reload.data.partyEXP,0);
 f.setClock(first.lamp.lastActivationAt+2000);const edge=await Promise.allSettled([f.store.generate({}),f.store.generate({})]);assert.equal(edge.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.store.data.lamp.sequence,2);
 for(const hero of Object.values(f.globals.HeroProgress.heroes))hero.currentLevel=5;
 f.setClock(f.store.time()+1999);assert.equal(await f.store.tickConveyor({}),null);await assert.rejects(f.store.generate({}),/preparing/);
 f.setClock(f.store.time()+3001);await f.store.tickConveyor({});assert.equal(f.store.data.lamp.sequence,3);await assert.rejects(f.store.generate({}),/preparing/);
});

test('essence-funded lamp levels apply increasing rarity odds and preserve existing rolls',()=>{
 let previousMean=-1;
 for(const [tierIndex,tier]of LAMP_CAPACITY_TIERS.entries()){
  assert.ok(Math.abs(Object.values(tier.rarityWeights).reduce((a,b)=>a+b,0)-100)<1e-8);
  const mean=Object.values(tier.rarityWeights).reduce((total,weight,index)=>total+weight*index,0);assert.ok(mean>previousMean);previousMean=mean;
  const found=new Set();for(let seed=0;seed<1000;seed++){const data=createLampEconomy(seed);data.lamp.capacityTier=tierIndex;const item=activateLamp(data,{},0);assert.deepEqual(item,generateLampItem(seed,0,0,tier.rarityWeights));assert.ok(tier.rarityWeights[item.rarity]>0);found.add(item.rarity);}
  assert.ok(found.has('common')&&found.has('uncommon'),'seeded sample covers ordinary qualities');
 }
 const data=createLampEconomy(42);activateLamp(data,{},0);const original=structuredClone(data.items);data.lamp.essence=LAMP_CAPACITY_TIERS[0].cost;for(let stage=0;stage<4;stage++)purchaseLampStage(data,0,stage,1000);completeLampUpgrade(data,data.lamp.upgradeEndsAt);assert.deepEqual(data.items,original);assert.equal(data.partyEXP,0);
});

test('manual equip saves immediately and permanently removes replaced gear',async()=>{
 const f=fixture(),data=createLampEconomy(42),candidate={...generateLampItem(42,0,0),instanceId:'new'},old={...candidate,instanceId:'old',stats:Object.fromEntries(Object.entries(candidate.stats).map(([k,v])=>[k,Math.max(1,v-1)]))};
 data.items=[candidate,old];data.lamp.pending=['new'];data.loadouts.Falie={[old.type]:'old'};f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.sync();
 await f.store.equip('Falie','new');assert.equal(f.store.data.loadouts.Falie[old.type],'new');assert.equal(f.store.data.items.some(i=>i.instanceId==='old'),false);assert.deepEqual(f.store.data.lamp.discarded,[]);assert.equal(f.store.data.lamp.essence,0);assert.equal(lampStoredCount(f.store.data),0);
 await f.store.refresh();const saved=f.values.get(EQUIPMENT_SAVE_KEY);f.setFail(true);await assert.rejects(f.store.equip('Huun','old'),/Item missing/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);assert.equal(f.store.data.items.some(i=>i.instanceId==='old'),false);f.setFail(false);validateLampEconomy(f.store.data);
});

test('Auto fills all twelve hero slots with unique gear while preserving emission order and unused cache',async()=>{
 const f=fixture(),data=createLampEconomy(42),heroes=Object.values(f.globals.HeroProgress.heroes);
 for(const hero of heroes)for(const type of ['hat','body','boots']){const base=GEAR_ARCHETYPES.find(entry=>entry.type===type),id='old:'+hero.heroInstanceKey+':'+type;data.items.push({...base,instanceId:id,rarity:'common',level:1,sequence:0,ordinal:0,stats:{ATK:1,DEF:1,MAG:1,RES:1,HP:1}});(data.loadouts[hero.heroInstanceKey]||={})[type]=id;}
 for(let index=0;index<13;index++){const type=['hat','body','boots'][index%3],base=GEAR_ARCHETYPES.find(entry=>entry.type===type);data.items.push({...base,instanceId:'new:'+index,rarity:'common',level:1,sequence:index,ordinal:0,stats:{ATK:20,DEF:20,MAG:20,RES:20,HP:20}});data.lamp.pending.push('new:'+index);}
 const order=[...data.lamp.pending],recent=structuredClone(data.lamp.recent),sorted=sortedLampItems(data);assert.ok(sorted.every((item,n)=>!n||sorted[n-1].rarity!==item.rarity||lampGearCP(sorted[n-1])>=lampGearCP(item)));assert.deepEqual(data.lamp.pending,order);
 f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.sync();const exp=f.store.data.partyEXP,results=await f.store.autoEquip();
 assert.ok(results.length>0&&results.length<=4);assert.equal(new Set(results.map(result=>result.heroId)).size,results.length);assert.equal(results.reduce((sum,result)=>sum+result.slots.length,0),12);assert.ok(results.every(result=>result.cpChange>0));
 const equipped=Object.values(f.store.data.loadouts).flatMap(slots=>Object.values(slots));assert.equal(new Set(equipped).size,12);assert.ok(equipped.every(id=>id.startsWith('new:')));assert.deepEqual(f.store.data.lamp.pending,[]);assert.deepEqual(f.store.data.lamp.discarded,['new:12']);assert.deepEqual(f.store.data.lamp.recent,recent);assert.equal(f.store.data.partyEXP,exp);assert.equal(f.store.data.items.length,13);validateLampEconomy(f.store.data);
});
test('Auto planner exhausts positive gains in the 50-item cache without mutating its source',()=>{
 const data=createLampEconomy(42);data.lamp.capacityTier=3;for(let index=0;index<50;index++)activateLamp(data,{},index*2000);validateLampEconomy(data);
 const heroes=Object.values(createHeroProgressStore().heroes),plan=planLampAutoEquip(data,heroes),projected={...data,items:plan.items,loadouts:plan.loadouts,lamp:{...data.lamp,pending:plan.pending,discarded:plan.discarded}};
 assert.ok(plan.changes.reduce((sum,change)=>sum+change.slots.length,0)<=12);const equipped=Object.values(plan.loadouts).flatMap(slots=>Object.values(slots));assert.equal(new Set(equipped).size,equipped.length);assert.equal(lampReviewCandidates(projected,heroes).filter(candidate=>candidate.bestGain>0).length,0);assert.equal(data.lamp.pending.length,50,'planning leaves the source cache untouched');
});
test('explicit dismantle rejects positive upgrades and preserves the cache',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const saved=f.values.get(EQUIPMENT_SAVE_KEY);
 await assert.rejects(f.store.dismantle(preview(f.store.data)),/still improves/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);assert.equal(f.store.data.lamp.essence,0);
});


test('earned batch Auto Equip uses actual hero CP gains and preserves accurate receipts',async()=>{
 const captured=JSON.parse(readFileSync(new URL('./fixtures/lamp-auto-earned-69.json',import.meta.url)));
 const data=structuredClone(captured.economy),heroes=Object.values(captured.heroes.heroes).slice(0,4);
 const eligible=sortedLampItems(data).filter(i=>heroes.some(h=>lampItemCPGain(data,i,h)>0));
 assert.equal(eligible.length,21);
 assert.deepEqual(new Set(selectLampUpgrades(data,heroes).map(i=>i.instanceId)),new Set(eligible.map(i=>i.instanceId)));
 const f=fixture({[EQUIPMENT_SAVE_KEY]:JSON.stringify(data)});f.globals.HeroProgress=structuredClone(captured.heroes);await f.store.sync();
 const exp=data.partyEXP,progress=heroes.map(h=>[h.currentLevel,h.currentEXP,h.lampEXPClaimed]);
 const reverse=structuredClone(data);reverse.lamp.pending.reverse();assert.deepEqual(planLampAutoEquip(data,heroes).loadouts,planLampAutoEquip(reverse,heroes).loadouts);
 const beforeFailure=JSON.stringify(f.store.data);f.setFail(true);await assert.rejects(f.store.autoEquip(),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),beforeFailure);assert.equal(JSON.stringify(f.store.data),beforeFailure);f.setFail(false);
 const receipts=await f.store.autoEquip();assert.ok(receipts.length>0&&receipts.length<=4);
 assert.equal(new Set(receipts.map(r=>r.heroId)).size,receipts.length);assert.ok(receipts.every(receipt=>receipt.slots.length>0&&receipt.items.length===receipt.slots.length));
 for(const receipt of receipts){const hero=heroes.find(h=>h.heroInstanceKey===receipt.heroId);assert.equal(Math.round((receipt.cpAfter-receipt.cpBefore)*10)/10,receipt.cpChange);assert.ok(receipt.slots.every((slot,index)=>f.store.data.loadouts[receipt.heroId][slot]===receipt.items[index].instanceId));assert.ok(hero);}
 const totalBefore=heroes.reduce((sum,hero)=>sum+computeCombatPower(hero),0),totalAfter=Object.values(f.globals.HeroProgress.heroes).slice(0,4).reduce((sum,hero)=>sum+computeCombatPower(hero),0);assert.ok(totalAfter>totalBefore);
 assert.equal(f.store.data.partyEXP,exp);assert.deepEqual(Object.values(f.globals.HeroProgress.heroes).slice(0,4).map(h=>[h.currentLevel,h.currentEXP,h.lampEXPClaimed]),progress);assert.equal(f.store.data.lamp.pending.length,0);assert.ok(f.store.data.lamp.discarded.length>0);assert.ok(lampReviewCandidates(f.store.data,Object.values(f.globals.HeroProgress.heroes).slice(0,4)).every(candidate=>candidate.queue==='discarded'&&candidate.bestGain<=0));
});

test('long lamp curve uses exact four-installment costs and fractional rarity changes',()=>{
 const data=createLampEconomy(42);let total=0;
 for(let tier=0;tier<LAMP_CONFIG.lampLevels-1;tier++){
  data.lamp.essence=LAMP_CAPACITY_TIERS[tier].cost;const original=data.lamp.essence;
  for(let stage=0;stage<4;stage++){assert.ok(lampStageCost(data)>0);purchaseLampStage(data,tier,stage,1000);assert.equal(data.lamp.capacityTier,tier);}
  assert.equal(data.lamp.essence,0);total+=original;assert.equal(data.lamp.capacityTier,tier);completeLampUpgrade(data,data.lamp.upgradeEndsAt);assert.equal(data.lamp.upgradeStage,0);
  for(const key of Object.keys(RARITIES))assert.ok(Math.abs(LAMP_CAPACITY_TIERS[tier+1].rarityWeights[key]-LAMP_CAPACITY_TIERS[tier].rarityWeights[key])<.56);
 }
 assert.equal(data.lamp.capacityTier,99);assert.equal(total,138029955534);
 assert.equal(1+LAMP_CONFIG.maxOrdinal*LAMP_CONFIG.mapStatGrowth,5.95);
});


test('lamp capacity accelerates through all levels and each paid notch scales geometrically',()=>{
 assert.deepEqual(LAMP_CAPACITY_TIERS.slice(0,5).map(tier=>tier.capacity),[20,30,48,72,100]);

 for(let n=0;n<LAMP_CAPACITY_TIERS.length;n++){
  const tier=LAMP_CAPACITY_TIERS[n];assert.ok(Number.isSafeInteger(tier.capacity));
  if(n){const gain=tier.capacity-LAMP_CAPACITY_TIERS[n-1].capacity;assert.ok(gain>0);}
  const data=createLampEconomy(7);data.lamp.capacityTier=n;data.lamp.essence=tier.cost||0;
  if(n===99){assert.equal(lampStageCost(data),0);continue;}
  const costs=[];for(let stage=0;stage<4;stage++){costs.push(lampStageCost(data));purchaseLampStage(data,n,stage,1000);}
  assert.equal(costs.reduce((a,b)=>a+b,0),tier.cost);assert.equal(data.lamp.essence,0);
  assert.equal(data.lamp.upgradeEndsAt,1000+7*60*60*1000);
  if(n)assert.ok(costs.every(cost=>cost>Math.ceil(LAMP_CAPACITY_TIERS[n-1].cost/4)));
 }
 const blockGains=[0,10,20,30,40,50,60,70,80].map(n=>LAMP_CAPACITY_TIERS[n+10].capacity-LAMP_CAPACITY_TIERS[n].capacity);assert.ok(blockGains.every((gain,n)=>!n||gain>blockGains[n-1]));
 const data=createLampEconomy(7);assert.equal(lampStageCost(data),100);data.lamp.capacityTier=1;assert.equal(lampStageCost(data),120);
});

test('cache groups all rarity tiers before descending CP within each tier without mutating saved queues',()=>{
 const data=createLampEconomy(7),base=generateLampItem(7,0,0);
 const rarities=['common','uncommon','rare','epic','legendary'];
 data.items=rarities.flatMap((rarity,index)=>[1,2].map(power=>({...base,instanceId:rarity+power,rarity,sequence:index*2+power,stats:{HP:0,ATK:(5-index)*100+power,DEF:0,MAG:0,RES:0}})));
 data.lamp.pending=data.items.map(item=>item.instanceId);const before=structuredClone(data);
 assert.deepEqual(sortedLampItems(data).map(item=>item.instanceId),[...rarities].reverse().flatMap(rarity=>[rarity+'2',rarity+'1']));
 const hero=Object.values(createHeroProgressStore().heroes)[0],plan=planLampAutoEquip(data,[hero]);
 assert.equal(plan.loadouts[hero.heroInstanceKey][base.type],'common2','Auto Equip still chooses the strongest CP candidate despite its lower display rarity');
 assert.deepEqual(data,before);
});

 test('manual and automatic equip publish matching saved and live hero CP before resolving',async()=>{
 const f=fixture(),actors=Object.values(f.globals.HeroProgress.heroes).map(hero=>({...structuredClone(hero),kind:'hero'}));
 const store=createEquipmentStorage({globals:f.globals,getActors:()=>actors,storage:f.storage,locks:f.locks,now:()=>f.store.time(),seed:()=>42});
 await store.sync();
 const verify=()=>{for(const actor of actors){const hero=f.globals.HeroProgress.heroes[actor.heroInstanceKey];assert.equal(actor.combatPower,computeCombatPower(hero));assert.equal(hero.combatPower,computeCombatPower(hero));assert.deepEqual(actor.stats,hero.stats);assert.equal(actor.maxHP,hero.maxHP);}};
 for(const hero of Object.values(f.globals.HeroProgress.heroes)){f.setClock(f.store.time()+2000);await store.generate();const receipt=await store.equip(hero.heroInstanceKey,store.data.lamp.pending[0]);verify();assert.equal(receipt.cpAfter,computeCombatPower(hero));}
 for(let i=0;i<12;i++){f.setClock(f.store.time()+2000);await store.generate();}
 const receipts=await store.autoEquip();assert.ok(receipts.length);verify();for(const receipt of receipts)assert.equal(receipt.cpAfter,computeCombatPower(f.globals.HeroProgress.heroes[receipt.heroId]));
 });
