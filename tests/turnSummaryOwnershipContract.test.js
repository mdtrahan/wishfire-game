const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'turnSummaryRules.mjs');

function loadFunctionBank(modulePath, createTurnSummarySimulationPacket) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  collectTurnSummaryShadowSnapshot,
  maybeShadowTurnSummary,
};`;
  const context = {
    console: {
      log() {},
      warn() {},
      error() {},
    },
    Math,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
    createTurnSummarySimulationPacket,
    __ORKA_TURN_SUMMARY_OWNER__: () => ({
      owner: 'rust',
      code: 400301,
    }),
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeContext() {
  return {
    state: {
      globals: {},
      entities: [
        { uid: 100, kind: 'hero', name: 'Falie', hp: 40, maxHP: 40 },
        { uid: 101, kind: 'hero', name: 'Kojonn', hp: 0, maxHP: 35 },
        { uid: 200, kind: 'enemy', name: 'Marid', hp: 25, maxHP: 25 },
        { uid: 201, kind: 'enemy', name: 'Wisp', hp: 0, maxHP: 12 },
      ],
    },
  };
}

test('simulation core module exposes a Rust-owned turn summary marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_TURN_SUMMARY_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreTurnSummaryResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.turnSummaryOwner/);
  assert.match(shadowSrc, /turnSummaryOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowTurnSummaryOwner/);
});

test('turn summary packet follows Rust owner when Rust and JS disagree', async () => {
  const { createTurnSummarySimulationPacket } = await import(pathToFileURL(rulesPath));
  const calls = [];
  const responses = [];
  const packet = createTurnSummarySimulationPacket({
    source: 'test.packetizedTurnSummary',
    heroCount: 2,
    heroHp: [40, 0],
    enemyCount: 2,
    enemyHp: [25, 0],
    ownerHook: (payload) => {
      calls.push(payload);
      return {
        owner: 'rust',
        code: 400301,
      };
    },
    requestFactory(action, context) {
      return {
        contractVersion: 1,
        baselineId: 'test',
        gameState: {
          turnSummary: {
            code: 111100,
          },
        },
        action,
        rngState: { seed: 5, draws: 0, owner: 'rust', reason: 'test', lastValue: 0 },
        context,
      };
    },
    responseApplier(response) {
      responses.push(response);
      return response;
    },
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.code, 400301);
  assert.equal(packet.jsSummary.code, 111100);
  assert.equal(calls[0].jsCode, 111100);
  assert.equal(packet.simulationCoreRequest.action.type, 'turn.summary');
  assert.deepEqual(packet.simulationCoreRequest.action.heroHp, [40, 0, 0, 0]);
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'turnSummary');
  assert.equal(packet.simulationCoreResponse.result, 'win');
  assert.equal(packet.simulationCoreResponse.diagnostics.owner, 'rust');
  assert.equal(packet.simulationCoreResponse.diagnostics.jsCode, 111100);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnSummary.code, 400301);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnSummary.enemyAlive, 0);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnSummary.enemiesDefeated, 1);
  assert.equal(responses.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreRequest)), packet.simulationCoreRequest);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});

test('turn summary follows Rust owner when Rust and JS disagree', async () => {
  const { createTurnSummarySimulationPacket } = await import(pathToFileURL(rulesPath));
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const mod = loadFunctionBank(modulePath, createTurnSummarySimulationPacket);
    const ctx = makeContext();
    const jsSnapshot = mod.collectTurnSummaryShadowSnapshot(ctx);
    assert.notEqual(jsSnapshot.jsCode, 400301, `${modulePath} test needs JS and Rust sentinel codes to disagree`);

    const code = mod.maybeShadowTurnSummary(ctx, 'test.turnSummaryOwner');

    assert.equal(code, 400301, `${modulePath} Rust-owned summary code`);
    assert.equal(ctx.state.globals.LastTurnSummaryOwner.owner, 'rust');
    assert.equal(ctx.state.globals.LastTurnSummaryOwner.code, 400301);
    assert.equal(ctx.state.globals.LastTurnSummaryPacket.owner, 'rust');
    assert.equal(ctx.state.globals.LastTurnSummaryPacket.actionType, 'turn.summary');
    assert.equal(ctx.state.globals.LastTurnSummaryShadow.jsCode, jsSnapshot.jsCode);
  }
});

test('functionBank routes turn summary through packetized Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /createTurnSummarySimulationPacket/);
    assert.match(src, /__ORKA_TURN_SUMMARY_OWNER__/);
    assert.match(src, /g\.LastTurnSummaryOwner/);
    assert.match(src, /g\.LastTurnSummaryPacket/);
    assert.match(src, /actionType: String\(summary\?\.simulationCoreRequest\?\.action\?\.type \|\| ''\)/);
  }
});
