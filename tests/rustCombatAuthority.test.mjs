import {createEquipmentStorage,EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';
import { createCombatAuthorityDriver } from '../web-runner/src/core/combatAuthorityDriver.mjs';
import { settleContinuousCombatRewards } from '../web-runner/modules/heroCommands.mjs';
import { createRustCombatRuntime } from '../web-runner/systems/rustCombatRuntime.mjs';
import { installRustCombat, isRustCombatStage } from '../web-runner/systems/rustCombat.mjs';
import { createQuestCombatSession } from '../web-runner/systems/questCombatSession.mjs';
import { createCombatHostClock } from '../web-runner/systems/combatHostClock.mjs';
import { createContinuousCombatStageState } from '../web-runner/src/core/continuousCombatStage.mjs';
import { createHeroProgressStore, newHeroProgress, refreshHeroStats } from '../web-runner/src/core/heroProgression.mjs';
const progressSource = fs.readFileSync(new URL('../web-runner/systems/heroProgressStorage.js', import.meta.url), 'utf8');
const persistHeroProgressIfDirty = new Function('window', `${progressSource.replace(/^import .*\n/gm, '').replace(/export /g, '')}; return persistHeroProgressIfDirty;`)({ localStorage: { setItem: (k, v) => globalThis.window.localStorage.setItem(k, v) } });
const wasm = new WebAssembly.Module(fs.readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url)));
const noLeaks = bridge => assert.deepEqual(bridge.describe().resources, { worlds: 0, responses: 0, inputs: 1 });
function fixture({ lose = false, fault = false, deathObjects = false, durable = false } = {}) {
  const realBridge = createCombatBridge(new WebAssembly.Instance(wasm));
  const spawns = [];
  let presented, deathObjectSnapshots=0;
  const bridge = { ...realBridge, step(...args) {
    const next=realBridge.step(...args);
    if(deathObjects && next.events.some(e=>e.body.kind==='died')) {
      deathObjectSnapshots++;
      next.snapshot.projectiles.push({id:999,kind:'bomb',team:'enemy',pos:{x:456,y:430},height:0,dir:{x:1,y:0}});
      next.snapshot.hazards.push({id:998,kind:'lizardo_drop',phase:'locked'});
      next.snapshot.actors[0].encased=1;
    }
    return next;
  }, spawn(...args) { spawns.push(args); return realBridge.spawn(...args); },
    ...(fault ? { step() { throw new Error('bridge fault'); } } : {}) };
  const rows = ['Gobloc', 'Troll'].map(name => ({ name, HP: name === 'Troll' ? 1500 : 140, ATK: name === 'Troll' ? 165 : 10, DEF: 1, MAG: 1, RES: 1, SPD: 8 }));
  const heroes = ['Falie', 'Huun', 'Runa', 'Kojonn'].map((name, i) => {
    const actor = { ...newHeroProgress(name), uid: i + 1, kind: 'hero', x: 840 + i * 18, y: 350, isAlive: true };
    actor.currentLevel = lose ? 1 : 100; refreshHeroStats(actor); actor.hp = lose ? (i === 0 ? .01 : 0) : actor.maxHP;
    return actor;
  });
  const boss = { uid: 90, kind: 'enemy', name: 'Troll', enemyRole: 'boss', slotIndex: 0, x: 960, y: 350,
    hp: 1500, maxHP: 1500, stats: { ...rows[1], ATK: lose ? 100000 : 165 } };
  const stage = { ...createContinuousCombatStageState(42), bossActive: true, bossAvailable: true, bossArmed: true, bossUID: 90 };
  const g = { ContinuousCombatStageLoop: 1, ContinuousCombatStage: stage, CombatSessionId: 'proof', GamePhase: 'RUNTIME', time: 0,
    HeroProgress: createHeroProgressStore(), EnemyData: rows, EnemySlots: [91], EnemyIDs: [90], NextUID: 91,
    ProgressionBattle: { id: 'proof', participants: heroes.map(h => h.heroInstanceKey), defeated: {}, defeatedGold: {} } };
  const rewards = [], calls = [], routes = [], warnings = [], canonicalMaxHP = heroes.map(h => h.maxHP);
  g.ProgressionBattle.persistPendingRewards = reward => { if (reward) rewards.push(reward); };
  const state = { globals: g, entities: [...heroes, boss] };
  function call(name, ...args) {
    assert.ok(!/TickRealtime|ApplyDamage|KillEnemy|AwardMonster|ProcessTurn|CalculateDamage/.test(name), `JS combat call ${name}`);
    calls.push(name);
    if (name === 'SettleContinuousCombatRewards') {
      assert.deepEqual(heroes.map(h => h.maxHP), canonicalMaxHP, 'reward settlement sees WFM stat scale');
      return settleContinuousCombatRewards({ state });
    }
    if (name === 'SpawnEnemy') {
      const [row, slotIndex] = args;
      const actor = { uid: g.NextUID++, kind: 'enemy', name: row.name, stats: { ...row }, enemyRole: row.enemyRole,
        slotIndex, hp: row.HP, maxHP: row.HP };
      state.entities.push(actor); return actor;
    }
  }
  const session = createQuestCombatSession({ state, gameState: {}, call, sync() {} });
  const original = session.surrenderBossAttempt;
  session.surrenderBossAttempt = function(reason) { routes.push(reason); return original.call(this, reason); };
  const clock = createCombatHostClock({ isBagProgressBlocked: () => false });
  const saved = new Map();
  const equipment = durable ? createEquipmentStorage({globals:g,storage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)},locks:{request:async(_key,fn)=>fn()},now:()=>0,seed:()=>42,reportError:()=>{}}) : undefined;
  const runtime = createRustCombatRuntime({ persistCheckpoint: () => true, state, bridge, session, call, equipmentProgress:equipment, persistProgress: () => {saved.set('orka.hero_progress.v2',JSON.stringify(g.HeroProgress));return true;}, getEnemyRows: () => rows,
    present: snapshot => { presented=snapshot; }, advanceHostTime: clock.advanceHostTime, warn: (...args) => warnings.push(args) });
  const options = { globals: g, entities: state.entities, presentationBarrier: { lanes: {} }, call,
    onBossTimeout: () => session.surrenderBossAttempt('boss_timeout'), onBossClear() { calls.push('boss_clear'); } };
  function run() {
    for (let frame = 0; frame < 1500 && g.ContinuousCombatStage.bossActive; frame++) runtime.tick({ ...options, entities: state.entities, nowMs: frame * 1000 / 30 });
  }
  return { equipment,saved, get deathObjectSnapshots(){return deathObjectSnapshots;}, get presented(){return presented;}, runtime, bridge: realBridge, g, state, rewards, calls, routes, warnings, run, options, spawns };
}

test('real Rust boss death clears the WFM stage with one boss receipt and no JS combat entrypoints', () => {
  const f = fixture(); f.run();
  assert.equal(f.g.RustCombatReceipt.outcome, 'ended');
  assert.equal(f.g.ContinuousCombatStage.region, 2);
  assert.equal(f.calls.filter(x => x === 'boss_clear').length, 1);
  assert.deepEqual(f.rewards.filter(x => x.id === 'enemy:proof:90'), [{ id: 'enemy:proof:90', amount: 5 }]);
  assert.equal(f.runtime.read().active, false); noLeaks(f.bridge);
  assert.deepEqual(f.warnings, []);
});

test('real Rust lethal damage emits downed/all-down and routes once through WFM recovery', () => {
  const f = fixture({ lose: true }); f.run();
  assert.equal(f.g.RustCombatReceipt.outcome, 'all_down');
  assert.deepEqual(f.routes, ['rust_all_down']);
  assert.equal(f.g.ContinuousCombatStage.bossSummonRequired, true);
  assert.ok(f.state.entities.filter(a => a.kind === 'hero').every(a => a.hp === a.maxHP));
  assert.deepEqual(f.rewards, []); noLeaks(f.bridge);
});

test('bridge error releases its world and uses normal WFM failed-attempt recovery without boss credit', () => {
  const f = fixture({ fault: true }); f.run();
  assert.deepEqual(f.routes, ['rust_bridge_error']); assert.equal(f.warnings.length, 1);
  assert.equal(f.g.RustCombatReceipt.outcome, 'bridge_error');
  assert.deepEqual(f.rewards, []); noLeaks(f.bridge);
});

test('event batches deduplicate by encounter/sequence; gaps and collisions stop before another step', () => {
  const f = fixture(), batches = [], errors = [];
  const driver = createCombatAuthorityDriver({ bridge: f.bridge, consume: (s, events) => batches.push(events), onError: e => errors.push(e.message) });
  const event = { encounter_id: 'e', sequence: '1', body: { kind: 'died', data: { actor: 4 } } };
  // Use a minimal transport so this proof controls repeated delivery precisely.
  const stub = { create: () => ({ world: 1, snapshot: { encounter_id: 'e', state: 'running', step: '0' }, events: [event] }), destroy() {} };
  const d = createCombatAuthorityDriver({ bridge: stub, consume: (s, events) => batches.push(events), onError: e => errors.push(e.message) });
  d.start({ encounter_id: 'e' });
  d.accept({ snapshot: { encounter_id: 'e', state: 'running' }, events: [event] });
  assert.deepEqual(batches.map(x => x.length), [1, 0]);
  assert.throws(() => d.accept({ snapshot: { encounter_id: 'e' }, events: [{ ...event, sequence: '3' }] }), /sequence gap/);
  assert.throws(() => d.accept({ snapshot: { encounter_id: 'e' }, events: [{ ...event, body: { kind: 'all_down' } }] }), /collision/);
  d.stop(); driver.stop(); noLeaks(f.bridge);
});


test('battle-entry fade remains a host lifecycle phase without admitting JS combat', () => {
  const f = fixture(); f.g.BattleStartActive = 1; f.g.BattleStartFadeEndsAt = .1;
  f.run();
  assert.equal(f.g.BattleStartActive, 0);
  assert.equal(f.g.RustCombatReceipt.outcome, 'ended');
  noLeaks(f.bridge);
});

test('host wave additions become spawn commands and paused wall time adds no combat debt', () => {
  const f = fixture(); f.runtime.tick({ ...f.options, nowMs: 0 });
  const initial = f.runtime.read().snapshot.step;
  f.runtime.pause(); f.runtime.tick({ ...f.options, nowMs: 3600000 });
  assert.equal(f.runtime.read().snapshot.step, initial);
  const row = f.g.EnemyData[0];
  f.state.entities.push({ uid: 200, name: 'Gobloc', kind: 'enemy', stats: { ...row }, maxHP: row.HP, hp: row.HP, x: 1000, y: 350, slotIndex: 1 });
  f.runtime.tick({ ...f.options, nowMs: 3600034 });
  assert.equal(f.spawns.length, 1);
  assert.equal(f.spawns[0][2][0].spawn_key, '200');
  assert.ok(f.runtime.read().snapshot.actors.some(a => a.host_id === '200'));
  f.runtime.dispose(); f.runtime.dispose(); noLeaks(f.bridge);
});

test('D18 persists a WFM checkpoint while Rust actor HP and pose stay ephemeral', () => {
  const f = fixture(), saves = new Map(), priorWindow = globalThis.window;
  globalThis.window = { localStorage: { setItem: (k, v) => saves.set(k, v) } };
  try {
    f.runtime.tick({ ...f.options, nowMs: 0 });
    f.g.HeroProgressDirty = true;
    assert.equal(persistHeroProgressIfDirty({ stateGlobals: f.g }), true);
    const raw = saves.get('orka.hero_progress.v2'), checkpoint = createHeroProgressStore(JSON.parse(raw));
    assert.equal(checkpoint.continuousStage.region, 1);
    assert.equal(checkpoint.continuousStage.wave, 1);
    assert.equal(checkpoint.continuousStage.bossSummonRequired, true);
    assert.doesNotMatch(raw, /rustActorId|rustState|hazards|combat_steps/);
    assert.equal(checkpoint.heroes.Falie.maxHP, 75);
    assert.notEqual(f.state.entities[0].maxHP, checkpoint.heroes.Falie.maxHP);
  } finally { globalThis.window = priorWindow; f.runtime.dispose(); }
  noLeaks(f.bridge);
});

test('Rust victory clears through legacy presentation barriers without recreating empty worlds', () => {
  const f = fixture(); f.options.presentationBarrier = { lanes: { damageText: true, heroAction: true } }; f.run();
  assert.equal(f.g.ContinuousCombatStage.region, 2);
  assert.equal(f.g.RustCombatReceipt.outcome, 'ended');
  assert.equal(f.calls.filter(x => x === 'boss_clear').length, 1); noLeaks(f.bridge);
});


test('executable app tick calls only Rust and never invokes retired scheduler or outcome owners', () => {
  const app = fs.readFileSync(new URL('../web-runner/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('  function tick(){', app.indexOf('let frameCount = 0;'));
  const source = app.slice(start, app.indexOf('  tick();', start));
  for (const bagOpen of [false, true]) {
    const counts = { rust: 0, paused: 0, js: 0, stage: 0, outcome: 0 };
    const context = vm.createContext({
      state: { globals: {}, entities: [] }, gameState: { storyEntry: { phase: 'combat' } },
      document: { hidden: false }, performance: { now: () => 100 }, requestAnimationFrame() {},
      rustCombatShadow: undefined,
      rustCombat: { ownsEncounter: () => true, tick() { counts.rust++; return false; }, pause() { counts.paused++; } },
      lampEquipment: { state: () => ({ open: bagOpen }) },
      combatSimulationTicker: { reset() {}, tick() { counts.js++; } },
      ensureDevToolingConfig: () => ({ open: false }), layoutState: { getActiveLayoutId: () => 'combat' },
      shouldFreezeCombatSimulation: () => false, combatProgression: { observe() {} },
      recoverContinuousOrdinaryDefeatIfNeeded: () => false, continuousCombatWaveClearEventId: () => '',
      getPresentationTurnBarrier: () => ({ lanes: {} }),
      maybeAdvanceContinuousCombatStage() { counts.stage++; return false; },
      checkMainRuntimeCombatOutcome() { counts.outcome++; return false; },
      questCombat: { isCleared: () => false }, heroProgressStorage: { persistHeroProgressIfDirty() {} }, drawFrame() {},
      // The flag-off ticker's existing dependency packet is still evaluated.
      fnContext: {}, callFunctionWithContext() {}, animationMath: {}, layoutW: 360, applyTurnGateGlobals() {}, applyTurnGateIntent() {},
      createEnemyTurnIdleRecovery() {}, getCellWorldPos() {}, randomGemFrame() {}, setGemArray() {}, countCellCoverage() {},
      recordTask011RefillWriteEvent() {}, createEnemyTurnGateBaseline: {}, createRefillCompleteGate: {}, runtimeDebugLogging: {},
      assertBoardIntegrity() {}, getGemGateSnapshot() {}, getYellowSequenceCompletionIntent: {}, traceTask015YellowAnimation() {},
      traceTask015YellowWrite() {}, YELLOW_CASINO_SETTLE_SEC: 0, YELLOW_CASINO_SETTLE_BOUNCE_AMP: 0, YELLOW_COLOR: 0,
      startGemMergeFx() {}, getGoldLabelTargetWorld() {},
    });
    vm.runInContext(`let frameCount = 0; ${source}; tick();`, context);
    assert.deepEqual(counts, { rust: bagOpen ? 0 : 1, paused: bagOpen ? 1 : 0, js: 0, stage: 0, outcome: 0 });
  }
});


test('boss death retains its bounded tail with living summons; cleanup never creates kill receipts', () => {
  const f = fixture(), row = f.g.EnemyData[0];
  f.state.entities.push({ uid: 201, kind: 'enemy', name: 'Gobloc', slotIndex: 1, x: 1700, y: 350,
    maxHP: 1000000, hp: 1000000, stats: { ...row, HP: 1000000 } });
  f.run();
  assert.equal(f.g.ContinuousCombatStage.region, 2);
  assert.equal(f.g.RustCombatReceipt.outcome, 'ended');
  assert.equal(Object.hasOwn(f.g.ProgressionBattle.defeated, '201'), false);
  assert.deepEqual(f.rewards, [{ id: 'enemy:proof:90', amount: 5 }]);
  noLeaks(f.bridge);
});


test('boss rewards settle at death and stage advance waits exactly for the source tail', () => {
  const f = fixture();
  let deathAt;
  for (let frame = 0; frame < 1500; frame++) {
    const nowMs = frame * 1000 / 30;
    f.runtime.tick({ ...f.options, nowMs });
    if (f.g.RustCombatReceipt?.outcome === 'ended') { deathAt = nowMs; break; }
  }
  assert.ok(Number.isFinite(deathAt));
  const snapshot = f.runtime.read().snapshot;
  const duration = snapshot.hit_stop.remaining + Math.max(1 + .42, .32);
  const reward = [{ id: 'enemy:proof:90', amount: 5 }];
  assert.deepEqual(f.rewards, reward);
  assert.equal(f.g.ContinuousCombatStage.region, 1);
  assert.equal(f.runtime.read().active, false); noLeaks(f.bridge);
  assert.equal(f.calls.filter(x => x === 'boss_clear').length, 1);
  assert.equal(f.calls.filter(x => x === 'SettleContinuousCombatRewards').length, 1);
  assert.deepEqual(f.g.HeroProgress.settledBattles, ['proof']);
  assert.equal(f.g.ProgressionBattle.id, 'proof-continuous-1');
  const timeAtDeath = f.g.time;
  const before = deathAt + duration * 1000 - .001;
  assert.equal(f.runtime.tick({ ...f.options, nowMs: before }), false);
  assert.equal(f.g.ContinuousCombatStage.region, 1);
  assert.ok(Math.abs(f.g.time - timeAtDeath - (before - deathAt) / 1000) < 1e-8);
  assert.deepEqual(f.rewards, reward);
  assert.equal(f.runtime.tick({ ...f.options, nowMs: deathAt + duration * 1000 }), true);
  assert.equal(f.g.ContinuousCombatStage.region, 2);
  assert.deepEqual(f.g.HeroProgress.settledBattles, ['proof']);
  assert.equal(f.calls.filter(x => x === 'boss_clear').length, 1);
  assert.deepEqual(f.rewards, reward);
  assert.equal(f.calls.filter(x => x === 'SettleContinuousCombatRewards').length, 1);
});


test('destroyed Rust world cannot carry bombs, hazards or stun film into its boss presentation tail', () => {
 const f=fixture({deathObjects:true});let frame=0;
 for(;frame<1500&&f.g.RustCombatReceipt?.outcome!=='ended';frame++) f.runtime.tick({...f.options,nowMs:frame*1000/30});
 assert.equal(f.runtime.read().active,false);assert.ok(f.deathObjectSnapshots>0,'pre-end Rust snapshot held a live bomb');
 assert.deepEqual(f.runtime.read().snapshot.projectiles,[],'EndEncounter removed its projectiles');
 assert.deepEqual(f.presented.projectiles,[]);assert.deepEqual(f.presented.hazards,[]);
 f.runtime.tick({...f.options,nowMs:frame*1000/30});
 assert.deepEqual(f.presented.projectiles,[]);assert.deepEqual(f.presented.hazards,[]);
 assert.ok(f.presented.actors.every(a=>a.encased===0));f.runtime.dispose();
});

test('mid-fight HP equipment, EXP and Training commits revise Rust without mutating live JS stats', async () => {
  const { createEquipmentStorage, EQUIPMENT_SAVE_KEY } = await import('../web-runner/systems/equipmentStorage.mjs');
  const { createLampEconomy, generateLampItem } = await import('../web-runner/src/core/lampGear.mjs');
  const { createCombatProgression } = await import('../web-runner/systems/combatProgression.mjs');
  const { awardHeroEXP, expToNextLevel, saveHeroProgress } = await import('../web-runner/src/core/heroProgression.mjs');
  const f = fixture(), hero = f.state.entities.find(a => a.kind === 'hero');
  for (const actor of f.state.entities.filter(a => a.kind === 'hero')) {
    actor.currentLevel = 1; refreshHeroStats(actor); actor.hp = actor.maxHP;
  }
  f.state.entities.find(a => a.kind === 'enemy').stats.ATK = 0;
  const item = generateLampItem(42, 1, 1); item.stats.HP = 50;
  const economy = createLampEconomy(42, 0); economy.items.push(item); economy.lamp.pending.push(item.instanceId);
  const values = new Map([[EQUIPMENT_SAVE_KEY, JSON.stringify(economy)]]);
  const storage = { getItem:k => values.get(k) ?? null, setItem:(k,v) => values.set(k,v) };
  const equipment = createEquipmentStorage({ globals:f.g, storage, getActors:() => f.state.entities,
    locks:{ request:async (_key,fn) => fn() }, now:() => 1000, seed:() => 42, persistProgress:() => true });
  await equipment.sync(); f.runtime.tick({ ...f.options, nowMs:0 });
  const before = { hp:hero.hp, maxHP:hero.maxHP, stats:{ ...hero.stats } };
  assert.equal(before.maxHP,420);
  f.runtime.pause(); await equipment.equip('Falie',item.instanceId);
  assert.deepEqual({ hp:hero.hp,maxHP:hero.maxHP,stats:hero.stats },before);
  assert.equal(f.g.HeroProgress.heroes.Falie.maxHP,125); assert.equal(f.runtime.read().pendingRevisions,1);
  // A reload before acknowledgement constructs from durable meta, never an old live snapshot.
  const { createWfmCombatConfig } = await import('../web-runner/systems/wfmCombatConfig.mjs');
  const reloadHero={ ...structuredClone(f.g.HeroProgress.heroes.Falie),kind:'hero',uid:1 };
  const reload = createWfmCombatConfig({ globals:f.g,entities:[reloadHero],enemyRows:f.g.EnemyData,encounterId:'reload-before-ack' });
  assert.equal(reload.heroes[0].stats.hp,700);
  f.runtime.tick({ ...f.options,nowMs:1000 }); f.runtime.tick({ ...f.options,nowMs:1034 });
  assert.equal(hero.maxHP,700); assert.equal(hero.hp,700); assert.equal(f.runtime.read().pendingRevisions,0);
  assert.deepEqual(hero.stats,before.stats);
  const { getContinuousCombatPartyCP } = await import('../web-runner/src/core/continuousCombatStage.mjs');
  const { computeCombatPower } = await import('../web-runner/src/core/combatPower.mjs');
  assert.equal(getContinuousCombatPartyCP([hero]),computeCombatPower(f.g.HeroProgress.heroes.Falie));
  saveHeroProgress(hero,f.g.HeroProgress);
  assert.equal(f.g.HeroProgress.heroes.Falie.maxHP,125);
  assert.deepEqual(f.g.HeroProgress.heroes.Falie.equipmentStats,item.stats);
  awardHeroEXP(hero,expToNextLevel(1));
  const canonical=f.g.HeroProgress.heroes.Falie;
  assert.equal(canonical.currentLevel,2); assert.equal(hero.maxHP,700);
  const { wfmHeroPermanentInputs }=await import('../web-runner/systems/wfmCombatConfig.mjs');
  const afterLevel=wfmHeroPermanentInputs(f.g,hero);
  f.runtime.tick({ ...f.options,nowMs:1068 }); assert.equal(hero.maxHP,afterLevel.stats.hp);
  storage.setItem('orka.combat_progression.v1',JSON.stringify({ wallet:{incense:20,ticketsByHero:{Falie:1000}} }));
  const progression=createCombatProgression({ globals:f.g,storage,getHeroes:() => f.state.entities,persistHeroProgress:() => true });
  assert.equal(progression.spendLevelUp('Falie').ok,true);
  assert.equal(f.g.HeroProgress.heroes.Falie.currentLevel,3); assert.equal(hero.currentLevel,3);
  f.runtime.tick({ ...f.options,nowMs:1102 });
  const priorHP=hero.hp,priorStats={...hero.stats};
  assert.equal(progression.train('ATK').ok,true); assert.deepEqual(hero.stats,priorStats); assert.equal(hero.hp,priorHP);
  assert.equal(f.runtime.read().pendingRevisions,4);
  f.runtime.tick({ ...f.options,nowMs:1136 }); assert.equal(f.runtime.read().pendingRevisions,0);
  assert.equal(f.runtime.read().failed,false); assert.deepEqual(f.warnings,[]);
  f.runtime.dispose(); noLeaks(f.bridge);
});

test('real-WASM runtime durably captures a boss kill and automatically settles after world teardown',async()=>{
 const f=fixture({durable:true});
 for(let frame=0;frame<1500&&f.g.ContinuousCombatStage.bossActive;frame++){
  f.runtime.tick({...f.options,entities:f.state.entities,nowMs:frame*1000/30});await new Promise(resolve=>setImmediate(resolve));
 }
 await f.runtime.settlePendingReceipts();
 assert.equal(f.g.ContinuousCombatStage.region,2);
 assert.equal(JSON.parse(f.saved.get(EQUIPMENT_SAVE_KEY)).lamp.killPoints,5);
 const source=JSON.parse(f.saved.get('orka.hero_progress.v2'));
 assert.ok(Object.values(source.combatRewardOutbox.streams).every(stream=>stream.pending.length===0));
 assert.deepEqual(f.warnings,[]);noLeaks(f.bridge);
});
