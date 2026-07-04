const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const repoRoot = path.join(__dirname, '..');

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
}

test('world map icon visibility is an explicit binary flag', async () => {
  const visibility = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapIconVisibility.mjs'));
  const caves = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapCaveInstances.mjs'));
  const portals = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapPortalInstances.mjs'));
  const towers = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapTowerInstances.mjs'));
  const towns = await import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapTownInstances.mjs'));
  const allIcons = [
    ...caves.WORLD_MAP_CAVE_INSTANCES,
    ...portals.WORLD_MAP_PORTAL_INSTANCES,
    ...towers.WORLD_MAP_TOWER_INSTANCES,
    ...towns.WORLD_MAP_TOWN_INSTANCES,
  ];

  assert.equal(visibility.WORLD_MAP_ICON_VISIBILITY.VISIBLE, true);
  assert.equal(visibility.WORLD_MAP_ICON_VISIBILITY.HIDDEN, false);
  assert.equal(visibility.isWorldMapIconVisible({ visible: true }), true);
  assert.equal(visibility.isWorldMapIconVisible({ visible: false }), false);
  assert.equal(visibility.isWorldMapIconVisible({}), false);
  assert.equal(visibility.getWorldMapVisibleIconInstances([{ visible: true }, { visible: false }, {}]).length, 1);

  assert.ok(allIcons.length > 0);
  for (const icon of allIcons) {
    assert.equal(typeof icon.visible, 'boolean', `${icon.id} must declare binary visible flag`);
    assert.equal(icon.visible, true, `${icon.id} should be visible for the current map state`);
  }
});

test('world map renderers filter icons through shared visibility tooling', () => {
  const renderMapSrc = readRepoFile('web-runner', 'systems', 'renderMap.js');
  const uses = renderMapSrc.match(/getWorldMapVisibleIconInstances\(/g) || [];

  assert.match(renderMapSrc, /from '\.\.\/src\/core\/worldMapIconVisibility\.mjs'/);
  assert.equal(uses.length, 4, 'caves, portals, towers, and towns should all use the visibility filter');
  assert.match(renderMapSrc, /visible: true/);
  assert.match(renderMapSrc, /visible: point\.visible/);
});
