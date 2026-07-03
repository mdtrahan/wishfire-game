const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
}

function readPngHeader(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes.readUInt8(24),
    colorType: bytes.readUInt8(25),
  };
}

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.0001, `${message}: expected ${expected}, got ${actual}`);
}

test('world map tower variant assets are 46x54 transparent PNGs', async () => {
  const towers = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapTowerInstances.mjs'));

  assert.deepEqual(towers.WORLD_MAP_TOWER_VARIANTS, ['red', 'gold', 'purple', 'green', 'blue']);
  for (const variant of towers.WORLD_MAP_TOWER_VARIANTS) {
    const imagePath = path.join(
      repoRoot,
      'web-runner',
      'assets',
      towers.WORLD_MAP_TOWER_IMAGE_ASSETS[variant],
    );
    const header = readPngHeader(imagePath);

    assert.equal(header.width, 46);
    assert.equal(header.height, 54);
    assert.equal(header.bitDepth, 8);
    assert.equal(header.colorType, 6);
  }
});

test('world map tower instances resolve requested coordinates and intercepts', async () => {
  const towers = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapTowerInstances.mjs'));
  const coordinates = await import(path.join(repoRoot, 'src', 'core', 'worldMapCoordinates.mjs'));

  assert.equal(towers.WORLD_MAP_TOWER_IMAGE_WIDTH, 46);
  assert.equal(towers.WORLD_MAP_TOWER_IMAGE_HEIGHT, 54);
  assert.equal(towers.WORLD_MAP_TOWER_RENDER_OFFSET_Y, -8);
  assert.equal(towers.WORLD_MAP_TOWER_INSTANCES.length, 5);
  assert.deepEqual(towers.WORLD_MAP_TOWER_INSTANCES.map((tower) => tower.variant), [
    'red',
    'gold',
    'purple',
    'blue',
    'green',
  ]);
  assert.deepEqual(
    new Set(towers.WORLD_MAP_TOWER_INSTANCES.map((tower) => tower.variant)),
    new Set(towers.WORLD_MAP_TOWER_VARIANTS),
  );
  assert.deepEqual(towers.WORLD_MAP_TOWER_INSTANCES.map((tower) => (
    tower.coordinate || tower.anchorCoordinates.join('/')
  )), [
    'H04',
    'H15/J15',
    'L19',
    'M08/N08/M09/N09',
    'B18',
  ]);

  for (const tower of towers.WORLD_MAP_TOWER_INSTANCES) {
    const anchors = tower.coordinate ? [tower.coordinate] : tower.anchorCoordinates;
    for (const coordinate of anchors) {
      assert.ok(coordinates.getWorldMapCellBounds(coordinate), `${coordinate} resolves to a map cell`);
    }
    assert.ok(towers.resolveWorldMapTowerPoint(tower), `${tower.id} resolves to a map point`);
  }

  const h15 = coordinates.getWorldMapCellBounds('H15');
  const h15J15 = towers.resolveWorldMapTowerPoint(towers.WORLD_MAP_TOWER_INSTANCES[1]);
  assert.equal(h15J15.placement, 'intercept');
  assert.equal(coordinates.getWorldMapCoordinateAtPoint(h15J15.centerX - 0.01, h15J15.centerY), 'H15');
  assert.equal(coordinates.getWorldMapCoordinateAtPoint(h15J15.centerX + 0.01, h15J15.centerY), 'I15');
  assertClose(h15J15.centerX, h15.x + h15.width, 'H15/J15 intercept centerX');
  assertClose(h15J15.centerY, h15.centerY, 'H15/J15 intercept centerY');

  const eastAnchors = ['M08', 'N08', 'M09', 'N09'].map((coordinate) => (
    coordinates.getWorldMapCellBounds(coordinate)
  ));
  const eastIntercept = towers.resolveWorldMapTowerPoint(towers.WORLD_MAP_TOWER_INSTANCES[3]);
  assert.equal(eastIntercept.placement, 'intercept');
  assert.equal(eastIntercept.variant, 'blue');
  assertClose(
    eastIntercept.centerX,
    eastAnchors.reduce((sum, anchor) => sum + anchor.centerX, 0) / eastAnchors.length,
    'M08/N08/M09/N09 intercept centerX',
  );
  assertClose(
    eastIntercept.centerY,
    eastAnchors.reduce((sum, anchor) => sum + anchor.centerY, 0) / eastAnchors.length,
    'M08/N08/M09/N09 intercept centerY',
  );
});

test('world map tower rendering is owned by map modules', () => {
  const loaderSrc = readRepoFile('web-runner', 'systems', 'runtimeVisualAssetLoader.js');
  const routerSrc = readRepoFile('web-runner', 'systems', 'surfaceRenderRouter.js');
  const renderMapSrc = readRepoFile('web-runner', 'systems', 'renderMap.js');
  const appSrc = readRepoFile('web-runner', 'app.js');

  assert.match(loaderSrc, /mapTowerImages\.red = await loadImage\(assetUrl\('images\/map_tower_spire_red_46x54\.png'\)\);/);
  assert.match(loaderSrc, /mapTowerImages\.blue = await loadImage\(assetUrl\('images\/map_tower_spire_46x54\.png'\)\);/);
  assert.match(routerSrc, /getMapTowerImages/);
  assert.match(renderMapSrc, /WORLD_MAP_TOWER_INSTANCES/);
  assert.match(renderMapSrc, /WORLD_MAP_TOWER_RENDER_OFFSET_Y/);
  assert.match(renderMapSrc, /drawWorldMapTowers/);
  assert.match(appSrc, /getMapTowerImages: \(\) => mapTowerImages/);
  assert.doesNotMatch(appSrc, /WORLD_MAP_TOWER_INSTANCES/);
});
