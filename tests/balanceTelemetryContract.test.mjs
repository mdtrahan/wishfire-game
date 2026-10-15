import test from 'node:test';
import assert from 'node:assert/strict';
import { recordBalanceCombatEvent } from '../web-runner/src/core/balanceTelemetry.mjs';

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
