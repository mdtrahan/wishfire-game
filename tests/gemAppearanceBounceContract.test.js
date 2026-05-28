const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('gem bounce render scale starts small, overshoots, and settles', async () => {
  const src = read('web-runner/systems/renderBoard.js');
  const moduleSrc = src
    .replace(/import .*;\n\n/, '')
    .replace(/export /g, '');
  const getGemBounceScale = Function(`${moduleSrc}; return getGemBounceScale;`)();
  const renderRuntimeSrc = read('web-runner/systems/renderRuntime.js');

  assert.match(src, /const GEM_APPEAR_BOUNCE_MIN_RENDER_SEC = 0\.14784;/);
  assert.match(src, /const GEM_APPEAR_BOUNCE_OVERSHOOT_SCALE = 0\.56;/);
  assert.match(src, /const bounceNow = Number\(gameTime != null \? gameTime : now\);/);
  assert.match(renderRuntimeSrc, /gameTime: state\.globals\.time \|\| 0/);
  assert.match(src, /Number\(gem\.bounceDur \|\| 0\),\n\s+GEM_APPEAR_BOUNCE_MIN_RENDER_SEC,/);
  assert.equal(getGemBounceScale(0, 1), 0);
  assert.equal(getGemBounceScale(0.44, 1), 1.28784);
  assert.ok(getGemBounceScale(0.8, 1) > 1);
  assert.equal(getGemBounceScale(1, 1), 1);
  assert.match(src, /const amp = Number\(gem\.bounceAmp \?\? 1\);/);
});
