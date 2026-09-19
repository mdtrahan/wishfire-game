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

test('initial cooldown phases interleave factions instead of preserving roster order', () => {
  const actors = [
    { uid: 1, type: 0, hp: 10, speed: 10 },
    { uid: 2, type: 0, hp: 10, speed: 10 },
    { uid: 3, type: 1, hp: 10, speed: 10 },
    { uid: 4, type: 1, hp: 10, speed: 10 },
  ];
  const { readyAt } = selectRealtimeReadyActor({ actors, now: 5 });
  const order = actors.slice().sort((a, b) => readyAt[a.uid] - readyAt[b.uid]).map(actor => actor.type);
  assert.notDeepEqual(order, [0, 0, 1, 1]);
});
