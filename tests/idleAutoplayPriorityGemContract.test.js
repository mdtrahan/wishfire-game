const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const modulePath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'idleAutoplayPriority.mjs');

function triplet(color, row) {
  return [
    { cellR: row, cellC: 0, color },
    { cellR: row, cellC: 1, color },
    { cellR: row, cellC: 2, color },
  ];
}

function superGem(baseColor, row, col = 0) {
  return { baseColor, cells: [{ r: row, c: col }] };
}

test('dev idle autoplay picks each hero preferred color when party HP is stable', async () => {
  const { pickIdleAutoplayTriplet } = await import(modulePath);
  const board = [
    ...triplet(0, 0),
    ...triplet(1, 1),
    ...triplet(2, 2),
    ...triplet(3, 3),
  ];

  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Falie', partyHpRatio: 0.7 }), triplet(1, 1).map(({ cellR, cellC }) => ({ row: cellR, col: cellC })));
  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Huun', partyHpRatio: 0.7 }), triplet(3, 3).map(({ cellR, cellC }) => ({ row: cellR, col: cellC })));
  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Runa', partyHpRatio: 0.7 }), triplet(2, 2).map(({ cellR, cellC }) => ({ row: cellR, col: cellC })));
  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Kojonn', partyHpRatio: 0.7 }), triplet(0, 0).map(({ cellR, cellC }) => ({ row: cellR, col: cellC })));
});

test('dev idle autoplay HP thresholds override or suppress heal triplets', async () => {
  const { pickIdleAutoplayTriplet } = await import(modulePath);
  const board = [
    ...triplet(1, 0),
    ...triplet(4, 1),
  ];

  assert.deepEqual(
    pickIdleAutoplayTriplet(board, { heroName: 'Falie', partyHpRatio: 0.59 }),
    [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }],
  );
  assert.deepEqual(
    pickIdleAutoplayTriplet(board, { heroName: 'Falie', partyHpRatio: 0.81 }),
    [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }],
  );
});

test('dev idle autoplay always takes an available heal supergem below 40 percent HP', async () => {
  const { pickIdleAutoplaySuperGem } = await import(modulePath);
  const superGems = [
    superGem(1, 0),
    superGem(4, 2),
    superGem(5, 3),
  ];

  assert.deepEqual(
    pickIdleAutoplaySuperGem(superGems, { heroName: 'Falie', partyHpRatio: 0.39 }),
    { row: 2, col: 0 },
  );
});

test('dev idle autoplay runtime delegates priority through the core module', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /from '\.\/src\/core\/idleAutoplayPriority\.mjs';/);
  assert.match(src, /pickIdleAutoplayTriplet\(gameState\.gems, getIdleAutoplayPriorityContext\(\)\)/);
  assert.match(src, /pickIdleAutoplaySuperGem\(gameState\.superGems, getIdleAutoplayPriorityContext\(\)\)/);
});
