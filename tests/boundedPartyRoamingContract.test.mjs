import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatCameraProjection, deriveCombatOrdinaryPatrolBounds, deriveCombatWorldVerticalBounds } from '../src/core/combatOrientation.mjs';
import { actorFootprintRadius, isActorTargetInRange } from '../src/core/arenaCombatRules.mjs';
import { advanceContinuousCombatArena, placeContinuousCombatHeroesInRecoveryHuddle } from '../web-runner/src/core/arenaCombat.mjs';
import { activateContinuousCombatSpawnedEnemy, buildContinuousCombatSpawnPlan, createContinuousCombatStageState, resetContinuousCombatAfterDefeat } from '../web-runner/src/core/continuousCombatStage.mjs';

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
    const globals = { time: 1, CombatOrientation: orientation, ContinuousCombatStage: createContinuousCombatStageState(42) };
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
