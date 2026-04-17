const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('hero selector uses one-shot bounce-up easing instead of perpetual pulse/bob', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /const HERO_SELECTOR_BOUNCE_POINTS = Object\.freeze\(\[/);
  assert.match(src, /const HERO_SELECTOR_BOUNCE_DURATION_SEC = 1\.02;/);
  assert.match(src, /function getHeroSelectorBounceScale\(elapsedSec\)/);
  assert.match(src, /function getHeroSelectorAttentionScale\(elapsedSec, timeSec\)/);
  assert.match(src, /return sampleLinearPoints\(HERO_SELECTOR_BOUNCE_POINTS, t\);/);
  assert.match(src, /gameState\.heroTurnSelectorFx = \{/);
  assert.match(src, /selectorFx\.startedAt = Number\(g\.time \|\| 0\);/);
  assert.match(src, /const selectorElapsed = Math\.max\(0, Number\(g\.time \|\| 0\) - Number\(selectorFx\.startedAt \|\| 0\)\);/);
  assert.match(src, /const entranceScale = getHeroSelectorBounceScale\(selectorElapsed\);/);
  assert.match(src, /const attentionScale = getHeroSelectorAttentionScale\(selectorElapsed, g\.time \|\| 0\);/);
  assert.match(src, /const selScale = entranceScale \* attentionScale;/);
  assert.match(src, /const targetY = pos\.y - scaledH \/ 2 - \(10 \* layoutScale\);/);
  assert.doesNotMatch(src, /const bob = 2\.2 \* controlScale \* pulse;/);
  assert.doesNotMatch(src, /const selScale = 1 \+ 0\.035 \* pulse;/);
  assert.doesNotMatch(src, /HERO_SELECTOR_MIN_SCALE/);
});
