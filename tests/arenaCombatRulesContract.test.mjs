import test from 'node:test';
import assert from 'node:assert/strict';
import { isActorTargetInRange } from '../src/core/arenaCombatRules.mjs';
import { advanceContinuousCombatArena } from '../web-runner/src/core/arenaCombat.mjs';
import { activateContinuousCombatSpawnedEnemy, pushContinuousCombatEnemy } from '../web-runner/src/core/continuousCombatStage.mjs';

test('actor reach uses initialized feet and preserves delivery-specific range', () => {
  const melee = { kind: 'hero', hp: 10, footX: 100, footY: 200, attackType: 'melee', arenaEnabled: true };
  const mage = { kind: 'hero', hp: 10, footX: 100, footY: 200, attackType: 'magic', arenaEnabled: true };
  const enemy = { kind: 'enemy', hp: 10, footX: 210, footY: 200, streamState: 'in_range' };
  assert.equal(isActorTargetInRange(melee, enemy), false);
  assert.equal(isActorTargetInRange(mage, enemy), true);
});

test('arena advances both factions to contact with bounded semantic actor state', () => {
  const hero = { uid: 1, kind: 'hero', hp: 100, maxHP: 100, attackType: 'melee' };
  const enemy = { uid: 2, kind: 'enemy', hp: 100, maxHP: 100, x: 290, y: 200, streamState: 'in_range', streamWalkSpeed: 40, streamDelivery: 'melee' };
  const entities = [hero, enemy];
  for (let index = 0; index < 70; index += 1) {
    advanceContinuousCombatArena({ globals: { EnemySize: 40 }, entities, seconds: 0.1 });
  }
  assert.ok(hero.footX > 106);
  assert.ok(enemy.footX < 290);
  assert.equal(enemy.streamState, 'engaged');
  assert.notEqual(hero.arenaTargetUID, 0);
  assert.notEqual(enemy.arenaTargetUID, 0);
  for (const actor of entities) {
    assert.ok(Number.isFinite(actor.footX));
    assert.ok(Number.isFinite(actor.footY));
    assert.ok(['left', 'right'].includes(actor.facing));
    assert.ok(['idle', 'walk'].includes(actor.locomotion));
    assert.ok(['idle', 'walk'].includes(actor.actionState));
  }
});

test('four heroes retain stable targets and separate crowded footprints', () => {
  const heroes = Array.from({ length: 4 }, (_, index) => ({ uid: index + 1, kind: 'hero', hp: 100, attackType: index === 2 ? 'magic' : 'melee', footX: 106, footY: 240, arenaEnabled: true }));
  const enemies = [
    { uid: 10, kind: 'enemy', hp: 100, streamState: 'in_range', footX: 175, footY: 240, streamDelivery: 'melee', arenaEnabled: true },
    { uid: 11, kind: 'enemy', hp: 100, streamState: 'in_range', footX: 178, footY: 240, streamDelivery: 'melee', arenaEnabled: true },
  ];
  const entities = [...heroes, ...enemies];
  advanceContinuousCombatArena({ globals: { time: 1 }, entities, seconds: 0.1 });
  const targets = heroes.map(hero => hero.arenaTargetUID);
  advanceContinuousCombatArena({ globals: { time: 1.1 }, entities, seconds: 0.1 });
  assert.deepEqual(heroes.map(hero => hero.arenaTargetUID), targets, 'small distance changes stay inside hysteresis');
  for (let index = 0; index < entities.length; index += 1) for (let other = index + 1; other < entities.length; other += 1) {
    const a = entities[index], b = entities[other];
    assert.ok(Math.hypot(a.footX - b.footX, a.footY - b.footY) >= 35, `${a.uid}/${b.uid} footprints separate`);
  }
});

test('spawn feet are staggered and source-relative displacement remains bounded', () => {
  const globals = { time: 0, EnemySize: 40, EnemyAreaRect: { minX: 160, maxX: 300, minY: 60, maxY: 240 } };
  const spawned = Array.from({ length: 5 }, (_, index) => activateContinuousCombatSpawnedEnemy(globals, { uid: 20 + index, kind: 'enemy', hp: 100, name: 'Gobloc' }, { entryOrder: index }));
  assert.equal(new Set(spawned.map(enemy => enemy.footX)).size, 1);
  assert.equal(new Set(spawned.map(enemy => enemy.footY)).size, 4);
  assert.ok(spawned.every(enemy => enemy.actionState === 'spawn' && Number.isFinite(enemy.footY)));
  const enemy = { uid: 99, kind: 'enemy', hp: 100, streamState: 'engaged', footX: 180, footY: 230, x: 180, y: 230 };
  const source = { uid: 1, kind: 'hero', hp: 100, footX: 150, footY: 200 };
  assert.ok(pushContinuousCombatEnemy(enemy, 55, 0, source) > 0);
  assert.ok(enemy.footX > 180 && enemy.footY > 230);
  assert.ok(enemy.footX <= 290 && enemy.footY <= 375);
});
