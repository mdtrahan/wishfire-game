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

test('world map cave asset is a 46x46 transparent PNG', () => {
  const imagePath = path.join(repoRoot, 'web-runner', 'assets', 'images', 'map_cave_46.png');
  const header = readPngHeader(imagePath);

  assert.equal(header.width, 46);
  assert.equal(header.height, 46);
  assert.equal(header.bitDepth, 8);
  assert.equal(header.colorType, 6);
});

test('world map cave instances are six unique valid grid coordinates', async () => {
  const caves = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapCaveInstances.mjs'));
  const coordinates = await import(path.join(repoRoot, 'src', 'core', 'worldMapCoordinates.mjs'));

  assert.equal(caves.WORLD_MAP_CAVE_IMAGE_SIZE, 46);
  assert.equal(caves.WORLD_MAP_CAVE_INSTANCES.length, 6);
  assert.deepEqual(caves.WORLD_MAP_CAVE_INSTANCES.map((cave) => cave.coordinate), [
    'F04',
    'D09',
    'E16',
    'I10',
    'L13',
    'N16',
  ]);
  assert.equal(new Set(caves.WORLD_MAP_CAVE_INSTANCES.map((cave) => cave.coordinate)).size, 6);
  for (const cave of caves.WORLD_MAP_CAVE_INSTANCES) {
    assert.ok(coordinates.getWorldMapCellBounds(cave.coordinate), `${cave.coordinate} resolves to a map cell`);
  }
});

test('world map cave rendering is owned by map modules', () => {
  const loaderSrc = readRepoFile('web-runner', 'systems', 'runtimeVisualAssetLoader.js');
  const routerSrc = readRepoFile('web-runner', 'systems', 'surfaceRenderRouter.js');
  const renderMapSrc = readRepoFile('web-runner', 'systems', 'renderMap.js');
  const appSrc = readRepoFile('web-runner', 'app.js');

  assert.match(loaderSrc, /mapCaveImage = await loadImage\(assetUrl\('images\/map_cave_46\.png'\)\);/);
  assert.match(routerSrc, /getMapCaveImage/);
  assert.match(renderMapSrc, /WORLD_MAP_CAVE_INSTANCES/);
  assert.match(renderMapSrc, /drawWorldMapCaves/);
  assert.match(appSrc, /getMapCaveImage: \(\) => mapCaveImage/);
  assert.doesNotMatch(appSrc, /WORLD_MAP_CAVE_INSTANCES/);
});
