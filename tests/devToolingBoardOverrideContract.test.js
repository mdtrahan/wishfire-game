const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function readAppSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
}

function extractFunctionSource(src, signature) {
  const start = src.indexOf(signature);
  assert.notEqual(start, -1, `expected ${signature}`);
  const bodyStart = src.indexOf('{', start + signature.length);
  assert.notEqual(bodyStart, -1, `expected ${signature} body`);
  let depth = 0;
  for (let idx = bodyStart; idx < src.length; idx += 1) {
    const ch = src[idx];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return src.slice(start, idx + 1);
  }
  assert.fail(`expected ${signature} to close`);
}

test('dev panel gem color override resets board-only stale state', () => {
  const src = readAppSource();
  const fn = extractFunctionSource(src, 'function applyBoardGemColor(colorValue)');

  assert.match(fn, /resetSuperGemBoardState\(gameState\);/);
  assert.match(fn, /superGemRuntime\.clearPendingSuperGemAction\(state\);/);
  assert.match(fn, /gameState\.selectedGems = \[\];/);
  assert.match(fn, /gameState\.selectionLocked = false;/);
  assert.match(fn, /gameState\.gemMergeFx = null;/);
  assert.match(fn, /state\.globals\.BoardFillActive = 0;/);
  assert.match(fn, /state\.globals\.TapIndex = 0;/);
  assert.match(fn, /gem\.selected = false;/);
  assert.match(fn, /gem\.Selected = 0;/);
  assert.match(fn, /gem\.flashUntil = 0;/);
  assert.match(fn, /setGemArray\(gameState\.gems\);/);
  assert.match(fn, /rebuildGridFromGems\(\);/);
});
