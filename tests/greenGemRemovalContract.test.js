const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('runtime board spawning and dev forced board options do not create active green gems', () => {
  const src = read('web-runner/app.js');
  assert.doesNotMatch(src, /\{\s*value:\s*0,\s*label:\s*'GREEN'\s*\}/);
  assert.match(src, /const GEM_SPAWN_COLORS = Object\.freeze\(\[1, 2, 3, 4, 5\]\);/);
  assert.doesNotMatch(src, /const weights = \[1, 1, 1, 1, 1, PURPLE_WEIGHT\];/);
});

test('green color zero no longer forms or activates a super gem', () => {
  const rulesSrc = read('web-runner/src/core/superGemRules.mjs');
  const runtimeSrc = read('web-runner/systems/superGemRuntime.js');
  assert.doesNotMatch(rulesSrc, /SUPER_GEM_COLORS = new Set\(\[0, 1, 2, 3, 4, 5\]\)/);
  assert.match(rulesSrc, /SUPER_GEM_COLORS = new Set\(\[1, 2, 3, 4, 5\]\)/);
  assert.match(runtimeSrc, /if \(color === 0\) return false;/);
});

test('gem action routing treats green color zero as retired legacy input', () => {
  const srcCore = read('src/core/gemActionRules.mjs');
  const runnerCore = read('web-runner/src/core/gemActionRules.mjs');
  const runtimeBank = read('web-runner/modules/functionBank.js');
  const scriptsBank = read('Scripts/functionBank.js');
  for (const src of [srcCore, runnerCore, runtimeBank, scriptsBank]) {
    assert.doesNotMatch(src, /GEM_ACTION_GREEN_ATTACK/);
    assert.doesNotMatch(src, /HERO_AOE[^;\n]*GREEN/);
  }
});

test('active hero gem usage no longer increments or renders green counters', () => {
  const runtimeBank = read('web-runner/modules/functionBank.js');
  const scriptsBank = read('Scripts/functionBank.js');
  const hudSrc = read('web-runner/systems/renderHUD.js');
  for (const src of [runtimeBank, scriptsBank]) {
    assert.doesNotMatch(src, /if \(gemColor === 0\) return 'GREEN';/);
  }
  assert.doesNotMatch(hudSrc, /`GREEN:\$\{Number\(/);
});
