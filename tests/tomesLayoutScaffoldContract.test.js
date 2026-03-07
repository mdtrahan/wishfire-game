const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('tomes scaffold defines deterministic gallery model in runtime state', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /tomesLayout:\s*\{/);
  assert.match(src, /entryPoint:\s*'map-locale'/);
  assert.match(src, /id:\s*'tome-cinder-codex'/);
  assert.match(src, /id:\s*'tome-gale-archive'/);
  assert.match(src, /buffSlot:\s*\{\s*stat:\s*'ATK'/);
  assert.match(src, /enemyDebuffSlot:\s*\{\s*stat:\s*'CRIT'/);
});

test('tomes layout is wired as map locale entry and runtime layout route', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /allowedTransitions:\s*\[[^\]]*'tomesLayout'[^\]]*\]/);
  assert.match(src, /id:\s*'tomesLayout'/);
  assert.match(src, /layoutState\.requestLayoutChange\('tomesLayout',\s*'map-tomes-locale'\)/);
  assert.match(src, /if \(layoutId === 'tomesLayout'\)/);
});
