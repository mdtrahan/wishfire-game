const test = require('node:test');
const assert = require('node:assert/strict');

test('shared navigation reaches Vault and pauses into the Quests modal during combat', async () => {
  const { createStoryEntryFlow } = await import('../web-runner/systems/storyEntryFlow.mjs');
  let active = 'combat';
  const gameState = { selectedGems: [1,2,3], selectionLocked: true };
  const flow = createStoryEntryFlow({ gameState, isReady: () => true,
    layoutState: { getActiveLayoutId: () => active, async requestLayoutChange(target) { active = target; return true; } } });
  gameState.storyEntry.phase = 'combat';
  assert.equal(await flow.navigate('Vault'), true);
  assert.equal(active, 'chestsLayout');
  assert.equal(await flow.navigate('Quests'), true);
  assert.equal(active, 'storyMock');
  assert.equal(gameState.storyEntry.phase, 'combat-paused');
  assert.equal(gameState.storyEntry.modal, 'combat-pause');
  gameState.storyEntry.phase = 'opening';
  assert.equal(await flow.navigate('Vault'), false);
  assert.equal(active, 'storyMock');
});
