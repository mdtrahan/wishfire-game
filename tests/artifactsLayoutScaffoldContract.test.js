const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('artifacts scaffold defines deterministic gallery model in runtime state', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'state', 'gameState.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /artifactsLayout:\s*\{/);
  assert.match(src, /entryPoint:\s*'map-locale'/);
  assert.match(src, /id:\s*'artifact-fang-mark'/);
  assert.match(src, /id:\s*'artifact-iron-crest'/);
  assert.match(src, /passiveHook:\s*\{\s*key:\s*'regen_tick'/);
  assert.match(src, /visibleCombatFx:\s*false/);
});

test('artifacts layout is wired as map locale entry and runtime layout route', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  const registrySrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'runtimeLayoutRegistry.js'), 'utf8');
  assert.match(src, /import \{ createInitialGameState \} from '\.\/state\/gameState\.js';/);
  assert.match(src, /const gameState = createInitialGameState\(\);/);
  assert.match(registrySrc, /const GALLERY_TRANSITIONS = Object\.freeze\(\['chestsLayout', 'combat', 'storyMock', 'heroLayout', 'idleFarmLayout'\]\);/);
  assert.match(registrySrc, /id:\s*'artifactsLayout'/);
  assert.match(src, /layoutState\.requestLayoutChange\('artifactsLayout',\s*'map-artifacts-locale'\)/);
  assert.match(src, /if \(layoutId === 'artifactsLayout'\)/);
});
