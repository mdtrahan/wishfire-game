const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
  test(`configured follow-up attack harness exists in ${relPath}`, () => {
    const src = read(relPath);
    assert.match(src, /export function ConfigureActorExtraTurnSkill\(ctx, actorUID, options = \{\}\)/);
    assert.match(src, /export function RemoveActorExtraTurnSkill\(ctx, actorUID\)/);
    assert.match(src, /export function GetActorExtraTurnSkill\(ctx, actorUID\)/);
    assert.match(src, /export function TryGrantConfiguredExtraTurn\(ctx, actorUID, forcedRoll = null, meta = null\)/);
    assert.match(src, /const config = ensureActorExtraTurnSkillStore\(g\)\[uid\];/);
    assert.match(src, /if \(!Number\.isFinite\(roll\) \|\| roll < 0 \|\| roll >= Number\(config\.chance \|\| 0\)\) return false;/);
    assert.match(src, /if \(String\(config\.skillId \|\| ''\) === 'DOUBLE_ATTACK'\) \{/);
    assert.match(src, /if \(actionSkillId !== 'HERO_SINGLE'\) return false;/);
    assert.match(src, /granted = queueConfiguredDoubleAttackFollowUp\(ctx, uid, preferredTargetUID\);/);
    assert.match(src, /hit\.retargetOnDeath = 1;/);
    assert.match(src, /hit\.followUpSkillId = 'DOUBLE_ATTACK';/);
    assert.match(src, /let latestExistingAt = 0;/);
    assert.match(src, /const lungeTotal = 0\.14 \+ 0\.32 \+ 0\.16 \+ 0\.26;/);
    assert.match(src, /const firstAttackSettledAt = latestExistingAt > 0 \? latestExistingAt : \(now \+ lungeTotal\);/);
    assert.match(src, /const finalFollowUpUntil = firstAttackSettledAt \+ \(lungeTotal \* 2\);/);
    assert.match(src, /g\.ActionLockUntil = Math\.max\(Number\(g\.ActionLockUntil \|\| 0\), finalFollowUpUntil\);/);
    assert.match(src, /hit\.followUpAwaitTextClear = 1;/);
    assert.match(src, /hit\.followUpOffset = earliestNewAt > 0 \? Math\.max\(0, Number\(hit\.at \|\| 0\) - earliestNewAt\) : 0;/);
    assert.doesNotMatch(src, /spdOppMax/);
    assert.doesNotMatch(src, /SpeedDoubleRatio/);
  });
}

test('hero action resolve path passes skill identity and target into the follow-up harness', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /let resolvedTargetUID = 0;/);
  assert.match(src, /resolvedTargetUID = Number\(target\.uid \|\| 0\);/);
  assert.match(src, /TryGrantConfiguredExtraTurn\(ctx, Number\(actorUID \|\| 0\), null, \{\s*skillId: String\(skillId \|\| ''\),\s*targetUID: Number\(resolvedTargetUID \|\| 0\),\s*}\);/s);
});

for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
  test(`advance turn clears the current hero's double-attack latch in ${relPath}`, () => {
    const src = read(relPath);
    assert.match(src, /if \(currentType === 0 && currentUID && g\.ExtraTurnGranted && Object\.prototype\.hasOwnProperty\.call\(g\.ExtraTurnGranted, currentUID\)\) \{/);
    assert.match(src, /delete g\.ExtraTurnGranted\[currentUID\];/);
  });
}

test('pending hero hit executor retargets double-attack follow-up packets when the first target is dead', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /state\.globals\.DoubleAttackLungeStarted = state\.globals\.DoubleAttackLungeStarted \|\| \{\};/);
  assert.match(src, /if \(followUpBatchId > 0 && hit\.followUpAwaitTextClear\) \{/);
  assert.match(src, /if \(state\.globals\.TextAnimating \|\| \(state\.globals\.HeroAction && state\.globals\.HeroAction\.active\)\) continue;/);
  assert.match(src, /queued\.at = anchorAt \+ Number\(queued\.followUpOffset \|\| 0\);/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'StartHeroLunge', hit\.heroUID\);/);
  assert.match(src, /if \(\(!targetEntity \|\| Number\(targetEntity\.hp \|\| 0\) <= 0\) && hit\.retargetOnDeath\) \{/);
  assert.match(src, /const batchId = Number\(hit\.followUpBatchId \|\| 0\);/);
  assert.match(src, /queued\.targetUID = Number\(replacement\.uid \|\| 0\);/);
});
