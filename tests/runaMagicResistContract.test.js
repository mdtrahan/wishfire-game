const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('runtime function bank defines Runa magic-resist trigger constants and helper', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /const RUNA_MAGIC_RESIST_TRIGGER_CHANCE = 0\.6;/);
  assert.match(src, /const RUNA_MAGIC_RESIST_NULLIFY_CHANCE = 0\.35;/);
  assert.match(src, /const RUNA_MAGIC_RESIST_REDUCE_FACTOR = 0\.2;/);
  assert.match(src, /function applyRunaMagicResist\(ctx, enemyUID, targetHeroUID, incomingDamage, skillId = 'Enemy_MAG_Single'\)/);
  assert.match(src, /LastRunaMagicResist/);
});

test('enemy magic resolves through canonical combat rules', () => {
 const src=read('web-runner/modules/functionBank.js');
 const body=src.slice(src.indexOf('export function Enemy_MAG_Single'),src.indexOf('export function Enemy_Heal_Self'));
 assert.match(body,/magic:true/);assert.doesNotMatch(body,/applyRunaMagicResist/);
 assert.match(src,/resolveNativeEnemyArea/);
});

test('Scripts mirror includes Runa magic-resist helper and usage', () => {
  const src = read('Scripts/functionBank.js');
  assert.match(src, /const RUNA_MAGIC_RESIST_TRIGGER_CHANCE = 0\.6;/);
  assert.match(src, /function applyRunaMagicResist\(ctx, enemyUID, targetHeroUID, incomingDamage, skillId = 'Enemy_MAG_Single'\)/);
  assert.match(src, /LastRunaMagicResist/);
});
