const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
}

test('map runtime loads Genielands presentation PNG instead of placeholder grass map', () => {
  const loaderSrc = readRepoFile('web-runner', 'systems', 'runtimeVisualAssetLoader.js');

  assert.match(loaderSrc, /mapBackgroundImage = await loadImage\(assetUrl\('images\/genielands-geography\.png'\)\);/);
  assert.doesNotMatch(loaderSrc, /map-layout\.png/);
});

test('map runtime owns coordinate overlay toggle and rendering outside app shell', () => {
  const appSrc = readRepoFile('web-runner', 'app.js');
  const stateSrc = readRepoFile('web-runner', 'state', 'mapLayoutState.js');
  const inputSrc = readRepoFile('web-runner', 'systems', 'inputHandling.js');
  const renderMapSrc = readRepoFile('web-runner', 'systems', 'renderMap.js');
  const surfaceRouterSrc = readRepoFile('web-runner', 'systems', 'surfaceRenderRouter.js');

  assert.match(stateSrc, /showCoordinateGrid:\s*false/);
  assert.match(inputSrc, /handleMapCoordinateGridKeydown/);
  assert.match(inputSrc, /String\(ev\?\.key \|\| ''\)\.toLowerCase\(\) !== 'g'/);
  assert.match(inputSrc, /isEditableDomTarget\(ev\?\.target\)/);
  assert.match(inputSrc, /ev\?\.metaKey \|\| ev\?\.ctrlKey \|\| ev\?\.altKey/);
  assert.match(inputSrc, /setMapLayoutField\('showCoordinateGrid'/);
  assert.match(renderMapSrc, /worldMapCoordinates/);
  assert.match(renderMapSrc, /drawWorldMapCoordinateGrid/);
  assert.match(renderMapSrc, /getWorldMapCoordinateAtPoint/);
  assert.match(renderMapSrc, /Boolean\(mapLayoutState\?\.showCoordinateGrid\)/);
  assert.doesNotMatch(inputSrc, /__codexGameDevTest/);
  assert.doesNotMatch(renderMapSrc, /coordinateGridDevOverlayEnabled/);
  assert.doesNotMatch(surfaceRouterSrc, /getCoordinateGridDevOverlayEnabled/);
  assert.doesNotMatch(appSrc, /showCoordinateGrid/);
  assert.doesNotMatch(appSrc, /getCoordinateGridDevOverlayEnabled/);
});
