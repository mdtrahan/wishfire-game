const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('map layout uses hero-style close control instead of Return Combat button', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /closeHit:\s*null,/);
  assert.match(src, /const close = getHeroStyleCloseRect\(viewWidth, viewHeight\);/);
  assert.match(src, /drawHeroStyleCloseControl\(ctx, close, closeWinOvalImage, '#111'\);/);
  assert.match(src, /gameState\.mapLayout\.closeHit = close;/);
  assert.doesNotMatch(src, /ctx\.fillText\('Return Combat'/);
});

test('map close control routes to combat and preserves map drag path', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  assert.match(src, /if \(activeLayoutId === 'mapLayout'\) \{/);
  assert.match(src, /const close = gameState\.mapLayout\.closeHit;/);
  assert.match(src, /if \(isPointInRect\(mx, my, close\)\) \{/);
  assert.match(src, /requestLayoutChange\('combat', 'map-close-button'\)/);
  assert.match(src, /const drag = gameState\.mapLayout\.drag;/);
  assert.match(src, /drag\.active = true;/);
});
