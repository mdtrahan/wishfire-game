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

test('enemy line clears mark persistent board pressure in both runtime mirrors', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /if \(consumed > 0\) g\.EnemyLineClearPressureActive = 1;/);
  }
});

test('app refill loop keeps enemy line-clear empties until a player action clears pressure', () => {
  const src = read('web-runner/app.js');

  assert.match(src, /applyTurnGateGlobals\(\{\s*CanPickGems: 0,\s*IsPlayerBusy: 1,\s*EnemyLineClearPressureActive: 0,\s*\}\);/s);
  assert.match(src, /setGems: \(gems\) => \{\s+setGemArray\(gems\);\s+rebuildGridFromGems\(\);/s);
  assert.match(src, /const enemyLineClearPressureActive = !!state\.globals\.EnemyLineClearPressureActive;/);
  assert.match(src, /if \(\s*refillReady &&\s*hasEmpty &&\s*!enemyLineClearPressureActive\s*\)\s*\{\s*startRefillBounce\(\);/s);
  assert.match(src, /function canResolveDeferredAdvance\(\{ hasEmpty = false, enemyLineClearPressureActive = false \} = \{\}\)/);
  assert.match(
    src,
    /const refillPending =\s*boardFillActive \|\|[\s\S]*?\(\!\!hasEmpty && !refillActive && !enemyLineClearPressureActive\);/
  );
  assert.match(src, /if \(deferredAdvanceState\.refillPending\) \{\s*\/\/ Refill must complete before advancing to the next actor\.\s*startRefillBounce\(\);/s);
  assert.doesNotMatch(src, /if \(enemyAction\.state === 'DONE'\) \{[\s\S]*if \(hasEmptySlots\(\) && !\(gameState\.refillBounce && gameState\.refillBounce\.active\)\) \{[\s\S]*startRefillBounce\(\);/s);
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

test('existing Djinn/Marid incomplete-board fallback contract is still present', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /function normalizeEnemyBoardLineSkillDecision\(ctx, enemy, decision\)/);
    assert.match(src, /if \(!getEnemyBoardPressureSkillHarness\(selected\)\) return decision;/);
    assert.match(src, /selected: resolveEnemyBoardLineFallbackSkill\(enemy, selected\),/);
    assert.match(src, /blocked_incomplete_board/);
  }
});
