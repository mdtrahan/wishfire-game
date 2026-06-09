const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('locked gems render dark overlay and centered countdown text', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderBoard.js'), 'utf8');

  assert.match(src, /function isLockedGem\(gem\)/);
  assert.match(src, /function renderLockedGemOverlay\(ctx, rect, countdown\)/);
  assert.match(src, /ctx\.fillStyle = 'rgba\(55, 65, 81, 0\.66\)';/);
  assert.match(src, /ctx\.fillRect\(rect\.x, rect\.y, rect\.w, rect\.h\);/);
  assert.match(src, /ctx\.font = `700 \$\{fontSize\}px monospace`;/);
  assert.match(src, /ctx\.textAlign = 'center';/);
  assert.match(src, /ctx\.textBaseline = 'middle';/);
  assert.match(src, /ctx\.strokeStyle = '#000';/);
  assert.match(src, /ctx\.fillStyle = '#fff';/);
  assert.match(src, /renderLockedGemOverlay\(ctx, rect, getLockedGemCountdown\(gem\)\);/);
});
