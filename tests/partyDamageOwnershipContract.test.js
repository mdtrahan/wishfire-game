const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'partyDamageRules.mjs');

function loadFunctionBank(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ApplyPartyDamage,
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
    createPartyDamageSimulationPacket: (payload) => {
      const { ownerHook, ...submitted } = payload;
      const result = ownerHook(submitted);
      return {
        ...result,
        simulationCoreRequest: {
          action: { type: 'combat.partyDamage' },
        },
        simulationCoreResponse: {
          result: 'party_damage',
          diagnostics: submitted,
        },
      };
    },
    __ORKA_PARTY_DAMAGE_OWNER__: () => ({
      owner: 'rust',
      absorbed: 3,
      damageAfterShield: 4,
      shieldAfter: 2,
      heroHp: [16, 12, 8, 4],
      partyHp: 40,
    }),
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeContext() {
  const heroes = [20, 16, 12, 8].map((hp, index) => ({
    uid: 100 + index,
    kind: 'hero',
    name: `Hero ${index + 1}`,
    heroIndex: index,
    hp,
    maxHP: hp,
  }));
  return {
    state: {
      globals: {
        PartyHP: 56,
        PartyMaxHP: 56,
        PartyHPByIndex: [20, 16, 12, 8],
        PartyMaxHPByIndex: [20, 16, 12, 8],
        PartyTempHPShield: 5,
        PartyTempHPShieldStacks: 2,
        PartyTempHPShieldRatio: 0.1,
        PartyTempHPShieldMax: 50,
      },
      entities: heroes,
    },
  };
}

test('Rust simulation core declares party damage accounting exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn party_damage_absorbed/);
  assert.match(rustSrc, /extern "C" fn party_damage_absorbed_shadow/);
  assert.match(rustSrc, /extern "C" fn party_damage_after_shield_shadow/);
  assert.match(rustSrc, /extern "C" fn party_damage_party_hp_after_shadow/);
});

test('static simulation core wasm matches party damage accounting fixtures', async () => {
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.party_damage_absorbed_shadow, 'function');
  assert.equal(exports.party_damage_absorbed_shadow(12, 5), 5);
  assert.equal(exports.party_damage_after_shield_shadow(12, 5), 7);
  assert.equal(exports.party_damage_shield_after_shadow(12, 5), 0);
  assert.equal(exports.party_damage_hero_after_hp_shadow(9, 7), 2);
  assert.equal(exports.party_damage_party_hp_after_shadow(4, 20, 16, 12, 8, 7), 28);
});

test('simulation core module exposes a Rust-owned party damage marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_PARTY_DAMAGE_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCorePartyDamageResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.partyDamageOwner/);
  assert.match(shadowSrc, /partyDamageOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowPartyDamageOwner/);
});

test('party damage packet follows Rust owner when Rust and JS disagree', async () => {
  const { createPartyDamageSimulationPacket } = await import(pathToFileURL(rulesPath));
  const packet = createPartyDamageSimulationPacket({
    source: 'test.packetizedPartyDamage',
    incomingDamage: 8,
    shield: 5,
    heroCount: 4,
    heroHp: [20, 16, 12, 8],
    jsAbsorbed: 5,
    jsDamageAfterShield: 3,
    jsShieldAfter: 0,
    jsHeroHp: [17, 13, 9, 5],
    jsPartyHp: 44,
    ownerHook: () => ({
      owner: 'rust',
      absorbed: 3,
      damageAfterShield: 4,
      shieldAfter: 2,
      heroHp: [16, 12, 8, 4],
      partyHp: 40,
    }),
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.damageAfterShield, 4);
  assert.deepEqual(packet.heroHp, [16, 12, 8, 4]);
  assert.equal(packet.simulationCoreRequest.action.type, 'combat.partyDamage');
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'partyDamage');
  assert.equal(packet.simulationCoreResponse.result, 'party_damage');
  assert.equal(packet.simulationCoreResponse.diagnostics.jsDamageAfterShield, 3);
  assert.equal(packet.simulationCoreResponse.nextGameState.combat.lastPartyDamage.partyHp, 40);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreRequest)), packet.simulationCoreRequest);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});

test('ApplyPartyDamage follows Rust owner when Rust and JS disagree', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const mod = loadFunctionBank(modulePath);
    const ctx = makeContext();

    mod.ApplyPartyDamage(ctx, 8);

    const heroes = ctx.state.entities.filter((entity) => entity.kind === 'hero');
    assert.deepEqual(heroes.map((hero) => hero.hp), [16, 12, 8, 4], `${modulePath} Rust-owned hero HP`);
    assert.equal(ctx.state.globals.PartyHP, 40, `${modulePath} Rust-owned party HP`);
    assert.equal(ctx.state.globals.PartyTempHPShield, 2, `${modulePath} Rust-owned shield after`);
    assert.equal(ctx.state.globals.LastPartyTempHPShieldAbsorbed, 3, `${modulePath} Rust-owned absorbed shield`);
    assert.equal(ctx.state.globals.LastPartyDamageOwner.owner, 'rust');
    assert.equal(ctx.state.globals.LastPartyDamageOwner.damageAfterShield, 4);
    assert.equal(ctx.state.globals.LastPartyDamagePacket.owner, 'rust');
    assert.equal(ctx.state.globals.LastPartyDamagePacket.actionType, 'combat.partyDamage');
  }
});
