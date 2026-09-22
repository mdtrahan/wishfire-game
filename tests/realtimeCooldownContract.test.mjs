import test from 'node:test';
import assert from 'node:assert/strict';
import { realtimeCooldownSeconds, selectRealtimeReadyActor } from '../web-runner/src/core/realtimeCooldown.mjs';

test('real-time cooldowns advance from wall time and only reset the actor that completed', () => {
  const actors = [
    { uid: 1, hp: 10, speed: 8 },
    { uid: 2, hp: 10, speed: 16 },
  ];
  const opening = selectRealtimeReadyActor({ actors, now: 0 });
  assert.equal(opening.selected, null);
  const firstReadyAt = Math.min(...Object.values(opening.readyAt));
  const first = selectRealtimeReadyActor({ actors, readyAt: opening.readyAt, now: firstReadyAt });
  assert.ok(first.selected);
  const firstUID = first.selected.uid;
  const idle = selectRealtimeReadyActor({ actors, readyAt: first.readyAt, now: firstReadyAt + 0.1, completedUID: firstUID });
  assert.equal(idle.selected, null);
  assert.equal(idle.readyAt[String(firstUID)], firstReadyAt + 0.1 + realtimeCooldownSeconds(first.selected));
  const secondReadyAt = Math.min(...Object.values(idle.readyAt));
  const secondReady = selectRealtimeReadyActor({ actors, readyAt: idle.readyAt, now: secondReadyAt });
  assert.ok(secondReady.selected);
  assert.notEqual(secondReady.selected.uid, firstUID);
});

test('hero basics use independent one-to-1.2 second cooldowns and pre-arm before a target arrives', () => {
  const actors = [8, 10, 11, 12].map((speed, index) => ({ uid: index + 1, type: 0, hp: 10, speed }));
  assert.deepEqual(actors.map(realtimeCooldownSeconds), [1, 1.1, 1.15, 1.2]);
  const waiting = selectRealtimeReadyActor({ actors, now: 5, selectionEnabled: false });
  assert.equal(waiting.selected, null);
  assert.deepEqual(Object.values(waiting.readyAt), [6, 6.1, 6.15, 6.2]);
  const released = selectRealtimeReadyActor({ actors, readyAt: waiting.readyAt, now: 6.2 });
  assert.equal(released.selected.uid, 1);
});
