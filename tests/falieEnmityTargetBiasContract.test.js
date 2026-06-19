const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('runtime function bank delegates enemy targeting to data-driven shared policy', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /resolveEnemyTargetHero,\s*\} from '..\/src\/core\/enemyTargetingRules\.mjs';/);
  assert.match(src, /function pickEnemyTargetHero\(ctx, enemyUID = 0\)/);
  assert.match(src, /const result = resolveEnemyTargetHero\(\{/);
  assert.match(src, /g\.LastEnemyTargetBias = result\.trace;/);
  assert.doesNotMatch(src, /FALIE_ENMITY_BONUS/);
});

test('enemy single-target paths use shared target picker', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /const target = pickEnemyTargetHero\(ctx, actorUID\);/);
  assert.match(src, /const target = pickEnemyTargetHero\(ctx, enemyUID\);/);
  assert.match(src, /const targetUID = target \? target\.uid : 0;/);
  assert.match(src, /const target = pickEnemyTargetHero\(ctx, enemyUID\);/);
});

test('Scripts mirror delegates enemy targeting to data-driven shared policy', () => {
  const src = read('Scripts/functionBank.js');
  assert.match(src, /resolveEnemyTargetHero,\s*\} from '..\/src\/core\/enemyTargetingRules\.mjs';/);
  assert.match(src, /function pickEnemyTargetHero\(ctx, enemyUID = 0\)/);
  assert.match(src, /const result = resolveEnemyTargetHero\(\{/);
  assert.match(src, /g\.LastEnemyTargetBias = result\.trace;/);
  assert.doesNotMatch(src, /FALIE_ENMITY_BONUS/);
});
