const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractFunctionSource(src, name) {
  const markers = [`function ${name}(`, `export function ${name}(`];
  let start = -1;
  for (const marker of markers) {
    start = src.indexOf(marker);
    if (start !== -1) break;
  }
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = src.indexOf('{', start);
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('enemy board locks do not mark line-clear refill pressure in both runtime mirrors', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /function lockRandomGemLine\(ctx, axis, skillId, duration, maxLocks = 0, targetColor = 0\)/);
    assert.match(src, /g\.EnemyGemLockActive = cappedTargetGems\.length > 0 \? 1 : 0;/);
    assert.doesNotMatch(src, /EnemyLineClearPressureActive = 1/);
  }
});



test('app startRefillBounce queues missing cells after a line-clear style gem removal', () => {
  const src = read('web-runner/app.js');
  const setGemArraySrc = extractFunctionSource(src, 'setGemArray');
  const rebuildGridSrc = extractFunctionSource(src, 'rebuildGridFromGems');
  const startRefillBounceSrc = extractFunctionSource(src, 'startRefillBounce');
  const setGemsBody = src.match(/setGems: \(gems\) => \{([\s\S]*?)\n  \},\n  getSelectedGemIndices:/);

  assert.ok(setGemsBody, 'missing fnContext.setGems body');

  const sandbox = {
    state: {
      globals: {
        CanPickGems: true,
        IsPlayerBusy: 0,
        PendingSkillID: '',
        BoardFillActive: 0,
        TurnPhase: 0,
        DeferAdvance: 0,
        ActionLockUntil: 0,
        MatchedColorValue: -1,
        TapIndex: 0,
      },
    },
    gameState: { gems: [], grid: [], refillBounce: null },
    boardGeometry: { cols: 3, rows: 3 },
    createContext(spec) { return spec; },
    getTask015TraceStore() { return {}; },
    gemDebugLog() {},
    runtimeDebugLogging: {
      gemDebugLog() {},
    },
    resolveSuperGemDecomposition() {},
    applyTurnGateIntent() {},
    createRefillStartGate() { return {}; },
  };
  vm.createContext(sandbox);
  vm.runInContext(`${setGemArraySrc}\n${rebuildGridSrc}\n${startRefillBounceSrc}`, sandbox);
  vm.runInContext(
    `globalThis.fnContext = createContext({
      getGems: () => (state.globals.Gems || gameState.gems),
      setGems: (gems) => {${setGemsBody[1]}
      },
      getSelectedGemIndices: () => [],
      setSelectedGemIndices: () => {},
    });`,
    sandbox
  );

  sandbox.fnContext.setGems([
    { uid: 1, cellC: 0, cellR: 0 },
    { uid: 3, cellC: 2, cellR: 0 },
    { uid: 4, cellC: 0, cellR: 1 },
    { uid: 6, cellC: 2, cellR: 1 },
    { uid: 7, cellC: 0, cellR: 2 },
    { uid: 9, cellC: 2, cellR: 2 },
  ]);

  sandbox.startRefillBounce();
  assert.equal(sandbox.gameState.refillBounce.active, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.gameState.refillBounce.queue)),
    [
      { cellC: 1, cellR: 0, reason: 'empty', index: 1 },
      { cellC: 1, cellR: 1, reason: 'empty', index: 4 },
      { cellC: 1, cellR: 2, reason: 'empty', index: 7 },
    ]
  );
  assert.equal(sandbox.state.globals.BoardFillActive, 1);
});

test('refill bounce fills every queued empty cell before waiting for settle', async () => {
  const { advanceRefillBounceSimulation } = await import('../web-runner/systems/combatSimulationTick.mjs');
  const state = { globals: { time: 5, TurnPhase: 0, GamePhase: 'RUNTIME', BoardFillActive: 1, ActionInProgress: 0 }, entities: [] };
  const gameState = {
    grid: [[0, 0, 0]], gems: [], nextGemUID: 1,
    refillBounce: { active: true, index: 0, current: null, queue: [{ cellC: 0, cellR: 0 }, { cellC: 0, cellR: 1 }, { cellC: 0, cellR: 2 }], speedScale: 1 },
  };
  const deps = {
    state, gameState, getCellWorldPos: () => ({ x: 0, y: 0, w: 1, h: 1 }), randomGemFrame: () => 0,
    createEnemyTurnGateBaseline: {}, createRefillCompleteGate: {}, applyTurnGateIntent() {},
  };
  advanceRefillBounceSimulation(deps);
  assert.equal(gameState.gems.length, 3, 'all queued cells should fill in one simulation pass');
  assert.equal(gameState.refillBounce.active, true, 'refill remains active until the shared bounce settle time');
  state.globals.time = 5.48;
  advanceRefillBounceSimulation(deps);
  assert.equal(gameState.refillBounce.active, false, 'refill settles after the final bounce duration');
});

test('existing Djinn/Marid incomplete-board fallback contract is still present', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /function normalizeEnemyBoardLineSkillDecision\(ctx, enemy, decision\)/);
    assert.match(src, /if \(!harness\) return decision;/);
    assert.match(src, /if \(isEnemyBoardPressureSkillAvailable\(ctx, selected\)\) return decision;/);
    assert.match(src, /selected: resolveEnemyBoardLineFallbackSkill\(enemy, selected\),/);
    assert.match(src, /blocked_incomplete_board/);
    assert.match(src, /blocked_no_lock_target/);
    assert.match(src, /const result = lockRandomGemLine\(ctx, harness\.axis, harness\.skillId, harness\.duration, harness\.maxLocks, harness\.targetColor\);/);
  }
});
