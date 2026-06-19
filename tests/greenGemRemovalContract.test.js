const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('runtime board spawning, yellow refill, and dev forced board options retire only frame-zero green', () => {
  const src = read('web-runner/app.js');
  const devToolingSrc = read('web-runner/systems/devToolingRuntime.js');
  assert.doesNotMatch(devToolingSrc, /\{\s*value:\s*0,\s*label:\s*'GREEN'\s*\}/);
  assert.match(devToolingSrc, /\{\s*value:\s*4,\s*label:\s*'HEAL'\s*\}/);
  assert.match(devToolingSrc, /const GEM_SPAWN_COLORS = Object\.freeze\(\[1, 2, 3, 4, 5\]\);/);
  assert.doesNotMatch(src, /const weights = \[1, 1, 1, 1, 1, PURPLE_WEIGHT\];/);

  const yellowSrc = read('web-runner/src/core/yellowRefillRules.mjs');
  assert.match(yellowSrc, /YELLOW_REFILL_TARGETS = \[1, 2, 4\]/);
  assert.doesNotMatch(yellowSrc, /YELLOW_REFILL_TARGETS = \[[^\]]*0[^\]]*\]/);
});

test('frame-zero green no longer forms active super gems while heal remains active', () => {
  const rulesSrc = read('web-runner/src/core/superGemRules.mjs');
  const runtimeSrc = read('web-runner/systems/superGemRuntime.js');
  assert.doesNotMatch(rulesSrc, /SUPER_GEM_COLORS = new Set\(\[0, 1, 2, 3, 4, 5\]\)/);
  assert.match(rulesSrc, /SUPER_GEM_COLORS = new Set\(\[1, 2, 3, 4, 5\]\)/);
  assert.match(rulesSrc, /const palette = \[1, 2, 3, 4, 5\];/);
  assert.match(runtimeSrc, /if \(color === 0\) return false;/);
});

test('frame-zero green has no active visual assets while heal visuals remain active', () => {
  const visualSrc = read('web-runner/systems/gemVisuals.js');
  assert.match(visualSrc, /const ACTIVE_GEM_COLORS = Object\.freeze\(\[1, 2, 3, 4, 5\]\);/);
  assert.doesNotMatch(visualSrc, /0:\s*'gems\/green_gem\.png'/);
  assert.doesNotMatch(visualSrc, /0:\s*'images\/gem-animation 1-000\.png'/);
  assert.doesNotMatch(visualSrc, /0:\s*'gems\/super_green\.png'/);
  assert.match(visualSrc, /4:\s*'gems\/heal_gem\.png'/);
  assert.match(visualSrc, /4:\s*'images\/gem-animation 1-004\.png'/);
  assert.match(visualSrc, /4:\s*'gems\/super_heal\.png'/);
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
