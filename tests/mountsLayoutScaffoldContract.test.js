const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('mounts scaffold defines deterministic gallery model in runtime state', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /mountsLayout:\s*\{/);
  assert.match(src, /entryPoint:\s*'map-locale'/);
  assert.match(src, /id:\s*'mount-ash-runner'/);
  assert.match(src, /id:\s*'mount-ridge-boar'/);
  assert.match(src, /siblingFamily:\s*'progression-gallery'/);
  assert.match(src, /vaultCompatibilityTier:\s*3/);
});

test('mounts layout is wired as map locale entry and runtime layout route', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /allowedTransitions:\s*\[[^\]]*'mountsLayout'[^\]]*\]/);
  assert.match(src, /id:\s*'mountsLayout'/);
  assert.match(src, /layoutState\.requestLayoutChange\('mountsLayout',\s*'map-mounts-locale'\)/);
  assert.match(src, /if \(layoutId === 'mountsLayout'\)/);
});
