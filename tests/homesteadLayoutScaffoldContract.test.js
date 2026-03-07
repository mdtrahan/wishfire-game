const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('homestead scaffold defines deterministic scene metadata in runtime state', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /homesteadLayout:\s*\{/);
  assert.match(src, /entryPoint:\s*'map-locale'/);
  assert.match(src, /theme:\s*'garden-shell'/);
  assert.match(src, /id:\s*'home-slot-1'/);
  assert.match(src, /kind:\s*'emitter-pad'/);
  assert.match(src, /placeholderEmissions:\s*\[/);
});

test('homestead layout is wired as map locale entry and runtime layout route', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /allowedTransitions:\s*\[[^\]]*'homesteadLayout'[^\]]*\]/);
  assert.match(src, /id:\s*'homesteadLayout'/);
  assert.match(src, /layoutState\.requestLayoutChange\('homesteadLayout',\s*'map-homestead-locale'\)/);
  assert.match(src, /if \(layoutId === 'homesteadLayout'\)/);
});
