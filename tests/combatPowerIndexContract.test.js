const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('runtime bootstraps canonical derived CP without authored overrides', () => {
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const initializerSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'combatSessionInitializer.js'), 'utf8');
  assert.match(appSrc, /computeCombatPower as canonicalCombatPower, normalizeCombatPowerActor/);
  assert.match(appSrc, /actor: normalizeCombatPowerActor\(actor\)/);
  assert.match(appSrc, /return shadowCombatPower\(\{[\s\S]*jsValue: result[\s\S]*\}\);/);
  assert.match(appSrc, /createCombatSessionInitializer\(\{[\s\S]*computeCombatPower,/);
  assert.match(initializerSrc, /export function resolveEnemyEncounterCombatPower\(row, computeCombatPower = defaultComputeCombatPower\)/);
  assert.match(initializerSrc, /combatPower: computeCombatPower\(\{ \.\.\.v, maxHP: partyMaxHP\[i\]/);
  assert.match(initializerSrc, /state\.globals\.EnemyData = \(enemyRows \|\| \[\]\)\.map\(\(row\) => \(\{/);
  assert.match(initializerSrc, /CombatPower: resolveEnemyEncounterCombatPower\(row, computeCombatPower\)/);
});

test('runtime snapshot surfaces combatPower for heroes and enemies', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'devBrowserTestHooks.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /heroes:[\s\S]*combatPower: Number\(e\.combatPower \|\| 0\)/);
  assert.match(src, /enemies:[\s\S]*combatPower: Number\(e\.combatPower \|\| 0\)/);
});

test('spawn enemy derives combatPower in both runtime mirrors', () => {
  const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /function computeCombatPowerFromStats\(atk, def, hp\)/);
    assert.match(src, /combatPower: computeCombatPowerFromStats\(/);
    assert.doesNotMatch(src, /combatPower: Number\([\s\S]{0,260}enemyData\.CombatPower/);
  }
});
