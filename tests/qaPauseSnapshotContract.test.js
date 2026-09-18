const test = require('node:test');
const assert = require('node:assert/strict');

test('QA pause snapshots serialize canonical combat state and retain exact departure and resume evidence', async () => {
  const { serializeQaPauseCombatSnapshot } = await import('../web-runner/src/core/qaPauseSnapshot.mjs');
  const { createStoryEntryFlow } = await import('../web-runner/systems/storyEntryFlow.mjs');
  const state = {
    entities: [
      { kind: 'hero', uid: 11, name: 'Fara', hp: 46, flow: 15 },
      { kind: 'hero', uid: 12, name: 'Hondo', hp: 35, flow: 0 },
      { kind: 'enemy', uid: 91, name: 'Dune Wisp', hp: 20 },
      { kind: 'enemy', uid: 92, name: 'Defeated', hp: 0 },
    ],
    globals: { TurnSerial: 18, InitiativeCurrentUID: 11 },
  };
  const snapshots = { departure: null, current: null, resume: null };
  const recordQaPauseSnapshot = stage => {
    const snapshot = serializeQaPauseCombatSnapshot({ state, getCurrentTurn: () => 11 });
    if (stage === 'departure') snapshots.departure = snapshot;
    if (stage === 'resume') snapshots.resume = snapshot;
    snapshots.current = snapshot;
  };
  const gameState = {};
  let active = 'combat';
  const flow = createStoryEntryFlow({
    gameState,
    isReady: () => true,
    recordQaPauseSnapshot,
    layoutState: { getActiveLayoutId: () => active, async requestLayoutChange(target) { active = target; return true; } },
  });
  gameState.storyEntry.phase = 'combat';
  gameState.storyEntry.activeCard = 0;
  assert.equal(await flow.navigate('Hero'), true);
  assert.deepEqual(snapshots.departure, {
    heroes: [{ uid: 11, name: 'Fara', hp: 46, af: 15 }, { uid: 12, name: 'Hondo', hp: 35, af: 0 }],
    activeActorUID: 11,
    turnSerial: 18,
    schedulerToken: 11,
    enemies: [{ uid: 91, name: 'Dune Wisp', hp: 20 }],
  });
  assert.equal(await flow.navigate('Quests'), true);
  assert.deepEqual(snapshots.current, snapshots.departure, 'the paused snapshot stays identical away from combat');
  assert.equal(await flow.continuePausedCombat(), true);
  assert.deepEqual(snapshots.resume, snapshots.departure, 'Resume records exact state before combat can tick');
});
