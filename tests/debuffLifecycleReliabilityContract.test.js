const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

test('debuff lifecycle uses normalized state helper in runtime function bank', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /function ensureEnemyDebuffState\(ctx, enemyUID\)/);
  assert.match(src, /function maybeResolveEnemyDebuffApplyOwner\(ctx, payload = \{\}\)/);
  assert.match(src, /const jsAmountAfter = amountBefore \+ addAmount;/);
  assert.match(src, /const jsTurnsAfter = durationTurns;/);
  assert.match(src, /function decayEnemyDebuffsForTurn\(ctx, enemyUID\)/);
  assert.match(src, /const debuffState = ensureEnemyDebuffState\(ctx, enemyUID\);/);
  assert.match(src, /decayEnemyDebuffsForTurn\(ctx, currentUID\);/);
  assert.match(src, /const ENEMY_DEBUFF_SLOT_LIMIT = 3;/);
});

test('debuff lifecycle normalization is mirrored in Scripts function bank', () => {
  const src = read('Scripts/functionBank.js');
  assert.match(src, /function ensureEnemyDebuffState\(ctx, enemyUID\)/);
  assert.match(src, /function maybeResolveEnemyDebuffApplyOwner\(ctx, payload = \{\}\)/);
  assert.match(src, /const jsAmountAfter = amountBefore \+ addAmount;/);
  assert.match(src, /const jsTurnsAfter = durationTurns;/);
  assert.match(src, /function decayEnemyDebuffsForTurn\(ctx, enemyUID\)/);
  assert.match(src, /const debuffState = ensureEnemyDebuffState\(ctx, enemyUID\);/);
  assert.match(src, /decayEnemyDebuffsForTurn\(ctx, currentUID\);/);
  assert.match(src, /const ENEMY_DEBUFF_SLOT_LIMIT = 3;/);
});
