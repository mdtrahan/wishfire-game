const test = require('node:test');
const assert = require('node:assert/strict');

test('shared navigation reaches Quests and Vault during combat, and blocks dialogue', async () => {
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
  assert.equal(gameState.storyEntry.phase, 'ladder');
  gameState.storyEntry.phase = 'opening';
  assert.equal(await flow.navigate('Vault'), false);
  assert.equal(active, 'storyMock');
});
