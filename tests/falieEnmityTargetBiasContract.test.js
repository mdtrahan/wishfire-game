const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('runtime function bank defines Falie enmity bias with cap guardrail', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /const FALIE_ENMITY_BONUS = 0\.35;/);
  assert.match(src, /const FALIE_ENMITY_CAP = 0\.75;/);
  assert.match(src, /function pickEnemyTargetHero\(ctx, enemyUID = 0\)/);
  assert.match(src, /mode: 'falie_enmity_bias'/);
  assert.match(src, /Math\.min\(FALIE_ENMITY_CAP, baseChance \+ FALIE_ENMITY_BONUS\)/);
});

test('enemy single-target paths use shared Falie target picker', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /const target = pickEnemyTargetHero\(ctx, actorUID\);/);
  assert.match(src, /const resolvedTargetUID = targetUID \|\| \(pickEnemyTargetHero\(ctx, enemyUID\)\?\.uid \|\| 0\);/);
  assert.match(src, /const target = pickEnemyTargetHero\(ctx, enemyUID\);/);
});

test('Scripts mirror includes Falie enmity target-bias implementation', () => {
  const src = read('Scripts/functionBank.js');
  assert.match(src, /const FALIE_ENMITY_BONUS = 0\.35;/);
  assert.match(src, /const FALIE_ENMITY_CAP = 0\.75;/);
  assert.match(src, /function pickEnemyTargetHero\(ctx, enemyUID = 0\)/);
  assert.match(src, /mode: 'falie_enmity_bias'/);
});
