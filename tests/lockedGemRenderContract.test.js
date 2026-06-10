const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('locked gems render normalized gray lock treatment and centered countdown text', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderBoard.js'), 'utf8');

  assert.match(src, /function isLockedGem\(gem\)/);
  assert.match(src, /function renderLockedGemOverlay\(ctx, rect, countdown, drawGemSprite = null\)/);
  assert.match(src, /const LOCKED_GEM_GRAY = 160;/);
  assert.match(src, /const LOCKED_GEM_LUMINANCE_MIX = 0\.4;/);
  assert.match(src, /const LOCKED_GEM_GRAY_MIX = 0\.6;/);
  assert.match(src, /function getLockedGemGraySprite\(sourceImage\)/);
  assert.match(src, /0\.2126 \* data\[i\]/);
  assert.match(src, /0\.7152 \* data\[i \+ 1\]/);
  assert.match(src, /0\.0722 \* data\[i \+ 2\]/);
  assert.match(src, /const lockedGray = Math\.round\(\(luminance \* LOCKED_GEM_LUMINANCE_MIX\) \+ \(LOCKED_GEM_GRAY \* LOCKED_GEM_GRAY_MIX\)\);/);
  assert.match(src, /typeof drawGemSprite === 'function'/);
  assert.doesNotMatch(src, /ctx\.filter = 'saturate\(0\.15\)';/);
  assert.doesNotMatch(src, /sourceSaturation \* LOCKED_GEM_SATURATION_SCALE/);
  assert.doesNotMatch(src, /brightness\(0\.28\)/);
  assert.doesNotMatch(src, /grayscale\(1\)/);
  assert.doesNotMatch(src, /rgba\(55, 65, 81/);
  assert.match(src, /drawGemSprite\(\);/);
  assert.match(src, /ctx\.arc\(rect\.cx, rect\.cy, radius, 0, Math\.PI \* 2\);/);
  assert.match(src, /ctx\.font = `700 \$\{fontSize\}px monospace`;/);
  assert.match(src, /ctx\.textAlign = 'center';/);
  assert.match(src, /ctx\.textBaseline = 'middle';/);
  assert.match(src, /ctx\.strokeStyle = '#000';/);
  assert.match(src, /ctx\.fillStyle = '#fff';/);
  assert.match(src, /const lockedGemImg = gemImg \? getLockedGemGraySprite\(gemImg\) : null;/);
  assert.match(src, /const drawLockedGemSprite = lockedGemImg \? \(\) => ctx\.drawImage\(lockedGemImg, rect\.x, rect\.y, rect\.w, rect\.h\) : null;/);
  assert.match(src, /renderLockedGemOverlay\(ctx, rect, getLockedGemCountdown\(gem\), drawLockedGemSprite\);/);
});
