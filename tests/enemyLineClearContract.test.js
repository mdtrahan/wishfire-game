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
    assert.match(src, /decision\.selected === 'Enemy_X_Out' && !isBoardFullyPopulatedForEnemyMutation\(ctx\)/);
    assert.match(src, /selected: 'Enemy_MAG_Single'/);
    assert.match(src, /blocked_incomplete_board/);
  }
});

test('Djinn/Marid line-clear skills fall back to single-target magic at execution time on incomplete boards', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /if \(skillId === 'Enemy_X_Out'\) \{\s+if \(!isBoardFullyPopulatedForEnemyMutation\(ctx\)\) \{\s+if \(resolvedTargetUID\) Enemy_MAG_Single\(ctx, enemyUID, resolvedTargetUID\);\s+return 1;\s+\}\s+return Enemy_X_Out\(ctx, enemyUID\);/);
  }
});
