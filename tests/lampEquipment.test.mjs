import {RARITIES} from '../web-runner/src/core/equipment.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LAMP_CONFIG,LAMP_CAPACITY_TIERS,generateLampItem,createLampEconomy,activateLamp,lampStoredCount,lampItemCPGain,lampGearCP,sortedLampItems,selectLampUpgrades,finishLampReview,lampStageCost,purchaseLampStage,upgradeLamp,validateLampEconomy,compareLampItem,selectAutoEquipHero,equipLampItem,dismantleLampItems,migrateLegacyEquipment,salvageValue} from '../web-runner/src/core/lampGear.mjs';
import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';
import {createHeroProgressStore} from '../web-runner/src/core/heroProgression.mjs';
const preview=d=>[...d.lamp.pending,...(d.lamp.discarded||[]),'salvage:'+d.lamp.salvage.count+':'+d.lamp.salvage.gold];
function fixture(initial={}){const values=new Map(Object.entries(initial));let fail=false,chain=Promise.resolve(),clock=1000;
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){if(fail)throw Error('disk full');values.set(k,v);}};
 const locks={request:(key,fn)=>{const next=chain.then(fn);chain=next.catch(()=>{});return next;}};
 const globals={goldTotal:0,HeroProgress:createHeroProgressStore()};const store=createEquipmentStorage({globals,storage,locks,seed:()=>42,now:()=>clock,reportError:()=>{}});
 return{values,storage,locks,globals,store,setFail:v=>fail=v,setClock:v=>clock=v};}

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

test('four paid lamp stages persist individually and promotion requires manual confirmation',async()=>{
 const data=createLampEconomy(42);activateLamp(data,{},0);data.lamp.essence=200;
 const f=fixture({[EQUIPMENT_SAVE_KEY]:JSON.stringify(data)});await f.store.sync();
 const heroes=structuredClone(f.globals.HeroProgress.heroes),gear=structuredClone(f.store.data.items),saved=f.values.get(EQUIPMENT_SAVE_KEY);
 await assert.rejects(f.store.upgrade(0),/four upgrade stages/);
 assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved,'bank alone grants no stage or level');
 f.setFail(true);await assert.rejects(f.store.purchaseStage(0,0),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);assert.equal(f.store.data.lamp.essence,200);
 f.setFail(false);const purchases=await Promise.allSettled([f.store.purchaseStage(0,0),f.store.purchaseStage(0,0)]);
 assert.equal(purchases.filter(r=>r.status==='fulfilled').length,1);assert.match(purchases.find(r=>r.status==='rejected').reason.message,/upgrade changed/);
 assert.equal(f.store.data.lamp.essence,195);assert.equal(f.store.data.lamp.upgradeStage,1);assert.equal(f.store.data.lamp.capacityTier,0);
 const restarted=createEquipmentStorage({globals:f.globals,storage:f.storage,locks:f.locks,now:()=>11000,reportError:()=>{}});await restarted.sync();
 assert.equal(restarted.data.lamp.upgradeStage,1);assert.equal(restarted.data.lamp.capacityTier,0);
 for(let stage=1;stage<4;stage++){await restarted.purchaseStage(0,stage);assert.equal(restarted.data.lamp.capacityTier,0);}
 assert.equal(restarted.data.lamp.upgradeStage,4);assert.equal(restarted.data.lamp.essence,180);
 await assert.rejects(restarted.purchaseStage(0,4),/Press Lv.UP/);
 const ready=f.values.get(EQUIPMENT_SAVE_KEY);f.setFail(true);await assert.rejects(restarted.upgrade(0),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),ready);assert.equal(restarted.data.lamp.upgradeStage,4);f.setFail(false);
 const levels=await Promise.allSettled([restarted.upgrade(0),restarted.upgrade(0)]);
 assert.equal(levels.filter(r=>r.status==='fulfilled').length,1);assert.match(levels.find(r=>r.status==='rejected').reason.message,/level changed/);
 assert.equal(restarted.data.lamp.capacityTier,1);assert.equal(restarted.data.lamp.upgradeStage,0);assert.equal(restarted.data.lamp.essence,180);
 assert.deepEqual(restarted.data.items,gear);assert.deepEqual(f.globals.HeroProgress.heroes,heroes);assert.equal(restarted.data.partyEXP,25);
 const poor=fixture();await poor.store.sync();const before=JSON.stringify(poor.store.data);await assert.rejects(poor.store.purchaseStage(0,0),/Need 5 more essence/);assert.equal(JSON.stringify(poor.store.data),before);
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
test('restart retains stored gear and EXP while Auto waits for a new player toggle',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});
 for(const h of Object.values(f.globals.HeroProgress.heroes))h.currentLevel=5;
 await f.store.setAuto(true);const saved=structuredClone(f.store.data);
 const restart=createEquipmentStorage({globals:f.globals,storage:f.storage,locks:f.locks,now:()=>11000});
 await restart.sync();assert.equal(restart.data.lamp.autoEnabled,false);
 assert.deepEqual(restart.data.items,saved.items);assert.deepEqual(restart.data.lamp.pending,saved.lamp.pending);
 assert.equal(await restart.tickAuto({}),null);assert.equal(restart.data.partyEXP,saved.partyEXP);
 assert.equal(restart.data.lamp.sequence,saved.lamp.sequence);
 await restart.setAuto(true);assert.ok(await restart.tickAuto({}));assert.equal(restart.data.lamp.sequence,saved.lamp.sequence+1);
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
 equipLampItem(d,'Falie','new');assert.equal(d.loadouts.Falie.body,'new');assert.equal(d.lamp.salvage.count,0);assert.ok(d.items.some(i=>i.instanceId==='Falie'));assert.ok(d.lamp.discarded.includes('Falie'));assert.throws(()=>equipLampItem(d,'Huun','Falie'),/no longer/);assert.throws(()=>equipLampItem(d,'Huun','new'),/no longer/);validateLampEconomy(d);
});
test('confirmed dismantling consumes its displayed pieces and preserves later raw arrivals',()=>{
 const d=createLampEconomy(2);activateLamp(d,{},0);const id=d.lamp.pending[0];equipLampItem(d,'Falie',id);activateLamp(d,{},2000);finishLampReview(d);const expected=preview(d);activateLamp(d,{},4000);const arrival=d.lamp.pending[0];
 const result=dismantleLampItems(d,expected);assert.equal(result.count,1);assert.deepEqual(d.lamp.pending,[arrival]);assert.ok(d.items.some(i=>i.instanceId===id));assert.ok(d.items.some(i=>i.instanceId===arrival));validateLampEconomy(d);
 const before=JSON.stringify(d);assert.throws(()=>dismantleLampItems(d,expected),/changed/);assert.equal(JSON.stringify(d),before);
});
test('salvage EXP is bounded per item',()=>{
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
 const f=fixture();await f.store.sync();for(const hero of Object.values(f.globals.HeroProgress.heroes))hero.currentLevel=5;for(let n=0;n<6;n++){f.setClock(f.store.time()+2000);await f.store.generate({});}await f.store.setAuto(true);f.setClock(f.store.time()+5000);
 const results=await Promise.all([f.store.tickAuto({}),f.store.tickAuto({})]);assert.equal(results.filter(Boolean).length,1);assert.equal(f.store.data.lamp.sequence,7);f.setClock(999999);await f.store.tickAuto({});assert.equal(f.store.data.lamp.sequence,8);
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

test('Auto Equip chooses matching-slot total hero CP gain, then lowest current max HP, then party order',()=>{
 const data=createLampEconomy(1),heroes=Object.values(createHeroProgressStore().heroes);
 const item={instanceId:'candidate',type:'body',stats:{ATK:4,DEF:3,MAG:1,RES:1}};data.items.push(item);data.lamp.pending.push(item.instanceId);
 assert.equal(selectAutoEquipHero(data,item,heroes),'Huun');
 assert.equal(selectAutoEquipHero(data,item,[{...heroes[3],hp:1},{...heroes[2],hp:40}]),'Runa','equal CP favors lower max HP even when current HP is higher');
 data.items.push({...item,instanceId:'old',stats:{ATK:100,DEF:100,MAG:100,RES:100}});data.loadouts.Huun={body:'old'};
 assert.equal(selectAutoEquipHero(data,item,heroes),'Falie');
 assert.equal(selectAutoEquipHero(data,item,[heroes[0],{...heroes[0],heroInstanceKey:'tie'}]),'Falie');
 for(const hero of heroes)data.loadouts[hero.heroInstanceKey]={body:'old'};
 const snapshot=JSON.stringify(data);assert.equal(selectAutoEquipHero(data,item,heroes),null);assert.equal(JSON.stringify(data),snapshot);
 assert.equal(selectAutoEquipHero(data,item,[]),null);
});

test('four-stat saves migrate once without rerolling items or healing; equip reports actual permanent CP',async()=>{
 const old=createLampEconomy(42,1000);old.version=3;activateLamp(old,{},0);for(const i of old.items)delete i.stats.HP;
 const raw=JSON.stringify(old),f=fixture({'wishfire.equipment-economy.v3':raw});await f.store.sync();assert.equal(f.store.data.version,5);assert.equal(f.store.data.items[0].stats.HP,0);assert.equal(f.values.get('wishfire.equipment-economy.v3'),raw);assert.equal(f.store.data.gold,old.gold);
 f.setClock(2000);await f.store.generate({});const hero=f.globals.HeroProgress.heroes.Falie,hp=hero.hp,maxHP=hero.maxHP;
 const result=await f.store.equip('Falie',f.store.data.lamp.pending.at(-1));assert.ok(hero.maxHP>maxHP);assert.equal(hero.hp,hp);assert.equal(result.cpAfter,hero.combatPower);assert.equal(result.cpChange,Math.round((result.cpAfter-result.cpBefore)*10)/10);
});

test('manual and Auto draws grant all four heroes EXP once; full cache stops Auto and XP',async()=>{
 const f=fixture();await f.store.sync();await assert.rejects(f.store.setAuto(true),/level|Lv/);
 await f.store.generate({});assert.equal(f.store.data.partyEXP,25);assert.ok(Object.values(f.globals.HeroProgress.heroes).every(h=>h.currentEXP===25));
 await f.store.equip('Falie',f.store.data.lamp.pending[0]);assert.equal(f.store.data.partyEXP,25);
 await f.store.sync();assert.ok(Object.values(f.globals.HeroProgress.heroes).every(h=>h.currentEXP===25));
 const recovered={goldTotal:0,HeroProgress:createHeroProgressStore()};const reload=createEquipmentStorage({globals:recovered,storage:f.storage,locks:f.locks});await reload.sync();assert.ok(Object.values(recovered.HeroProgress.heroes).every(h=>h.currentEXP===25));
 const saved=createHeroProgressStore(JSON.parse(JSON.stringify(recovered.HeroProgress)));const again={goldTotal:0,HeroProgress:saved};const second=createEquipmentStorage({globals:again,storage:f.storage,locks:f.locks});await second.sync();assert.ok(Object.values(again.HeroProgress.heroes).every(h=>h.currentEXP===25));
 for(const hero of Object.values(f.globals.HeroProgress.heroes))hero.currentLevel=5;await f.store.setAuto(true);
 while(lampStoredCount(f.store.data)<LAMP_CONFIG.capacity){f.setClock(f.store.time()+5000);await f.store.tickAuto({});}
 assert.equal(f.store.data.lamp.autoEnabled,false);const exp=f.store.data.partyEXP;f.setClock(f.store.time()+5000);assert.equal(await f.store.tickAuto({}),null);assert.equal(f.store.data.partyEXP,exp);
 await assert.rejects(f.store.setAuto(true),/space/);await assert.rejects(f.store.generate({}),/full/);
 f.setFail(true);await assert.rejects(f.store.dismantle(preview(f.store.data)),/disk full/);assert.equal(f.store.data.partyEXP,exp);f.setFail(false);
 const heroes=structuredClone(f.globals.HeroProgress),essence=f.store.data.lamp.essence;const result=await f.store.dismantle(preview(f.store.data));assert.ok(result.essence>0);assert.equal(f.store.data.lamp.essence,essence+result.essence);assert.equal(f.store.data.partyEXP,exp);assert.deepEqual(f.globals.HeroProgress,heroes);assert.equal(f.store.data.lamp.autoEnabled,false);
});

test('dismantling essence buys saved capacity upgrades; upgrade never grants EXP or resumes Auto',async()=>{
 const f=fixture();await f.store.sync();await assert.rejects(f.store.purchaseStage(),/essence/);
 for(let i=0;i<20;i++){f.setClock(f.store.time()+2000);await f.store.generate({});}await f.store.dismantle(preview(f.store.data));const exp=f.store.data.partyEXP;
 for(let stage=0;stage<4;stage++)await f.store.purchaseStage(0,stage);
 const capacity=await f.store.upgrade();assert.equal(capacity,30);assert.equal(f.store.data.lamp.capacityTier,1);assert.equal(f.store.data.partyEXP,exp);assert.equal(f.store.data.lamp.autoEnabled,false);
 for(let i=0;i<30;i++){f.setClock(f.store.time()+2000);await f.store.generate({});}await assert.rejects(f.store.generate({}),/full/);validateLampEconomy(f.store.data);
 const next=createEquipmentStorage({globals:{goldTotal:0,HeroProgress:createHeroProgressStore()},storage:f.storage,locks:f.locks});await next.sync();assert.equal(next.data.lamp.capacityTier,1);
});

test('Auto rejects weak gear while manual permits a deliberate lower-CP override',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const data=structuredClone(f.store.data),candidate=data.items[0];
 for(const hero of Object.values(f.globals.HeroProgress.heroes)){const current={...candidate,instanceId:'strong:'+hero.heroInstanceKey,stats:Object.fromEntries(Object.keys(candidate.stats).map(k=>[k,candidate.stats[k]+100]))};data.items.push(current);data.loadouts[hero.heroInstanceKey]={[candidate.type]:current.instanceId};}
 f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.refresh();const result=await f.store.equip('Falie',candidate.instanceId);assert.ok(result.cpChange<0);
 const auto=await f.store.autoEquip();assert.deepEqual(auto,[]);
});

test('weaker gear stays visible through refresh until explicit resource conversion',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const data=structuredClone(f.store.data),candidate=data.items[0];
 for(const h of Object.values(f.globals.HeroProgress.heroes)){const owned={...candidate,instanceId:'owned:'+h.heroInstanceKey,stats:Object.fromEntries(Object.keys(candidate.stats).map(k=>[k,1000]))};data.items.push(owned);data.loadouts[h.heroInstanceKey]={[candidate.type]:owned.instanceId};}
 f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.refresh();
 assert.deepEqual(f.store.data.items,data.items);assert.deepEqual(f.store.data.lamp.pending,[candidate.instanceId]);assert.equal(f.store.data.lamp.essence,0);
 await f.store.refresh();assert.deepEqual(f.store.data.items,data.items);
 const exp=f.store.data.partyEXP,result=await f.store.dismantle(preview(f.store.data));assert.equal(result.count,1);assert.equal(f.store.data.lamp.essence,result.essence);assert.equal(f.store.data.partyEXP,exp);assert.equal(f.store.data.items.length,4);
});

test('entirely weaker Auto emissions stop at capacity and cannot farm unlimited EXP',async()=>{
 const f=fixture(),data=createLampEconomy(42);
 for(const hero of Object.values(f.globals.HeroProgress.heroes)){hero.currentLevel=5;for(const type of ['hat','body','boots']){const owned={...generateLampItem(42,0,0),instanceId:hero.heroInstanceKey+':'+type,type,stats:{ATK:1000,DEF:1000,MAG:1000,RES:1000,HP:1000}};data.items.push(owned);(data.loadouts[hero.heroInstanceKey]||={})[type]=owned.instanceId;}}
 f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.sync();await f.store.setAuto(true);
 for(let n=0;n<LAMP_CONFIG.capacity;n++){f.setClock(f.store.time()+5000);await f.store.tickAuto({});}
 assert.equal(f.store.data.lamp.pending.length,LAMP_CONFIG.capacity);assert.equal(f.store.data.items.length,12+LAMP_CONFIG.capacity);assert.equal(f.store.data.lamp.salvage.count,0);assert.equal(f.store.data.lamp.autoEnabled,false);const exp=f.store.data.partyEXP;
 f.setClock(f.store.time()+5000);assert.equal(await f.store.tickAuto({}),null);assert.equal(f.store.data.partyEXP,exp);await assert.rejects(f.store.generate({}),/full/);
 await f.store.dismantle(preview(f.store.data));assert.equal(lampStoredCount(f.store.data),0);assert.equal(f.store.data.lamp.autoEnabled,false);
});

test('persisted two-second emission gate rejects spam, reload bypass and mixed manual/Auto draws',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const first=structuredClone(f.store.data),saved=f.values.get(EQUIPMENT_SAVE_KEY);
 const spam=await Promise.allSettled([f.store.generate({}),f.store.generate({})]);assert.ok(spam.every(r=>r.status==='rejected'));assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);
 const reload=createEquipmentStorage({globals:f.globals,storage:f.storage,locks:f.locks,now:()=>first.lamp.lastActivationAt+1999});await reload.sync();await assert.rejects(reload.generate({}),/preparing/);assert.equal(reload.data.lamp.sequence,1);assert.equal(reload.data.partyEXP,25);
 f.setClock(first.lamp.lastActivationAt+2000);const edge=await Promise.allSettled([f.store.generate({}),f.store.generate({})]);assert.equal(edge.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.store.data.lamp.sequence,2);
 for(const hero of Object.values(f.globals.HeroProgress.heroes))hero.currentLevel=5;await f.store.setAuto(true);
 f.setClock(f.store.time()+1999);assert.equal(await f.store.tickAuto({}),null);await assert.rejects(f.store.generate({}),/preparing/);
 f.setClock(f.store.time()+3001);await f.store.tickAuto({});assert.equal(f.store.data.lamp.sequence,3);await assert.rejects(f.store.generate({}),/preparing/);
});

test('essence-funded lamp levels apply increasing rarity odds and preserve existing rolls',()=>{
 let previousMean=-1;
 for(const [tierIndex,tier]of LAMP_CAPACITY_TIERS.entries()){
  assert.ok(Math.abs(Object.values(tier.rarityWeights).reduce((a,b)=>a+b,0)-100)<1e-8);
  const mean=Object.values(tier.rarityWeights).reduce((total,weight,index)=>total+weight*index,0);assert.ok(mean>previousMean);previousMean=mean;
  const found=new Set();for(let seed=0;seed<1000;seed++){const data=createLampEconomy(seed);data.lamp.capacityTier=tierIndex;const item=activateLamp(data,{},0);assert.deepEqual(item,generateLampItem(seed,0,0,tier.rarityWeights));assert.ok(tier.rarityWeights[item.rarity]>0);found.add(item.rarity);}
  assert.ok(found.has('common')&&found.has('uncommon'),'seeded sample covers ordinary qualities');
 }
 const data=createLampEconomy(42);activateLamp(data,{},0);const original=structuredClone(data.items);data.lamp.essence=20;for(let stage=0;stage<4;stage++)purchaseLampStage(data,0,stage);upgradeLamp(data);assert.deepEqual(data.items,original);assert.equal(data.partyEXP,25);
});

 test('replaced gear persists as inspectable dismantling stock and cannot be reassigned',async()=>{
 const f=fixture(),data=createLampEconomy(42),candidate={...generateLampItem(42,0,0),instanceId:'new'},old={...candidate,instanceId:'old',stats:Object.fromEntries(Object.entries(candidate.stats).map(([k,v])=>[k,Math.max(1,v-1)]))};
 data.items=[candidate,old];data.lamp.pending=['new'];data.loadouts.Falie={[old.type]:'old'};f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.sync();
 await f.store.equip('Falie','new');assert.deepEqual(f.store.data.lamp.discarded,['old']);assert.deepEqual(f.store.data.items.find(i=>i.instanceId==='old'),old);assert.equal(f.store.data.lamp.essence,0);assert.equal(lampStoredCount(f.store.data),1);
 await f.store.refresh();assert.deepEqual(f.store.data.lamp.discarded,['old']);await assert.rejects(f.store.equip('Huun','old'),/no longer/);
 const saved=f.values.get(EQUIPMENT_SAVE_KEY),ids=preview(f.store.data);f.setFail(true);await assert.rejects(f.store.dismantle(ids),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),saved);f.setFail(false);
 const receipt=await f.store.dismantle(ids);assert.equal(receipt.count,1);assert.equal(f.store.data.lamp.essence,receipt.essence);assert.deepEqual(f.store.data.lamp.discarded,[]);assert.deepEqual(f.store.data.items.map(i=>i.instanceId),['new']);
 });

test('review sorting leaves emission order intact and Auto equips at most one item per hero',async()=>{
 const f=fixture(),data=createLampEconomy(42);for(let n=0;n<8;n++)activateLamp(data,{region:n+1,stage:1},n*2000);
 const order=[...data.lamp.pending],recent=structuredClone(data.lamp.recent);assert.deepEqual(recent.map(i=>i.sequence),[3,4,5,6,7]);
 const sorted=sortedLampItems(data);assert.ok(sorted.every((i,n)=>!n||lampGearCP(sorted[n-1])>=lampGearCP(i)));assert.deepEqual(data.lamp.pending,order);
 f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));await f.store.sync();const picked=selectLampUpgrades(f.store.data,Object.values(f.globals.HeroProgress.heroes)).map(i=>i.instanceId),exp=f.store.data.partyEXP;
 const results=await f.store.autoEquip();assert.ok(results.length>0&&results.length<=4);assert.equal(new Set(results.map(r=>r.heroId)).size,results.length);assert.ok(results.every(r=>picked.includes(r.item.instanceId)&&r.cpChange>0));
 assert.deepEqual(f.store.data.lamp.pending,[]);assert.equal(f.store.data.lamp.discarded.length,8-results.length);assert.deepEqual(f.store.data.lamp.recent,recent);assert.equal(f.store.data.partyEXP,exp);validateLampEconomy(f.store.data);
 for(const id of f.store.data.lamp.discarded)await assert.rejects(f.store.equip('Falie',id),/no longer/);
});
test('entering dismantling permanently removes equip eligibility without converting resources',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const id=f.store.data.lamp.pending[0],before=structuredClone(f.store.data);await f.store.finishReview();assert.deepEqual(f.store.data.lamp.pending,[]);assert.deepEqual(f.store.data.lamp.discarded,[id]);assert.equal(f.store.data.lamp.essence,before.lamp.essence);assert.equal(f.store.data.partyEXP,before.partyEXP);await f.store.refresh();await assert.rejects(f.store.equip('Huun',id),/no longer/);assert.deepEqual(await f.store.autoEquip(),[]);
});


test('earned batch Auto Equip bypasses item-CP leaders that give no hero gain',async()=>{
 const captured=JSON.parse(readFileSync(new URL('./fixtures/lamp-auto-earned-69.json',import.meta.url)));
 const data=structuredClone(captured.economy),heroes=Object.values(captured.heroes.heroes).slice(0,4);
 const eligible=sortedLampItems(data).filter(i=>heroes.some(h=>lampItemCPGain(data,i,h)>0));
 assert.equal(eligible.length,21);
 assert.deepEqual(selectLampUpgrades(data,heroes).map(i=>i.instanceId),eligible.map(i=>i.instanceId));
 const f=fixture({[EQUIPMENT_SAVE_KEY]:JSON.stringify(data)});f.globals.HeroProgress=structuredClone(captured.heroes);await f.store.sync();
 const exp=data.partyEXP,progress=heroes.map(h=>[h.currentLevel,h.currentEXP,h.lampEXPClaimed]);
 const receipts=await f.store.autoEquip();assert.ok(receipts.length>0&&receipts.length<=4);
 assert.equal(new Set(receipts.map(r=>r.heroId)).size,receipts.length);
 for(const r of receipts){const item=data.items.find(i=>i.instanceId===r.item.instanceId),hero=heroes.find(h=>h.heroInstanceKey===r.heroId);assert.ok(item);assert.ok(r.cpChange>0);assert.equal(r.cpChange,lampItemCPGain(data,item,hero));assert.equal(f.store.data.loadouts[r.heroId][item.type],item.instanceId);}
 assert.equal(f.store.data.partyEXP,exp);assert.deepEqual(Object.values(f.globals.HeroProgress.heroes).slice(0,4).map(h=>[h.currentLevel,h.currentEXP,h.lampEXPClaimed]),progress);assert.equal(f.store.data.lamp.pending.length,0);
});

test('long lamp curve uses exact four-installment costs and fractional rarity changes',()=>{
 const data=createLampEconomy(42);let total=0;
 for(let tier=0;tier<LAMP_CONFIG.lampLevels-1;tier++){
  data.lamp.essence=LAMP_CAPACITY_TIERS[tier].cost;const original=data.lamp.essence;
  for(let stage=0;stage<4;stage++){assert.ok(lampStageCost(data)>0);purchaseLampStage(data,tier,stage);assert.equal(data.lamp.capacityTier,tier);}
  assert.equal(data.lamp.essence,0);total+=original;upgradeLamp(data,tier);assert.equal(data.lamp.upgradeStage,0);
  for(const key of Object.keys(RARITIES))assert.ok(Math.abs(LAMP_CAPACITY_TIERS[tier+1].rarityWeights[key]-LAMP_CAPACITY_TIERS[tier].rarityWeights[key])<.56);
 }
 assert.equal(data.lamp.capacityTier,99);assert.equal(total,596397);
 assert.equal(1+LAMP_CONFIG.maxOrdinal*LAMP_CONFIG.mapStatGrowth,5.95);
});
