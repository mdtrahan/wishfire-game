const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');

test('Djinn/Marid line-clear skills only select on full boards in both runtime mirrors', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /function isBoardFullyPopulatedForEnemyMutation\(ctx\)/);
    assert.match(src, /const ENEMY_BOARD_PRESSURE_SKILL_HARNESSES = Object\.freeze\(\{/);
    assert.match(src, /Enemy_Scathe:\s*Object\.freeze\(\{[\s\S]*axis:\s*'column'[\s\S]*label:\s*'Scathe'/);
    assert.match(src, /Enemy_Sweep:\s*Object\.freeze\(\{[\s\S]*axis:\s*'row'[\s\S]*label:\s*'Sweep'/);
    assert.match(src, /function getEnemyBoardPressureSkillHarness\(skillId\)/);
    assert.match(src, /function normalizeEnemyBoardLineSkillDecision\(ctx, enemy, decision\)/);
    assert.match(src, /if \(!getEnemyBoardPressureSkillHarness\(selected\)\) return decision;/);
    assert.match(src, /selected: resolveEnemyBoardLineFallbackSkill\(enemy, selected\),/);
    assert.match(src, /blocked_incomplete_board/);
  }
});

test('Djinn/Marid line-clear skills fall back to single-target magic at execution time on incomplete boards', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /const normalizedSkillId = normalizeEnemyBoardLineSkillDecision\(ctx, enemy, \{/);
    assert.match(src, /if \(normalizedSkillId === 'Enemy_Scathe'\) \{\s+Enemy_Scathe\(ctx, enemyUID\);/);
    assert.match(src, /if \(normalizedSkillId === 'Enemy_Sweep'\) \{\s+Enemy_Sweep\(ctx, enemyUID\);/);
    assert.match(src, /if \(normalizedSkillId === 'Enemy_MAG_Single'\) \{\s+if \(resolvedTargetUID\) Enemy_MAG_Single\(ctx, enemyUID, resolvedTargetUID\);/);
    assert.match(src, /function executeEnemyBoardPressureSkill\(ctx, enemyUID, skillId\)/);
    assert.match(src, /const harness = getEnemyBoardPressureSkillHarness\(skillId\);/);
    assert.match(src, /const result = clearRandomGemLine\(ctx, harness\.axis\);/);
    assert.match(src, /LogCombat\(ctx, `\$\{enemyName\} used \$\{harness\.label\} and removed \$\{result\.cleared\} gems \$\{harness\.logSuffix\}`\);/);
  }
});
