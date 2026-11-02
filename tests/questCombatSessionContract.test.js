const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('full-party recovery emits per-hero restored HP without treating it as skill healing', async () => {
 const {restoreHeroesToFullHP}=await import('../web-runner/systems/questCombatSession.mjs');
 const state={entities:[{uid:1,kind:'hero',hp:0,maxHP:42,isAlive:false},{uid:2,kind:'hero',hp:20,maxHP:30,isAlive:true}],globals:{time:10,DevBalanceCapture:true,ContinuousCombatStage:{defeatRecoveries:2},PendingDeaths:{1:true}}};
 restoreHeroesToFullHP({state,call(){},reason:'continuous_defeat'});
 assert.deepEqual(state.globals.BalanceCombatEvents.map(({type,reason,recoveryIndex,targetUID,sourceUID,amount,hpBefore,hpAfter})=>({type,reason,recoveryIndex,targetUID,sourceUID,amount,hpBefore,hpAfter})),[
  {type:'recovery',reason:'continuous_defeat',recoveryIndex:2,targetUID:1,sourceUID:0,amount:42,hpBefore:0,hpAfter:42},
  {type:'recovery',reason:'continuous_defeat',recoveryIndex:2,targetUID:2,sourceUID:0,amount:10,hpBefore:20,hpAfter:30},
 ]);
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
 const stage={...createContinuousCombatStageState(42,{region:1,stage:1}),wave:10,bossAvailable:true,bossActive:true,bossUID:90,bossTimerStartedAt:10,bossTimeLimitSec:18};
 const hero={uid:1,kind:'hero',name:'Hondo',hp:31,maxHP:60,isAlive:true,statuses:[]};
 const boss={uid:90,kind:'enemy',name:'Troll',enemyRole:'boss',hp:41,maxHP:231};
 const state={entities:[hero,boss],globals:{ContinuousCombatStageLoop:1,ContinuousCombatStage:stage,time:40,EnemyData:[{name:'Gobloc',HP:20,ATK:2,DEF:2,MAG:1,RES:1,SPD:8,CombatPower:20}],EnemySlots:[],PendingDeaths:{},Equipment:{lamp:{autoEnabled:true}}}};
 const calls=[];
 const call=(name,row,slotIndex)=>{calls.push(name);if(name==='SpawnEnemy'){const enemy={uid:100+slotIndex,kind:'enemy',name:row.name,hp:row.HP,maxHP:row.HP,enemyRole:row.enemyRole,slotIndex};state.entities.push(enemy);return enemy;}return null;};
 const session=createQuestCombatSession({state,gameState:{},call,sync(){}});
 assert.equal(session.surrenderBossAttempt('boss_timeout'),true);
 assert.equal(stage.bossTimeouts,1);
 assert.equal(stage.lastBossOutcome,'timeout');
 assert.equal(stage.lastBossTimeout.bossHp,41);
 assert.equal(stage.lastBossTimeout.elapsedSec,30);
 assert.equal(stage.lastBossTimeout.timeLimitSec,30);
 assert.deepEqual(stage.lastBossTimeout.heroes.map(({hp})=>hp),[31]);
 assert.equal(hero.hp,60);
 const recoveredStage=state.globals.ContinuousCombatStage;
 assert.equal(recoveredStage.bossActive,false);
 assert.equal(recoveredStage.bossSummonRequired,true);
 assert.equal(recoveredStage.stage,1);
 assert.equal(session.surrenderBossAttempt('boss_timeout'),false);
 assert.equal(recoveredStage.bossTimeouts,1);
 assert.equal(calls.filter(name=>name==='SettleContinuousCombatRewards').length,1);
});

test('new battle clears combat conditions and retired Flow state while retaining gold and progression', async () => {
 const {resetCombatSessionConditions}=await import('../web-runner/systems/combatSessionReset.mjs');
 const g={goldTotal:321,HeroGemUsage:{RED:9},AstralFlowAmpPoints:12,AstralFlowAmpReady:1,
 PartyBuff_ATK:8,BuffTurns_ATK:3,PartyTempHPShield:40,HeroWardHPByUID:{1:9},PowerAmpByUID:{1:{}},
 EnemyDebuffs:{2:{DEF:8}},EnemyDamageOverTime:[{}],PartyRegens:[{}],TaintedGroundZones:[{}]};
 const ui={partyHpTextRoll:{displayHp:1}}; resetCombatSessionConditions(g,ui);
 assert.equal(g.goldTotal,321);assert.deepEqual(g.HeroGemUsage,{RED:9});
 assert.equal(g.AstralFlowAmpPoints,undefined);assert.equal(g.AstralFlowAmpReady,undefined);
 for(const key of ['PartyBuff_ATK','BuffTurns_ATK','PartyTempHPShield','HeroWardHPByUID','PowerAmpByUID']) assert.equal(g[key],undefined);
 assert.deepEqual(g.EnemyDebuffs,{});assert.deepEqual(g.EnemyDamageOverTime,[]);
 assert.deepEqual(g.PartyRegens,[]);assert.deepEqual(g.TaintedGroundZones,[]);
 assert.equal(ui.partyHpTextRoll,undefined);
});

test('gold persists gains and spending across reloads without writing unchanged balances', async () => {
 const {createEquipmentStorage}=await import('../web-runner/systems/equipmentStorage.mjs');
 const {createHeroProgressStore}=await import('../web-runner/src/core/heroProgression.mjs');
 const locks={request:async(k,fn)=>fn()},seed=()=>1,now=()=>100000;
 const values=new Map();let writes=0;
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){values.set(k,v);writes++;}};
 const globals={goldTotal:27,HeroProgress:createHeroProgressStore()};const wallet=createEquipmentStorage({globals,storage,locks,seed,now});
 await wallet.sync();await wallet.sync();assert.equal(writes,1);
 globals.goldTotal=19;await wallet.sync();
 const reloaded={goldTotal:0,HeroProgress:createHeroProgressStore()};await createEquipmentStorage({globals:reloaded,storage,locks,seed,now}).sync();
 assert.equal(reloaded.goldTotal,19);assert.equal(writes,3);
});


test('macro energy is charged only on entry and meta recovery shares the balance', async () => {
 const fs = require('node:fs'); const vm = require('node:vm');
 const {createStoryEntryFlow} = await import('../web-runner/systems/storyEntryFlow.mjs');
 const globals = {Player_Energy:80, MatchedColorValue:1};
 const gameState = {}; let layout = 'storyMock';
 const flow = createStoryEntryFlow({gameState,energyGlobals:globals,isReady:()=>true,
 layoutState:{getActiveLayoutId:()=>layout,requestLayoutChange:async id=>{layout=id;return true;}}});
 await flow.startCombatForQA();
 assert.equal(globals.Player_Energy,80);
 for (const file of ['web-runner/modules/functionBank.js']) {
  const src=fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8');
  const extract=name=>src.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0];
  const ctx=vm.createContext({getGlobals:()=>globals,Math,GetCurrentTurn:()=>1,random01:()=>0.7,getActorNameByUID:()=> 'Hero',LogCombat:()=>{}});
  vm.runInContext(extract('Sub_Energy'),ctx); ctx.Sub_Energy({},3);
  assert.equal(globals.Player_Energy,80);
  vm.runInContext(extract('Add_Energy'),ctx);
  ctx.Add_Energy({});
  assert.equal(gameState.storyEntry.progress.energy,86);
  globals.Player_Energy=80;
 }
 globals.Player_Energy += 6;
 assert.equal(gameState.storyEntry.progress.energy,86);
});
