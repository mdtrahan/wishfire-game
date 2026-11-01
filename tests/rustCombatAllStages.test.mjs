import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WFM_ENEMY_DEFINITIONS, shadowEnemy } from '../src/core/combatShadowAdapter.mjs';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';
import { createWfmCombatConfig } from '../web-runner/systems/wfmCombatConfig.mjs';
import { createRustCombatRuntime } from '../web-runner/systems/rustCombatRuntime.mjs';
import { createQuestCombatSession, recoverContinuousOrdinaryDefeatIfNeeded } from '../web-runner/systems/questCombatSession.mjs';
import { createCombatSimulationTicker } from '../web-runner/systems/combatSimulationTick.mjs';
import { settleContinuousCombatRewards } from '../web-runner/modules/heroCommands.mjs';
import { newHeroProgress, refreshHeroStats, createHeroProgressStore } from '../web-runner/src/core/heroProgression.mjs';
import { buildContinuousCombatSpawnPlan, activateContinuousCombatSpawnedEnemy, createContinuousCombatStageState, getContinuousCombatStage } from '../web-runner/src/core/continuousCombatStage.mjs';
const table = JSON.parse(fs.readFileSync(new URL('../web-runner/assets/enemies.json', import.meta.url)));
const rows = table.data[0].slice(1).map((cell, i) => Object.fromEntries(table.data.map(column => [column[0][0], column[i + 1][0]]))).filter(row => row.name);
const wasm = new WebAssembly.Module(fs.readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url)));
function fixture({ mask = 0, boss = false, hp = 1, level = 100 } = {}) {
  const real = createCombatBridge(new WebAssembly.Instance(wasm)), ends = [], spawned = [], receipts = [], routes = [], transitions = [], heals = [], spawnHP = [], clears = [];
  const bridge = { ...real, ordinaryClear(...args) { const result = real.ordinaryClear(...args); clears.push(result); return result; }, end(...args) { const result = real.end(...args); ends.push({ reason: args[3], events: result.events }); return result; } };
  const heroes = ['Falie', 'Huun', 'Runa', 'Kojonn'].map((name, i) => {
    const actor = { ...newHeroProgress(name), uid: i + 1, kind: 'hero', x: 1020 + i * 36, y: 350, isAlive: true };
    actor.currentLevel = level; refreshHeroStats(actor); actor.hp = actor.maxHP * hp;
    return actor;
  });
  const g = { ContinuousCombatStageLoop: 1, ContinuousCombatStage: { ...createContinuousCombatStageState(7), clearedPackMask: mask,
    ...(boss ? { bossActive: true, bossAvailable: true, bossArmed: true } : {}), nextEmissionAt: 3 },
    time: 0, CombatSessionId: 'all-stages', GamePhase: 'RUNTIME', EnemyData: rows, EnemySlots: [], EnemyIDs: [], NextUID: 90,
    HeroProgress: createHeroProgressStore(), ProgressionBattle: { id: 'all-stages', participants: heroes.map(h => h.heroInstanceKey), defeated: {}, defeatedGold: {}, persistPendingRewards(reward) { if (reward) receipts.push(reward); } } };
  const state = { globals: g, entities: [...heroes] };
  function call(name, ...args) {
    assert.doesNotMatch(name, /TickRealtime|ApplyDamage|KillEnemy|ProcessTurn|CalculateDamage/);
    if (name === 'SpawnEnemy') {
      const [row, slotIndex] = args;
      spawnHP.push({ time: g.time, heroes: heroes.map(h => ({ hp: h.hp, maxHP: h.maxHP })) });
      const actor = { uid: g.NextUID++, kind: 'enemy', name: row.name, stats: { ...row }, enemyRole: row.enemyRole, combatTier: row.combatTier,
        slotIndex, hp: row.HP, maxHP: row.HP };
      spawned.push(actor); state.entities.push(actor); g.EnemySlots[slotIndex] = actor.uid + 1; g.EnemyIDs[slotIndex] = actor.uid;
      return actor;
    }
    if (name === 'SettleContinuousCombatRewards') return settleContinuousCombatRewards({ state });
    if (name === 'UpdateHeroHPUI') heals.push(heroes.map(h => h.hp));
  }
  const plan = buildContinuousCombatSpawnPlan(rows, g.ContinuousCombatStage);
  g.ContinuousCombatStage.spawnedPackMask = plan.reduce((mask, p) => mask | 1 << p.sectorIndex, 0);
  for (const entry of plan) {
    const a = call('SpawnEnemy', { ...entry.row, enemyRole: boss ? 'boss' : 'fodder' }, entry.slotIndex);
    activateContinuousCombatSpawnedEnemy(g, a, entry);
    if (boss) g.ContinuousCombatStage.bossUID = a.uid;
  }
  const session = createQuestCombatSession({ state, gameState: {}, call, sync() {} });
  for (const method of ['surrenderBossAttempt', 'recoverContinuousDefeat']) {
    const fn = session[method]; session[method] = function(reason) { routes.push([method, reason]); return fn.call(this, reason); };
  }
  const clock = createCombatSimulationTicker({ isBagProgressBlocked: () => false });
  const runtime = createRustCombatRuntime({ state, bridge, session, call, getEnemyRows: () => rows, advanceHostTime: clock.advanceHostTime,
    warn(...args) { throw new Error(args.join(' ')); } });
  let frame = 0;
  const options = () => ({ globals: g, entities: state.entities, call, nowMs: frame++ * 1000 / 30,
    onBossTimeout: () => session.surrenderBossAttempt('boss_timeout') });
  function tick() {
    const before = g.ContinuousCombatStage;
    if (runtime.tick(options())) transitions.push({ from: before, to: g.ContinuousCombatStage, time: g.time, heroes: heroes.map(h => ({ hp: h.hp, maxHP: h.maxHP })) });
    assert.equal(g.RustCombatError, undefined);
  }
  function runUntil(predicate, budget = 5000) { for (let n = 0; n < budget && !predicate(); n++) tick(); assert.ok(predicate(), 'scenario reached its bound'); }
  return { state, g, heroes, runtime, bridge: real, ends, spawned, receipts, routes, transitions, heals, spawnHP, clears, tick, runUntil, call };
}

test('every authored WFM enemy has one explicit Rust definition and a distinct host identity', () => {
  assert.deepEqual(Object.keys(WFM_ENEMY_DEFINITIONS).sort(), rows.map(r => r.name).sort());
  assert.equal(new Set(Object.values(WFM_ENEMY_DEFINITIONS).map(d => d.id)).size, rows.length);
  const f = fixture();
  const config = createWfmCombatConfig({ globals: f.g, entities: f.state.entities, enemyRows: rows, encounterId: 'registry' });
  const position = { x: 1200, y: 350 };
  config.enemies = rows.map((row, i) => shadowEnemy({ identity: String(1000 + i), key: row.name, position, reference: row, resolved: row, hp: row.HP, hostMaxHP: row.HP }));
  config.enemies.find(e => e.definition_id === 'slice.boss.troll_brute').summon_profiles = [{ definition_id: WFM_ENEMY_DEFINITIONS.Gobloc.id, stats: config.enemies[0].stats }];
  const world = f.bridge.create(config);
  assert.equal(world.snapshot.live_enemies, 10);
  assert.ok(world.snapshot.actors.some(a => a.kind === 'wfm_djinn'));
  f.bridge.destroy(world.world);
  f.state.entities.find(a => a.kind === 'enemy').name = 'Unmapped';
  assert.throws(() => createWfmCombatConfig({ globals: f.g, entities: f.state.entities, enemyRows: rows, encounterId: 'bad' }), /WFM combat: unmapped enemy "Unmapped"/);
  f.runtime.dispose();
});

test('R8: all WFM spawn tables exclude dormant slice combatants; Troll is the sole R7 exception', () => {
  const dormant = new Set(['slice.enemy.fizzmite', 'slice.enemy.bastorto', 'slice.enemy.mirewing', 'slice.enemy.gloamink', 'slice.boss.troll_brute', 'slice.boss.chimerilass', 'slice.boss.djinn']);
  for (let region = 1; region <= 100; region++) for (let wave = 1; wave <= 20; wave++) for (const bossActive of [false, true]) {
    const state = { ...createContinuousCombatStageState(7, { region }), wave, bossActive };
    const stage = getContinuousCombatStage(state);
    for (const name of stage.enemyNames) {
      const id = WFM_ENEMY_DEFINITIONS[name]?.id;
      assert.ok(id, name);
      assert.ok(!dormant.has(id) || (bossActive && name === 'Troll' && id === 'slice.boss.troll_brute'));
    }
    for (const entry of buildContinuousCombatSpawnPlan(rows, state)) {
      const id = WFM_ENEMY_DEFINITIONS[entry.row.name]?.id;
      assert.ok(id && (!dormant.has(id) || (bossActive && entry.row.name === 'Troll')));
    }
  }
});

test('real Rust ordinary packs overlap, advance seeded waves at >=3s and heal once in host HP units', () => {
  const f = fixture({ hp: .5 });
  const first = f.spawned.map(a => [a.name, a.x, a.y, a.streamSectorIndex]);
  assert.ok(new Set(f.spawned.map(a => a.streamSectorIndex)).size > 1);
  const control = fixture({ hp: .5 });
  assert.deepEqual(control.spawned.map(a => [a.name, a.x, a.y, a.streamSectorIndex]), first); control.runtime.dispose();
  f.tick(); assert.ok(f.runtime.read().snapshot.live_enemies > 6);
  f.runUntil(() => f.transitions.length === 2);
  assert.ok(f.transitions.every(t => t.time >= t.from.nextEmissionAt));
  assert.equal(f.ends.length, 0, 'ordinary waves retain the world, cooldowns and wards');
  assert.equal(f.clears.length, 2);
  assert.equal(new Set(f.clears.map(c => c.snapshot.encounter_id)).size, 1);
  assert.ok(f.receipts.every(r => r.amount === 0), 'ordinary kills mint zero Bag points');
  assert.equal(new Set(f.receipts.map(r => r.id)).size, f.receipts.length);
  assert.ok(f.g.ProgressionBattle.settled !== true);
  for (const transition of f.transitions) {
    const before = f.spawnHP.find(s => s.time === transition.time).heroes;
    transition.heroes.forEach((h, i) => {
      const hostMax = f.heroes[i].combatBaseMaxHP;
      const expected = Math.min(h.maxHP, before[i].hp + Math.ceil(hostMax * .15) / hostMax * h.maxHP);
      assert.ok(Math.abs(h.hp - expected) < .001, `${h.hp} ~= ${expected}`);
    });
  }
  assert.ok(f.heroes.every(h => h.hp > 0));
  f.runtime.dispose();
});

test('checkpoint mask survives Rust creation and completed sectors never respawn', () => {
  const f = fixture({ mask: 0b010101 });
  assert.ok(f.spawned.every(a => !(0b010101 & 1 << a.streamSectorIndex)));
  f.tick();
  assert.equal(f.g.ContinuousCombatStage.clearedPackMask, 0b010101);
  assert.equal(f.runtime.read().snapshot.live_enemies, f.spawned.length);
  f.runtime.dispose();
});

test('boss timeout ends with HostTimeout, no cleanup kills and one WFM recovery', () => {
  const f = fixture({ boss: true, level: 1 });
  for (const hero of f.heroes) hero.stats.ATK = hero.stats.MAG = 0;
  f.state.entities.find(a => a.kind === 'enemy').stats.ATK = 0;
  f.runUntil(() => f.g.ContinuousCombatStage.lastBossOutcome === 'timeout');
  assert.equal(f.ends.at(-1).reason, 'host_timeout');
  assert.ok(f.ends.at(-1).events.some(e => e.body.kind === 'despawned'));
  assert.ok(f.ends.at(-1).events.every(e => e.body.kind !== 'died'));
  assert.equal(f.routes.filter(([method]) => method === 'recoverContinuousDefeat').length, 1);
  assert.deepEqual(f.receipts, []);
  assert.ok(f.g.ContinuousCombatStage.lastBossTimeout.elapsedSec >= 30);
  f.runtime.dispose();
});

test('one downed hero stays in Rust combat and autonomous Phoenix selects the lowest slot', () => {
  const f = fixture({ boss: true, level: 1 });
  f.heroes[0].hp = f.heroes[1].hp = 0;
  f.state.entities.find(a => a.kind === 'enemy').stats.ATK = 0;
  f.tick();
  assert.equal(recoverContinuousOrdinaryDefeatIfNeeded({ state: f.state, session: { recoverContinuousDefeat() { throw Error('legacy KO route'); } } }), false);
  f.runUntil(() => !!f.runtime.read().snapshot.phoenix_channel, 30);
  assert.equal(f.runtime.read().snapshot.phoenix_channel.hero, f.runtime.read().snapshot.actors.find(a => a.host_id === f.heroes[0].heroInstanceKey).actor_id);
  assert.deepEqual(f.routes, []);
  f.runtime.dispose();
});


test('a real lethal hit on the deadline step wins before the timeout callback', () => {
  const control = fixture({ boss: true });
  control.runUntil(() => control.g.RustCombatReceipt?.outcome === 'ended');
  const deathTime = control.g.RustCombatReceipt.seconds;
  control.runtime.dispose();
  const f = fixture({ boss: true });
  f.g.ContinuousCombatStage.bossTimerStartedAt = deathTime - 30;
  f.runUntil(() => f.g.RustCombatReceipt?.outcome === 'ended');
  assert.equal(f.g.RustCombatReceipt.seconds, deathTime);
  assert.equal(f.routes.length, 0);
  assert.equal(f.receipts.filter(r => r.amount === 5).length, 1);
  f.runtime.dispose();
});

test('ordinary all-down routes once through checkpoint recovery and never credits cleanup', () => {
  const f = fixture();
  f.heroes.forEach(h => { h.hp = 0; });
  f.tick();
  assert.equal(f.g.RustCombatReceipt.outcome, 'all_down');
  assert.deepEqual(f.routes, [['recoverContinuousDefeat', 'rust_all_down']]);
  assert.equal(f.ends.at(-1).reason, 'all_down_routed');
  assert.ok(f.heroes.every(h => h.hp === h.maxHP));
  assert.deepEqual(f.receipts, []);
  f.runtime.dispose();
});

test('boss surrender ends before WFM recovery with no boss kill receipt', () => {
  const f = fixture({ boss: true }); f.tick();
  f.runtime.stop(); f.routes.length = 0;
  // Production departure stops Rust before invoking this same session owner.
  const session = createQuestCombatSession({ state: f.state, gameState: {}, call: f.call, sync() {} });
  assert.equal(session.surrenderBossAttempt(), true);
  assert.equal(f.ends.at(-1).reason, 'host_stage_transition');
  assert.ok(f.ends.at(-1).events.every(e => e.body.kind !== 'died'));
  assert.equal(f.g.ContinuousCombatStage.bossSummonRequired, true);
  assert.deepEqual(f.receipts, []);
  f.runtime.dispose();
});


test('ordinary respite rounds in host units, deduplicates transitions and rejects live-field healing', () => {
  const f = fixture();
  const config = createWfmCombatConfig({ globals: f.g, entities: f.state.entities, enemyRows: rows, encounterId: 'respite-rounding' });
  config.enemies = [];
  config.heroes.forEach(h => { h.host_max_hp = 100; h.hp = h.stats.hp / 2; });
  const created = f.bridge.create(config);
  const clear = f.bridge.ordinaryClear(created.world, config.encounter_id, 'wave:1');
  clear.snapshot.actors.filter(a => a.team === 'hero').forEach(a => assert.ok(Math.abs(a.hp / a.max_hp - .65) < 1e-6));
  assert.deepEqual(f.bridge.ordinaryClear(created.world, config.encounter_id, 'wave:1').events, []);
  const enemy = shadowEnemy({ identity: 'new', key: 'Gobloc', position: { x: 1300, y: 350 }, reference: rows[0], resolved: rows[0], hp: 40, hostMaxHP: 40 });
  f.bridge.spawn(created.world, config.encounter_id, [enemy]);
  assert.throws(() => f.bridge.ordinaryClear(created.world, config.encounter_id, 'wave:2'), /respite requires a cleared ordinary wave/);
  f.bridge.destroy(created.world); f.runtime.dispose();
});
