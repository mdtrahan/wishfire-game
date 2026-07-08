const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');

async function loadSharedCoordinates() {
  return import(path.join(repoRoot, 'src', 'core', 'worldMapCoordinates.mjs'));
}

async function loadBrowserCoordinates() {
  return import(path.join(repoRoot, 'web-runner', 'src', 'core', 'worldMapCoordinates.mjs'));
}

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.0001, `${message}: expected ${expected}, got ${actual}`);
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

test('world map coordinate grid is stable and human-readable', async () => {
  const shared = await loadSharedCoordinates();
  const browser = await loadBrowserCoordinates();

  assert.deepEqual(shared.DEFAULT_WORLD_MAP_GRID, browser.DEFAULT_WORLD_MAP_GRID);
  assert.equal(shared.DEFAULT_WORLD_MAP_GRID.width, 1549);
  assert.equal(shared.DEFAULT_WORLD_MAP_GRID.height, 1361);
  assert.equal(shared.DEFAULT_WORLD_MAP_GRID.columns, 16);
  assert.equal(shared.DEFAULT_WORLD_MAP_GRID.rows, 24);

  assert.equal(shared.indexToColumnLabel(0), 'A');
  assert.equal(shared.indexToColumnLabel(15), 'P');
  assert.equal(shared.columnLabelToIndex('A'), 0);
  assert.equal(shared.columnLabelToIndex('P'), 15);
  assert.equal(shared.normalizeWorldMapCoordinate('h11'), 'H11');
  assert.equal(shared.normalizeWorldMapCoordinate('P7'), 'P07');
  assert.equal(shared.normalizeWorldMapCoordinate('C24'), 'C24');
  assert.equal(shared.normalizeWorldMapCoordinate('Q01'), null);
  assert.equal(shared.normalizeWorldMapCoordinate('A00'), null);
  assert.equal(shared.normalizeWorldMapCoordinate('A25'), null);
});

test('world map coordinates resolve deterministic cell bounds and centers', async () => {
  const {
    getWorldMapCell,
    getWorldMapCellBounds,
    getWorldMapCoordinateAtPoint,
  } = await loadSharedCoordinates();

  assert.deepEqual(getWorldMapCell('H11'), {
    coordinate: 'H11',
    column: 'H',
    columnIndex: 7,
    row: 11,
    rowIndex: 10,
  });

  const h11 = getWorldMapCellBounds('H11');
  assert.equal(h11.coordinate, 'H11');
  assertClose(h11.x, 677.6875, 'H11 x');
  assertClose(h11.y, 567.0833333333, 'H11 y');
  assertClose(h11.width, 96.8125, 'H11 width');
  assertClose(h11.height, 56.7083333333, 'H11 height');
  assertClose(h11.centerX, 726.09375, 'H11 centerX');
  assertClose(h11.centerY, 595.4375, 'H11 centerY');

  assert.equal(getWorldMapCoordinateAtPoint(0, 0), 'A01');
  assert.equal(getWorldMapCoordinateAtPoint(1548.99, 1360.99), 'P24');
  assert.equal(getWorldMapCoordinateAtPoint(h11.centerX, h11.centerY), 'H11');
  assert.equal(getWorldMapCoordinateAtPoint(-1, 10), null);
  assert.equal(getWorldMapCoordinateAtPoint(1549, 10), null);
});

test('world map zoom clamps requested cells to safe whole-cell centers', async () => {
  const shared = await loadSharedCoordinates();
  const browser = await loadBrowserCoordinates();
  const viewWidth = 360;
  const viewHeight = 640;
  const zoomDrawH = viewHeight * (shared.DEFAULT_WORLD_MAP_GRID.rows / 9);
  const zoomDrawW = zoomDrawH * (1338 / 1176);

  const center = shared.resolveWorldMapSafeZoomCenter('H11', {
    viewWidth,
    viewHeight,
    drawW: zoomDrawW,
    drawH: zoomDrawH,
  });
  assert.equal(center.requestedCoordinate, 'H11');
  assert.equal(center.centerCoordinate, 'H11');
  assert.equal(center.clamped, false);
  assert.ok(center.drawX <= 0 && center.drawY <= 0);
  assert.ok(center.drawX + zoomDrawW >= viewWidth);
  assert.ok(center.drawY + zoomDrawH >= viewHeight);

  const corner = shared.resolveWorldMapSafeZoomCenter('A01', {
    viewWidth,
    viewHeight,
    drawW: zoomDrawW,
    drawH: zoomDrawH,
  });
  assert.equal(corner.requestedCoordinate, 'A01');
  assert.equal(corner.centerCoordinate, 'B05');
  assert.equal(corner.clamped, true);
  assert.ok(corner.drawX <= 0 && corner.drawY <= 0);
  assert.ok(corner.drawX + zoomDrawW >= viewWidth);
  assert.ok(corner.drawY + zoomDrawH >= viewHeight);

  assert.deepEqual(
    browser.resolveWorldMapSafeZoomCenter('A01', { viewWidth, viewHeight, drawW: zoomDrawW, drawH: zoomDrawH }),
    corner,
  );
});

test('Genielands browser presentation asset keeps the canonical map frame', async () => {
  const { DEFAULT_WORLD_MAP_GRID } = await loadSharedCoordinates();
  const imagePath = path.join(repoRoot, 'web-runner', 'assets', 'images', 'genielands-geography.png');
  const header = readPngHeader(imagePath);

  assert.equal(header.width, 1338);
  assert.equal(header.height, 1176);
  assert.equal(header.bitDepth, 8);
  assert.equal(header.colorType, 2);
  assert.ok(
    Math.abs((header.width / header.height) - (DEFAULT_WORLD_MAP_GRID.width / DEFAULT_WORLD_MAP_GRID.height)) < 0.001,
    'presentation asset aspect ratio must stay aligned to the canonical grid frame',
  );
});

test('Genielands source SVG remains geography-only provenance', () => {
  const svgPath = path.join(repoRoot, 'web-runner', 'assets', 'images', 'genielands-geography.svg');
  const svg = fs.readFileSync(svgPath, 'utf8');
  const searchableMarkup = svg.replace(/data:image\/[^"']+/gi, 'data:image/stripped');
  const lower = searchableMarkup.toLowerCase();

  assert.match(svg, /<svg[^>]+width="1549"[^>]+height="1361"/);
  assert.match(svg, /id="ocean"/);
  assert.match(svg, /id="landmass"/);
  assert.match(svg, /id="lakes"/);
  assert.match(svg, /id="coastline"/);
  assert.doesNotMatch(svg, /<text\b/i);
  assert.doesNotMatch(svg, /id="labels?"/i);

  for (const banned of [
    /\bburgs?\b/,
    /\bcit(?:y|ies)\b/,
    /\bvillages?\b/,
    /\bcapitals?\b/,
    /\broads?\b/,
    /\broutes?\b/,
    /\brivers?\b/,
    /\bmarkets?\b/,
    /\bborders?\b/,
    /\bprovinces?\b/,
    /\bstate-labels?\b/,
    /\bcultures?\b/,
    /\breligions?\b/,
    /\bbiomes?\b/,
    /\btemperature\b/,
    /\bprecipitation\b/,
    /\bpopulation\b/,
    /\bcompass\b/,
    /\bwind rose\b/,
    /\bheraldry\b/,
  ]) {
    assert.equal(banned.test(lower), false, `asset leaked banned map metadata: ${banned}`);
  }
});
