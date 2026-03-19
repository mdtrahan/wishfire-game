const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('dev idle mode auto-resolves pending hero target selection instead of stalling', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /function autoResolvePendingSelectionForDevIdle\(\)/);
  assert.match(src, /if \(!state\.globals\.DevAutoplayActive\) return false;/);
  assert.match(src, /if \(!state\.globals\.PendingSkillID\) return false;/);
  assert.match(src, /if \(String\(state\.globals\.PendingSkillID \|\| ''\) === 'HERO_SINGLE'\) \{/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'ExecuteSkill', state\.globals\.PendingSkillID, actorUID\);/);
  assert.match(src, /if \(autoResolvePendingSelectionForDevIdle\(\)\) \{/);
});
