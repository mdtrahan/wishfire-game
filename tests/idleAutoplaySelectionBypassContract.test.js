const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('dev idle mode auto-resolves pending hero target selection instead of stalling', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /function autoResolvePendingSelectionForDevIdle\(\)/);
  assert.match(src, /if \(!state\.globals\.DevAutoplayActive\) return false;/);
  assert.match(src, /if \(!state\.globals\.PendingSkillID\) return false;/);
  assert.match(src, /if \(!presentationBarrier\.canResolvePendingTargetAction\) return false;/);
  assert.match(src, /if \(String\(state\.globals\.PendingSkillID \|\| ''\) === 'HERO_SINGLE'\) \{/);
  assert.match(src, /const roll = typeof state\.globals\.RuntimeRandom === 'function'\s*\? Number\(state\.globals\.RuntimeRandom\(\)\)\s*: 0;/);
  assert.match(src, /const targetIndex = Math\.max\(0, Math\.min\(livingEnemies\.length - 1, Math\.floor\(safeRoll \* livingEnemies\.length\)\)\);/);
  assert.match(src, /state\.globals\.SelectedEnemyUID = Number\(livingEnemies\[targetIndex\]\.uid \|\| 0\);/);
  assert.doesNotMatch(src, /state\.globals\.SelectedEnemyUID = Number\(livingEnemies\[0\]\.uid \|\| 0\);/);
  assert.match(src, /resolvePendingTargetHandoff\(\{\s*actorUID,\s*source: 'dev-autoplay',\s*\}\)/s);
  assert.match(src, /if \(autoResolvePendingSelectionForDevIdle\(\)\) \{/);
});

test('dev idle mode auto-selects a random skill draw card so combat can resume', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /const IDLE_AUTOPLAY_SKILL_DRAUGHT_HOLD_MS = 1400;/);
  assert.match(src, /function autoResolveSkillDraughtForDevIdle\(\)/);
  assert.match(src, /if \(!state\.globals\.DevAutoplayActive\) return false;/);
  assert.match(src, /state\.globals\.DevAutoplaySkillDraughtSeenAt = 0;/);
  assert.match(src, /if \(!Number\(state\.globals\.SkillDraughtOpen \|\| 0\)\) \{/);
  assert.match(src, /const candidates = Array\.isArray\(state\.globals\.SkillDraughtCandidates\) \? state\.globals\.SkillDraughtCandidates : \[\];/);
  assert.match(src, /if \(!seenAt\) \{/);
  assert.match(src, /if \(now - seenAt < IDLE_AUTOPLAY_SKILL_DRAUGHT_HOLD_MS\) return true;/);
  assert.match(src, /const randomIndex = Math\.floor\(Math\.random\(\) \* candidates\.length\);/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'SelectSkillDraughtCard', randomIndex\);/);
  assert.match(src, /if \(autoResolveSkillDraughtForDevIdle\(\)\) \{/);
});
