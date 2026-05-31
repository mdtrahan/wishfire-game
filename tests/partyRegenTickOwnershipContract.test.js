const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const renderRuntimePath = path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

function loadShadowModule() {
  const original = fs.readFileSync(shadowModulePath, 'utf8');
  const transformed = `${original.replace(/\bexport\s+/g, '')}

module.exports = {
  createSimulationCorePartyRegenTickResolution,
};`;
  const context = {
    console: {
      log() {},
      warn() {},
      error() {},
    },
    document: undefined,
    module: { exports: {} },
    exports: {},
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: shadowModulePath }).runInContext(context);
  return context.module.exports;
}

test('simulation core module exposes a Rust-owned party regen tick marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_PARTY_REGEN_TICK_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCorePartyRegenTickResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.partyRegenTickOwner/);
  assert.match(shadowSrc, /partyRegenTickOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowPartyRegenTickOwner/);
});

test('party regen tick owner follows Rust when Rust and JS disagree', () => {
  const mod = loadShadowModule();
  const decision = mod.createSimulationCorePartyRegenTickResolution({
    source: 'test.partyRegenTickOwner',
    totalHealRemaining: 10,
    remainingFires: 3,
    healPerFire: 0,
    hasTotalHealRemaining: 1,
    nextFireSerial: 10,
    firesEvery: 2,
    distributionMode: 1,
    jsHeal: 99,
    jsTotalHealRemaining: 88,
    jsRemainingFires: 77,
    jsNextFireSerial: 66,
  }, {
    exportsOverride: {
      party_regen_tick_heal_shadow: () => 3,
      party_regen_tick_total_remaining_shadow: () => 7,
      party_regen_tick_remaining_fires_shadow: () => 2,
      party_regen_tick_next_serial_shadow: () => 12,
    },
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.heal, 3);
  assert.equal(decision.totalHealRemaining, 7);
  assert.equal(decision.remainingFires, 2);
  assert.equal(decision.nextFireSerial, 12);
});

test('browser party regen cadence routes deterministic tick state through Rust owner hook', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const renderRuntimeSrc = fs.readFileSync(renderRuntimePath, 'utf8');

  assert.match(appSrc, /__ORKA_PARTY_REGEN_TICK_OWNER__/);
  assert.match(appSrc, /createPartyRegenLifecycleSimulationPacket/);
  assert.match(appSrc, /createPartyRegenTickSimulationPacket/);
  assert.match(appSrc, /LastPartyRegenTickOwner/);
  assert.match(appSrc, /LastPartyRegenLifecyclePacket/);
  assert.match(appSrc, /LastPartyRegenTickPacket/);
  assert.match(appSrc, /ownedTick[\s\S]*owner[\s\S]*rust/);
  assert.match(appSrc, /regen\.totalHealRemaining = Math\.max\(0, Math\.floor\(Number\(ownedTick\.totalHealRemaining/);
  assert.match(appSrc, /regen\.remainingFires = Math\.max\(0, Math\.floor\(Number\(ownedTick\.remainingFires/);
  assert.match(appSrc, /regen\.nextFireTurnSerial = Number\(ownedTick\.nextFireSerial/);

  assert.match(renderRuntimeSrc, /__ORKA_PARTY_REGEN_TICK_OWNER__/);
  assert.match(renderRuntimeSrc, /createPartyRegenTickSimulationPacket/);
  assert.match(renderRuntimeSrc, /LastPartyRegenTickPacket/);
  assert.match(renderRuntimeSrc, /regen\.nextFireTick = Number\(ownedTick\.nextFireSerial/);
});
