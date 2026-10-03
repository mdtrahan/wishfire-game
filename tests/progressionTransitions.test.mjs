import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HERO_DEFINITIONS,heroSkillUnlocked} from '../web-runner/src/core/heroDefinitions.mjs';
import {attachHeroProgress,createHeroProgressStore,setHeroProgressLevel,awardHeroEXP} from '../web-runner/src/core/heroProgression.mjs';
import {createLampEconomy,validateLampEconomy,LAMP_CONFIG,purchaseLampStage,upgradeLamp,speedUpLampUpgrade} from '../web-runner/src/core/lampGear.mjs';
import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';
import {castRealtimeHeroSkill,realtimeRetaliation} from '../web-runner/src/core/realtimeHeroSkills.mjs';
import {configureContinuousCombatProduction} from '../web-runner/src/core/continuousCombatStage.mjs';
import {resetCombatSessionConditions} from '../web-runner/systems/combatSessionReset.mjs';

const progressSource=readFileSync(new URL('../web-runner/systems/heroProgressStorage.js',import.meta.url),'utf8');
const HERO_PROGRESS_SAVE_KEY='orka.hero_progress.v2';
function loadControls(){
 const source=readFileSync(new URL('../web-runner/systems/devToolingControls.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace(/export /g,'');
 return new Function('attachHeroProgress','createHeroProgressStore','setHeroProgressLevel','validateLampEconomy','EQUIPMENT_SAVE_KEY','HERO_PROGRESS_SAVE_KEY','resetCombatSessionConditions',source+';return {applyDeveloperLevel,resetDeveloperGame};')(attachHeroProgress,createHeroProgressStore,setHeroProgressLevel,validateLampEconomy,EQUIPMENT_SAVE_KEY,HERO_PROGRESS_SAVE_KEY,resetCombatSessionConditions);
}
function fixture(){
 let clock=1000,fail=false,chain=Promise.resolve();const values=new Map();
 const storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem(k,v){if(fail)throw Error('disk full');values.set(k,v);},removeItem:k=>values.delete(k)};
 const locks={request:(key,fn)=>{const result=chain.then(fn);chain=result.catch(()=>{});return result;}};
 const globals={goldTotal:0,HeroProgress:createHeroProgressStore()};
 const data=createLampEconomy(42);data.lamp.essence=200;values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));
 const options={globals,storage,locks,now:()=>clock,reportError:()=>{}};
 return{globals,storage,locks,values,options,store:createEquipmentStorage(options),setClock:v=>clock=v,setFail:v=>fail=v};
}

test('construction uses a seven-hour deadline, survives reload and automatically commits once',async()=>{
 const f=fixture();await f.store.sync();for(let n=0;n<4;n++)await f.store.purchaseStage(0,n);
 const end=1000+7*60*60*1000;assert.equal(f.store.data.lamp.upgradeEndsAt,end);assert.equal(f.store.data.lamp.capacityTier,0);
 f.setClock(end-1);const reload=createEquipmentStorage(f.options);await reload.sync();assert.equal(reload.data.lamp.capacityTier,0);
 f.setClock(end);await reload.sync();assert.equal(reload.data.lamp.capacityTier,1);assert.equal(reload.data.lamp.upgradeEndsAt,0);
 const receipt=f.values.get(EQUIPMENT_SAVE_KEY);await reload.sync();assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),receipt);
 assert.equal(reload.data.lamp.essence,180);assert.equal(reload.data.partyEXP,0);
});

test('final essence purchase and its timer are atomic, and stale clicks cannot restart construction',async()=>{
 const f=fixture();await f.store.sync();for(let n=0;n<3;n++)await f.store.purchaseStage(0,n);
 const before=f.values.get(EQUIPMENT_SAVE_KEY);f.setFail(true);await assert.rejects(f.store.purchaseStage(0,3),/disk full/);
 assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),before);assert.equal(f.store.data.lamp.upgradeEndsAt,undefined);f.setFail(false);
 const results=await Promise.allSettled([f.store.purchaseStage(0,3),f.store.purchaseStage(0,3)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const deadline=f.store.data.lamp.upgradeEndsAt;
 await assert.rejects(f.store.upgrade(0),/under construction/);assert.equal(f.store.data.lamp.upgradeEndsAt,deadline);
 const paid=createLampEconomy(4);paid.lamp.upgradeStage=4;upgradeLamp(paid,0,1000);assert.equal(paid.lamp.capacityTier,0);
 for(const value of [NaN,-1,1.2,Number.MAX_SAFE_INTEGER])assert.throws(()=>purchaseLampStage(createLampEconomy(4),0,0,value));
});

test('SPD UP ALL consumes five-minute tickets without waste; failures and concurrent clicks stay atomic',async()=>{
 const zero=createLampEconomy(1,0);zero.lamp.upgradeStage=4;zero.lamp.speedUpTickets=84;upgradeLamp(zero,0,0);assert.equal(speedUpLampUpgrade(zero,0,0),84);assert.equal(zero.lamp.capacityTier,1);
 const f=fixture();const save=JSON.parse(f.values.get(EQUIPMENT_SAVE_KEY));save.lamp.speedUpTickets=2;f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(save));
 await f.store.sync();for(let n=0;n<4;n++)await f.store.purchaseStage(0,n);
 const before=f.values.get(EQUIPMENT_SAVE_KEY);f.setFail(true);await assert.rejects(f.store.speedUp(0),/disk full/);assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),before);f.setFail(false);
 const end=f.store.data.lamp.upgradeEndsAt;const results=await Promise.allSettled([f.store.speedUp(0),f.store.speedUp(0)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.store.data.lamp.upgradeEndsAt,end-2*5*60*1000);assert.equal(f.store.data.lamp.speedUpTickets,0);
 const extra=JSON.parse(f.values.get(EQUIPMENT_SAVE_KEY));extra.lamp.speedUpTickets=100;f.values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(extra));await f.store.refresh();
 f.setClock(f.store.data.lamp.upgradeEndsAt-1);assert.equal(await f.store.speedUp(0),1);assert.equal(f.store.data.lamp.capacityTier,1);assert.equal(f.store.data.lamp.speedUpTickets,99);
});

test('fresh heroes gate every skill at the authoritative milestone including direct casts and retaliation',()=>{
 const store=createHeroProgressStore();
 for(const [key,d] of Object.entries(HERO_DEFINITIONS)){
  const h=store.heroes[key];h.uid=1;h.kind='hero';const target={uid:2,kind:'enemy',hp:1000,maxHP:1000,x:220,y:200,streamState:'engaged'};
  const ctx={state:{globals:{time:100,RuntimeRandom:()=>.5,RealtimeHeroBasicClocks:{1:{skillReadyAt:{}}}},entities:[h,target]},callFunction:()=>0};
  assert.deepEqual(d.actives.map(s=>s.unlockLevel),key==='Kojonn'?[1,5,10,15,25,35,50,60,75]:[1,5,10,15,25,35,50,75]);assert.equal(h.currentLevel,1);assert.equal(h.currentEXP,0);
  for(const skill of d.actives){
   h.currentLevel=skill.unlockLevel-1;if(h.currentLevel<1)continue;
   assert.equal(heroSkillUnlocked(h,skill),false);const snapshot=JSON.stringify(ctx.state);
   assert.equal(castRealtimeHeroSkill(ctx,1,skill,{targetUID:2,targetUIDs:[1],point:{x:220,y:200}}),false);assert.equal(JSON.stringify(ctx.state),snapshot);
   h.currentLevel=skill.unlockLevel;assert.equal(heroSkillUnlocked(h,skill),true);
  }
  h.currentLevel=1;if(key==='Falie')assert.equal(realtimeRetaliation(ctx,h,target),false);
 }
 const h=store.heroes.Huun;h.currentLevel=4;h.currentEXP=0;h.maxLevel=100;awardHeroEXP(h,800);assert.equal(h.currentLevel,5);assert.equal(heroSkillUnlocked(h,HERO_DEFINITIONS.Huun.actives[1]),true);
});

test('developer presets save real levels, stats, EXP and receipt baselines without changing equipment',async()=>{
 const f=fixture();await f.store.sync();await f.store.generate({});const controls=loadControls();
 const state={globals:f.globals,entities:Object.values(createHeroProgressStore().heroes).map((h,i)=>({...h,kind:'hero',uid:i+1}))};const gameState={};
 const gear=f.values.get(EQUIPMENT_SAVE_KEY);
 for(const level of [1,5,25,100]){
  state.globals.PendingHeroHits=[{effectType:'skill'}];state.globals.RealtimeSkillEffects={1:{old:{expiresAt:100}}};
  await controls.applyDeveloperLevel({state,gameState,call:()=>0,storage:f.storage,locks:f.locks,level});
  assert.deepEqual(state.globals.PendingHeroHits,[]);assert.deepEqual(state.globals.RealtimeSkillEffects,{});
  const saved=createHeroProgressStore(JSON.parse(f.values.get(HERO_PROGRESS_SAVE_KEY)));
  for(const actor of state.entities){
   const h=saved.heroes[actor.heroInstanceKey];assert.equal(actor.currentLevel,level);assert.equal(h.currentLevel,level);assert.equal(h.currentEXP,0);assert.equal(h.lampEXPClaimed,25);assert.equal(h.maxLevel,100);
   assert.deepEqual(actor.stats,h.stats);assert.equal(actor.maxHP,h.maxHP);assert.equal(actor.EXPToNextLevel,h.EXPToNextLevel);
   assert.equal(HERO_DEFINITIONS[actor.baseHeroName].actives.filter(s=>heroSkillUnlocked(actor,s)).length,level===1?1:level===5?2:level===25?5:actor.baseHeroName==='Kojonn'?9:8);
  }
  await f.store.sync();assert.ok(state.entities.every(h=>h.currentLevel===level&&h.currentEXP===0));assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),gear);
 }
 const before=JSON.stringify(state);f.setFail(true);await assert.rejects(controls.applyDeveloperLevel({state,gameState,call:()=>0,storage:f.storage,locks:f.locks,level:1}),/disk full/);assert.equal(JSON.stringify(state),before);
});

test('RESET GAME preserves a recovery snapshot and unrelated origin data; failed backup leaves saves intact',()=>{
 const f=fixture(),controls=loadControls();f.values.set(HERO_PROGRESS_SAVE_KEY,JSON.stringify(setHeroProgressLevel(createHeroProgressStore(),25)));f.values.set('other.app','keep');
 const before=Object.fromEntries(f.values);f.setFail(true);assert.throws(()=>controls.resetDeveloperGame(f.storage),/disk full/);assert.deepEqual(Object.fromEntries(f.values),before);f.setFail(false);
 controls.resetDeveloperGame(f.storage);assert.equal(f.storage.getItem(EQUIPMENT_SAVE_KEY),null);assert.equal(f.storage.getItem(HERO_PROGRESS_SAVE_KEY),null);assert.equal(f.storage.getItem('other.app'),'keep');
 assert.equal(JSON.parse(f.storage.getItem('wishfire.qa.reset-backup.v1'))[HERO_PROGRESS_SAVE_KEY],before[HERO_PROGRESS_SAVE_KEY]);
 const fresh=createHeroProgressStore();assert.ok(Object.values(fresh.heroes).every(h=>h.currentLevel===1&&h.currentEXP===0));
});

test('boss availability and current tier restore from the existing progression save, never from transient armed state',()=>{
 const store=createHeroProgressStore();const g={HeroProgress:store,ContinuousCombatStageLoop:1,ContinuousCombatStage:{region:3,stage:7,wave:3,bossAvailable:true,bossActive:true,clearedBosses:26}};
 const values=new Map();const source=progressSource.replace(/^import .*\n/gm,'').replace(/export /g,'');
 const persist=new Function('window',source+';return persistHeroProgressIfDirty;')({localStorage:{setItem:(k,v)=>values.set(k,v)}});
 assert.equal(persist({stateGlobals:g}),true);const restored=createHeroProgressStore(JSON.parse(values.get(HERO_PROGRESS_SAVE_KEY)));
 const next={HeroProgress:restored};configureContinuousCombatProduction(next,{productionPath:true});
 assert.equal(next.ContinuousCombatStage.region,3);assert.equal(next.ContinuousCombatStage.stage,7);assert.equal(next.ContinuousCombatStage.wave,1);assert.equal(next.ContinuousCombatStage.bossAvailable,true);assert.equal(next.ContinuousCombatStage.bossArmed,false);assert.equal(next.ContinuousCombatStage.bossActive,false);
});
