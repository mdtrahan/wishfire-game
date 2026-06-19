const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('enemy HP bar rendering uses integer pixel coordinates and sizes', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /const drawBarW = Math\.max\(1, Math\.round\(barState\.baseW\)\);/);
  assert.match(src, /const drawBarH = Math\.max\(1, Math\.round\(baseH\)\);/);
  assert.match(src, /const barX = Math\.round\(pos\.x - \(drawBarW \/ 2\)\);/);
  assert.match(src, /const barY = Math\.round\(\(pos\.y - enemyH \/ 2\) - \(10 \* layoutScale\)\);/);
});

test('enemy HP bar sprite sampling disables smoothing to avoid gradient distortion', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.match(src, /ctx\.save\(\);\\n\s*ctx\.imageSmoothingEnabled = false;/s);
  assert.match(src, /ctx\.restore\(\);/);
});
