const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('layout-0 startup loading frame renders when bootstrap is incomplete', () => {
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const fallbackSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderHarnessFallback.js'), 'utf8');
  const overlaySrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderOverlays.js'), 'utf8');

  assert.match(appSrc, /function drawStartupLoadingFrame\(\) \{/);
  assert.match(fallbackSrc, /const startupLoading = layoutId === 'storyMock' && !freshCombatBootstrapped;/);
  assert.match(fallbackSrc, /Loading Chapter 1\.\.\./);
  assert.match(fallbackSrc, /const barY = Math\.max\(24 \* layoutScale, viewHeight - 66 \* layoutScale\);/);
  assert.match(overlaySrc, /Loading assets/);
});

test('startup loading state is tracked and finalized at runtime readiness', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /function updateStartupLoadState\(patch = \{\}\) \{/);
  assert.match(src, /updateStartupLoadState\(\{ active: true, phase: 'bootstrap', label: 'Loading layout data\.{3}', progress: 0\.05 \}\);/);
  assert.match(src, /updateStartupLoadState\(\{ active: false, phase: 'runtime', label: 'Ready', progress: 1 \}\);/);
  assert.match(src, /function ensureStartupPreload\(\) \{/);
  assert.match(src, /ensureStartupPreload\(\)\.catch\(\(\) => \{\}\);/);
  assert.match(src, /isReady: \(\) => freshCombatBootstrapped/);
});
