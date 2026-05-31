const path = require('node:path');
const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const idleAutoplayPriorityModule = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'idleAutoplayPriority.mjs');

function makeFullColorBoard(color) {
  const gems = [];
  const grid = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => 0));
  let uid = 1;
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 6; c += 1) {
      gems.push({
        uid,
        cellR: r,
        cellC: c,
        color,
        elementIndex: color,
        x: 10 + c * 10,
        y: 10 + r * 10,
      });
      grid[c][r] = uid;
      uid += 1;
    }
  }
  const superGem = {
    id: `sg-${color}`,
    type: 'uniform',
    baseColor: color,
    size: 2,
    cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
  };
  return {
    selectedHero: 0,
    selectedGems: [],
    selectionLocked: false,
    superGems: [superGem],
    superGemCellMap: new Map(superGem.cells.map((cell) => [`${cell.r},${cell.c}`, superGem.id])),
    gems,
    grid,
  };
}

test('dev idle autoplay prefers attack supergems before resource and purple supergems', async () => {
  const { pickIdleAutoplaySuperGem } = await import(idleAutoplayPriorityModule);
  const result = pickIdleAutoplaySuperGem([
    { id: 'blue-super', baseColor: 2, cells: [{ r: 1, c: 2 }, { r: 1, c: 3 }, { r: 2, c: 2 }, { r: 2, c: 3 }] },
    { id: 'red-super', baseColor: 1, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }] },
    { id: 'purple-super', baseColor: 5, cells: [{ r: 3, c: 0 }, { r: 3, c: 1 }, { r: 4, c: 0 }, { r: 4, c: 1 }] },
  ], { heroName: 'Falie', partyHpRatio: 0.7 });

  assert.equal(JSON.stringify(result), JSON.stringify({ row: 0, col: 0 }));
});

test('dev idle autoplay does not burn non-Huun combat turns on yellow-only resource supergems', async () => {
  const { pickIdleAutoplaySuperGem } = await import(idleAutoplayPriorityModule);
  const superGems = [
    { id: 'yellow-super', baseColor: 3, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }] },
  ];
  const nonHuunResult = pickIdleAutoplaySuperGem(superGems, {
    heroName: 'Kojonn',
    partyHpRatio: 0.7,
    hasLivingEnemies: true,
  });
  const huunResult = pickIdleAutoplaySuperGem(superGems, {
    heroName: 'Huun',
    partyHpRatio: 0.7,
    hasLivingEnemies: true,
  });

  assert.equal(nonHuunResult, null);
  assert.equal(JSON.stringify(huunResult), JSON.stringify({ row: 0, col: 0 }));
});

test('supergem spend reserves refill until the pending activation pacing can complete', async () => {
  const mod = await import('../web-runner/src/core/superGemBoardState.mjs');
  const state = {
    globals: {
      GamePhase: 'RUNTIME',
      Player_Energy: 10,
      CanPickGems: true,
      PendingSkillID: '',
      DeferAdvance: 0,
    },
  };
  const gameState = {
    selectedHero: 0,
    selectedGems: [{ uid: 1 }],
    selectionLocked: true,
    superGems: [
      { id: 'sg-red', type: 'uniform', baseColor: 1, size: 2, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }] },
    ],
    superGemCellMap: new Map([['0,0', 'sg-red'], ['0,1', 'sg-red'], ['1,0', 'sg-red'], ['1,1', 'sg-red']]),
    gems: [
      { uid: 1, cellR: 0, cellC: 0, color: 1, x: 10, y: 10 },
      { uid: 2, cellR: 0, cellC: 1, color: 1, x: 20, y: 10 },
      { uid: 3, cellR: 1, cellC: 0, color: 1, x: 10, y: 20 },
      { uid: 4, cellR: 1, cellC: 1, color: 1, x: 20, y: 20 },
      { uid: 5, cellR: 2, cellC: 2, color: 2, x: 30, y: 30 },
    ],
    grid: [
      [1, 3, 6],
      [2, 4, 7],
      [8, 9, 5],
    ],
  };
  let refillCalls = 0;
  const spent = mod.spendSuperGem({
    superGem: gameState.superGems[0],
    gameState,
    state,
    reason: 'contract',
    callFunctionWithContext: (_ctx, name) => {
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
    startRefillBounce: () => { refillCalls += 1; },
    activateSuperGemEffect: () => {
      state.globals.PendingSkillID = 'HERO_SINGLE';
      state.globals.PendingActor = 101;
      state.globals.CanPickGems = false;
      return true;
    },
    superGemCost: 4,
  });
  assert.equal(spent, true);
  assert.equal(refillCalls, 0);
  assert.equal(state.globals.LastSuperGemSpend.refillDeferred, true);
});

test('supergem spend refuses to start during active presentation lanes', async () => {
  const mod = await import('../web-runner/src/core/superGemBoardState.mjs');
  const baseGameState = (lane = {}) => ({
    selectedHero: 0,
    selectedGems: [],
    selectionLocked: false,
    superGems: [
      { id: 'sg-red', type: 'uniform', baseColor: 1, size: 2, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }] },
    ],
    superGemCellMap: new Map([['0,0', 'sg-red'], ['0,1', 'sg-red'], ['1,0', 'sg-red'], ['1,1', 'sg-red']]),
    gems: [
      { uid: 1, cellR: 0, cellC: 0, color: 1, x: 10, y: 10 },
      { uid: 2, cellR: 0, cellC: 1, color: 1, x: 20, y: 10 },
      { uid: 3, cellR: 1, cellC: 0, color: 1, x: 10, y: 20 },
      { uid: 4, cellR: 1, cellC: 1, color: 1, x: 20, y: 20 },
    ],
    grid: [
      [1, 3],
      [2, 4],
    ],
    ...lane,
  });
  const callFunctionWithContext = (_ctx, name) => {
    if (name === 'GetCurrentTurn') return 101;
    if (name === 'GetActorByUID') return { uid: 101, kind: 'hero' };
    return 0;
  };
  for (const lane of [
    { refillBounce: { active: true } },
    { yellowCasino: { active: true } },
    { gemMergeFx: { active: true } },
    { grid: [[1, 0], [2, 4]] },
    { grid: [[1, 0], [2, 4]], globals: { EnemyLineClearPressureActive: 1 } },
  ]) {
    const { globals: extraGlobals = {}, ...gameStateLane } = lane;
    const state = {
      globals: {
        GamePhase: 'RUNTIME',
        Player_Energy: 10,
        CanPickGems: true,
        PendingSkillID: '',
        DeferAdvance: 0,
        TurnPhase: 0,
        ...extraGlobals,
      },
    };
    const gameState = baseGameState(gameStateLane);
    let activated = 0;
    const spent = mod.spendSuperGem({
      superGem: gameState.superGems[0],
      gameState,
      state,
      reason: 'contract',
      callFunctionWithContext,
      fnContext: {},
      getHeroUIDByIndex: () => 101,
      beginTask011ActionCycle: () => {},
      startGemMergeFx: () => {},
      getGoldLabelTargetWorld: () => null,
      setGemArray: () => {},
      startRefillBounce: () => {},
      activateSuperGemEffect: () => {
        activated += 1;
        return true;
      },
      superGemCost: 4,
    });
    assert.equal(spent, false, JSON.stringify(lane));
    assert.equal(activated, 0, JSON.stringify(lane));
    assert.equal(state.globals.Player_Energy, 10, JSON.stringify(lane));
    assert.equal(gameState.gems.length, 4, JSON.stringify(lane));
  }
});

test('supergem spend clears all matching-color gems and flies non-supergem matches into its center', async () => {
  const mod = await import('../web-runner/src/core/superGemBoardState.mjs');
  const state = {
    globals: {
      GamePhase: 'RUNTIME',
      Player_Energy: 10,
      CanPickGems: true,
      PendingSkillID: '',
      DeferAdvance: 0,
      time: 12,
    },
  };
  const gameState = {
    selectedHero: 0,
    selectedGems: [{ uid: 1 }],
    selectionLocked: true,
    superGems: [
      { id: 'sg-blue', type: 'uniform', baseColor: 2, size: 2, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }] },
    ],
    superGemCellMap: new Map([['0,0', 'sg-blue'], ['0,1', 'sg-blue'], ['1,0', 'sg-blue'], ['1,1', 'sg-blue']]),
    gems: [
      { uid: 1, cellR: 0, cellC: 0, color: 2, x: 10, y: 10 },
      { uid: 2, cellR: 0, cellC: 1, color: 2, x: 20, y: 10 },
      { uid: 3, cellR: 1, cellC: 0, color: 2, x: 10, y: 20 },
      { uid: 4, cellR: 1, cellC: 1, color: 2, x: 20, y: 20 },
      { uid: 5, cellR: 2, cellC: 0, color: 2, x: 10, y: 30 },
      { uid: 6, cellR: 2, cellC: 1, color: 4, x: 20, y: 30 },
      { uid: 7, cellR: 3, cellC: 2, elementIndex: 2, x: 30, y: 40 },
    ],
    grid: [
      [1, 3, 5, 8],
      [2, 4, 6, 9],
      [10, 11, 12, 7],
    ],
  };
  let refillCalls = 0;
  let mergeFx = null;
  const spent = mod.spendSuperGem({
    superGem: gameState.superGems[0],
    gameState,
    state,
    reason: 'contract',
    callFunctionWithContext: (_ctx, name) => {
      if (name === 'GetCurrentTurn') return 101;
      if (name === 'GetActorByUID') return { uid: 101, kind: 'hero' };
      return 0;
    },
    fnContext: {},
    getHeroUIDByIndex: () => 101,
    beginTask011ActionCycle: () => {},
    startGemMergeFx: (args) => {
      mergeFx = args;
      gameState.gemMergeFx = { active: true };
    },
    getGoldLabelTargetWorld: () => null,
    setGemArray: () => {},
    startRefillBounce: () => { refillCalls += 1; },
    activateSuperGemEffect: () => true,
    superGemCost: 4,
  });
  assert.equal(spent, true);
  assert.equal(refillCalls, 0);
  assert.deepEqual(gameState.gems.map((gem) => gem.uid), [6]);
  assert.equal(gameState.grid[0][0], 0);
  assert.equal(gameState.grid[1][2], 6);
  assert.equal(gameState.grid[2][3], 0);
  assert.deepEqual(mergeFx.target, { x: 15, y: 15 });
  assert.equal(mergeFx.scaleOut, false);
  assert.deepEqual(mergeFx.sourceItems, [
    { x: 10, y: 30, color: 2 },
    { x: 30, y: 40, color: 2 },
  ]);
  assert.equal(state.globals.LastSuperGemSpend.clearedGemCount, 6);
});

test('one-color full-board supergem spends accept numeric hero input readiness for every gem color', async () => {
  const mod = await import('../web-runner/src/core/superGemBoardState.mjs');
  for (const color of [0, 1, 2, 3, 4, 5]) {
    const state = {
      globals: {
        GamePhase: 'RUNTIME',
        Player_Energy: 10,
        CanPickGems: 1,
        PendingSkillID: '',
        DeferAdvance: 0,
        TurnPhase: 0,
        time: 3,
      },
    };
    const gameState = makeFullColorBoard(color);
    let activated = 0;
    let refillCalls = 0;
    let mergeCalls = 0;
    const spent = mod.spendSuperGem({
      superGem: gameState.superGems[0],
      gameState,
      state,
      reason: 'numeric-can-pick-contract',
      callFunctionWithContext: (_ctx, name) => {
        if (name === 'GetCurrentTurn') return 101;
        if (name === 'GetActorByUID') return { uid: 101, kind: 'hero' };
        return 0;
      },
      fnContext: {},
      getHeroUIDByIndex: () => 101,
      beginTask011ActionCycle: () => {},
      startGemMergeFx: () => {
        mergeCalls += 1;
        gameState.gemMergeFx = { active: true };
      },
      getGoldLabelTargetWorld: () => null,
      setGemArray: () => {},
      startRefillBounce: () => { refillCalls += 1; },
      activateSuperGemEffect: () => {
        activated += 1;
        return true;
      },
      superGemCost: 4,
    });

    assert.equal(spent, true, `color ${color} should spend with CanPickGems=1`);
    assert.equal(activated, 1, `color ${color} should activate exactly once`);
    assert.equal(refillCalls, 0, `color ${color} should defer refill while merge presentation is active`);
    assert.equal(mergeCalls, 1, `color ${color} should merge non-footprint color gems into the supergem center`);
    assert.equal(gameState.gems.length, 0, `color ${color} should clear the one-color board`);
    assert.equal(state.globals.LastSuperGemSpend.clearedGemCount, 24);
    assert.equal(state.globals.Player_Energy, color === 5 ? 9 : 6);
    assert.equal(state.globals.LastSuperGemSpend.refillDeferred, true);
  }
});

test('runtime input gates interpret CanPickGems numerically without changing presentation barriers', () => {
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const boardStateSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'superGemBoardState.mjs'), 'utf8');

  assert.match(appSrc, /isCanPickGemsReady/);
  assert.match(appSrc, /!isCanPickGemsReady\(state\.globals\.CanPickGems\) \|\| !isHeroTurn/);
  assert.match(appSrc, /isCanPickGemsReady\(state\.globals\.CanPickGems\)/);
  assert.match(boardStateSrc, /isCanPickGemsReady\(globals\.CanPickGems\)/);
  assert.doesNotMatch(appSrc, /state\.globals\.CanPickGems === true/);
  assert.doesNotMatch(boardStateSrc, /globals\.CanPickGems === true/);
});
