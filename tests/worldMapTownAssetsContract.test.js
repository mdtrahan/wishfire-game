const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');

const townAssetFiles = [
  'map_town_town_46.png',
  'map_town_castle_46.png',
  'map_town_moor_46.png',
  'map_town_cape_46.png',
];

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

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
}

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.0001, `${message}: expected ${expected}, got ${actual}`);
}

test('world map town landmark assets are 46x46 transparent PNGs', () => {
  for (const file of townAssetFiles) {
    const imagePath = path.join(repoRoot, 'web-runner', 'assets', 'images', file);
    const header = readPngHeader(imagePath);

    assert.equal(header.width, 46, `${file} width`);
    assert.equal(header.height, 46, `${file} height`);
    assert.equal(header.bitDepth, 8, `${file} bit depth`);
    assert.equal(header.colorType, 6, `${file} color type`);
  }
});

test('world map town landmark instances resolve requested coordinates', async () => {
  const towns = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapTownInstances.mjs'));
  const coordinates = await import(path.join(repoRoot, 'src', 'core', 'worldMapCoordinates.mjs'));

  assert.equal(towns.WORLD_MAP_TOWN_IMAGE_SIZE, 46);
  assert.equal(towns.WORLD_MAP_TOWN_UPPER_OFFSET_Y, -12);
  assert.equal(towns.WORLD_MAP_TOWN_RIGHT_EDGE_OFFSET_X, -23);
  assert.deepEqual(towns.WORLD_MAP_TOWN_VARIANTS, ['town', 'castle', 'moor', 'cape']);
  assert.equal(towns.WORLD_MAP_TOWN_INSTANCES.length, 15);
  assert.deepEqual(towns.WORLD_MAP_TOWN_INSTANCES.map((town) => town.variant), [
    'town',
    'town',
    'town',
    'town',
    'town',
    'moor',
    'moor',
    'moor',
    'castle',
    'castle',
    'castle',
    'cape',
    'cape',
    'cape',
    'cape',
  ]);
  assert.deepEqual(towns.WORLD_MAP_TOWN_INSTANCES.map((town) => (
    town.coordinate || town.anchorCoordinates.join('/')
  )), [
    'M14',
    'G11',
    'F19',
    'I17',
    'C14',
    'B13',
    'D16',
    'O11',
    'J18',
    'L10',
    'O19',
    'I14',
    'B10/C10',
    'G07/H07',
    'K21',
  ]);
  assert.deepEqual(towns.WORLD_MAP_TOWN_INSTANCES.map((town) => town.visible), [
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  assert.equal(towns.WORLD_MAP_TOWN_INSTANCES.filter((town) => town.variant === 'moor').length, 3);
  assert.equal(towns.WORLD_MAP_TOWN_INSTANCES.filter((town) => town.variant === 'cape').length, 4);
  assert.equal(coordinates.normalizeWorldMapCoordinate('Q13'), null, 'Q13 is outside the current A-P map grid');

  for (const town of towns.WORLD_MAP_TOWN_INSTANCES) {
    const anchors = town.coordinate ? [town.coordinate] : town.anchorCoordinates;
    for (const coordinate of anchors) {
      assert.ok(coordinates.getWorldMapCellBounds(coordinate), `${coordinate} resolves to a map cell`);
    }
    assert.ok(towns.resolveWorldMapTownPoint(town), `${town.id} resolves to a map point`);
    assert.equal(towns.resolveWorldMapTownPoint(town).visible, true, `${town.id} resolves visible`);
  }

  const i14 = towns.resolveWorldMapTownPoint(towns.WORLD_MAP_TOWN_INSTANCES[11]);
  assert.equal(i14.coordinate, 'I14');
  assert.equal(i14.offsetY, -20);

  const b10 = coordinates.getWorldMapCellBounds('B10');
  const b10C10 = towns.resolveWorldMapTownPoint(towns.WORLD_MAP_TOWN_INSTANCES[12]);
  assert.equal(b10C10.placement, 'intercept');
  assert.equal(coordinates.getWorldMapCoordinateAtPoint(b10C10.centerX - 0.01, b10C10.centerY), 'B10');
  assert.equal(coordinates.getWorldMapCoordinateAtPoint(b10C10.centerX + 0.01, b10C10.centerY), 'C10');
  assertClose(b10C10.centerX, b10.x + b10.width, 'B10 right-edge intercept centerX');
  assertClose(b10C10.centerY, b10.centerY, 'B10 right-edge intercept centerY');
  assert.equal(b10C10.offsetX, -23);
  assertClose(
    b10C10.centerX + b10C10.offsetX + (towns.WORLD_MAP_TOWN_IMAGE_SIZE / 2),
    b10.x + b10.width,
    'B10 cape rendered right edge',
  );

  const g07 = coordinates.getWorldMapCellBounds('G07');
  const g07H07 = towns.resolveWorldMapTownPoint(towns.WORLD_MAP_TOWN_INSTANCES[13]);
  assert.equal(g07H07.placement, 'intercept');
  assert.equal(coordinates.getWorldMapCoordinateAtPoint(g07H07.centerX - 0.01, g07H07.centerY), 'G07');
  assert.equal(coordinates.getWorldMapCoordinateAtPoint(g07H07.centerX + 0.01, g07H07.centerY), 'H07');
  assertClose(g07H07.centerX, g07.x + g07.width, 'G07/H07 intercept centerX');
  assertClose(g07H07.centerY, g07.centerY, 'G07/H07 intercept centerY');

  const upperK21 = towns.resolveWorldMapTownPoint(towns.WORLD_MAP_TOWN_INSTANCES[14]);
  assert.equal(upperK21.coordinate, 'K21');
  assert.equal(upperK21.offsetY, -12);
});

test('world map town landmark rendering is owned by map modules', () => {
  const loaderSrc = readRepoFile('web-runner', 'systems', 'runtimeVisualAssetLoader.js');
  const routerSrc = readRepoFile('web-runner', 'systems', 'surfaceRenderRouter.js');
  const renderMapSrc = readRepoFile('web-runner', 'systems', 'renderMap.js');
  const appSrc = readRepoFile('web-runner', 'app.js');

  assert.match(loaderSrc, /mapTownImages\.town = await loadImage\(assetUrl\('images\/map_town_town_46\.png'\)\);/);
  assert.match(loaderSrc, /mapTownImages\.castle = await loadImage\(assetUrl\('images\/map_town_castle_46\.png'\)\);/);
  assert.match(loaderSrc, /mapTownImages\.moor = await loadImage\(assetUrl\('images\/map_town_moor_46\.png'\)\);/);
  assert.match(loaderSrc, /mapTownImages\.cape = await loadImage\(assetUrl\('images\/map_town_cape_46\.png'\)\);/);
  assert.match(routerSrc, /getMapTownImages/);
  assert.match(renderMapSrc, /WORLD_MAP_TOWN_INSTANCES/);
  assert.match(renderMapSrc, /drawWorldMapTowns/);
  assert.match(appSrc, /getMapTownImages: \(\) => mapTownImages/);
  assert.doesNotMatch(appSrc, /WORLD_MAP_TOWN_INSTANCES/);
});
