const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('locked gems render dark overlay and centered countdown text', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderBoard.js'), 'utf8');

  assert.match(src, /function isLockedGem\(gem\)/);
  assert.match(src, /function renderLockedGemOverlay\(ctx, rect, countdown, drawGemSprite = null\)/);
  assert.match(src, /typeof drawGemSprite === 'function'/);
  assert.match(src, /ctx\.globalAlpha = 0\.66;/);
  assert.match(src, /ctx\.filter = 'brightness\(0\.28\) grayscale\(1\)';/);
  assert.match(src, /drawGemSprite\(\);/);
  assert.match(src, /ctx\.arc\(rect\.cx, rect\.cy, radius, 0, Math\.PI \* 2\);/);
  assert.match(src, /ctx\.font = `700 \$\{fontSize\}px monospace`;/);
  assert.match(src, /ctx\.textAlign = 'center';/);
  assert.match(src, /ctx\.textBaseline = 'middle';/);
  assert.match(src, /ctx\.strokeStyle = '#000';/);
  assert.match(src, /ctx\.fillStyle = '#fff';/);
  assert.match(src, /const drawLockedGemSprite = gemImg\s*\?\s*\(\) => ctx\.drawImage\(gemImg, rect\.x, rect\.y, rect\.w, rect\.h\)\s*:\s*null;/);
  assert.match(src, /renderLockedGemOverlay\(ctx, rect, getLockedGemCountdown\(gem\), drawLockedGemSprite\);/);
});
