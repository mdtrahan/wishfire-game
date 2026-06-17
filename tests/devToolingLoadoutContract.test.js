const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('idle farm runtime accepts forced duplicate hero names and forced enemy slot names from config', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'idleFarmRuntime.mjs'), 'utf8');
  assert.match(src, /const forcedHeroNames = Array\.isArray\(config\.heroNames\) \? config\.heroNames\.filter\(Boolean\) : \[\];/);
  assert.match(src, /const forcedEnemyNames = Array\.isArray\(config\.enemyNames\) \? config\.enemyNames\.map\(\(name\) => String\(name \|\| ''\)\.trim\(\)\) : \[\];/);
  assert.match(src, /name: forcedName \|\| pickEnemyName\(spawnIndex - 1, catalog\),/);
});

test('dev tooling loadout sync writes hero and enemy slot overrides into idle farm config', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devToolingRuntime.js'), 'utf8');
  assert.match(src, /function syncIdleFarmDevLoadoutConfig\(cfg = ensureDevToolingConfig\(\)\) \{/);
  assert.match(src, /heroNames,/);
  assert.match(src, /enemySlots: Math\.max\(1, activeEnemySlots\.length \|\| Number\(currentConfig\.enemySlots \|\| 1\)\),/);
  assert.match(src, /enemyNames: rawEnemySlots\.map\(\(value\) => \(value === DEV_TOOL_RANDOM_ENEMY_SLOT \? '' : value\)\),/);
});
