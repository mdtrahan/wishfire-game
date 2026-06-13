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
    assert.match(src, /const ENEMY_GEM_LOCK_DURATIONS = Object\.freeze\(\{/);
    assert.match(src, /const ENEMY_GEM_LOCK_TARGET_COLORS = Object\.freeze\(\{/);
    assert.match(src, /const ENEMY_BOARD_PRESSURE_SKILL_HARNESSES = Object\.freeze\(\{/);
    assert.match(src, /Enemy_Scathe:\s*Object\.freeze\(\{[\s\S]*axis:\s*'column'[\s\S]*label:\s*'Scathe'[\s\S]*duration:\s*ENEMY_GEM_LOCK_DURATIONS\.Enemy_Scathe[\s\S]*maxLocks:\s*1[\s\S]*targetColor:\s*ENEMY_GEM_LOCK_TARGET_COLORS\.Enemy_Scathe/);
    assert.match(src, /Enemy_Sweep:\s*Object\.freeze\(\{[\s\S]*axis:\s*'row'[\s\S]*label:\s*'Sweep'[\s\S]*duration:\s*ENEMY_GEM_LOCK_DURATIONS\.Enemy_Sweep[\s\S]*maxLocks:\s*2[\s\S]*targetColor:\s*ENEMY_GEM_LOCK_TARGET_COLORS\.Enemy_Sweep/);
    assert.match(src, /function getEnemyBoardPressureSkillHarness\(skillId\)/);
    assert.match(src, /function isEnemyBoardPressureSkillAvailable\(ctx, skillId\)/);
    assert.match(src, /function normalizeEnemyBoardLineSkillDecision\(ctx, enemy, decision\)/);
    assert.match(src, /if \(!harness\) return decision;/);
    assert.match(src, /if \(isEnemyBoardPressureSkillAvailable\(ctx, selected\)\) return decision;/);
    assert.match(src, /selected: resolveEnemyBoardLineFallbackSkill\(enemy, selected\),/);
    assert.match(src, /blocked_incomplete_board/);
    assert.match(src, /blocked_no_lock_target/);
  }
});

test('Djinn/Marid line-clear skills fall back to single-target magic at execution time on incomplete boards', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /const decision = resolveEnemyJobSkillCompat\(\{/);
    assert.match(src, /__ORKA_ENEMY_JOB_SKILL_OWNER__/);
    assert.match(src, /if \(actionCode === ENEMY_JOB_ACTION_SCATHE\) \{\s+if \(isEnemyBoardPressureSkillAvailable\(ctx, 'Enemy_Scathe'\)\) \{\s+Enemy_Scathe\(ctx, enemyUID\);/);
    assert.match(src, /if \(actionCode === ENEMY_JOB_ACTION_SWEEP\) \{\s+if \(isEnemyBoardPressureSkillAvailable\(ctx, 'Enemy_Sweep'\)\) \{\s+Enemy_Sweep\(ctx, enemyUID\);/);
    assert.match(src, /else if \(resolvedTargetUID\) \{\s+Enemy_MAG_Single\(ctx, enemyUID, resolvedTargetUID\);/);
    assert.match(src, /if \(actionCode === ENEMY_JOB_ACTION_MAGIC_SINGLE\) \{\s+if \(resolvedTargetUID\) Enemy_MAG_Single\(ctx, enemyUID, resolvedTargetUID\);/);
    assert.match(src, /function executeEnemyBoardPressureSkill\(ctx, enemyUID, skillId\)/);
    assert.match(src, /const harness = getEnemyBoardPressureSkillHarness\(skillId\);/);
    assert.match(src, /const result = lockRandomGemLine\(ctx, harness\.axis, harness\.skillId, harness\.duration, harness\.maxLocks, harness\.targetColor\);/);
    assert.match(src, /const gemWord = result\.locked === 1 \? 'gem' : 'gems';/);
    assert.match(src, /LogCombat\(ctx, `\$\{enemyName\} used \$\{harness\.label\} and locked \$\{result\.locked\} \$\{gemWord\} \$\{harness\.logSuffix\} \(\$\{result\.duration\} turns\)\.`\);/);
  }
});
