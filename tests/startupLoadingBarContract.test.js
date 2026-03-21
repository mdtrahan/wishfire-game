const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('layout-0 startup loading frame renders when bootstrap is incomplete', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /function drawStartupLoadingFrame\(\) \{/);
  assert.match(src, /const startupLoading = layoutId === 'storyMock' && !freshCombatBootstrapped;/);
  assert.match(src, /Story Mock \(loading\.\.\.\)/);
  assert.match(src, /const barY = Math\.max\(24, viewH - 66\);/);
  assert.match(src, /Loading/);
});

test('startup loading state is tracked and finalized at runtime readiness', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /function updateStartupLoadState\(patch = \{\}\) \{/);
  assert.match(src, /updateStartupLoadState\(\{ active: true, phase: 'bootstrap', label: 'Loading layout data\.{3}', progress: 0\.05 \}\);/);
  assert.match(src, /updateStartupLoadState\(\{ active: false, phase: 'runtime', label: 'Ready', progress: 1 \}\);/);
  assert.match(src, /function ensureStartupPreload\(\) \{/);
  assert.match(src, /ensureStartupPreload\(\)\.catch\(\(\) => \{\}\);/);
  assert.match(src, /blocked: 'bootstrap_loading'/);
});
