const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('web-runner app restores town recovery routing shell', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');

  assert.match(src, /allowedTransitions: \['base', 'shop', 'intro', 'idleFarmLayout'[\s\S]*?'storyMock', 'town'\]/);
  assert.match(src, /allowedTransitions: \['town'\]/);
  assert.match(src, /id:\s*'town'/);
  assert.match(src, /eventBus\.on\('layout:town:click'[\s\S]*?requestLayoutChange\('combat', 'town-click', \{ freshStart: true \}\)/);
  assert.match(src, /if \(activeLayoutId === 'town'\) \{[\s\S]*?inputDomains\.emit\('town', 'layout:town:click'/);
  assert.match(src, /if \(activeLayout === 'town'\) \{[\s\S]*?harnessInputDomains\.emit\(activeLayout, 'layout:town:click'/);
  assert.match(src, /requestLayoutChange\('town', 'story-blue-click'\)/);
  assert.match(src, /function requestCombatFailureExit\(reason = 'party_defeated'\)/);
  assert.match(src, /gameState\.substate = 'Neutral';/);
  assert.match(src, /gameState\.isTurnResolving = false;/);
  assert.match(src, /requestLayoutChange\('storyMock', layoutReason\)/);
  assert.match(src, /const outcome = resolveMainRuntimeCombatOutcome\(\{ energy, partyHp, livingHeroes \}\);/);
  assert.match(src, /requestCombatFailureExit\(outcome\.reason\)/);
});
