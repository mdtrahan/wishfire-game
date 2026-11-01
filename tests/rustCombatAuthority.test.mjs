import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';
import { createCombatAuthorityDriver } from '../web-runner/src/core/combatAuthorityDriver.mjs';
import { createRustCombatRuntime } from '../web-runner/systems/rustCombatRuntime.mjs';
import { installRustCombat, isRustCombatStage } from '../web-runner/systems/rustCombat.mjs';
import { createQuestCombatSession } from '../web-runner/systems/questCombatSession.mjs';
import { createCombatSimulationTicker } from '../web-runner/systems/combatSimulationTick.mjs';
import { createContinuousCombatStageState } from '../web-runner/src/core/continuousCombatStage.mjs';
import { createHeroProgressStore, newHeroProgress, refreshHeroStats } from '../web-runner/src/core/heroProgression.mjs';
const progressSource = fs.readFileSync(new URL('../web-runner/systems/heroProgressStorage.js', import.meta.url), 'utf8');
const persistHeroProgressIfDirty = new Function('window', `${progressSource.replace(/^import .*\n/gm, '').replace(/export /g, '')}; return persistHeroProgressIfDirty;`)({ localStorage: { setItem: (k, v) => globalThis.window.localStorage.setItem(k, v) } });
const wasm = new WebAssembly.Module(fs.readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url)));
const noLeaks = bridge => assert.deepEqual(bridge.describe().resources, { worlds: 0, responses: 0, inputs: 1 });
function fixture({ lose = false, fault = false } = {}) {
  const realBridge = createCombatBridge(new WebAssembly.Instance(wasm));
  const spawns = [];
  const bridge = { ...realBridge, spawn(...args) { spawns.push(args); return realBridge.spawn(...args); },
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
    ProgressionBattle: { id: 'proof', defeated: {}, defeatedGold: {} } };
  const rewards = [], calls = [], routes = [], warnings = [];
  g.ProgressionBattle.persistPendingRewards = reward => { if (reward) rewards.push(reward); };
  const state = { globals: g, entities: [...heroes, boss] };
  function call(name, ...args) {
    assert.ok(!/TickRealtime|ApplyDamage|KillEnemy|AwardMonster|ProcessTurn|CalculateDamage/.test(name), `JS combat call ${name}`);
    calls.push(name);
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
  const clock = createCombatSimulationTicker({ isBagProgressBlocked: () => false });
  const runtime = createRustCombatRuntime({ state, bridge, session, call, getEnemyRows: () => rows,
    advanceHostTime: clock.advanceHostTime, warn: (...args) => warnings.push(args) });
  const options = { globals: g, entities: state.entities, presentationBarrier: { lanes: {} }, call,
    onBossTimeout: () => session.surrenderBossAttempt('boss_timeout'), onBossClear() { calls.push('boss_clear'); } };
  function run() {
    for (let frame = 0; frame < 1500 && isRustCombatStage(g); frame++) runtime.tick({ ...options, entities: state.entities, nowMs: frame * 1000 / 30 });
  }
  return { runtime, bridge: realBridge, g, state, rewards, calls, routes, warnings, run, options, spawns };
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

test('localhost gate is lazy when off and refuses other stages and public origins', () => {
  let loads = 0;
  const load = () => { loads++; throw Error('unexpected load'); };
  for (const location of [{ hostname: 'localhost', search: '' }, { hostname: 'localhost', search: '?rustCombat=0' },
    { hostname: 'example.org', search: '?rustCombat=1' }]) assert.equal(installRustCombat({}, { location, load }), undefined);
  assert.equal(loads, 0);
  for (const stage of [{ region: 2, stage: 1, bossActive: true }, { region: 1, stage: 1, bossActive: false }]) {
    assert.equal(isRustCombatStage({ ContinuousCombatStageLoop: 1, ContinuousCombatStage: stage }), false);
  }
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


test('executable app tick calls only the selected combat owner and keeps JS outcome inference off under Rust', () => {
  const app = fs.readFileSync(new URL('../web-runner/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('  function tick(){', app.indexOf('let frameCount = 0;'));
  const source = app.slice(start, app.indexOf('  tick();', start));
  for (const enabled of [true, false]) {
    const counts = { rust: 0, js: 0, stage: 0, outcome: 0 };
    const context = vm.createContext({
      state: { globals: {}, entities: [] }, gameState: { storyEntry: { phase: 'combat' } },
      document: { hidden: false }, performance: { now: () => 100 }, requestAnimationFrame() {},
      rustCombatShadow: undefined,
      rustCombat: enabled ? { ownsEncounter: () => true, tick() { counts.rust++; return false; } } : undefined,
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
    assert.deepEqual(counts, enabled ? { rust: 1, js: 0, stage: 0, outcome: 0 } : { rust: 0, js: 1, stage: 1, outcome: 1 });
  }
});


test('boss death clears immediately with living summons; cleanup never creates kill receipts', () => {
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
