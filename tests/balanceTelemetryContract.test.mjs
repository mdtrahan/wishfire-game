import test from 'node:test';
import assert from 'node:assert/strict';
import { captureBalanceImpactGeometry, recordBalanceCombatEvent } from '../web-runner/src/core/balanceTelemetry.mjs';

test('impact capture records the enemy target and every hero range before damage', () => {
  const enemy = { uid: 8, name: 'Gobloc', combatTier: 'fodder', kind: 'enemy', hp: 50, footX: 100, footY: 100, arenaTargetUID: 2 };
  const heroes = [
    { uid: 1, kind: 'hero', hp: 20, footX: 150, footY: 100 },
    { uid: 2, kind: 'hero', hp: 20, footX: 180, footY: 100 },
    { uid: 3, kind: 'hero', hp: 0, footX: 100, footY: 100 },
  ];
  assert.deepEqual(captureBalanceImpactGeometry(enemy, heroes), {
    source: { uid: 8, name: 'Gobloc', combatTier: 'fodder', x: 100, y: 100, arenaTargetUID: 2, streamDelivery: '' },
    heroes: [
      { uid: 1, x: 150, y: 100, hp: 20, inReach: true },
      { uid: 2, x: 180, y: 100, hp: 20, inReach: false },
      { uid: 3, x: 100, y: 100, hp: 0, inReach: false },
    ],
  });
});

test('balance events stay off in ordinary gameplay and retain ordered IDs in capture mode', () => {
  const globals = { time: 1 };
  recordBalanceCombatEvent(globals, { type: 'damage', amount: 2 });
  assert.equal(globals.BalanceCombatEvents, undefined);
  globals.DevBalanceCapture = true;
  recordBalanceCombatEvent(globals, { type: 'damage', amount: 2 });
  globals.time = 2;
  recordBalanceCombatEvent(globals, { type: 'heal', amount: 1 });
  assert.deepEqual(globals.BalanceCombatEvents, [
    { id: 1, time: 1, type: 'damage', amount: 2 },
    { id: 2, time: 2, type: 'heal', amount: 1 },
  ]);
});

test('capture ring stays bounded while preserving sequence gaps for detection', () => {
  const globals = { DevBalanceCapture: true, time: 0 };
  for (let id = 0; id < 4097; id += 1) recordBalanceCombatEvent(globals, { type: 'damage' });
  assert.equal(globals.BalanceCombatEventSeq, 4097);
  assert.equal(globals.BalanceCombatEvents.length, 2048);
  assert.equal(globals.BalanceCombatEvents[0].id, 2050);
});
