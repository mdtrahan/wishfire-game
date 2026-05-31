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

function pickedTriplet(row) {
  return [{ row, col: 0 }, { row, col: 1 }, { row, col: 2 }];
}

test('dev idle autoplay picks each hero preferred color when party HP is stable', async () => {
  const { pickIdleAutoplayTriplet } = await import(modulePath);
  const board = [
    ...triplet(0, 0),
    ...triplet(1, 1),
    ...triplet(2, 2),
    ...triplet(3, 3),
  ];

  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Falie', partyHpRatio: 0.7 }), pickedTriplet(1));
  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Huun', partyHpRatio: 0.7 }), pickedTriplet(3));
  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Runa', partyHpRatio: 0.7 }), pickedTriplet(2));
  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Kojonn', partyHpRatio: 0.7 }), pickedTriplet(0));
});

test('dev idle autoplay HP thresholds override or suppress heal triplets', async () => {
  const { pickIdleAutoplayTriplet } = await import(modulePath);
  const board = [
    ...triplet(1, 0),
    ...triplet(4, 1),
  ];

  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Falie', partyHpRatio: 0.59 }), pickedTriplet(1));
  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Falie', partyHpRatio: 0.81 }), pickedTriplet(0));
});

test('dev idle autoplay keeps gold/yellow resource-only unless Huun is active while enemies are living', async () => {
  const { pickIdleAutoplaySuperGem, pickIdleAutoplayTriplet } = await import(modulePath);
  const board = [
    ...triplet(3, 0),
    ...triplet(0, 1),
  ];
  const superGems = [
    superGem(3, 0),
    superGem(0, 1),
  ];

  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Runa', partyHpRatio: 0.7, hasLivingEnemies: true }), pickedTriplet(1));
  assert.deepEqual(pickIdleAutoplayTriplet(board, { heroName: 'Huun', partyHpRatio: 0.7, hasLivingEnemies: true }), pickedTriplet(0));
  assert.deepEqual(pickIdleAutoplaySuperGem(superGems, { heroName: 'Runa', partyHpRatio: 0.7, hasLivingEnemies: true }), { row: 1, col: 0 });
  assert.deepEqual(pickIdleAutoplaySuperGem(superGems, { heroName: 'Huun', partyHpRatio: 0.7, hasLivingEnemies: true }), { row: 0, col: 0 });
});

test('dev idle autoplay forced-yellow board can spend yellow for non-Huun instead of stalling', async () => {
  const { pickIdleAutoplaySuperGem, pickIdleAutoplayTriplet } = await import(modulePath);
  const yellowOnlyBoard = [
    ...triplet(3, 0),
  ];
  const yellowOnlySuperGems = [
    superGem(3, 0),
  ];
  const context = {
    heroName: 'Kojonn',
    partyHpRatio: 0.7,
    hasLivingEnemies: true,
    forcedBoardColor: 3,
  };

  assert.deepEqual(pickIdleAutoplayTriplet(yellowOnlyBoard, context), pickedTriplet(0));
  assert.deepEqual(pickIdleAutoplaySuperGem(yellowOnlySuperGems, context), { row: 0, col: 0 });
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
  assert.match(src, /hasLivingEnemiesForIdleAutoplay\(\)/);
  assert.match(src, /forcedBoardColor: Number\(state\.globals\.DevForcedBoardColor\)/);
  assert.match(src, /pickIdleAutoplayTriplet\(gameState\.gems, getIdleAutoplayPriorityContext\(\)\)/);
  assert.match(src, /pickIdleAutoplaySuperGem\(gameState\.superGems, getIdleAutoplayPriorityContext\(\)\)/);
});
