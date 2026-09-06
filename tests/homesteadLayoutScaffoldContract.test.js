const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('homestead scaffold defines deterministic scene metadata in runtime state', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'state', 'gameState.js');
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
  const registrySrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'runtimeLayoutRegistry.js'), 'utf8');
  assert.match(src, /import \{ createInitialGameState \} from '\.\/state\/gameState\.js';/);
  assert.match(src, /const gameState = createInitialGameState\(\);/);
  assert.match(registrySrc, /id:\s*'homesteadLayout'[\s\S]*allowedTransitions: \['chestsLayout', 'combat', 'storyMock', 'heroLayout', 'idleFarmLayout'\]/);
  assert.match(registrySrc, /id:\s*'homesteadLayout'/);
  assert.match(src, /layoutState\.requestLayoutChange\('homesteadLayout',\s*'map-homestead-locale'\)/);
  assert.match(src, /if \(layoutId === 'homesteadLayout'\)/);
});
