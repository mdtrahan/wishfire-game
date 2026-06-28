#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');
const exists = (relativePath) => existsSync(resolve(repoRoot, relativePath));

const checks = [];
const testRuns = [];
const multipassRows = [];

function recordCheck(name, ok, severity, detail = '') {
  checks.push({ name, ok: Boolean(ok), severity, detail });
}

function extractFunctionSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`missing ${name}`);
  const parenStart = src.indexOf('(', start);
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
  const braceStart = src.indexOf('{', paramsEnd);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

function runNodeTest(relativePath) {
  const result = spawnSync(process.execPath, ['--test', relativePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  testRuns.push({
    name: relativePath,
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  });
}

function loadYellowSequenceHarness() {
  const src = read('web-runner/app.js');
  const harnessSrc = [
    extractFunctionSource(src, 'isBoardGemLocked'),
    extractFunctionSource(src, 'startYellowCasinoSequence'),
    'module.exports = { startYellowCasinoSequence };',
  ].join('\n');
  const captured = { queues: [], gates: [], functionCalls: [], mergeFx: [] };
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
        goldTotal: 100,
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
      gems: [],
    },
    boardGeometry: { rows: 4, cols: 6 },
    YELLOW_COLOR: 3,
    YELLOW_CASINO_TELEGRAPH_SEC: 0.12,
    YELLOW_CASINO_SPIN_SEC: 0.08,
    getGoldLabelTargetWorld: () => ({ x: 100, y: 20 }),
    getCellWorldPos: (cellC, cellR) => ({ x: cellC * 10, y: cellR * 10, w: 8, h: 8 }),
    startGemMergeFx: (payload = {}) => {
      captured.mergeFx.push(payload);
      context.gameState.gemMergeFx = {
        active: Array.isArray(payload.sourceItems) && payload.sourceItems.length > 0,
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

function runNormalYellowMultipass() {
  const cases = [
    { label: 'match-3 with 4 extra board yellows', matched: 3, boardYellow: 7 },
    { label: 'match-3 with 21 extra board yellows', matched: 3, boardYellow: 24 },
    { label: 'match-4 with 12 board yellows', matched: 4, boardYellow: 12 },
    { label: 'match-5 with full yellow board', matched: 5, boardYellow: 24 },
    { label: 'zero safeguard', matched: 0, boardYellow: 18 },
  ];

  for (const testCase of cases) {
    const { startYellowCasinoSequence, context, captured } = loadYellowSequenceHarness();
    const mergeSources = Array.from({ length: testCase.matched }, (_, index) => ({
      cellC: index % 6,
      cellR: Math.floor(index / 6),
      color: 3,
    }));
    startYellowCasinoSequence(77, testCase.matched, {
      goldTarget: { x: 10, y: 12 },
      mergeSources,
    });
    const addGoldCalls = captured.functionCalls.filter(call => call.name === 'Add_Gold');
    const addGoldArg = Number(addGoldCalls[0]?.args?.[0] ?? 0);
    const ok = addGoldCalls.length === (testCase.matched > 0 ? 1 : 0)
      && addGoldArg === testCase.matched
      && addGoldArg !== testCase.boardYellow
      && Number(context.state.globals.goldTotal) === 100
      && Number(context.gameState.yellowCasino.pendingGoldAward || 0) === 0
      && captured.queues[0]?.length === 0;
    multipassRows.push({
      lane: 'normal-yellow-match',
      ...testCase,
      addGoldCalls: addGoldCalls.length,
      addGoldArg,
      boardWideLeak: addGoldArg === testCase.boardYellow && testCase.boardYellow !== testCase.matched,
      ok,
    });
  }
}

function runYellowSupergemMultipass() {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const cases = [
    { label: 'empty board safeguard', consumed: 0, startingGold: 11 },
    { label: 'single yellow consumed', consumed: 1, startingGold: 11 },
    { label: 'partial yellow board consumed', consumed: 9, startingGold: 15 },
    { label: 'full yellow board consumed', consumed: 24, startingGold: 15 },
  ];

  for (const testCase of cases) {
    let randomCalls = 0;
    const actor = { uid: 4, name: 'Falie', kind: 'hero' };
    const state = {
      globals: {
        time: 8,
        goldTotal: testCase.startingGold,
        RuntimeRandom: () => {
          randomCalls += 1;
          return 0.4;
        },
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
      sourceItems: Array.from({ length: testCase.consumed }, (_, index) => ({ uid: index + 1, color: 3 })),
      consumedColorGemCount: testCase.consumed,
      startGemMergeFx: () => {},
      getGoldLabelTargetWorld: () => null,
    });
    const expectedGold = testCase.startingGold + testCase.consumed;
    const ok = activated === true
      && Number(state.globals.goldTotal) === expectedGold
      && randomCalls === 0
      && calls.some((call) => call.name === 'LogCombat' && String(call.args[0]).includes(`found ${testCase.consumed} gold`));
    multipassRows.push({
      lane: 'yellow-supergem',
      ...testCase,
      expectedGold,
      actualGold: Number(state.globals.goldTotal),
      randomCalls,
      ok,
    });
  }
}

function runStaticChecks() {
  const appSrc = read('web-runner/app.js');
  const handleGemMatchSrc = extractFunctionSource(appSrc, 'handleGemMatch');
  const yellowBranch = handleGemMatchSrc.match(/} else if \(color === 3\) \{[\s\S]*?\n  \} else if \(color === 4\)/);
  recordCheck(
    'yellow match branch resolves selected gem indices before counting',
    Boolean(yellowBranch && /const selectedYellowGems = Array\.isArray\(gameState\.selectedGems\)[\s\S]*?gameState\.gems && gameState\.gems\[index\]/.test(yellowBranch[0])),
    'way off',
    'Normal yellow matching should derive the count from selected gems, not from all board yellows.',
  );
  recordCheck(
    'yellow match branch passes matchedYellowCount into startYellowCasinoSequence',
    Boolean(yellowBranch && /const matchedYellowCount = selectedYellowGems\.length;[\s\S]*startYellowCasinoSequence\(actorUID, matchedYellowCount,/.test(yellowBranch[0])),
    'way off',
    'Normal yellow matching must pass only matched yellow count.',
  );
  recordCheck(
    'yellow match branch no longer filters board gems as the match source',
    Boolean(yellowBranch && !/gameState\.selectedGems\.filter\(\(gm\) =>/.test(yellowBranch[0])),
    'way off',
    'The old board-wide selectedGems object filter must not return.',
  );
  const packageJson = JSON.parse(read('package.json'));
  recordCheck(
    'package.json exposes npm run eval:yellow-coin-accounting',
    packageJson.scripts?.['eval:yellow-coin-accounting'] === 'node tools/eval_yellow_coin_accounting.mjs',
    'slightly off',
    'The eval should be runnable without remembering the tool path.',
  );
}

const requiredTests = [
  'tests/yellowCoinAccountingContract.test.js',
  'tests/yellowGoldFlyupContract.test.js',
  'tests/huunYellowSuperGemGoldstrikeContract.test.js',
];

runStaticChecks();
runNormalYellowMultipass();
runYellowSupergemMultipass();

for (const testPath of requiredTests) {
  recordCheck(`${testPath} exists`, exists(testPath), 'slightly off', 'Supporting focused contract missing.');
  if (exists(testPath)) runNodeTest(testPath);
}

for (const row of multipassRows) {
  recordCheck(
    `${row.lane}: ${row.label}`,
    row.ok,
    'way off',
    JSON.stringify(row),
  );
}

const failedStatic = checks.filter((check) => !check.ok);
const failedTests = testRuns.filter((run) => !run.ok);
const wayOff = failedStatic.filter((check) => check.severity === 'way off');
const slight = failedStatic.filter((check) => check.severity !== 'way off');

console.log('ORKA-293n yellow coin accounting eval');
console.log(`Static/multipass checks: ${checks.length - failedStatic.length}/${checks.length} passed`);
console.log(`Focused tests: ${testRuns.length - failedTests.length}/${testRuns.length} passed`);
console.log('\nMultipass rows');
for (const row of multipassRows) console.log(JSON.stringify(row));

if (wayOff.length) {
  console.log('\nWAY OFF failures');
  for (const failure of wayOff) {
    console.log(`- ${failure.name}`);
    console.log(`  ${failure.detail}`);
  }
}

if (slight.length) {
  console.log('\nSLIGHTLY OFF failures');
  for (const failure of slight) {
    console.log(`- ${failure.name}`);
    console.log(`  ${failure.detail}`);
  }
}

if (failedTests.length) {
  console.log('\nFocused test failures');
  for (const failure of failedTests) {
    console.log(`- ${failure.name} exited ${failure.status}`);
    const output = [failure.stderr, failure.stdout].filter(Boolean).join('\n').split('\n').slice(-12).join('\n');
    if (output) console.log(output);
  }
}

if (failedStatic.length || failedTests.length) {
  process.exitCode = 1;
} else {
  console.log('\nPASS: normal yellow matches use matched count; yellow supergem uses consumed board count without normal gold randomization.');
}
