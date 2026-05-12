const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

test('dev idle autoplay prefers attack supergems before resource and purple supergems', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const priorityConst = src.match(/const IDLE_AUTOPLAY_SUPER_GEM_COLOR_PRIORITY = Object\.freeze\(\[[\s\S]*?\]\);/);
  const fn = src.match(/function findIdleAutoplayPrioritySuperGemPick\(\) \{[\s\S]*?\n  \}/);
  assert.ok(priorityConst, 'supergem priority should have its own combat-QA tiers');
  assert.ok(fn, 'idle autoplay should expose a supergem picker');
  const script = `${priorityConst[0]}\n${fn[0]}\nfindIdleAutoplayPrioritySuperGemPick();`;
  const result = vm.runInNewContext(script, {
    gameState: {
      superGems: [
        { id: 'blue-super', baseColor: 2, cells: [{ r: 1, c: 2 }, { r: 1, c: 3 }, { r: 2, c: 2 }, { r: 2, c: 3 }] },
        { id: 'red-super', baseColor: 1, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }] },
        { id: 'purple-super', baseColor: 5, cells: [{ r: 3, c: 0 }, { r: 3, c: 1 }, { r: 4, c: 0 }, { r: 4, c: 1 }] },
      ],
    },
    Number,
    Array,
  });
  assert.equal(JSON.stringify(result), JSON.stringify({ row: 0, col: 0 }));
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
      [1, 3, 0],
      [2, 4, 0],
      [0, 0, 5],
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
      [1, 3, 5, 0],
      [2, 4, 6, 0],
      [0, 0, 0, 7],
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
    startGemMergeFx: (args) => { mergeFx = args; },
    getGoldLabelTargetWorld: () => null,
    setGemArray: () => {},
    startRefillBounce: () => { refillCalls += 1; },
    activateSuperGemEffect: () => true,
    superGemCost: 4,
  });
  assert.equal(spent, true);
  assert.equal(refillCalls, 1);
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
