import test from 'node:test';
import assert from 'node:assert/strict';
import { resetActorPresentationAfterRestore } from '../web-runner/src/core/actorPresentationState.mjs';
import { actorPuppetState } from '../web-runner/systems/actorPuppetPresentation.mjs';

test('restoring positive HP clears a terminal cue and starts fresh idle locomotion', () => {
  const actor = { hp: 40, actionState: 'ko', actionFacing: 'left', actionStateStartedAt: 5, actionImpactAt: 5, actionStateUntil: 86405 };
  resetActorPresentationAfterRestore(actor, 10);
  assert.equal(actorPuppetState(actor, 10), 'idle');
  assert.equal(actor.locomotion, 'idle');
  assert.equal(actor.locomotionStartedAt, 10);
  for (const key of ['actionState', 'actionFacing', 'actionStateStartedAt', 'actionImpactAt', 'actionStateUntil']) assert.equal(actor[key], undefined);
});

test('restoring no HP cannot clear a KO presentation', () => {
  const actor = { hp: 0, actionState: 'ko', actionStateUntil: 86405 };
  resetActorPresentationAfterRestore(actor, 10);
  assert.equal(actorPuppetState(actor, 10), 'ko');
});
