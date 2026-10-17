import test from 'node:test';
import assert from 'node:assert/strict';
import { recordActorPuppetDefeat, combatEnemiesForPresentation, resetActorPuppetDefeats } from '../web-runner/systems/actorPuppetDefeats.mjs';

test('removed enemies finish their puppet KO without returning to simulation or rewards', () => {
  const g = { time: 4, CombatSessionId: 1 };
  const actor = { uid: 9, kind: 'enemy', name: 'Gobloc', hp: 0, x: 200, y: 180, facing: 'left' };
  recordActorPuppetDefeat(g, actor);
  const entities = [];
  const [picture] = combatEnemiesForPresentation(entities, g);
  assert.equal(picture.uid, actor.uid);
  assert.equal(picture.actionState, 'ko');
  assert.equal(picture.actionStateStartedAt, 4);
  assert.deepEqual(entities, []);
  assert.deepEqual(actor, { uid: 9, kind: 'enemy', name: 'Gobloc', hp: 0, x: 200, y: 180, facing: 'left' });
  g.time = 4.9;
  recordActorPuppetDefeat(g, actor);
  assert.equal(combatEnemiesForPresentation([], g)[0].actionStateStartedAt, 4, 'duplicate KO cannot restart the pose');
  g.time = 5;
  assert.deepEqual(combatEnemiesForPresentation([], g), []);
});

test('death pictures deduplicate held actors and reset with session/recovery/clock changes', () => {
  const g = { time: 4, CombatSessionId: 1, EnemyDeathVisualHoldByUID: { 9: {} } };
  const actor = { uid: 9, kind: 'enemy', hp: 0 };
  recordActorPuppetDefeat(g, actor);
  assert.deepEqual(combatEnemiesForPresentation([actor], g), [actor]);
  g.CombatSessionId = 2;
  assert.deepEqual(combatEnemiesForPresentation([], g), []);
  recordActorPuppetDefeat(g, actor); resetActorPuppetDefeats(g);
  assert.deepEqual(combatEnemiesForPresentation([], g), []);
  recordActorPuppetDefeat(g, actor); g.time = 0;
  assert.deepEqual(combatEnemiesForPresentation([], g), []);
});
