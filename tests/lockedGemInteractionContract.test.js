const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('app rejects locked gems from manual and dev autoplay selection paths', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const superGemBoardSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'superGemBoardState.mjs'), 'utf8');
  const devBrowserHookSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devBrowserTestHooks.js'), 'utf8');

  assert.match(src, /function isBoardGemLocked\(gem\)/);
  assert.match(src, /function isSuperGemLockedByBoardGems\(superGem\)/);
  assert.ok(
    src.indexOf('function isBoardGemLocked(gem)') < src.indexOf('function handleGemMatch(color)'),
    'isBoardGemLocked must be in scope before match handling claims input',
  );
  assert.equal(
    src.indexOf('function isBoardGemLocked(gem)', src.indexOf('function isBoardGemLocked(gem)') + 1),
    -1,
    'isBoardGemLocked should have a single shared declaration',
  );
  assert.match(src, /if \(isBoardGemLocked\(gem\)\) return false;/);
  assert.match(src, /reason: 'reject-locked-gem'/);
  assert.match(src, /reason: 'reject-locked-super-gem-footprint'/);
  assert.match(src, /const selectedLockedGem = \(gameState\.selectedGems \|\| \[\]\)\.some\(\(idx\) => isBoardGemLocked\(gameState\.gems && gameState\.gems\[idx\]\)\);/);
  assert.match(src, /lockedCells: getLockedGemCellKeys\(\)/);
  assert.match(devBrowserHookSrc, /locked: isBoardGemLocked\(g\),/);
  assert.match(devBrowserHookSrc, /lockCountdown: Number\(g\.lockCountdown \?\? g\.LockCountdown \?\? 0\),/);
  assert.match(superGemBoardSrc, /function isLockedGem\(gem\)/);
  assert.match(superGemBoardSrc, /if \(!isSuperGemSourceCell && isLockedGem\(gem\)\) continue;/);
  assert.match(superGemBoardSrc, /if \(hasLockedSuperGemSource\(superGem, gameState\.gems \|\| \[\]\)\) return false;/);
});

function makeSuperGemSpendContext({ lockSource = false } = {}) {
  const superGem = {
    id: 'sg-red',
    type: 'uniform',
    baseColor: 1,
    size: 2,
    cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
  };
  const gems = [
    { uid: 1, cellR: 0, cellC: 0, color: 1, x: 10, y: 10 },
    { uid: 2, cellR: 0, cellC: 1, color: 1, x: 20, y: 10 },
    { uid: 3, cellR: 1, cellC: 0, color: 1, x: 10, y: 20 },
    { uid: 4, cellR: 1, cellC: 1, color: 1, x: 20, y: 20 },
    { uid: 5, cellR: 2, cellC: 2, color: 1, x: 30, y: 30, locked: true, lockCountdown: 3 },
    { uid: 6, cellR: 2, cellC: 0, color: 2, x: 10, y: 30 },
    { uid: 7, cellR: 2, cellC: 1, color: 3, x: 20, y: 30 },
  ];
  if (lockSource) {
    gems[0].locked = true;
    gems[0].lockCountdown = 3;
  }
  return {
    state: {
      globals: {
        GamePhase: 'RUNTIME',
        TurnPhase: 0,
        CanPickGems: true,
        PendingSkillID: '',
        DeferAdvance: 0,
        Player_Energy: 10,
      },
    },
    gameState: {
      selectedHero: 0,
      selectedGems: [],
      selectionLocked: false,
      superGems: [superGem],
      superGemCellMap: new Map(superGem.cells.map((cell) => [`${cell.r},${cell.c}`, superGem.id])),
      gems,
      grid: [
        [1, 3, 6],
        [2, 4, 7],
        [8, 9, 5],
      ],
    },
    superGem,
  };
}

function spendSuperGemForContract(mod, ctx) {
  return mod.spendSuperGem({
    superGem: ctx.superGem,
    gameState: ctx.gameState,
    state: ctx.state,
    reason: 'locked-gem-contract',
    callFunctionWithContext: (_fnContext, name) => {
      if (name === 'GetCurrentTurn') return 101;
      if (name === 'GetActorByUID') return { uid: 101, kind: 'hero' };
      return 0;
    },
    fnContext: {},
    getHeroUIDByIndex: () => 101,
    beginTask011ActionCycle: () => {},
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
    setGemArray: () => {},
    startRefillBounce: () => {},
    activateSuperGemEffect: () => true,
    superGemCost: 4,
  });
}

test('super gem color clears preserve locked same-color gems outside the source footprint', async () => {
  const mod = await import('../web-runner/src/core/superGemBoardState.mjs');
  const ctx = makeSuperGemSpendContext();

  const spent = spendSuperGemForContract(mod, ctx);

  assert.equal(spent, true);
  assert.ok(ctx.gameState.gems.some((gem) => gem.uid === 5 && gem.locked === true));
  assert.equal(ctx.gameState.grid[2][2], 5);
  assert.equal(ctx.state.globals.LastSuperGemSpend.clearedGemCount, 4);
});

test('super gem spend refuses locked source footprint gems', async () => {
  const mod = await import('../web-runner/src/core/superGemBoardState.mjs');
  const ctx = makeSuperGemSpendContext({ lockSource: true });

  const spent = spendSuperGemForContract(mod, ctx);

  assert.equal(spent, false);
  assert.equal(ctx.gameState.gems.length, 7);
  assert.equal(ctx.state.globals.Player_Energy, 10);
  assert.equal(ctx.state.globals.LastSuperGemSpend, undefined);
});
