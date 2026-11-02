import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';
import { createRustCombatRuntime } from '../web-runner/systems/rustCombatRuntime.mjs';
import { createQuestCombatSession } from '../web-runner/systems/questCombatSession.mjs';
import { authorSubwaves, bindAuthoredSubwaves } from '../web-runner/src/core/continuousCombatSubwaves.mjs';
import { SLICE_ORIGIN, SLICE_TRAVEL_SLOTS } from '../web-runner/systems/rustCombatArena.mjs';
import { wfmHeroPermanentInputs } from '../web-runner/systems/wfmCombatConfig.mjs';
import * as progression from '../web-runner/src/core/heroProgression.mjs';
import { configureContinuousCombatProduction, createContinuousCombatStageState, buildContinuousCombatSpawnPlan, activateContinuousCombatSpawnedEnemy, getContinuousCombatPartyCP } from '../web-runner/src/core/continuousCombatStage.mjs';
const wasm = new WebAssembly.Module(fs.readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url)));
const table = JSON.parse(fs.readFileSync(new URL('../web-runner/assets/enemies.json', import.meta.url)));
const rows = table.data[0].slice(1).map((_, i) => Object.fromEntries(table.data.map(column => [column[0][0], column[i + 1][0]]))).filter(row => row.name);
const source = fs.readFileSync(new URL('../web-runner/systems/heroProgressStorage.js', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/export /g, '');
const key = 'orka.hero_progress.v2';
function storage(raw) {
  const values = new Map(raw ? [[key, raw]] : []);
  const localStorage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  const context = { ...progression, window: { localStorage } };
  vm.runInNewContext(`${source}; this.api = {restoreHeroProgressFromStorage, persistHeroProgressIfDirty};`, context);
  return { ...context.api, values, localStorage };
}
function fixture({ raw, settlePendingReceipts, bridgeOverrides, saveFails = false, useRealSession = false } = {}) {
  const store = storage(raw), real = createCombatBridge(new WebAssembly.Instance(wasm));
  const created = [], routes = [], warnings = [], planned = [], spawned = [];
  let worldHandle;
  const bridge = { ...real, ...bridgeOverrides, spawn(...args) { spawned.push(...args[2]); return real.spawn(...args); }, create(config) {
    assert.ok(store.values.has(key), 'checkpoint persisted before create');
    created.push(structuredClone(config));
    const result = real.create(config); worldHandle = result.world; return result;
  } };
  const g = { HeroProgress: progression.createHeroProgressStore(), ContinuousCombatStageLoop: 0,
    EnemyData: rows, EnemySlots: [], EnemyIDs: [], NextUID: 90, CombatSessionId: 'same-session-after-reload', GamePhase: 'RUNTIME', time: 0 };
  const state = { globals: g, entities: ['Falie', 'Huun', 'Runa', 'Kojonn'].map((name, i) => ({ ...progression.newHeroProgress(name), kind: 'hero', uid: i + 1 })) };
  store.restoreHeroProgressFromStorage({ fnContext: { state }, settlePendingReceipts });
  configureContinuousCombatProduction(g, { productionPath: true });
  if (!raw) g.ContinuousCombatStage.seed = 42;
  function rebuild() {
    planned.length = 0;
    state.entities.splice(0, state.entities.length, ...state.entities.filter(a => a.kind === 'hero'));
    const progress = g.ContinuousCombatStage.combatCheckpoint?.subwaves;
    const saved = progress?.position === progression.combatSubwavePosition(g.ContinuousCombatStage) ? progress : null;
    for (const entry of buildContinuousCombatSpawnPlan(g.EnemyData, saved ? { ...g.ContinuousCombatStage, clearedPackMask: saved.entryPackMask } : g.ContinuousCombatStage,
      { partyCP: saved?.partyCP ?? getContinuousCombatPartyCP(state.entities) })) {
      const a = { uid: g.NextUID++, kind: 'enemy', name: entry.row.name, stats: { ...entry.row }, hp: entry.row.HP,
        maxHP: entry.row.HP, slotIndex: entry.slotIndex, enemyRole: entry.row.enemyRole };
      planned.push(a); state.entities.push(a); activateContinuousCombatSpawnedEnemy(g, a, entry);
      g.EnemySlots[a.slotIndex] = a.uid + 1;
      if (g.ContinuousCombatStage.bossActive) g.ContinuousCombatStage.bossUID = a.uid;
    }
  }
  rebuild();
  function call(name, ...args) {
    if (name !== 'SpawnEnemy') return;
    if (!state.entities.some(a => a.kind === 'enemy')) planned.length = 0;
    const [row, slotIndex] = args;
    const actor = { uid: g.NextUID++, kind: 'enemy', name: row.name, stats: { ...row }, hp: row.HP,
      maxHP: row.HP, slotIndex, enemyRole: row.enemyRole };
    planned.push(actor); state.entities.push(actor); return actor;
  }
  const runtime = createRustCombatRuntime({ state, bridge, session: useRealSession
    ? createQuestCombatSession({ state, gameState: {}, call, sync() {} }) : {
    recoverContinuousDefeat: reason => routes.push(reason), surrenderBossAttempt: reason => routes.push(reason) },
    call, getEnemyRows: () => rows, advanceHostTime() {}, warn: (...args) => warnings.push(args),
    persistCheckpoint() {
      if (saveFails) return false;
      g.HeroProgressDirty = true;
      return store.persistHeroProgressIfDirty({ stateGlobals: g });
    } });
  const tick = nowMs => runtime.tick({ globals: g, entities: state.entities, call, nowMs });
  return { g, state, real, runtime, created, routes, warnings, store, tick, rebuild, planned, spawned, world: () => worldHandle, raw: () => store.values.get(key) };
}
function assertFresh(f) {
  const s = f.runtime.read().snapshot;
  assert.ok(s);
  assert.equal(s.step, '0'); assert.equal(s.combat_time, 0);
  assert.deepEqual(s.projectiles, []);
  assert.ok(s.hazards.every(h => h.kind === 'spawn_marker' && h.progress === 0), 'only newly created entry markers exist');
  for (const a of s.actors.filter(a => a.team === 'hero')) {
    assert.equal(a.hp, a.max_hp); assert.equal(a.permanent_revision, '0');
    for (const field of ['ward', 'encased', 'poisoned', 'meter', 'groove_active']) assert.equal(a[field], 0, field);
    assert.ok(['idle', 'walk'].includes(a.state), 'no prior committed action resumes');
    const slot = f.created.at(-1).heroes.find(h => h.instance_id === a.host_id).slot;
    const offset = SLICE_TRAVEL_SLOTS[slot];
    assert.deepEqual(a.pos, { x: Math.fround(Math.fround(SLICE_ORIGIN.x) + offset.x), y: Math.fround(Math.fround(SLICE_ORIGIN.y) + offset.y) });
  }
  assert.equal(f.runtime.read().pendingRevisions, 0);
  return s;
}

test('D18 reload persists identity/seed/generation/lineage and reconstructs only uncleared packs/subwaves', () => {
  const before = fixture();
  before.g.ProgressionBattle = { id: 'original-reward-domain', participants: [], defeated: {} };
  before.g.ContinuousCombatStage.clearedPackMask = 0b010101;
  before.g.ContinuousCombatStage.transitions = 2;
  before.g.ContinuousCombatStage.wave = 3;
  before.rebuild(); before.tick(0);
  const initial = before.runtime.read().snapshot;
  const first = JSON.parse(before.raw()).continuousStage;
  assert.equal(first.seed, 42); assert.equal(first.transitions, 2);
  assert.equal(first.combatCheckpoint.generation, 1);
  assert.equal(first.combatCheckpoint.rewardLineage, 'original-reward-domain');
  before.g.ContinuousCombatStage.bossSummonRequired = true;
  before.store.persistHeroProgressIfDirty({ stateGlobals: before.g });
  const raw = before.raw(), saved = JSON.parse(raw).continuousStage;
  assert.equal(saved.combatCheckpoint.generation, 2);
  assert.equal(saved.combatCheckpoint.id, first.combatCheckpoint.id);
  assert.equal(saved.combatCheckpoint.rewardLineage, first.combatCheckpoint.rewardLineage);
  assert.equal(before.store.persistHeroProgressIfDirty({ stateGlobals: before.g }), false, 'unchanged checkpoint does not advance generation');
  before.runtime.dispose();
  const after = fixture({ raw });
  after.g.ProgressionBattle = { id: 'new-host-domain', participants: [], defeated: {} };
  after.tick(0);
  assert.equal(after.g.ContinuousCombatStage.combatCheckpoint.rewardLineage, 'original-reward-domain');
  const fresh = assertFresh(after);
  assert.notEqual(fresh.encounter_id, initial.encounter_id);
  assert.equal(after.created[0].seed, '42');
  assert.equal(after.g.ContinuousCombatStage.wave, 3);
  assert.equal(after.g.ContinuousCombatStage.transitions, 2);
  const all = after.planned;
  assert.ok(all.every(a => !(saved.clearedPackMask & 1 << (a.streamSectorIndex % 6))));
  assert.ok(after.created[0].enemies.every(e => all.some(a => String(a.uid) === e.spawn_key)));
  assert.equal(after.created[0].enemies.length, fresh.live_enemies);
  assert.doesNotMatch(raw, /projectiles|hazards|rustState|permanent_revision|encounter_id/);
  after.runtime.dispose();
});

test('fixture 6: receipt hook settles dead boss before stale checkpoint can restart and runs once', () => {
  const before = fixture();
  before.g.ContinuousCombatStage.bossActive = true;
  before.g.ContinuousCombatStage.bossUID = 90;
  before.g.ContinuousCombatStage.bossAvailable = true;
  before.rebuild();
  before.state.entities.find(a => a.kind === 'enemy').hp = .01;
  before.tick(0);
  let snapshot = before.runtime.read().snapshot, death;
  const encounter = snapshot.encounter_id;
  for (let step = 0; step < 1200 && !death; step++) {
    const result = before.real.step(before.world(), { encounter_id: encounter, expected_previous_step: snapshot.step });
    snapshot = result.snapshot;
    death = result.events.find(e => e.body.kind === 'died');
  }
  assert.ok(death, 'real Rust boss died before host checkpoint advance');
  assert.equal(before.g.ContinuousCombatStage.region, 1);
  const receiptId = `boss:${encounter}:${death.sequence}`;
  before.g.HeroProgress.pendingGoldSettlements[receiptId] = 7;
  before.g.HeroProgressDirty = true;
  assert.equal(before.store.persistHeroProgressIfDirty({ stateGlobals: before.g }), true);
  const raw = before.raw(); before.real.destroy(before.world());
  const settled = []; let calls = 0;
  const after = fixture({ raw, settlePendingReceipts({ state }) {
    calls++;
    const progress = state.globals.HeroProgress;
    settled.push(...Object.entries(progress.pendingGoldSettlements));
    delete progress.pendingGoldSettlements[receiptId];
    Object.assign(progress.continuousStage, { region: 2, wave: 1, clearedBosses: 1, bossAvailable: false, bossSummonRequired: false, clearedPackMask: 0 });
    delete progress.continuousStage.bossUID;
    state.globals.HeroProgressDirty = true;
  } });
  after.store.restoreHeroProgressFromStorage({ fnContext: { state: after.state }, settlePendingReceipts() { calls++; } });
  after.tick(0); assertFresh(after);
  assert.equal(calls, 1); assert.deepEqual(settled, [[receiptId, 7]]);
  assert.equal(after.g.ContinuousCombatStage.region, 2);
  assert.ok(after.created[0].enemies.every(e => e.definition_id !== 'slice.boss.troll_brute'));
  assert.deepEqual(JSON.parse(after.raw()).pendingGoldSettlements, {});
  after.runtime.dispose();
});

test('fixture 6: accepted permanent stat revision before ack reloads latest saved stats without replay', () => {
  let accepted;
  const before = fixture({ bridgeOverrides: { step(world, request) {
    accepted = before.real.step(world, request);
    throw new Error('process lost before ack');
  } } });
  before.tick(0);
  const hero = before.state.entities[0];
  const latest = before.g.HeroProgress.heroes.Falie;
  latest.currentLevel = 2; progression.refreshHeroStats(latest); latest.hp = 0;
  before.g.RustCombatPermanentInputs('Falie');
  before.g.HeroProgressDirty = true;
  before.store.persistHeroProgressIfDirty({ stateGlobals: before.g });
  const raw = before.raw(); before.tick(34);
  assert.ok(accepted.events.some(e => e.body.kind === 'permanent_inputs_applied'));
  assert.equal(accepted.snapshot.actors[0].permanent_revision, '1');
  before.runtime.dispose();
  const after = fixture({ raw }); after.tick(0);
  const fresh = assertFresh(after), a = fresh.actors.find(a => a.host_id === 'Falie');
  assert.equal(a.max_hp, 464);
  assert.equal(a.hp, a.max_hp);
  assert.equal(after.created[0].heroes[0].hp, 464);
  assert.equal(after.created[0].heroes[0].stats.atk, wfmHeroPermanentInputs(after.g, after.state.entities[0]).stats.atk);
  assert.notEqual(fresh.encounter_id, accepted.snapshot.encounter_id);
  after.runtime.dispose();
});

test('fixture 6: active boss reload resets timer, discards live attempt and starts healthy', () => {
  const before = fixture(); before.tick(0);
  assert.equal(before.runtime.restartAtSubwave(2), true); before.tick(34);
  Object.assign(before.g.ContinuousCombatStage, { bossActive: true, bossAvailable: true, bossArmed: true, bossTimerStartedAt: 17, wave: 10 });
  before.rebuild(); before.tick(0);
  let dirty = false;
  for (let frame = 1; frame < 240 && !dirty; frame++) {
    before.tick(frame * 1000 / 30);
    const s = before.runtime.read().snapshot;
    dirty = s.projectiles.length > 0 || s.actors.some(a => a.team === 'hero' && (a.meter > 0 || a.hp < a.max_hp || a.ward > 0));
  }
  assert.ok(dirty, 'old boss attempt contains real live combat state');
  const oldId = before.runtime.read().snapshot.encounter_id;
  const raw = before.raw(); before.runtime.dispose();
  assert.equal(JSON.parse(raw).continuousStage.combatCheckpoint.subwaves, undefined, 'boss checkpoint drops ordinary subwave cursor');
  const after = fixture({ raw });
  assert.equal(after.g.ContinuousCombatStage.bossActive, false);
  assert.equal(after.g.ContinuousCombatStage.bossSummonRequired, true);
  assert.equal(after.g.ContinuousCombatStage.bossTimerStartedAt, null);
  // WFM's explicit summon opens the restarted boss; no former timer/HP enters create.
  Object.assign(after.g.ContinuousCombatStage, { bossActive: true, bossArmed: true });
  after.rebuild(); after.tick(0);
  const fresh = assertFresh(after);
  assert.notEqual(fresh.encounter_id, oldId);
  assert.ok(fresh.actors.some(a => a.kind === 'boss'));
  after.runtime.dispose();
});

for (const [field, value, message] of [['contentVersion', 'other-content', /content version mismatch/], ['abiVersion', 131072, /ABI version mismatch/]]) {
  test(`fixture 6: ${field} mismatch preserves save and fails closed before create`, () => {
    const before = fixture(); before.tick(0);
    const save = JSON.parse(before.raw()); save.continuousStage.combatCheckpoint[field] = value;
    const raw = JSON.stringify(save); before.runtime.dispose();
    const after = fixture({ raw }); after.tick(0);
    assert.match(after.g.HeroProgressStorageError, message);
    assert.match(after.g.RustCombatError, message);
    assert.equal(after.created.length, 0); assert.deepEqual(after.routes, []);
    assert.equal(after.raw(), raw);
    assert.equal(after.real.describe().resources.worlds, 0);
    after.runtime.dispose();
  });
}

test('a checkpoint write failure never admits a Rust world', () => {
  const f = fixture({ saveFails: true }); f.tick(0);
  assert.match(f.g.RustCombatError, /save failed before Rust attempt creation/);
  assert.equal(f.created.length, 0); assert.deepEqual(f.routes, []); f.runtime.dispose();
});

test('receipt hook failure blocks restart and preserves original save', () => {
  const before = fixture(); before.tick(0); const raw = before.raw(); before.runtime.dispose();
  const after = fixture({ raw, settlePendingReceipts() { throw new Error('receipt settlement failed'); } });
  after.tick(0);
  assert.match(after.g.RustCombatError, /receipt settlement failed/);
  assert.equal(after.created.length, 0); assert.equal(after.raw(), raw); assert.deepEqual(after.routes, []);
  after.runtime.dispose();
});


test('production initializer retains checkpoint seed even with a new generated or explicit QA seed', () => {
  const before = fixture(); before.tick(0); const saved = JSON.parse(before.raw()); before.runtime.dispose();
  const initializerSource = fs.readFileSync(new URL('../web-runner/systems/combatSessionInitializer.js', import.meta.url), 'utf8')
    .replace(/import[\s\S]*?;\n/g, '').replace(/export /g, '');
  const context = { ...progression, crypto, beginCombatDpsSession() {}, resetCombatSessionConditions() {},
    scaleRoutineEnemy: row => row, getContinuousCombatPartyCP: () => 1 };
  vm.runInNewContext(`${initializerSource}; this.create = createCombatSessionInitializer;`, context);
  const state = { entities: [], globals: { HeroProgress: saved, ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: createContinuousCombatStageState(999), EncounterSeed: 999, EncounterSeedExplicit: 1 } };
  const stopped = new Error('seed captured');
  const init = context.create({ state, gameState: {}, fnContext: { state }, callFunctionWithContext() {},
    assertCombatLayoutDev() {}, computeCombatPower: () => 1, resetBootstrapRngSession() {},
    generateEncounterSeed() { throw new Error('saved checkpoint must not generate another seed'); },
    deriveCombatRuntimeRngSeed: seed => seed,
    installCombatRuntimeRandom(seed) { assert.equal(seed, 42); throw stopped; },
    getConfiguredHeroSlots: () => [], readEscortPartyConfig: () => ({}),
    buildConfiguredCombatPartyMembers: () => ({ heroMembers: [] }) });
  assert.throws(() => init(rows), error => error === stopped);
  assert.equal(state.globals.ContinuousCombatStage.seed, 42);
});


test('loaded checkpoint rejects a different running WASM ABI before save or create', () => {
  const before = fixture(); before.tick(0); const raw = before.raw(); before.runtime.dispose();
  const after = fixture({ raw, bridgeOverrides: { describe() { return { ...after.real.describe(), abi_version: 131072 }; } } });
  after.tick(0);
  assert.match(after.g.RustCombatError, /ABI version mismatch/);
  assert.equal(after.created.length, 0); assert.deepEqual(after.routes, []);
  assert.equal(after.raw(), raw); after.runtime.dispose();
});


test('D17′ reload restarts current subwave N with its authored boundaries, latest stats and healthy origins', () => {
  const before = fixture();
  for (const hero of before.state.entities.filter(a => a.kind === 'hero')) {
    hero.currentLevel = 100; progression.refreshHeroStats(hero); hero.hp = hero.maxHP;
    progression.saveHeroProgress(hero, before.g.HeroProgress);
  }
  before.rebuild(); before.tick(0);
  for (let frame = 1; frame < 1500 && before.g.ContinuousCombatStage.combatCheckpoint.subwaves.index < 2; frame++) before.tick(frame * 1000 / 30);
  const progress = before.g.ContinuousCombatStage.combatCheckpoint.subwaves;
  assert.ok(progress.index >= 2, 'real Rust admitted a later subwave');
  assert.equal(before.g.ContinuousCombatStage.wave, 1);
  const token = a => `${a.name}:${a.streamSectorIndex}:${a.streamSolo ? 1 : 0}:${a.streamEntryOrder}`;
  const groups = bindAuthoredSubwaves(authorSubwaves(before.planned.map(a => a.name)), before.planned);
  const expected = groups[progress.index].map(token).sort();
  const saved = JSON.parse(before.raw());
  assert.equal(saved.continuousStage.combatCheckpoint.subwaves.index, progress.index);
  assert.ok(saved.continuousStage.combatCheckpoint.generation > 1);
  // New permanent stats must not change which authored group N denotes.
  saved.heroes.Falie.equipmentStats.HP = (saved.heroes.Falie.equipmentStats.HP || 0) + 50;
  before.runtime.dispose();
  const after = fixture({ raw: JSON.stringify(saved) }); after.tick(0); assertFresh(after);
  assert.equal(after.g.ContinuousCombatStage.combatCheckpoint.subwaves.index, progress.index);
  assert.equal(after.g.ContinuousCombatStage.combatCheckpoint.subwaves.partyCP, progress.partyCP);
  const issued = after.created[0].enemies.map(e => after.planned.find(a => String(a.uid) === e.spawn_key));
  assert.deepEqual(issued.map(token).sort(), expected);
  assert.ok(after.created[0].enemies.every(e => e.hp === e.stats.hp), 'entire current subwave starts fresh');
  assert.equal(after.created[0].heroes[0].hp, wfmHeroPermanentInputs(after.g, after.state.entities[0]).stats.hp);
  after.runtime.dispose();
});

test('shared restartAtSubwave entry destroys the old attempt and supports unlimited free healthy retries', () => {
  const f = fixture(); f.tick(0); f.g.goldTotal = 123;
  const wave = f.g.ContinuousCombatStage.wave, lineage = f.g.ContinuousCombatStage.combatCheckpoint.rewardLineage;
  const ids = new Set([f.runtime.read().snapshot.encounter_id]);
  assert.throws(() => f.runtime.restartAtSubwave(-1), /invalid subwave index/);
  for (let attempt = 1; attempt <= 4; attempt++) {
    assert.equal(attempt === 1 ? f.runtime.restartAtSubwave(2) : f.g.RustCombatRestartAtSubwave(), true);
    assert.equal(f.real.describe().resources.worlds, 0, 'outgoing world is destroyed before replacement');
    f.tick(attempt * 1000); const fresh = assertFresh(f);
    assert.ok(!ids.has(fresh.encounter_id)); ids.add(fresh.encounter_id);
    assert.equal(f.g.ContinuousCombatStage.combatCheckpoint.subwaves.index, 2);
    assert.equal(f.g.ContinuousCombatStage.wave, wave);
    assert.equal(f.g.ContinuousCombatStage.combatCheckpoint.rewardLineage, lineage);
    assert.equal(f.g.goldTotal, 123);
    assert.deepEqual(f.routes, []);
  }
  const active = f.runtime.read().snapshot.encounter_id;
  f.g.ContinuousCombatStage.bossActive = true;
  assert.equal(f.runtime.restartAtSubwave(0), false, 'boss recovery keeps its WFM checkpoint path');
  assert.equal(f.runtime.read().snapshot.encounter_id, active);
  f.runtime.dispose(); assert.equal(f.g.RustCombatRestartAtSubwave, undefined);
});

test('automatic real Rust AllDown restarts subwave 3 with the same enemies, healthy origins and no cost', () => {
  const f = fixture({ useRealSession: true });
  for (const hero of f.state.entities.filter(a => a.kind === 'hero')) hero.hp = .001;
  for (const enemy of f.planned) {
    enemy.stats.ATK = 10000;
    enemy.stats.HP = enemy.maxHP = enemy.hp = 1000;
  }
  const stage = f.g.ContinuousCombatStage;
  stage.combatCheckpoint = { version: 1, id: 'automatic-wipe', generation: 1, rewardLineage: 'automatic-wipe',
    contentVersion: progression.WFM_COMBAT_CONTENT_VERSION, abiVersion: f.real.describe().abi_version,
    subwaves: { position: progression.combatSubwavePosition(stage), index: 2,
      partyCP: getContinuousCombatPartyCP(f.state.entities), entryPackMask: 0 } };
  const token = a => `${a.name}:${a.streamSectorIndex}:${a.streamEntryOrder}`;
  const groups = bindAuthoredSubwaves(authorSubwaves(f.planned.map(a => a.name)), f.planned);
  f.g.goldTotal = 123;
  const resources = ({ continuousStage, ...value }) => value;
  const beforeResources = structuredClone(resources(f.g.HeroProgress));
  const transitions = stage.transitions, wave = stage.wave;
  f.tick(0);
  const encounter = f.runtime.read().snapshot.encounter_id;
  let index, frame = 1;
  for (; frame < 6000 && f.g.RustCombatReceipt.outcome !== 'all_down'; frame++) {
    index = stage.combatCheckpoint.subwaves.index;
    f.tick(frame * 1000 / 30);
  }
  assert.equal(f.g.RustCombatReceipt.outcome, 'all_down', 'real WASM reached terminal AllDown');
  assert.equal(index, 3, 'wipe occurs during subwave 3');
  assert.equal(f.real.describe().resources.worlds, 0, 'outgoing world destroyed before retry');
  assert.equal(f.g.ContinuousCombatStage, stage);
  assert.equal(stage.combatCheckpoint.subwaves.index, index);
  f.tick(frame * 1000 / 30);
  assert.notEqual(assertFresh(f).encounter_id, encounter);
  const issued = f.created.at(-1).enemies.map(e => f.planned.find(a => String(a.uid) === e.spawn_key));
  assert.deepEqual(issued.map(token).sort(), groups[index].map(token).sort());
  assert.equal(stage.combatCheckpoint.subwaves.index, index);
  assert.equal(stage.transitions, transitions);
  assert.equal(stage.wave, wave);
  assert.equal(f.g.goldTotal, 123);
  assert.deepEqual(resources(f.g.HeroProgress), beforeResources, 'permanent progress/resources unchanged');
  assert.equal(f.real.describe().resources.worlds, 1);
  assert.deepEqual(f.warnings, []);
  f.runtime.dispose();
});


test('reload after a host wave checkpoint but before its first subwave starts at index zero', () => {
  const before = fixture(); before.tick(0);
  const saved = JSON.parse(before.raw());
  saved.continuousStage.wave = 2;
  saved.continuousStage.transitions++;
  saved.continuousStage.combatCheckpoint.subwaves.index = 3;
  before.runtime.dispose();
  const after = fixture({ raw: JSON.stringify(saved) }); after.tick(0); assertFresh(after);
  assert.equal(after.g.ContinuousCombatStage.wave, 2);
  assert.equal(after.g.ContinuousCombatStage.combatCheckpoint.subwaves.index, 0);
  after.runtime.dispose();
});


test('an out-of-plan persisted subwave index fails closed without checkpoint recovery or overwrite', () => {
  const before = fixture(); before.tick(0); const saved = JSON.parse(before.raw()); before.runtime.dispose();
  saved.continuousStage.combatCheckpoint.subwaves.index = 41;
  const raw = JSON.stringify(saved), after = fixture({ raw }); after.tick(0);
  assert.match(after.g.RustCombatError, /invalid subwave index 41/);
  assert.equal(after.created.length, 0); assert.deepEqual(after.routes, []); assert.equal(after.raw(), raw);
  after.runtime.dispose();
});
