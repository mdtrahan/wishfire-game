import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatCameraProjection, deriveCombatOrdinaryPatrolBounds, deriveCombatWorldVerticalBounds } from '../src/core/combatOrientation.mjs';
import { actorFootprintRadius, isActorTargetInRange } from '../src/core/arenaCombatRules.mjs';
import { LEGACY_COMBAT_MOVEMENT_TUNING } from '../web-runner/src/core/combatMovementTuning.mjs';
import { advanceContinuousCombatArena, beginContinuousCombatPatrolReturn, placeContinuousCombatHeroesInRecoveryHuddle } from '../web-runner/src/core/arenaCombat.mjs';
import { activateContinuousCombatSpawnedEnemy, buildContinuousCombatSpawnPlan, createContinuousCombatStageState, maybeAdvanceContinuousCombatStage, resetContinuousCombatAfterDefeat } from '../web-runner/src/core/continuousCombatStage.mjs';

const rows = ['Gobloc', 'Skeleton', 'High Gobloc', 'Lizardo', 'Orc', 'High Orc', 'Chimerilass', 'Djinn', 'Troll']
  .map(name => ({ name, HP: 20, ATK: 2, DEF: 2, MAG: 1, RES: 1, SPD: 8 }));
const party = () => ['Fara', 'Hondo', 'Runa', 'Kaja'].map((name, i) => ({ uid: i + 1, name, kind: 'hero', hp: 100, maxHP: 100, attackType: i < 2 ? 'physical' : 'magic' }));
const assertBounded = heroes => {
  const b = deriveCombatOrdinaryPatrolBounds();
  for (const h of heroes) {
    assert.ok(h.footX >= b.minX && h.footX <= b.maxX, `${h.name} X=${h.footX}`);
    assert.ok(h.footY >= b.minY && h.footY <= b.maxY, `${h.name} Y=${h.footY}`);
  }
};

test('stationary restored feet, separation and recovery enforce the ordinary patrol in both projections', () => {
  for (const orientation of ['left-wise', 'right-wise']) for (const [x, y] of [[-100, -500], [2300, 1000], [-100, 1000], [2300, -500]]) {
    const heroes = party();
    heroes.forEach(h => { h.footX = x; h.footY = y; });
    const globals = { time: 1, DevMovementTuning: LEGACY_COMBAT_MOVEMENT_TUNING, CombatOrientation: orientation, ContinuousCombatStage: createContinuousCombatStageState(42) };
    for (let i = 0; i < 16; i++) advanceContinuousCombatArena({ globals, entities: heroes, seconds: 0 });
    assertBounded(heroes);
    for (let i = 0; i < heroes.length; i++) for (let j = i + 1; j < heroes.length; j++) {
      assert.ok(Math.hypot(heroes[i].footX - heroes[j].footX, heroes[i].footY - heroes[j].footY) >= 35.9);
    }
    const mean = heroes.reduce((s, h) => s + h.footX / 4, 0);
    const camera = createCombatCameraProjection({ centerX: mean, orientation });
    assert.ok(camera.cameraX > 0 && camera.cameraX < 1440);
    assert.ok(heroes.every(h => camera.project(h.footX, h.footY).x > 0 && camera.project(h.footX, h.footY).x < 360));
    assert.equal(resetContinuousCombatAfterDefeat(globals), true);
    placeContinuousCombatHeroesInRecoveryHuddle({ globals, heroes, now: 1 });
    assertBounded(heroes);
    assert.equal(heroes.reduce((s, h) => s + h.footY / 4, 0), 370);
  }
});

test('all six original sectors and solos clear through actual reach across seeds and waves without patrol escape', () => {
  for (const seed of [1, 17, 42, 91, 1234]) for (const wave of [1, 5, 10]) {
    const stage = { ...createContinuousCombatStageState(seed), wave, transitions: wave - 1 };
    const heroes = party();
    const globals = { time: 0, EncounterSeed: seed, EnemySize: 40, ContinuousCombatStage: stage };
    placeContinuousCombatHeroesInRecoveryHuddle({ globals, heroes, now: 0 });
    const plan = buildContinuousCombatSpawnPlan(rows, stage);
    const enemies = plan.map((entry, i) => activateContinuousCombatSpawnedEnemy(globals,
      { uid: 100 + i, kind: 'enemy', name: entry.row.name, hp: 3, maxHP: 3 }, entry));
    assert.equal(new Set(enemies.map(e => e.streamSectorIndex)).size, 6);
    assert.equal(enemies.filter(e => e.streamSolo).length, 6);
    const nextBasic = new Map();
    let tick = 0;
    for (; tick < 6000 && enemies.some(e => e.hp > 0); tick++) {
      globals.time = tick / 10;
      advanceContinuousCombatArena({ globals, entities: [...heroes, ...enemies], seconds: 0.1 });
      assertBounded(heroes);
      // Diagnostic damage only after production contact, with independent clocks.
      for (const hero of heroes) if (globals.time >= (nextBasic.get(hero.uid) || 0)) {
        const enemy = enemies.find(e => e.hp > 0 && isActorTargetInRange(hero, e));
        if (enemy) { enemy.hp--; nextBasic.set(hero.uid, globals.time + 0.7); }
      }
    }
    assert.ok(enemies.every(e => e.hp === 0), `seed=${seed} wave=${wave} stalled: ${JSON.stringify(enemies.filter(e => e.hp > 0).map(e => ({ x: e.footX, y: e.footY, state: e.streamState })))} party=${JSON.stringify(heroes.map(h => ({ x: h.footX, y: h.footY })))}`);
    assert.ok(tick < 6000);
  }
});

test('sparse world-corner enemies approach bounded heroes while unrelated remote groups remain dormant', () => {
  const vertical = deriveCombatWorldVerticalBounds();
  for (const x of [40, 2120]) for (const y of [vertical.minY, vertical.maxY]) for (const delivery of ['melee', 'ranged']) {
    const heroes = party();
    const globals = { time: 0, ContinuousCombatStage: createContinuousCombatStageState(1) };
    placeContinuousCombatHeroesInRecoveryHuddle({ globals, heroes });
    const enemy = { uid: 20, kind: 'enemy', hp: 1, footX: x, footY: y, streamState: 'roaming', streamDelivery: delivery, streamEngagementGroupId: 20 };
    let reached = false;
    for (let tick = 0; tick < 1800 && !reached; tick++) {
      globals.time = tick / 10;
      advanceContinuousCombatArena({ globals, entities: [...heroes, enemy], seconds: 0.1 });
      assertBounded(heroes);
      reached = heroes.some(h => isActorTargetInRange(h, enemy));
    }
    assert.ok(reached, `${x},${y}/${delivery} becomes reachable`);
    assert.equal(actorFootprintRadius(enemy), 18);
  }
});

test('all-living boss victory preserves settlement feet then walks into patrol without an X or Y snap in either orientation', () => {
  for (const orientation of ['left-wise', 'right-wise']) for (const bossY of [370, 600]) {
    const heroes = party();
    heroes.forEach((hero, i) => { hero.footX = 1600 - i * 10; hero.footY = bossY - 20 + (i % 2) * 40; });
    const boss = { uid: 50, kind: 'enemy', hp: 100, maxHP: 100, combatRank: 'boss', footX: 1850, footY: bossY, streamState: 'engaged' };
    const entities = [...heroes, boss];
    const globals = {
      time: 0, CombatOrientation: orientation, ContinuousCombatStageLoop: 1, GamePhase: 'RUNTIME', EnemySize: 40, EnemyData: rows,
      ContinuousCombatStage: { ...createContinuousCombatStageState(1), bossActive: true, bossAvailable: true, bossWorldX: 1850, bossWorldY: bossY, bossUID: 50, nextEmissionAt: 0 },
      EnemySlots: [], PendingDeaths: {}, EnemyDeathVisualHoldByUID: {},
    };
    for (let i = 0; i < 300; i++) {
      globals.time = i / 10;
      advanceContinuousCombatArena({ globals, entities, seconds: 0.1 });
    }
    const before = heroes.map(hero => [hero.footX, hero.footY]);
    assert.ok(heroes.some(hero => hero.footX > 1640), 'the real boss pursuit reaches outside ordinary X');
    if (bossY === 600) assert.ok(heroes.some(hero => hero.footY > 450));
    boss.hp = 0;
    globals.ContinuousCombatStage.lastArenaUpdatedAt = globals.time;
    let uid = 100;
    assert.equal(maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier: { lanes: {} }, call(name, row) {
      if (name !== 'SpawnEnemy') return;
      const enemy = { uid: uid++, kind: 'enemy', name: row.name, hp: row.HP, maxHP: row.HP };
      entities.push(enemy);
      return enemy;
    } }), true);
    assert.deepEqual(heroes.map(hero => [hero.footX, hero.footY]), before, 'all-living settlement retains its position contract');
    assert.ok(globals.ContinuousCombatPatrolReturn);
    const distance = (a, b) => Math.hypot(a.footX - b.footX, a.footY - b.footY);
    const separation = distance(heroes[0], heroes[3]);
    let ticks = 0;
    while (globals.ContinuousCombatPatrolReturn && ticks++ < 100) {
      const previous = heroes.map(hero => ({ ...hero }));
      globals.time += 0.1;
      advanceContinuousCombatArena({ globals, entities, seconds: 0.1 });
      heroes.forEach((hero, i) => assert.ok(distance(hero, previous[i]) <= 7.800001, 'return uses the existing 78-world-unit/second walk speed'));
    }
    assert.ok(ticks < 100);
    assertBounded(heroes);
    assert.ok(Math.abs(distance(heroes[0], heroes[3]) - separation) < 1e-6, 'the fitting squad translates together');
    advanceContinuousCombatArena({ globals, entities, seconds: 0.1 });
    assertBounded(heroes);
  }
});

test('an oversized boss-return formation reaches separated targets and the first ordinary tick cannot snap it', () => {
  for (const orientation of ['left-wise', 'right-wise']) {
    const heroes = party();
    heroes.forEach((hero, i) => { hero.footX = 1738; hero.footY = [110, 160, 420, 470][i]; });
    const globals = { time: 0, CombatOrientation: orientation, ContinuousCombatStage: { bossActive: false } };
    beginContinuousCombatPatrolReturn(globals, heroes);
    const pairDistances = () => heroes.flatMap((a, i) => heroes.slice(i + 1).map(b => Math.hypot(a.footX - b.footX, a.footY - b.footY)));
    let ticks = 0;
    while (globals.ContinuousCombatPatrolReturn && ticks++ < 100) {
      const previous = heroes.map(h => [h.footX, h.footY]);
      globals.time += 0.1;
      advanceContinuousCombatArena({ globals, entities: heroes, seconds: 0.1 });
      heroes.forEach((h, i) => assert.ok(Math.hypot(h.footX - previous[i][0], h.footY - previous[i][1]) <= 7.800001));
      assert.ok(Math.min(...pairDistances()) >= 35.999, 'return paths keep footprints separate');
    }
    assert.ok(ticks < 100);
    assertBounded(heroes);
    const arrived = heroes.map(h => [h.footX, h.footY]);
    advanceContinuousCombatArena({ globals, entities: heroes, seconds: 0 });
    heroes.forEach((h, i) => assert.ok(Math.hypot(h.footX - arrived[i][0], h.footY - arrived[i][1]) < 1e-5, 'zero-time ordinary collision settlement cannot pop the arrived squad'));
    advanceContinuousCombatArena({ globals, entities: heroes, seconds: 0.1 });
    heroes.forEach((h, i) => assert.ok(Math.hypot(h.footX - arrived[i][0], h.footY - arrived[i][1]) <= 7.80001, 'the first moving ordinary tick stays within walking speed'));
    assertBounded(heroes);
  }
});
