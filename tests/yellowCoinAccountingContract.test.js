const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractFunctionSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const parenStart = src.indexOf('(', start);
  assert.notEqual(parenStart, -1, `missing params for ${name}`);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = parenStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '(') parenDepth += 1;
    if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  assert.notEqual(paramsEnd, -1, `unterminated params for ${name}`);
  const braceStart = src.indexOf('{', paramsEnd);
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

function loadYellowSequenceHarness() {
  const src = read('web-runner/app.js');
  const harnessSrc = [
    extractFunctionSource(src, 'isBoardGemLocked'),
    extractFunctionSource(src, 'startYellowCasinoSequence'),
    'module.exports = { startYellowCasinoSequence };',
  ].join('\n');

  const captured = { queues: [], gates: [], functionCalls: [] };
  const context = {
    module: { exports: {} },
    exports: {},
    Number,
    String,
    Boolean,
    Array,
    Map,
    Math,
    state: {
      globals: {
        GamePhase: 'RUNTIME',
        time: 4,
        goldTotal: 10,
        BoardFillActive: 0,
        CanPickGems: 0,
        IsPlayerBusy: 0,
        PendingSkillID: '',
        TurnPhase: 0,
        DeferAdvance: 0,
        ActionLockUntil: 0,
        MatchedColorValue: 0,
        TapIndex: 0,
      },
    },
    gameState: {
      yellowCasino: {},
      refillBounce: { active: false },
      gems: [
        { uid: 1, cellR: 0, cellC: 0, color: 3 },
        { uid: 2, cellR: 0, cellC: 1, color: 3 },
        { uid: 3, cellR: 1, cellC: 0, color: 3 },
        { uid: 4, cellR: 1, cellC: 1, color: 3 },
        { uid: 5, cellR: 2, cellC: 0, color: 3 },
        { uid: 6, cellR: 2, cellC: 1, color: 1 },
      ],
    },
    boardGeometry: { rows: 4, cols: 6 },
    YELLOW_COLOR: 3,
    YELLOW_CASINO_TELEGRAPH_SEC: 0.12,
    YELLOW_CASINO_SPIN_SEC: 0.08,
    pickYellowReassignTarget: () => 4,
    getGoldLabelTargetWorld: () => ({ x: 100, y: 20 }),
    getCellWorldPos: (cellC, cellR) => ({ x: cellC * 10, y: cellR * 10, w: 8, h: 8 }),
    startGemMergeFx: ({ target = null, scaleOut = true, startScale = 1, sourceItems = [] } = {}) => {
      context.gameState.gemMergeFx = {
        active: Array.isArray(sourceItems) && sourceItems.length > 0,
        target,
        scaleOut,
        startScale,
        items: sourceItems,
      };
    },
    traceTask015YellowQueue: (queue) => { captured.queues.push(queue.map(item => ({ ...item }))); },
    traceTask015YellowAnimation: () => {},
    runtimeDebugLogging: { gemDebugLog: () => {} },
    applyTurnGateIntent: (intent, payload) => { captured.gates.push({ intent, payload }); },
    callFunctionWithContext: (_fnContext, name, ...args) => { captured.functionCalls.push({ name, args }); },
    fnContext: {},
    createYellowSequenceGate: function createYellowSequenceGate() {},
    createYellowSequenceSkip: function createYellowSequenceSkip() {},
  };

  vm.runInNewContext(harnessSrc, context, { filename: 'yellow-sequence-harness.js' });
  return { startYellowCasinoSequence: context.module.exports.startYellowCasinoSequence, context, captured };
}

function loadSuperGemRuntime() {
  const src = read('web-runner/systems/superGemRuntime.js')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { activateSuperGemEffect };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map, Set };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

test('normal yellow match-3 sends only matched gems through regular gold randomizer', () => {
  const { startYellowCasinoSequence, context, captured } = loadYellowSequenceHarness();

  startYellowCasinoSequence(77, 3, {
    goldTarget: { x: 10, y: 12 },
    mergeSources: [
      { cellC: 0, cellR: 0, color: 3 },
      { cellC: 0, cellR: 1, color: 3 },
      { cellC: 0, cellR: 2, color: 3 },
    ],
  });

  assert.equal(context.state.globals.goldTotal, 10);
  assert.deepEqual(captured.functionCalls.filter(call => call.name === 'Add_Gold'), [
    { name: 'Add_Gold', args: [3] },
  ]);
  assert.equal(context.gameState.gemMergeFx.goldAward, undefined);
  assert.equal(context.gameState.yellowCasino.pendingGoldAward, 0);
  assert.equal(context.gameState.yellowCasino.active, false);
  assert.equal(captured.queues[0].length, 0);
});

test('yellow match branch resolves selected indices before counting gold award', () => {
  const src = read('web-runner/app.js');
  const handleGemMatchSrc = extractFunctionSource(src, 'handleGemMatch');
  const yellowBranch = handleGemMatchSrc.match(/} else if \(color === 3\) \{[\s\S]*?\n  \} else if \(color === 4\)/);

  assert.ok(yellowBranch, 'handleGemMatch should have a yellow branch');
  assert.match(yellowBranch[0], /\? gameState\.selectedGems\s*\n\s*\.map\(\(selection\) => \{/);
  assert.match(yellowBranch[0], /gameState\.gems && gameState\.gems\[index\]/);
  assert.match(yellowBranch[0], /const matchedYellowCount = selectedYellowGems\.length;/);
  assert.match(yellowBranch[0], /startYellowCasinoSequence\(actorUID, matchedYellowCount,/);
  assert.doesNotMatch(yellowBranch[0], /gameState\.selectedGems\.filter\(\(gm\) =>/);
});

test('yellow supergem consumes board-wide yellow count and bypasses random gold roll', () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const actor = { uid: 4, name: 'Falie', kind: 'hero' };
  const state = {
    globals: {
      time: 8,
      goldTotal: 15,
      RuntimeRandom: () => { throw new Error('yellow supergem gold should not roll random gold'); },
    },
    entities: [actor],
  };
  const calls = [];

  const activated = activateSuperGemEffect({
    superGem: { baseColor: 3 },
    actorUID: actor.uid,
    selectedEnemyUID: 0,
    state,
    callFunctionWithContext: (_ctx, name, ...args) => {
      calls.push({ name, args });
      if (name === 'GetActorByUID') return state.entities.find((entity) => Number(entity.uid) === Number(args[0])) || null;
      return undefined;
    },
    fnContext: {},
    sourceItems: [],
    consumedColorGemCount: 10,
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  });

  assert.equal(activated, true);
  assert.equal(state.globals.goldTotal, 25);
  assert.ok(calls.some((call) => call.name === 'LogCombat' && /found 10 gold/.test(String(call.args[0]))));
});
