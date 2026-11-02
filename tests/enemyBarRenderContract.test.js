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
  assert.match(src, /const barY = Math\.round\(enemyFootY \+ \(4 \* layoutScale\)\);/);
});

test('enemy HP bars paint flat vector tracks without sprite sampling', async () => {
  const { drawCombatHealthBar } = await import('../web-runner/systems/combatHealthBarPresentation.mjs');
  const calls = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => { assert.notEqual(key, 'drawImage'); calls.push([key, ...args]); }, set: () => true });
  drawCombatHealthBar(ctx, { x: 10, y: 20, width: 48, height: 4, fillWidth: 24, trailWidth: 36, team: 'enemy' });
  assert.deepEqual(calls.filter(([key]) => key === 'roundRect').map(call => call[3]), [48, 36, 24, 48]);
  assert.equal(calls.filter(([key]) => key === 'fill').length, 2);
});
