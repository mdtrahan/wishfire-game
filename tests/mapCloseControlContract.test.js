const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('map layout uses hero-style close control instead of Return Combat button', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const renderMapPath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderMap.js');
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const renderMapSrc = fs.readFileSync(renderMapPath, 'utf8');

  assert.match(appSrc, /mapLayoutState\.setMapLayoutField\('closeHit', null\);/);
  assert.match(renderMapSrc, /const closeHit = renderSystem\.getHeroStyleCloseRect\(viewWidth, viewHeight, heroLayoutSpec\);/);
  assert.match(renderMapSrc, /renderSystem\.drawHeroStyleCloseControl\(ctx, closeHit, closeWinOvalImage, '#111'\);/);
  assert.match(appSrc, /mapLayoutState\.setMapLayoutField\('closeHit', mapRenderResult\.closeHit\);/);
  assert.doesNotMatch(renderMapSrc, /ctx\.fillText\('Return Combat'/);
});

test('map close control routes to combat and preserves map drag path', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const inputPath = path.join(__dirname, '..', 'web-runner', 'systems', 'inputHandling.js');
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const inputSrc = fs.readFileSync(inputPath, 'utf8');

  assert.match(appSrc, /if \(activeLayoutId === 'mapLayout'\) \{/);
  assert.match(appSrc, /const close = mapLayoutState\.getMapLayoutState\(\)\.closeHit;/);
  assert.match(appSrc, /if \(isPointInRect\(mx, my, close\)\) \{/);
  assert.match(appSrc, /requestLayoutChange\('combat', 'map-close-button'\)/);
  assert.match(appSrc, /if \(handleMapDragStart\(ev, \{ mx, my \}\)\) return;/);
  assert.match(inputSrc, /mapLayoutState\.setMapDragState\(\{\s*active: true,/s);
});
