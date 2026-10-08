const test = require('node:test');
const assert = require('node:assert/strict');
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

test('continuous defeat is free, clears boss readiness and restarts wave one at full health', async () => {
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
 assert.equal(state.globals.ContinuousCombatStage.bossAvailable,false);
 assert.equal(state.globals.ContinuousCombatStage.bossArmed,false);
 assert.equal(state.entities[0].hp,42);
 assert.equal(state.globals.PendingHeroHits.length,0,'queued enemy projectiles are discarded before revival');
 assert.equal(state.entities[0].locomotion,'idle');assert.equal(state.entities[0].actionState,undefined);assert.equal(state.entities[0].actionStateUntil,undefined);
 const recoveredHeroes=state.entities.filter(actor=>actor.kind==='hero');
 assert.equal(new Set(recoveredHeroes.map(hero=>hero.recoveryFadeStartedAt)).size,1,'the squad shares one reveal start');
 assert.ok(recoveredHeroes.every(hero=>Number.isFinite(hero.footX)&&Number.isFinite(hero.footY)&&hero.x===hero.footX&&hero.y===hero.footY));
 assert.ok(Math.max(...recoveredHeroes.map(hero=>hero.footX))-Math.min(...recoveredHeroes.map(hero=>hero.footX))<60,'heroes return to the compact authored huddle');
 const retryEnemies=state.entities.filter(actor=>actor.kind==='enemy');
 assert.ok(retryEnemies.length>12&&retryEnemies.length<=36, 'underpowered local packs receive up to three extra actors each');
 assert.ok(retryEnemies.every(actor=>actor.streamState==='roaming'));
 const retryPacks=new Map();for(const enemy of retryEnemies){const pack=retryPacks.get(enemy.streamSectorIndex)||[];pack.push(enemy);retryPacks.set(enemy.streamSectorIndex,pack);}
 assert.equal(retryPacks.size,6);
 assert.ok([...retryPacks.values()].every(pack=>pack.length>=3&&pack.length<=6));
 for(const pack of retryPacks.values())assert.deepEqual(pack.map(enemy=>enemy.streamEntryOrder).sort((a,b)=>a-b),Array.from({length:pack.length},(_,index)=>index));
 assert.ok(calls.includes('SettleContinuousCombatRewards'));
 assert.equal(calls.includes('ProcessTurn'),false);
 assert.equal(calls.includes('RebuildTurnOrderPreserveCurrent'),false);
 assert.equal(state.globals.QuestFiniteEncounter,1, 'continuous recovery must keep legacy slot refills disabled');
 assert.equal(gameState.combatFailExitRequested,false);
});

test('ordinary recovery keeps earned boss access deferred while wave-one farming resumes', async () => {
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
 assert.equal(stage.wave,1);
 assert.equal(stage.bossAvailable,true);
 assert.equal(stage.bossArmed,false);
 assert.equal(stage.bossActive,false);
 assert.equal(stage.bossEntryDeferredUntilWaveFour,true);
 const hero=state.entities.find(actor=>actor.kind==='hero');
 assert.equal(hero.hp,42);
 assert.equal(hero.statuses.length,0);
 assert.equal(hero.recoveryFadeStartedAt,8);
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
