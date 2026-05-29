const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

function loadFunctionBank(modulePath) {
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

test('turn summary follows Rust owner when Rust and JS disagree', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const mod = loadFunctionBank(modulePath);
    const ctx = makeContext();
    const jsSnapshot = mod.collectTurnSummaryShadowSnapshot(ctx);
    assert.notEqual(jsSnapshot.jsCode, 400301, `${modulePath} test needs JS and Rust sentinel codes to disagree`);

    const code = mod.maybeShadowTurnSummary(ctx, 'test.turnSummaryOwner');

    assert.equal(code, 400301, `${modulePath} Rust-owned summary code`);
    assert.equal(ctx.state.globals.LastTurnSummaryOwner.owner, 'rust');
    assert.equal(ctx.state.globals.LastTurnSummaryOwner.code, 400301);
    assert.equal(ctx.state.globals.LastTurnSummaryShadow.jsCode, jsSnapshot.jsCode);
  }
});
