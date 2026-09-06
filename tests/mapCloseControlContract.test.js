const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('map layout uses hero-style close control instead of Return Combat button', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const renderMapPath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderMap.js');
  const registrySrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'runtimeLayoutRegistry.js'), 'utf8');
  const surfaceRouterSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'surfaceRenderRouter.js'), 'utf8');
  const renderMapSrc = fs.readFileSync(renderMapPath, 'utf8');

  assert.match(fs.readFileSync(appPath, 'utf8'), /createSurfaceRenderRouter/);
  assert.match(registrySrc, /mapLayoutState\.setMapLayoutField\('closeHit', null\);/);
  assert.match(renderMapSrc, /const closeHit = renderSystem\.getHeroStyleCloseRect\(viewWidth, viewHeight, heroLayoutSpec\);/);
  assert.match(renderMapSrc, /renderSystem\.drawHeroStyleCloseControl\(ctx, closeHit, closeWinOvalImage, '#111'\);/);
  assert.match(surfaceRouterSrc, /mapLayoutState\.setMapLayoutField\('closeHit', mapRenderResult\.closeHit\);/);
  assert.doesNotMatch(renderMapSrc, /ctx\.fillText\('Return Combat'/);
});

test('map layout omits war meter chrome', () => {
  const renderMapPath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderMap.js');
  const renderMapSrc = fs.readFileSync(renderMapPath, 'utf8');

  assert.doesNotMatch(renderMapSrc, /War Meter/);
  assert.doesNotMatch(renderMapSrc, /mapLayoutState\?\.warMeter/);
  assert.doesNotMatch(renderMapSrc, /#cf3d2e/);
});

test('map close control returns to the quest ladder and preserves map drag path', () => {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const inputPath = path.join(__dirname, '..', 'web-runner', 'systems', 'inputHandling.js');
  const pointerRouterPath = path.join(__dirname, '..', 'web-runner', 'systems', 'pointerRoutingShell.js');
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const inputSrc = fs.readFileSync(inputPath, 'utf8');
  const pointerRouterSrc = fs.readFileSync(pointerRouterPath, 'utf8');

  assert.match(appSrc, /const pointerRoutingShell = createPointerRoutingShell\(\{/);
  assert.match(pointerRouterSrc, /if \(activeLayoutId === 'mapLayout'\) \{/);
  assert.match(pointerRouterSrc, /const close = mapLayoutState\.getMapLayoutState\(\)\.closeHit;/);
  assert.match(pointerRouterSrc, /if \(isPointInRect\(mx, my, close\)\) \{/);
  assert.match(pointerRouterSrc, /returnToQuest\(gameState, layoutState, 'map-close-button'\)/);
  assert.match(pointerRouterSrc, /if \(handleMapDragStart\(event, \{ mx, my \}\)\) \{/);
  assert.match(inputSrc, /mapLayoutState\.setMapDragState\(\{\s*active: true,/s);
});
