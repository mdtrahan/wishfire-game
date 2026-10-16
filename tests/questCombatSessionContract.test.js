const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('app-source outcome routing distinguishes ordinary first KO, boss survivor and boss wipe', async () => {
 const {createQuestCombatSession,recoverContinuousOrdinaryDefeatIfNeeded}=await import('../web-runner/systems/questCombatSession.mjs');
 const {createContinuousCombatStageState}=await import('../web-runner/src/core/continuousCombatStage.mjs');
 const app=fs.readFileSync(require.resolve('../web-runner/app.js'),'utf8');
 const tick=app.slice(app.indexOf('  function tick(){',app.indexOf('let frameCount = 0;')));
 const simulationAt=tick.indexOf('combatSimulationTicker.tick(');
 const ordinaryAt=tick.indexOf('recoverContinuousOrdinaryDefeatIfNeeded({ state, session: questCombat })');
 const stageAt=tick.indexOf('maybeAdvanceContinuousCombatStage(');
 const outcomeAt=tick.indexOf('checkMainRuntimeCombatOutcome()');
 assert.ok(simulationAt>=0&&ordinaryAt>simulationAt&&stageAt>ordinaryAt&&outcomeAt>stageAt,
  'the app tick routes ordinary KO recovery before stage and all-party outcome checks');
 const start=app.indexOf('  function checkMainRuntimeCombatOutcome() {');
 const end=app.indexOf('  function getEnemyHit(mx, my) {',start);
 assert.ok(start>=0&&end>start,'production outcome functions are present');
 const outcomeFunctions=app.slice(start,end);
 const makeScenario=(bossActive)=>{
  const stage=createContinuousCombatStageState(42,{region:1,stage:2});
  Object.assign(stage,{wave:2,bossAvailable:bossActive,bossSummonRequired:bossActive,bossArmed:bossActive,bossActive});
  const state={entities:[
   {uid:1,kind:'hero',hp:0,maxHP:40,isAlive:false},
   {uid:2,kind:'hero',hp:30,maxHP:40,isAlive:true},
   ...(bossActive?[{uid:90,kind:'enemy',enemyRole:'boss',hp:100,maxHP:100}]:[]),
  ],globals:{ContinuousCombatStageLoop:1,ContinuousCombatStage:stage,time:10,
   EnemyData:[{name:'Gobloc',HP:20,ATK:2,DEF:2,MAG:1,RES:1,SPD:8,CombatPower:20}]}};
  const calls=[];
  const call=(name,row,slotIndex)=>{
   calls.push(name);
   if(name==='SpawnEnemy'){
    const enemy={uid:100+slotIndex,kind:'enemy',name:row.name,enemyRole:row.enemyRole,hp:row.HP,maxHP:row.HP,slotIndex};
    state.entities.push(enemy);
    return enemy;
   }
   return null;
  };
  const session=createQuestCombatSession({state,gameState:{},call,sync(){}});
  const context=vm.createContext({state,questCombat:session,
   resolveMainRuntimeCombatOutcome:()=>({reason:'no_living_heroes'})});
  const checkOutcome=vm.runInContext(`${outcomeFunctions}\ncheckMainRuntimeCombatOutcome`,context);
  return {state,session,calls,checkOutcome};
 };

 const ordinary=makeScenario(false);
 assert.equal(recoverContinuousOrdinaryDefeatIfNeeded({state:ordinary.state,session:ordinary.session}),true);
 assert.deepEqual(ordinary.state.entities.filter(actor=>actor.kind==='hero').map(hero=>hero.hp),[40,40]);
 assert.equal(ordinary.state.globals.ContinuousCombatStage.stage,2);
 assert.equal(ordinary.state.globals.ContinuousCombatStage.wave,2);
 assert.equal(ordinary.calls.filter(name=>name==='SettleContinuousCombatRewards').length,1);

 const boss=makeScenario(true);
 assert.equal(recoverContinuousOrdinaryDefeatIfNeeded({state:boss.state,session:boss.session}),false);
 assert.equal(boss.checkOutcome(),false,'one surviving hero keeps the boss attempt active');
 assert.equal(boss.state.globals.ContinuousCombatStage.bossActive,true);
 boss.state.entities.find(actor=>actor.uid===2).hp=0;
 boss.state.entities.find(actor=>actor.uid===2).isAlive=false;
 assert.equal(boss.checkOutcome(),true,'the production outcome check routes a full wipe to recovery');
 assert.equal(boss.state.globals.ContinuousCombatStage.stage,2);
 assert.equal(boss.state.globals.ContinuousCombatStage.bossActive,false);
 assert.equal(boss.state.globals.ContinuousCombatStage.bossSummonRequired,true);
 assert.deepEqual(boss.state.entities.filter(actor=>actor.kind==='hero').map(hero=>hero.hp),[40,40]);
 assert.equal(boss.calls.filter(name=>name==='SettleContinuousCombatRewards').length,1);
});
test('full-party recovery emits per-hero restored HP without treating it as skill healing', async () => {
 const {restoreHeroesToFullHP}=await import('../web-runner/systems/questCombatSession.mjs');
 const state={entities:[{uid:1,kind:'hero',hp:0,maxHP:42,isAlive:false},{uid:2,kind:'hero',hp:20,maxHP:30,isAlive:true}],globals:{time:10,DevBalanceCapture:true,ContinuousCombatStage:{defeatRecoveries:2},PendingDeaths:{1:true}}};
 restoreHeroesToFullHP({state,call(){},reason:'continuous_defeat'});
 assert.deepEqual(state.globals.BalanceCombatEvents.map(({type,reason,recoveryIndex,targetUID,sourceUID,amount,hpBefore,hpAfter})=>({type,reason,recoveryIndex,targetUID,sourceUID,amount,hpBefore,hpAfter})),[
  {type:'recovery',reason:'continuous_defeat',recoveryIndex:2,targetUID:1,sourceUID:0,amount:42,hpBefore:0,hpAfter:42},
  {type:'recovery',reason:'continuous_defeat',recoveryIndex:2,targetUID:2,sourceUID:0,amount:10,hpBefore:20,hpAfter:30},
 ]);
});
test('resurrection retains enemy progress, buffs and skills while reviving every hero', async () => {
 const {createQuestCombatSession}=await import('../web-runner/systems/questCombatSession.mjs');
 const state={entities:[{uid:1,kind:'hero',hp:0,maxHP:42,isAlive:false,actionState:'ko',actionFacing:'left',actionStateUntil:86400,buffs:{ward:3},skills:['faze']},{uid:2,kind:'hero',hp:0,maxHP:35,isAlive:false},{uid:3,kind:'enemy',hp:7,maxHP:50}],globals:{time:10,Player_Energy:-1,Player_maxEnergy:150,PendingDeaths:{1:true,3:true},Skills:{faze:true},HeroBuffs:{ward:3}}};
 const gameState={combatFailExitRequested:true};const calls=[];
 const session=createQuestCombatSession({state,gameState,call:n=>calls.push(n),sync(){}});
 session.prepare();assert.equal(session.isCleared(),false);
 session.resurrect();
 assert.equal(state.globals.Player_Energy,-1);
 assert.deepEqual(state.entities.map(e=>e.hp),[42,35,7]);
 assert.deepEqual(state.entities[0].buffs,{ward:3});assert.deepEqual(state.entities[0].skills,['faze']);
 assert.deepEqual(state.globals.PendingDeaths,{3:true});
 assert.equal(state.entities[0].locomotion,'idle');assert.equal(state.entities[0].locomotionStartedAt,10);assert.equal(state.entities[0].actionState,undefined);assert.equal(state.entities[0].actionStateUntil,undefined);
 assert.deepEqual(state.globals.Skills,{faze:true});assert.deepEqual(state.globals.HeroBuffs,{ward:3});
 assert.equal(gameState.combatFailExitRequested,false);
 assert.ok(calls.includes('UpdateHeroHPUI'));
 assert.equal(calls.includes('ProcessTurn'),false);
 assert.equal(calls.includes('RebuildTurnOrderPreserveCurrent'),false);
 state.entities=state.entities.filter(e=>e.kind!=='enemy');
 state.globals.AstralFlowKoOrbQueue=[{}];assert.equal(session.isCleared(),false);
 state.globals.NativeBattleEnded=false;assert.equal(session.isCleared(),false);
});

test('continuous KO resurrection puts the restored squad in one huddle and starts one shared reveal', async () => {
 const {createQuestCombatSession}=await import('../web-runner/systems/questCombatSession.mjs');
 const {isActorRecoveryRevealActive}=await import('../web-runner/src/core/actorPresentationState.mjs');
 const heroes=[
  {uid:1,kind:'hero',heroInstanceKey:'Fara',hp:0,maxHP:42,isAlive:false,footX:-400,footY:999,originX:-500,targetX:1200,actionState:'ko'},
  {uid:2,kind:'hero',heroInstanceKey:'Hondo',hp:8,maxHP:35,isAlive:true,footX:1600,footY:-200,originY:-300,targetY:-900,arenaDirectionX:-1,actionState:'attack'},
 ];
 const state={entities:heroes,globals:{time:12,ContinuousCombatStageLoop:1,PendingDeaths:{1:true},RealtimeHeroBasicScheduledActions:{1:{dueAt:99}}}};
 const gameState={combatFailExitRequested:true};
 const session=createQuestCombatSession({state,gameState,call(){},sync(){}});
 session.resurrect();
 assert.deepEqual(heroes.map(hero=>hero.hp),[42,35]);
 assert.deepEqual(heroes.map(hero=>hero.recoveryFadeStartedAt),[12,12]);
 assert.ok(heroes.every(hero=>isActorRecoveryRevealActive(hero,state.globals.time)));
 assert.notDeepEqual(heroes.map(hero=>[hero.footX,hero.footY]),[[-400,999],[1600,-200]],'old offscreen positions are replaced with authored huddle slots');
 assert.ok(heroes.every(hero=>hero.footX >= 0 && hero.footY >= 0 && hero.locomotion === 'idle'));
 assert.ok(heroes.every(hero=>hero.originX === undefined && hero.originY === undefined && hero.targetX === undefined && hero.targetY === undefined && hero.arenaDirectionX === undefined));
 assert.deepEqual(state.globals.RealtimeHeroBasicScheduledActions,{});
 assert.equal(gameState.combatFailExitRequested,false);
});

test('endless sessions never surface a finite-victory completion path', async () => {
 const {createQuestCombatSession}=await import('../web-runner/systems/questCombatSession.mjs');
 const state={entities:[],globals:{QuestFiniteEncounter:1,NativeBattleEnded:true,ProgressionBattle:{id:'victory-auto',outcome:'victory'},SessionLevelUpSettlement:null,FlowOrbs:[]}};
 const session=createQuestCombatSession({state,gameState:{},call(){},sync(){}});
 session.prepare();
 assert.equal(state.globals.QuestFiniteEncounter,0);
 assert.equal(session.isCleared(),false);
 state.globals.SessionLevelUpSettlement={phase:'active'};
 assert.equal(session.isCleared(),false, 'EXP rows do not create a finite completion');
 state.globals.SessionLevelUpSettlement=null;
 state.globals.FlowOrbs=[{}];
 assert.equal(session.isCleared(),false, 'remaining victory presentation clears before auto-advance');
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../web-runner/systems/questCombatSession.mjs'),'utf8');
 assert.doesNotMatch(src,/battle-results|showResults|Continue/);
});

test('boss defeat is free, retains the full ready milestone, and resumes farming until summoned', async () => {
 const {createQuestCombatSession}=await import('../web-runner/systems/questCombatSession.mjs');
 const enemyRows=['Gobloc','Skeleton'].map((name,index)=>({name,HP:20+index*2,ATK:2,DEF:2,MAG:1,RES:1,SPD:8,CombatPower:20+index}));
 const state={entities:[{uid:1,kind:'hero',heroInstanceKey:'Hondo',hp:0,maxHP:42,isAlive:false,actionState:'ko',actionFacing:'left',actionStateUntil:86400,
  ATK:900,DEF:900,MAG:900,RES:900,SPD:900},
  ...Array.from({length:3},(_,index)=>({uid:index+2,kind:'hero',hp:40,maxHP:40,ATK:900,DEF:900,MAG:900,RES:900,SPD:900})),
  {uid:9,kind:'enemy',hp:30,maxHP:30}],globals:{
  ContinuousCombatStageLoop:1,ContinuousCombatStage:{seed:1,region:2,stage:3,wave:4,bossAvailable:true,bossArmed:true,bossActive:true,transitions:8,clearedBosses:12,nextEmissionAt:0,lastUpdatedAt:0,spawnSerial:9},
  EnemyData:enemyRows,EnemySlots:[9],PendingHeroHits:[{targetUID:1,at:0,sourceUID:9}],PendingDeaths:{1:true,9:true},EnemyDeathVisualHoldByUID:{9:true},time:5,ProgressionBattle:{id:'run',participants:['Hondo'],defeated:{},settled:false},
 }};
 const gameState={combatFailExitRequested:true};const calls=[];
 const call=(name,data,slotIndex)=>{
  calls.push(name);
  if(name!=='SpawnEnemy')return null;
  const enemy={uid:20+slotIndex,kind:'enemy',name:data.name,hp:data.HP,maxHP:data.HP,slotIndex};state.entities.push(enemy);return enemy;
 };
 const session=createQuestCombatSession({state,gameState,call,sync(){}});
 assert.equal(session.recoverContinuousDefeat(),true);
 assert.equal(state.globals.ContinuousCombatStage.region,2);
 assert.equal(state.globals.ContinuousCombatStage.stage,3);
 assert.equal(state.globals.ContinuousCombatStage.wave,1);
 assert.equal(state.globals.ContinuousCombatStage.bossAvailable,true);
 assert.equal(state.globals.ContinuousCombatStage.bossSummonRequired,true);
 assert.equal(state.globals.ContinuousCombatStage.clearedPackMask,0,'boss loss keeps the 100% ready flag while starting a fresh farming wave');
 assert.equal(state.globals.ContinuousCombatStage.bossArmed,false);
 assert.equal(state.entities[0].hp,42);
 assert.equal(state.globals.PendingHeroHits.length,0,'queued enemy projectiles are discarded before revival');
 assert.equal(state.entities[0].locomotion,'idle');assert.equal(state.entities[0].actionState,undefined);assert.equal(state.entities[0].actionStateUntil,undefined);
 const recoveredHeroes=state.entities.filter(actor=>actor.kind==='hero');
 assert.equal(new Set(recoveredHeroes.map(hero=>hero.recoveryFadeStartedAt)).size,1,'the squad shares one reveal start');
 assert.ok(recoveredHeroes.every(hero=>Number.isFinite(hero.footX)&&Number.isFinite(hero.footY)&&hero.x===hero.footX&&hero.y===hero.footY));
 assert.ok(Math.max(...recoveredHeroes.map(hero=>hero.footX))-Math.min(...recoveredHeroes.map(hero=>hero.footX))<60,'heroes return to the compact authored huddle');
 assert.ok(state.entities.some(actor=>actor.kind==='enemy'&&actor.enemyRole!=='boss'),'recovery resumes ordinary farming before explicit boss summon');
 assert.ok(calls.includes('SettleContinuousCombatRewards'));
 assert.equal(calls.includes('ProcessTurn'),false);
 assert.equal(calls.includes('RebuildTurnOrderPreserveCurrent'),false);
 assert.equal(state.globals.QuestFiniteEncounter,1, 'continuous recovery must keep legacy slot refills disabled');
 assert.equal(gameState.combatFailExitRequested,false);
});

test('ordinary recovery preserves a wave-four ready milestone and requires a manual boss summon', async () => {
 const {createQuestCombatSession,recoverContinuousOrdinaryDefeatIfNeeded}=await import('../web-runner/systems/questCombatSession.mjs');
 const state={entities:[{uid:1,kind:'hero',heroIndex:0,hp:0,maxHP:42,isAlive:false,statuses:[{statusEffect:'dot',duration:4}],x:190,y:330,footX:190,footY:330}],globals:{
  ContinuousCombatStageLoop:1,ContinuousCombatStage:{seed:4,region:1,stage:2,wave:4,bossAvailable:true,bossArmed:false,bossActive:false,transitions:3,clearedBosses:2,nextEmissionAt:0,lastUpdatedAt:0,spawnSerial:0},
  EnemyData:[{name:'Gobloc',HP:20,ATK:2,DEF:2,MAG:1,RES:1,SPD:8,CombatPower:20}],time:8,
 }};
 let settlements=0;
 const call=(name,data,slotIndex)=>{if(name==='SettleContinuousCombatRewards')settlements++;if(name==='SpawnEnemy'){state.entities.push({uid:10+slotIndex,kind:'enemy',name:data.name,hp:data.HP,maxHP:data.HP,slotIndex,streamState:'roaming'});return state.entities.at(-1);}return null;};
 const session=createQuestCombatSession({state,gameState:{},call,sync(){}});
 assert.equal(recoverContinuousOrdinaryDefeatIfNeeded({state,session}),true);
 assert.equal(recoverContinuousOrdinaryDefeatIfNeeded({state,session}),false);
 assert.equal(settlements,1,'the KO latch settles and recovers only once');
 const stage=state.globals.ContinuousCombatStage;
 assert.equal(stage.wave,1,'ready defeat recovery starts a fresh farming wave at the preserved full milestone');
  assert.equal(stage.bossAvailable,true);
  assert.equal(stage.bossArmed,false);
  assert.equal(stage.bossActive,false);
 assert.equal(stage.bossSummonRequired,true);
 assert.equal(stage.clearedPackMask,0);
 assert.equal(stage.nextEmissionAt,11);
 assert.ok(state.entities.some(actor=>actor.kind==='enemy'&&actor.name!=='Troll'));
 assert.equal(state.entities.some(actor=>actor.kind==='enemy'&&actor.enemyRole==='boss'),false);
 const hero=state.entities.find(actor=>actor.kind==='hero');
 assert.equal(hero.hp,42);
 assert.equal(hero.statuses.length,0);
 assert.equal(hero.recoveryFadeStartedAt,8);
});

test('surrendering an active boss clears queued victory work and returns to manual-retry farming', async () => {
 const {createQuestCombatSession}=await import('../web-runner/systems/questCombatSession.mjs');
 const {createHeroProgressStore}=await import('../web-runner/src/core/heroProgression.mjs');
 const {settleContinuousCombatRewards}=await import('../web-runner/modules/heroCommands.mjs');
 const progress=createHeroProgressStore();
 const heroes=Object.entries(progress.heroes).map(([id,hero],index)=>({...hero,uid:index+1,kind:'hero',heroInstanceKey:id,hp:hero.maxHP,isAlive:true}));
 const boss={uid:90,kind:'enemy',enemyRole:'boss',combatRank:'boss',name:'Troll',hp:0,maxHP:100,streamState:'engaged'};
 const attempt={id:'boss-surrender',participants:heroes.map(hero=>hero.heroInstanceKey),defeated:{90:900,91:25},defeatedGold:{90:9000,91:17},outcome:'active'};
 let ledgerAtSettlement=null;
 const globals={
  ContinuousCombatStageLoop:1,
  ContinuousCombatStage:{seed:42,region:1,stage:2,wave:1,bossAvailable:true,bossSummonRequired:false,bossArmed:true,bossActive:true,bossUID:90,transitions:4,clearedBosses:3,clearedPackMask:0,spawnedPackMask:0,nextEmissionAt:0,lastUpdatedAt:10,spawnSerial:1},
  Equipment:{lamp:{autoEnabled:true}},
  EnemyData:[{name:'Gobloc',HP:100,ATK:2,DEF:2,MAG:1,RES:1,SPD:8,CombatPower:10000}],
  EnemySlots:[],EnemyDeathVisualHoldByUID:{90:true},PendingDeaths:{90:true},
  PendingHeroHits:[{targetUID:90}],CombatImpactRequests:[{targetUID:90}],RealtimeEnemyActionsByUID:{90:{active:true}},
  NativeBattleEnded:true,ProgressionBattle:attempt,HeroProgress:progress,goldTotal:0,time:10,
 };
 const state={globals,entities:[...heroes]},gameState={};let settlements=0;
 const call=(name,row,slotIndex)=>{
  if(name==='SettleContinuousCombatRewards'){settlements++;ledgerAtSettlement={defeated:{...attempt.defeated},defeatedGold:{...attempt.defeatedGold}};return settleContinuousCombatRewards({state,callFunction(){}});}
  if(name==='SpawnEnemy'){const actor={uid:100+slotIndex,kind:'enemy',name:row.name,hp:row.HP,maxHP:row.HP,enemyRole:row.enemyRole,slotIndex};state.entities.push(actor);return actor;}
  return null;
 };
 const session=createQuestCombatSession({state,gameState,call,sync(){}});
 assert.equal(session.surrenderBossAttempt(),true);
 assert.equal(settlements,1);
 assert.equal(globals.goldTotal,17,'earlier fodder rewards settle while the removed boss reward is discarded');
 assert.equal(Object.hasOwn(ledgerAtSettlement.defeated,'90'),false);
 assert.equal(Object.hasOwn(ledgerAtSettlement.defeatedGold,'90'),false);
 assert.equal(ledgerAtSettlement.defeated['91'],25);assert.equal(ledgerAtSettlement.defeatedGold['91'],17);
 assert.equal(globals.ContinuousCombatStage.bossUID,null);
 assert.deepEqual(globals.PendingHeroHits,[]);
 assert.deepEqual(globals.CombatImpactRequests,[]);
 assert.equal(globals.RealtimeEnemyActionsByUID,undefined);
 assert.equal(globals.NativeBattleEnded,false);
 assert.equal(globals.ContinuousCombatStage.bossAvailable,true);
 assert.equal(globals.ContinuousCombatStage.bossActive,false);
 assert.equal(globals.ContinuousCombatStage.bossSummonRequired,true);
 assert.equal(globals.ContinuousCombatStage.region,1);assert.equal(globals.ContinuousCombatStage.stage,2);assert.equal(globals.ContinuousCombatStage.clearedBosses,3,'surrender retains stage progress');
 assert.equal(globals.Equipment.lamp.autoEnabled,true,'surrender leaves the separately saved Lamp Auto preference enabled');
 assert.ok(heroes.every(hero=>hero.hp===hero.maxHP&&hero.isAlive));
 assert.ok(state.entities.some(actor=>actor.kind==='enemy'&&actor.enemyRole!=='boss'),'ordinary farming resumes after surrender');
 assert.equal(session.surrenderBossAttempt(),false,'duplicate menu or lifecycle exits cannot settle the attempt twice');
});

test('surrender is a no-op outside an active continuous boss attempt', async () => {
 const {createQuestCombatSession}=await import('../web-runner/systems/questCombatSession.mjs');
 const stage={region:1,stage:4,wave:2,bossAvailable:false,bossSummonRequired:false,bossActive:false,clearedBosses:7};
 let settlements=0;const state={entities:[],globals:{ContinuousCombatStageLoop:1,ContinuousCombatStage:stage}};
 const session=createQuestCombatSession({state,gameState:{},call(name){if(name==='SettleContinuousCombatRewards')settlements++;},sync(){}});
 assert.equal(session.surrenderBossAttempt(),false);assert.deepEqual(stage,{region:1,stage:4,wave:2,bossAvailable:false,bossSummonRequired:false,bossActive:false,clearedBosses:7});assert.equal(settlements,0);
});

test('boss timeout records the living party and boss HP before same-stage recovery', async () => {
 const {createQuestCombatSession}=await import('../web-runner/systems/questCombatSession.mjs');
 const {createContinuousCombatStageState}=await import('../web-runner/src/core/continuousCombatStage.mjs');
 const stage={...createContinuousCombatStageState(42,{region:1,stage:2}),wave:4,bossAvailable:true,bossActive:true,bossUID:90,bossTimerStartedAt:10,bossTimeLimitSec:18};
 const hero={uid:1,kind:'hero',name:'Hondo',hp:31,maxHP:60,isAlive:true,statuses:[]};
 const boss={uid:90,kind:'enemy',name:'Troll',enemyRole:'boss',hp:41,maxHP:231};
 const state={entities:[hero,boss],globals:{ContinuousCombatStageLoop:1,ContinuousCombatStage:stage,time:28,EnemyData:[{name:'Gobloc',HP:20,ATK:2,DEF:2,MAG:1,RES:1,SPD:8,CombatPower:20}],EnemySlots:[],PendingDeaths:{},Equipment:{lamp:{autoEnabled:true}}}};
 const calls=[];
 const call=(name,row,slotIndex)=>{calls.push(name);if(name==='SpawnEnemy'){const enemy={uid:100+slotIndex,kind:'enemy',name:row.name,hp:row.HP,maxHP:row.HP,enemyRole:row.enemyRole,slotIndex};state.entities.push(enemy);return enemy;}return null;};
 const session=createQuestCombatSession({state,gameState:{},call,sync(){}});
 assert.equal(session.surrenderBossAttempt('boss_timeout'),true);
 assert.equal(stage.bossTimeouts,1);
 assert.equal(stage.lastBossOutcome,'timeout');
 assert.equal(stage.lastBossTimeout.bossHp,41);
 assert.equal(stage.lastBossTimeout.elapsedSec,18);
 assert.deepEqual(stage.lastBossTimeout.heroes.map(({hp})=>hp),[31]);
 assert.equal(hero.hp,60);
 const recoveredStage=state.globals.ContinuousCombatStage;
 assert.equal(recoveredStage.bossActive,false);
 assert.equal(recoveredStage.bossSummonRequired,true);
 assert.equal(recoveredStage.stage,2);
 assert.equal(session.surrenderBossAttempt('boss_timeout'),false);
 assert.equal(recoveredStage.bossTimeouts,1);
 assert.equal(calls.filter(name=>name==='SettleContinuousCombatRewards').length,1);
});

test('ordinary KO captures cleared sectors before removing enemies and respawns only unfinished packs', async () => {
 const {createQuestCombatSession}=await import('../web-runner/systems/questCombatSession.mjs');
 const {buildContinuousCombatSpawnPlan,activateContinuousCombatSpawnedEnemy,deriveContinuousCombatWavePackProgress,getContinuousCombatPartyCP}=await import('../web-runner/src/core/continuousCombatStage.mjs');
 const rows=['High Gobloc','Lizardo','Orc'].map((name,index)=>({name,HP:20+index*2,ATK:2,DEF:2,MAG:1,RES:1,SPD:8,CombatPower:20+index}));
 const stage={seed:4,region:1,stage:2,wave:3,bossAvailable:false,bossArmed:false,bossActive:false,transitions:2,clearedBosses:2,clearedPackMask:0,spawnedPackMask:63,nextEmissionAt:0,lastUpdatedAt:0,spawnSerial:12};
 const globals={ContinuousCombatStageLoop:1,ContinuousCombatStage:stage,EnemyData:rows,EnemySlots:Array.from({length:12},(_,i)=>i),PendingDeaths:{},EnemyDeathVisualHoldByUID:{},Equipment:{lamp:{autoEnabled:true}},time:8};
 const hero={uid:1,kind:'hero',hp:0,maxHP:42,isAlive:false,ATK:90,DEF:90,MAG:90,RES:90,SPD:90};
 const entities=[hero];
 const plan=buildContinuousCombatSpawnPlan(rows,stage);stage.spawnSerial=plan.length;stage.spawnedPackMask=plan.reduce((mask,entry)=>mask|(1<<entry.sectorIndex),0);
 const enemies=plan.map((entry,index)=>{const enemy={uid:10+index,kind:'enemy',hp:entry.row.HP,maxHP:entry.row.HP,name:entry.row.name};activateContinuousCombatSpawnedEnemy(globals,enemy,entry);entities.push(enemy);return enemy;});
 for(const enemy of enemies)if([0,3].includes(enemy.streamSectorIndex%6))enemy.hp=0;
 const state={globals,entities};let nextUid=100;let rewardSettlements=0;
 const session=createQuestCombatSession({state,gameState:{},call(name,data,slotIndex){if(name==='SettleContinuousCombatRewards'){rewardSettlements++;return;}if(name!=='SpawnEnemy')return null;const enemy={uid:nextUid++,kind:'enemy',name:data.name,hp:data.HP,maxHP:data.HP,slotIndex};state.entities.push(enemy);return enemy;},sync(){}});
 const firstOldUIDs=new Set(state.entities.filter(actor=>actor.kind==='enemy').map(actor=>actor.uid));
 globals.PendingDeaths={[[...firstOldUIDs][0]]:1};globals.EnemyDeathVisualHoldByUID={[[...firstOldUIDs][1]]:4};globals.PendingHeroHits=[{targetUID:[...firstOldUIDs][0]}];globals.RealtimeEnemyActionsByUID={[[...firstOldUIDs][0]]:{targetUID:1}};globals.SelectedEnemyUID=[...firstOldUIDs][0];
 assert.equal(session.recoverContinuousDefeat(),true);
 const recoveredStage=globals.ContinuousCombatStage;
 assert.equal(recoveredStage.wave,3,'KO recovery keeps the active wave');
 assert.equal(recoveredStage.bossSummonRequired,true,'a KO before readiness also requires a manual summon later in this stage');
 assert.equal(recoveredStage.clearedPackMask,(1<<0)|(1<<3),'clears are recorded before the old enemy array is discarded');
 assert.equal(recoveredStage.transitions,3,'each recovery advances the existing deterministic generation serial once');
 assert.equal(recoveredStage.region,1);assert.equal(recoveredStage.stage,2);assert.equal(recoveredStage.bossAvailable,false);assert.equal(globals.Equipment.lamp.autoEnabled,true);
 assert.equal(deriveContinuousCombatWavePackProgress(recoveredStage,state.entities).fraction,2/6);
 const recovered=state.entities.filter(actor=>actor.kind==='enemy');
 assert.deepEqual([...new Set(recovered.map(enemy=>enemy.streamSectorIndex%6))],[1,2,4,5]);
 assert.ok(recovered.every(enemy=>!firstOldUIDs.has(enemy.uid)),'old enemy identities do not survive recovery');
 assert.equal(Object.keys(globals.PendingDeaths).length,0);assert.equal(Object.keys(globals.EnemyDeathVisualHoldByUID).length,0);assert.deepEqual(globals.PendingHeroHits,[]);assert.equal(globals.RealtimeEnemyActionsByUID,undefined);assert.equal(globals.SelectedEnemyUID,0);
 const expectedFirst=buildContinuousCombatSpawnPlan(rows,recoveredStage,{partyCP:getContinuousCombatPartyCP(state.entities),enemySize:40}).filter(entry=>!(recoveredStage.clearedPackMask&(1<<entry.sectorIndex)));
 const shape=entries=>entries.map(entry=>`${(entry.streamSectorIndex ?? entry.sectorIndex)%6}:${entry.name ?? entry.row?.name}:${entry.footX}:${entry.footY}`).sort().join('|');
 const expectedShape=entries=>entries.map(entry=>{const actor={uid:999,kind:'enemy',name:entry.row.name,enemyRole:'fodder'};activateContinuousCombatSpawnedEnemy(globals,actor,entry);return `${entry.sectorIndex}:${actor.name}:${actor.footX}:${actor.footY}`;}).sort().join('|');
 assert.equal(shape(recovered),expectedShape(expectedFirst),'first recovery uses the current full-party CP for its seeded compensation plan');
 assert.ok(expectedFirst.length>4*2,'the current party CP receives existing bonus enemies on weak packs');
 const firstLoadout=shape(recovered);
 hero.ATK=400;hero.DEF=400;hero.MAG=400;hero.RES=400;hero.SPD=400;
 hero.hp=0;hero.isAlive=false;
 assert.equal(session.recoverContinuousDefeat(),true,'a later KO can recover the same preserved partial wave again');
 const rerolled=state.entities.filter(actor=>actor.kind==='enemy');
 const secondLoadout=shape(rerolled);
 const expectedSecond=buildContinuousCombatSpawnPlan(rows,globals.ContinuousCombatStage,{partyCP:getContinuousCombatPartyCP(state.entities),enemySize:40}).filter(entry=>!(globals.ContinuousCombatStage.clearedPackMask&(1<<entry.sectorIndex)));
 assert.equal(shape(rerolled),expectedShape(expectedSecond),'next recovery recalculates compensation from the changed current party CP');
 assert.notEqual(expectedSecond.length,expectedFirst.length,'the changed party CP changes the deterministic bonus plan');
 assert.equal(globals.ContinuousCombatStage.transitions,4);
 assert.equal(globals.ContinuousCombatStage.clearedPackMask,(1<<0)|(1<<3));
 assert.equal(globals.ContinuousCombatStage.wave,3);assert.equal(globals.ContinuousCombatStage.region,1);assert.equal(globals.ContinuousCombatStage.stage,2);assert.equal(globals.ContinuousCombatStage.bossAvailable,false);assert.equal(globals.Equipment.lamp.autoEnabled,true);
 assert.notEqual(secondLoadout,firstLoadout,'fresh recovery composition or placement differs from the previous attempt');
 assert.notDeepEqual(rerolled.map(enemy=>enemy.name),recovered.map(enemy=>enemy.name),'authored enemy composition is rerolled, not merely repositioned');
 assert.notDeepEqual(rerolled.map(enemy=>[enemy.footX,enemy.footY]),recovered.map(enemy=>[enemy.footX,enemy.footY]),'fresh pack and solo placements use the next deterministic generation');
 assert.ok(rerolled.every(enemy=>!firstOldUIDs.has(enemy.uid)&&!recovered.some(old=>old.uid===enemy.uid)));
 assert.equal(rewardSettlements,2,'each attempt settles once, without reusing prior actor UIDs');
});

test('new battle clears combat conditions and retired Flow state while retaining gold and progression', async () => {
 const {resetCombatSessionConditions}=await import('../web-runner/systems/combatSessionReset.mjs');
 const g={goldTotal:321,HeroGemUsage:{RED:9},AstralFlowAmpPoints:12,AstralFlowAmpReady:1,
 PartyBuff_ATK:8,BuffTurns_ATK:3,PartyTempHPShield:40,PowerAmpByUID:{1:{}},
 EnemyDebuffs:{2:{DEF:8}},EnemyDamageOverTime:[{}],PartyRegens:[{}],TaintedGroundZones:[{}]};
 const ui={partyHpTextRoll:{displayHp:1}}; resetCombatSessionConditions(g,ui);
 assert.equal(g.goldTotal,321);assert.deepEqual(g.HeroGemUsage,{RED:9});
 assert.equal(g.AstralFlowAmpPoints,undefined);assert.equal(g.AstralFlowAmpReady,undefined);
 for(const key of ['PartyBuff_ATK','BuffTurns_ATK','PartyTempHPShield','PowerAmpByUID']) assert.equal(g[key],undefined);
 assert.deepEqual(g.EnemyDebuffs,{});assert.deepEqual(g.EnemyDamageOverTime,[]);
 assert.deepEqual(g.PartyRegens,[]);assert.deepEqual(g.TaintedGroundZones,[]);
 assert.equal(ui.partyHpTextRoll,undefined);
});

test('gold persists gains and spending across reloads without writing unchanged balances', async () => {
 const {createEquipmentStorage}=await import('../web-runner/systems/equipmentStorage.mjs');
 const locks={request:async(k,fn)=>fn()},seed=()=>1,now=()=>100000;
 const values=new Map();let writes=0;
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){values.set(k,v);writes++;}};
 const globals={goldTotal:27};const wallet=createEquipmentStorage({globals,storage,locks,seed,now});
 await wallet.sync();await wallet.sync();assert.equal(writes,1);
 globals.goldTotal=19;await wallet.sync();
 const reloaded={goldTotal:0};await createEquipmentStorage({globals:reloaded,storage,locks,seed,now}).sync();
 assert.equal(reloaded.goldTotal,19);assert.equal(writes,3);
});


test('macro energy is charged only on entry and purple recovery shares the balance', async () => {
 const fs = require('node:fs'); const vm = require('node:vm');
 const {createStoryEntryFlow} = await import('../web-runner/systems/storyEntryFlow.mjs');
 const globals = {Player_Energy:80, MatchedColorValue:1};
 const gameState = {}; let layout = 'storyMock';
 const flow = createStoryEntryFlow({gameState,energyGlobals:globals,isReady:()=>true,
 layoutState:{getActiveLayoutId:()=>layout,requestLayoutChange:async id=>{layout=id;return true;}}});
 await flow.startCombatForQA();
 assert.equal(globals.Player_Energy,80);
 for (const file of ['Scripts/functionBank.js','web-runner/modules/functionBank.js']) {
  const src=fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8');
  const extract=name=>src.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0];
  const ctx=vm.createContext({getGlobals:()=>globals,Math,GetCurrentTurn:()=>1,rollCombatRandom:()=>0,getActorNameByUID:()=> 'Hero',LogCombat:()=>{}});
  vm.runInContext(extract('Sub_Energy'),ctx); ctx.Sub_Energy({},3);
  assert.equal(globals.Player_Energy,80);
  vm.runInContext(extract('GrantPurpleMatchEnergy'),ctx);
  ctx.GrantPurpleMatchEnergy({},1,3,6);
  assert.equal(gameState.storyEntry.progress.energy,86);
  globals.Player_Energy=80;
 }
 globals.Player_Energy += 6;
 assert.equal(gameState.storyEntry.progress.energy,86);
});
