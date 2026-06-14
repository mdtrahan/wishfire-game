const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('collectibles scaffold defines deterministic gallery model in runtime state', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'state', 'gameState.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /collectiblesLayout:\s*\{/);
  assert.match(src, /entryPoint:\s*'map-locale'/);
  assert.match(src, /id:\s*'collectible-astral-seal'/);
  assert.match(src, /id:\s*'collectible-vault-shard'/);
  assert.match(src, /siblingFamily:\s*'progression-gallery'/);
  assert.match(src, /setTag:\s*'orbit-regalia'/);
});

test('collectibles layout is wired as map locale entry and runtime layout route', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /import \{ createInitialGameState \} from '\.\/state\/gameState\.js';/);
  assert.match(src, /const gameState = createInitialGameState\(\);/);
  assert.match(src, /allowedTransitions:\s*\[[^\]]*'collectiblesLayout'[^\]]*\]/);
  assert.match(src, /id:\s*'collectiblesLayout'/);
  assert.match(src, /layoutState\.requestLayoutChange\('collectiblesLayout',\s*'map-collectibles-locale'\)/);
  assert.match(src, /if \(layoutId === 'collectiblesLayout'\)/);
});
