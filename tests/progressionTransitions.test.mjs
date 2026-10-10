import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {HERO_DEFINITIONS,heroSkillUnlocked} from '../web-runner/src/core/heroDefinitions.mjs';
import {attachHeroProgress,createHeroProgressStore,setHeroProgressLevel,awardHeroEXP} from '../web-runner/src/core/heroProgression.mjs';
import {createLampEconomy,validateLampEconomy,LAMP_CONFIG,purchaseLampStage,upgradeLamp,speedUpLampUpgrade} from '../web-runner/src/core/lampGear.mjs';
import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';
import {castRealtimeHeroSkill,realtimeRetaliation} from '../web-runner/src/core/realtimeHeroSkills.mjs';
import {buildContinuousCombatSpawnPlan,configureContinuousCombatProduction,deriveContinuousCombatWavePackProgress,maybeAdvanceContinuousCombatStage,resetContinuousCombatAfterDefeat,summonContinuousCombatBoss} from '../web-runner/src/core/continuousCombatStage.mjs';
import {resetCombatSessionConditions} from '../web-runner/systems/combatSessionReset.mjs';

const progressSource=readFileSync(new URL('../web-runner/systems/heroProgressStorage.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('../web-runner/app.js',import.meta.url),'utf8');
const HERO_PROGRESS_SAVE_KEY='orka.hero_progress.v2';
const createPersistHeroProgressIfDirty=window=>new Function('window',`${progressSource.replace(/^import .*\n/gm,'').replace(/export /g,'')};return persistHeroProgressIfDirty;`)(window);
function loadControls(){
 const source=readFileSync(new URL('../web-runner/systems/devToolingControls.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace(/export /g,'');
 return new Function('attachHeroProgress','createHeroProgressStore','setHeroProgressLevel','validateLampEconomy','EQUIPMENT_SAVE_KEY','HERO_PROGRESS_SAVE_KEY','resetCombatSessionConditions',source+';return {applyDeveloperLevel,resetDeveloperGame};')(attachHeroProgress,createHeroProgressStore,setHeroProgressLevel,validateLampEconomy,EQUIPMENT_SAVE_KEY,HERO_PROGRESS_SAVE_KEY,resetCombatSessionConditions);
}
function fixture(){
 let clock=1000,fail=false,chain=Promise.resolve();const values=new Map();
 const storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem(k,v){if(fail)throw Error('disk full');values.set(k,v);},removeItem:k=>values.delete(k)};
 const locks={request:(key,fn)=>{const result=chain.then(fn);chain=result.catch(()=>{});return result;}};
 const globals={goldTotal:0,HeroProgress:createHeroProgressStore()};
 const data=createLampEconomy(42);data.lamp.essence=400;values.set(EQUIPMENT_SAVE_KEY,JSON.stringify(data));
 const options={globals,storage,locks,now:()=>clock,reportError:()=>{}};
 return{globals,storage,locks,values,options,store:createEquipmentStorage(options),setClock:v=>clock=v,setFail:v=>fail=v};
}

test('construction uses a seven-hour deadline, survives reload and automatically commits once',async()=>{
 const f=fixture();await f.store.sync();for(let n=0;n<4;n++)await f.store.purchaseStage(0,n);
 const end=1000+7*60*60*1000;assert.equal(f.store.data.lamp.upgradeEndsAt,end);assert.equal(f.store.data.lamp.capacityTier,0);
 f.setClock(end-1);const reload=createEquipmentStorage(f.options);await reload.sync();assert.equal(reload.data.lamp.capacityTier,0);
 f.setClock(end);await reload.sync();assert.equal(reload.data.lamp.capacityTier,1);assert.equal(reload.data.lamp.upgradeEndsAt,0);
 const receipt=f.values.get(EQUIPMENT_SAVE_KEY);await reload.sync();assert.equal(f.values.get(EQUIPMENT_SAVE_KEY),receipt);
 assert.equal(reload.data.lamp.essence,0);assert.equal(reload.data.partyEXP,0);
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

test('manual boss retry state restores from the existing progression save and survives defeat',()=>{
 const store=createHeroProgressStore();const g={HeroProgress:store,ContinuousCombatStageLoop:1,ContinuousCombatStage:{region:3,stage:7,wave:3,bossAvailable:true,bossSummonRequired:true,bossActive:true,clearedBosses:26}};
 const values=new Map();const source=progressSource.replace(/^import .*\n/gm,'').replace(/export /g,'');
 const persist=new Function('window',source+';return persistHeroProgressIfDirty;')({localStorage:{setItem:(k,v)=>values.set(k,v)}});
 assert.equal(persist({stateGlobals:g}),true);const restored=createHeroProgressStore(JSON.parse(values.get(HERO_PROGRESS_SAVE_KEY)));
 const next={HeroProgress:restored};configureContinuousCombatProduction(next,{productionPath:true});
 assert.equal(next.ContinuousCombatStage.region,3);assert.equal(next.ContinuousCombatStage.stage,7);assert.equal(next.ContinuousCombatStage.wave,1);assert.equal(next.ContinuousCombatStage.bossAvailable,true);assert.equal(next.ContinuousCombatStage.bossSummonRequired,true);assert.equal(next.ContinuousCombatStage.bossArmed,false);assert.equal(next.ContinuousCombatStage.bossActive,false);
 next.time=14;assert.equal(resetContinuousCombatAfterDefeat(next),true);assert.equal(next.ContinuousCombatStage.bossAvailable,true);assert.equal(next.ContinuousCombatStage.bossSummonRequired,true);assert.equal(next.ContinuousCombatStage.clearedPackMask,0);
 assert.equal(persist({stateGlobals:next}),true);const afterDefeat=createHeroProgressStore(JSON.parse(values.get(HERO_PROGRESS_SAVE_KEY)));
 assert.deepEqual(afterDefeat.continuousStage,{region:3,stage:7,wave:1,bossAvailable:true,bossSummonRequired:true,clearedBosses:26,clearedPackMask:0});
});

test('an unfinished active boss checkpoint reloads as a manual retry instead of a live boss',()=>{
 const globals={HeroProgress:createHeroProgressStore(),ContinuousCombatStageLoop:1,ContinuousCombatStage:{region:2,stage:4,wave:1,bossAvailable:true,bossSummonRequired:false,bossArmed:true,bossActive:true,bossUID:90,clearedBosses:9}};
 const values=new Map(),persist=createPersistHeroProgressIfDirty({localStorage:{setItem:(key,value)=>values.set(key,value)}});
 assert.equal(persist({stateGlobals:globals}),true);
 const restored=createHeroProgressStore(JSON.parse(values.get(HERO_PROGRESS_SAVE_KEY)));
 assert.deepEqual(restored.continuousStage,{region:2,stage:4,wave:1,bossAvailable:true,bossSummonRequired:true,clearedBosses:9,bossUID:90,clearedPackMask:0});
 const reloaded={HeroProgress:restored,EncounterSeed:73};configureContinuousCombatProduction(reloaded,{productionPath:true});
 assert.equal(reloaded.ContinuousCombatStage.bossActive,false);
 assert.equal(reloaded.ContinuousCombatStage.bossAvailable,true);
 assert.equal(reloaded.ContinuousCombatStage.bossSummonRequired,true);
});

test('production visibility and pagehide handlers call surrender on the correct event targets',()=>{
 const start=appSource.indexOf("document.addEventListener('visibilitychange'",appSource.indexOf('const combatSimulationTicker = createCombatSimulationTicker()'));
 const end=appSource.indexOf('const buffIconFrames',start);
 assert.ok(start>=0&&end>start,'finds production visibility and pagehide registrations');
 const source=appSource.slice(start,end),documentHandlers={},windowHandlers={};let surrenders=0,resets=0;
 const documentMock={hidden:false,addEventListener:(name,handler)=>{documentHandlers[name]=handler;}};
 new Function('document','window','combatSimulationTicker','lastFrameTime','performance','surrenderBossForDeparture',source)(
  documentMock,
  {addEventListener:(name,handler)=>{windowHandlers[name]=handler;}},
  {reset(){resets++;}},0,{now:()=>100},()=>{surrenders++;}
 );
 documentHandlers.visibilitychange();assert.equal(surrenders,0,'a visible tab keeps the current boss attempt');
 documentMock.hidden=true;documentHandlers.visibilitychange();assert.equal(surrenders,1);
 assert.equal(resets,2);
 assert.equal(typeof windowHandlers.pagehide,'function');windowHandlers.pagehide();assert.equal(surrenders,2);
});

test('production combat layout surrenders before capturing the outgoing combat snapshot',()=>{
 const layoutStart=appSource.indexOf('const combatLayout = {');
 const start=appSource.indexOf('onExit({ to }) {',layoutStart),end=appSource.indexOf('\n    },\n  };',start);
 assert.ok(layoutStart>=0&&start>layoutStart&&end>start,'finds combat layout onExit');
 const member=appSource.slice(start,end+6),order=[];
 const onExit=new Function('gameState','surrenderBossForDeparture','combatRuntimeGateway','validateCombatSnapshot',`return ({${member}}).onExit;`)({storyCardLayout:{}},()=>order.push('surrender'),{suspend(){order.push('suspend');return{snapshot:true};}},()=>order.push('validate'));
 assert.deepEqual(onExit({to:'heroLayout'}),{snapshot:true});assert.deepEqual(order,['surrender','suspend','validate']);
});

test('legacy deferred boss checkpoints keep readiness and auto-enter once after reload',()=>{
 const globals={HeroProgress:createHeroProgressStore(),ContinuousCombatStageLoop:1,ContinuousCombatStage:{region:2,stage:3,wave:1,bossAvailable:true,bossArmed:false,bossActive:false,bossEntryDeferredUntilWaveFour:true,clearedBosses:5}};
 const values=new Map();const persist=createPersistHeroProgressIfDirty({localStorage:{setItem:(key,value)=>values.set(key,value)}});
 assert.equal(persist({stateGlobals:globals}),true);
 const restored=createHeroProgressStore(JSON.parse(values.get(HERO_PROGRESS_SAVE_KEY)));
 assert.equal(restored.continuousStage.bossEntryDeferredUntilWaveFour,undefined,'the retired four-wave refill flag is omitted from saves');
 assert.equal(restored.continuousStage.bossSummonRequired,false,'older ready saves without a defeat latch retain first-entry automatic behavior');
 const next={HeroProgress:restored,GamePhase:'RUNTIME',BattleStartActive:0,time:1,EnemyData:[{name:'Troll',HP:40,ATK:4,DEF:3,MAG:1,RES:2,SPD:7,enemyRole:'boss'}],EnemySlots:[],PendingDeaths:{},EnemyDeathVisualHoldByUID:{}};
 configureContinuousCombatProduction(next,{productionPath:true});
 const spawned=[];const call=(name,...args)=>{if(name==='SpawnEnemy')spawned.push(args);};
 assert.equal(maybeAdvanceContinuousCombatStage({globals:next,entities:[{uid:1,kind:'hero',hp:40,maxHP:40}],presentationBarrier:{lanes:{}},call}),true);
 assert.equal(next.ContinuousCombatStage.bossAvailable,true);
 assert.equal(next.ContinuousCombatStage.bossActive,true);
 assert.equal(spawned.length,1,'restored legacy readiness enters exactly one boss without a four-wave refill');
});

test('fractional current-wave credits survive checkpoint reload without duplicate sector spawns',()=>{
 const rows=['High Orc','Chimerilass','Djinn'].map((name,index)=>({name,HP:30+index,ATK:3,DEF:2,MAG:1,RES:1,SPD:8}));
 const globals={HeroProgress:createHeroProgressStore(),ContinuousCombatStageLoop:1,ContinuousCombatStage:{region:1,stage:2,wave:3,bossAvailable:false,clearedBosses:0,clearedPackMask:0b010101}};
 const values=new Map();const persist=createPersistHeroProgressIfDirty({localStorage:{setItem:(key,value)=>values.set(key,value)}});
 assert.equal(persist({stateGlobals:globals}),true);
 const restored=createHeroProgressStore(JSON.parse(values.get(HERO_PROGRESS_SAVE_KEY)));
 const reloaded={HeroProgress:restored,EncounterSeed:8};configureContinuousCombatProduction(reloaded,{productionPath:true});
 assert.equal(reloaded.ContinuousCombatStage.wave,3);
 assert.equal(reloaded.ContinuousCombatStage.clearedPackMask,0b010101);
 const remaining=buildContinuousCombatSpawnPlan(rows,reloaded.ContinuousCombatStage);
 assert.deepEqual([...new Set(remaining.map(entry=>entry.sectorIndex))],[1,3,5]);
 assert.equal(deriveContinuousCombatWavePackProgress(reloaded.ContinuousCombatStage,[]).fraction,0.5,'stored credit remains visible before reloaded enemies finish spawning');
 const full={HeroProgress:createHeroProgressStore({version:2,heroes:{},continuousStage:{region:1,stage:2,wave:3,bossAvailable:false,clearedBosses:0,clearedPackMask:63}}),EncounterSeed:8};
 configureContinuousCombatProduction(full,{productionPath:true});
 assert.equal(deriveContinuousCombatWavePackProgress(full.ContinuousCombatStage,[]).fraction,1);
 assert.equal(buildContinuousCombatSpawnPlan(rows,full.ContinuousCombatStage).length,0,'a fully credited but unsettled wave does not respawn fodder after reload');
});

test('ordinary KO recovery, save and reload keep the bar at 75 percent before the boss',async()=>{
 const {createQuestCombatSession}=await import('../web-runner/systems/questCombatSession.mjs');
 const {buildContinuousCombatSpawnPlan,activateContinuousCombatSpawnedEnemy}=await import('../web-runner/src/core/continuousCombatStage.mjs');
 const {drawCombatProgressHud}=await import('../web-runner/systems/renderCombatBossControl.mjs');
 const rows=['Orc','High Orc','Chimerilass','Djinn'].map((name,index)=>({name,HP:30+index,ATK:4,DEF:2,MAG:1,RES:1,SPD:8}));
 const stage={seed:5,region:1,stage:8,wave:4,bossAvailable:false,bossArmed:false,bossActive:false,transitions:3,clearedBosses:7,clearedPackMask:0,spawnedPackMask:63,spawnSerial:12};
 const globals={HeroProgress:createHeroProgressStore(),ContinuousCombatStageLoop:1,ContinuousCombatStage:stage,EnemyData:rows,time:20,EnemySlots:[],PendingDeaths:{},EnemyDeathVisualHoldByUID:{}};
 const entities=[{uid:1,kind:'hero',hp:0,maxHP:42,isAlive:false}];
 for(const entry of buildContinuousCombatSpawnPlan(rows,stage)){const enemy={uid:entities.length+1,kind:'enemy',hp:entry.row.HP,maxHP:entry.row.HP,name:entry.row.name};activateContinuousCombatSpawnedEnemy(globals,enemy,entry);entities.push(enemy);}
 const state={globals,entities};
 const session=createQuestCombatSession({state,gameState:{},call(){},sync(){}});
 assert.equal(session.recoverContinuousDefeat(),true,'KO recovery retains the current wave rather than restarting it');
 assert.equal(globals.ContinuousCombatStage.wave,4);
 const values=new Map();const persist=createPersistHeroProgressIfDirty({localStorage:{setItem:(key,value)=>values.set(key,value)}});
 assert.equal(persist({stateGlobals:globals}),true);
 const restored=createHeroProgressStore(JSON.parse(values.get(HERO_PROGRESS_SAVE_KEY)));
 assert.equal(restored.continuousStage.bossSummonRequired,true,'an ordinary KO latches the stage even before readiness');
 const next={HeroProgress:restored};configureContinuousCombatProduction(next,{productionPath:true});
 assert.equal(next.ContinuousCombatStage.wave,4);
 assert.equal(deriveContinuousCombatWavePackProgress(next.ContinuousCombatStage,[]).fraction,0);
 const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true});
 const hud=drawCombatProgressHud(ctx,{state:{globals:{ContinuousCombatStage:next.ContinuousCombatStage},entities:[]},worldToCanvas:(x,y)=>({x,y})});
 assert.equal(hud.completedWaves,3);
 assert.equal(hud.progressPosition,3);
 assert.equal(hud.progressPosition/4,0.75);
});

test('the app tick persists boss readiness before its stage early return and defeat reset before its outcome early return',()=>{
 const tickStart=appSource.indexOf('function tick(){',appSource.indexOf('let frameCount = 0;'));
 const tickEnd=appSource.indexOf('\n  tick();',tickStart);
 assert.ok(tickStart>=0&&tickEnd>tickStart,'extracts the production app tick function');
 const tickSource=appSource.slice(tickStart,tickEnd);
 const savedValues=new Map();
 const persistHeroProgressIfDirty=createPersistHeroProgressIfDirty({localStorage:{setItem:(key,value)=>savedValues.set(key,value)}});
 const rows=['Gobloc','Skeleton','High Gobloc','Lizardo','Orc','High Orc','Chimerilass','Djinn','Troll'].map((name,index)=>({name,HP:20+index*5,ATK:2+index,DEF:2,MAG:1,RES:1,SPD:8}));
 let nextUID=10;
 const makeCall=(state)=> (name,row,slotIndex)=>{
  if(name==='SpawnEnemy'){
   const enemy={uid:nextUID++,kind:'enemy',name:row.name,enemyRole:row.enemyRole,hp:row.HP,maxHP:row.HP,slotIndex};
   state.entities.push(enemy);return enemy;
  }
  return null;
 };
 const runTick=(state,gameState,checkOutcome)=>{
  const context=vm.createContext({
   state,gameState,document:{hidden:false},performance:{now:()=>100},requestAnimationFrame(){},
   combatSimulationTicker:{reset(){},tick(){}},lastFrameTime:0,ensureDevToolingConfig:()=>({open:false}),
   layoutState:{getActiveLayoutId:()=> 'combat'},shouldFreezeCombatSimulation:()=>false,drawFrame(){},
   fnContext:{},callFunctionWithContext:(ctx,name,...args)=>makeCall(state)(name,...args),
   maybeAdvanceContinuousCombatStage,getPresentationTurnBarrier:()=>({lanes:{}}),recoverContinuousOrdinaryDefeatIfNeeded:()=>false,checkMainRuntimeCombatOutcome:checkOutcome,
   questCombat:{isCleared:()=>false},storyEntry:{victory(){}},heroProgressStorage:{persistHeroProgressIfDirty},
   animationMath:{},layoutW:0,applyTurnGateGlobals(){},applyTurnGateIntent(){},createEnemyTurnIdleRecovery(){},
   getCellWorldPos(){},randomGemFrame(){},setGemArray(){},countCellCoverage(){},recordTask011RefillWriteEvent(){},
   createEnemyTurnGateBaseline:{},createRefillCompleteGate:{},runtimeDebugLogging:{},assertBoardIntegrity(){},getGemGateSnapshot(){},
   getYellowSequenceCompletionIntent:{},traceTask015YellowAnimation(){},traceTask015YellowWrite(){},YELLOW_CASINO_SETTLE_SEC:0,
   YELLOW_CASINO_SETTLE_BOUNCE_AMP:0,YELLOW_COLOR:0,startGemMergeFx(){},getGoldLabelTargetWorld(){},
  });
  return vm.runInContext(`(()=>{let frameCount=0;${tickSource};return tick;})()`,context)();
 };
 const packGlobals={
  HeroProgress:createHeroProgressStore(),ContinuousCombatStageLoop:1,
  ContinuousCombatStage:{seed:4,region:1,stage:1,wave:2,bossAvailable:false,bossArmed:false,bossActive:false,clearedBosses:0,transitions:1,clearedPackMask:0,spawnedPackMask:63,spawnSerial:18,nextEmissionAt:99,lastUpdatedAt:10,lastArenaUpdatedAt:10},
  GamePhase:'RUNTIME',BattleStartActive:0,time:10,EnemyData:rows,EnemySize:40,EnemySlots:[],PendingDeaths:{},EnemyDeathVisualHoldByUID:{},
 };
 const packEntities=[{uid:1,kind:'hero',hp:100,maxHP:100,footX:200,footY:290}];
 for(let sector=0;sector<6;sector++)for(let member=0;member<3;member++)packEntities.push({uid:20+sector*3+member,kind:'enemy',hp:sector===0?0:20,maxHP:20,streamPackIndex:1,streamSectorIndex:6+sector,streamState:'roaming',x:500,y:260,footX:500,footY:260,originY:260,streamEngageX:500,streamWalkSpeed:50});
 runTick({globals:packGlobals,entities:packEntities},{storyEntry:{phase:'combat',combatPaused:false}},()=>false);
 let checkpoint=JSON.parse(savedValues.get(HERO_PROGRESS_SAVE_KEY)).continuousStage;
 assert.equal(checkpoint.wave,2,'a partial current wave remains the saved checkpoint');
 assert.equal(checkpoint.clearedPackMask,1,'the production app tick records and saves the final pack death before returning');

 const globals={
  HeroProgress:createHeroProgressStore(),ContinuousCombatStageLoop:1,
  ContinuousCombatStage:{seed:7,region:1,stage:1,wave:4,bossAvailable:false,bossArmed:false,bossActive:false,clearedBosses:0,transitions:3,nextEmissionAt:3,lastUpdatedAt:3,lastArenaUpdatedAt:3},
  GamePhase:'RUNTIME',BattleStartActive:0,time:3,EnemyData:rows,EnemySize:40,EnemySlots:[],PendingDeaths:{},EnemyDeathVisualHoldByUID:{},
  RealtimeEnemyActionsByUID:{},RealtimeEnemyActionReadyAt:{},PendingHeroHits:[],RealtimeHeroBasicScheduledActions:{},
 };
 const state={globals,entities:[{uid:1,kind:'hero',hp:100,maxHP:100,footX:200,footY:290}]};
 const gameState={storyEntry:{phase:'combat',combatPaused:false}};
 runTick(state,gameState,()=>false);
 checkpoint=JSON.parse(savedValues.get(HERO_PROGRESS_SAVE_KEY)).continuousStage;
 assert.equal(checkpoint.bossAvailable,true,'wave-four stage early return saves the earned readiness');
 assert.equal(checkpoint.wave,1);

 const restored=createHeroProgressStore(JSON.parse(savedValues.get(HERO_PROGRESS_SAVE_KEY)));
 const reloadedGlobals={HeroProgress:restored,GamePhase:'RUNTIME',BattleStartActive:0,time:4,EnemyData:rows,EnemySize:40,EnemySlots:[],PendingDeaths:{},EnemyDeathVisualHoldByUID:{}};
 configureContinuousCombatProduction(reloadedGlobals,{productionPath:true});
 const reloadedState={globals:reloadedGlobals,entities:[{uid:1,kind:'hero',hp:100,maxHP:100,footX:200,footY:290}]};
 const reloadedGameState={storyEntry:{phase:'combat',combatPaused:false}};
 runTick(reloadedState,reloadedGameState,()=>false);
 assert.equal(reloadedGlobals.ContinuousCombatStage.bossActive,false,'a saved unfinished attempt returns to farming instead of resuming unseen');
 assert.equal(reloadedGlobals.ContinuousCombatStage.bossSummonRequired,true);
 assert.equal(reloadedState.entities.filter(actor=>actor.kind==='enemy'&&actor.enemyRole==='boss').length,0);
 assert.ok(reloadedState.entities.some(actor=>actor.kind==='enemy'&&actor.enemyRole!=='boss'));
 runTick(reloadedState,reloadedGameState,()=>false);
 assert.equal(reloadedGlobals.ContinuousCombatStage.bossActive,false,'farming does not auto-enter the surrendered boss');
 assert.equal(summonContinuousCombatBoss(reloadedGlobals,reloadedState.entities,makeCall(reloadedState)),true,'the player can retry explicitly through the existing boss arm path');
 assert.equal(reloadedGlobals.ContinuousCombatStage.bossActive,true);
 assert.equal(reloadedState.entities.filter(actor=>actor.kind==='enemy'&&actor.enemyRole==='boss').length,1);
 reloadedGlobals.ContinuousCombatStage.bossTransitionEndsAtMs=0;
 runTick(reloadedState,reloadedGameState,()=>{
  reloadedState.entities=reloadedState.entities.filter(actor=>actor.kind==='hero');
  resetContinuousCombatAfterDefeat(reloadedGlobals);
  reloadedGameState.storyEntry.phase='defeat';
  return true;
 });
 checkpoint=JSON.parse(savedValues.get(HERO_PROGRESS_SAVE_KEY)).continuousStage;
 assert.equal(checkpoint.bossAvailable,true,'outcome early return preserves defeated-boss readiness');
 assert.equal(checkpoint.bossSummonRequired,true,'the defeated-stage manual retry latch is saved before the outcome early return');
 assert.equal(checkpoint.wave,1);
 assert.equal(checkpoint.clearedPackMask,0,'ready boss recovery starts wave-one farming while readiness keeps the bar full');

 const retryStore=createHeroProgressStore(JSON.parse(savedValues.get(HERO_PROGRESS_SAVE_KEY)));
 const retryGlobals={HeroProgress:retryStore,GamePhase:'RUNTIME',BattleStartActive:0,time:30,EnemyData:rows,EnemySlots:[],PendingDeaths:{},EnemyDeathVisualHoldByUID:{}};
 configureContinuousCombatProduction(retryGlobals,{productionPath:true});
 const retryEntities=[{uid:1,kind:'hero',hp:100,maxHP:100,footX:200,footY:290}];
 const retryCall=(name,row,slotIndex)=>{if(name!=='SpawnEnemy')return;const enemy={uid:100+slotIndex,kind:'enemy',name:row.name,enemyRole:row.enemyRole,hp:row.HP,maxHP:row.HP,slotIndex};retryEntities.push(enemy);return enemy;};
 assert.equal(maybeAdvanceContinuousCombatStage({globals:retryGlobals,entities:retryEntities,presentationBarrier:{lanes:{}},call:retryCall}),true,'a boss-loss checkpoint resumes farming after reload');
 assert.equal(retryGlobals.ContinuousCombatStage.bossActive,false);
 assert.ok(retryEntities.some(actor=>actor.kind==='enemy'&&actor.enemyRole!=='boss'));
 assert.equal(summonContinuousCombatBoss(retryGlobals,retryEntities,retryCall),true,'the player action summons through the existing boss arm path');
 assert.equal(retryGlobals.ContinuousCombatStage.bossActive,true);
 assert.equal(retryGlobals.ContinuousCombatStage.bossSummonRequired,true);
 assert.equal(retryEntities.filter(actor=>actor.kind==='enemy'&&actor.enemyRole==='boss').length,1);
});
