const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');

function loadFunctionBank(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  decayEnemyDebuffsForTurn,
};`;
  const calls = [];
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
    createEnemyDebuffDecaySimulationPacket: (payload) => {
      const { ownerHook, ...submitted } = payload;
      const result = ownerHook(submitted);
      return {
        ...result,
        simulationCoreRequest: {
          action: { type: 'status.enemyDebuffDecay' },
        },
        simulationCoreResponse: {
          result: 'enemy_debuff_decay',
          diagnostics: submitted,
        },
      };
    },
    __ORKA_ENEMY_DEBUFF_DECAY_OWNER__: (payload) => {
      calls.push(payload);
      if (payload.stat === 'ATK') {
        return {
          owner: 'rust',
          amountAfter: 9,
          turnsAfter: 8,
          active: 1,
        };
      }
      return {
        owner: 'rust',
        amountAfter: 0,
        turnsAfter: 0,
        active: 0,
      };
    },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return { mod: context.module.exports, calls };
}

function makeContext() {
  return {
    state: {
      globals: {
        EnemyDebuffs: {
          200: { ATK: 4, DEF: 3 },
        },
        EnemyDebuffTurns: {
          200: { ATK: 3, DEF: 1 },
        },
        EnemyDebuffSlots: {
          200: ['ATK', 'DEF'],
        },
      },
      entities: [],
    },
  };
}

test('Rust simulation core declares enemy debuff duration decay exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn enemy_debuff_turns_after_tick/);
  assert.match(rustSrc, /pub fn enemy_debuff_amount_after_tick/);
  assert.match(rustSrc, /pub fn enemy_debuff_active_after_tick/);
  assert.match(rustSrc, /extern "C" fn enemy_debuff_turns_after_tick_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_debuff_amount_after_tick_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_debuff_active_after_tick_shadow/);
});

test('static simulation core wasm matches enemy debuff duration fixtures', async () => {
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.enemy_debuff_turns_after_tick_shadow, 'function');
  assert.equal(exports.enemy_debuff_turns_after_tick_shadow(3), 2);
  assert.equal(exports.enemy_debuff_amount_after_tick_shadow(4, 2), 4);
  assert.equal(exports.enemy_debuff_active_after_tick_shadow(4, 2), 1);
  assert.equal(exports.enemy_debuff_turns_after_tick_shadow(1), 0);
  assert.equal(exports.enemy_debuff_amount_after_tick_shadow(4, 0), 0);
  assert.equal(exports.enemy_debuff_active_after_tick_shadow(4, 0), 0);
});

test('simulation core module exposes a Rust-owned enemy debuff duration marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_ENEMY_DEBUFF_DECAY_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreEnemyDebuffDecayResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.enemyDebuffDecayOwner/);
  assert.match(shadowSrc, /enemyDebuffDecayOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemyDebuffDecayOwner/);
});

test('functionBank mirrors Rust-owned enemy debuff duration decay without Rust imports', () => {
  for (const filePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const src = fs.readFileSync(filePath, 'utf8');

    assert.match(src, /function maybeResolveEnemyDebuffDecayOwner/);
    assert.match(src, /function decayEnemyDebuffsForTurn\(ctx, enemyUID\)/);
    assert.match(src, /enemyDebuffDecayOwnerHook/);
    assert.match(src, /__ORKA_ENEMY_DEBUFF_DECAY_OWNER__/);
    assert.match(src, /LastEnemyDebuffDecayOwner/);
    assert.match(src, /decayEnemyDebuffsForTurn\(ctx, currentUID\);/);
  }
});

test('enemy debuff duration decay follows Rust owner when Rust and JS disagree', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const { mod, calls } = loadFunctionBank(modulePath);
    const ctx = makeContext();

    mod.decayEnemyDebuffsForTurn(ctx, 200);

    const g = ctx.state.globals;
    assert.deepEqual(calls.map((payload) => payload.stat), ['ATK', 'DEF'], `${modulePath} submitted both slots`);
    assert.equal(g.EnemyDebuffs[200].ATK, 9, `${modulePath} Rust-owned ATK amount`);
    assert.equal(g.EnemyDebuffTurns[200].ATK, 8, `${modulePath} Rust-owned ATK turns`);
    assert.equal(g.EnemyDebuffs[200].DEF, 0, `${modulePath} Rust-owned expired DEF amount`);
    assert.equal(g.EnemyDebuffTurns[200].DEF, 0, `${modulePath} Rust-owned expired DEF turns`);
    assert.deepEqual(Array.from(g.EnemyDebuffSlots[200]), ['ATK'], `${modulePath} expired slot removed`);
    assert.equal(g.LastEnemyDebuffDecayOwner.owner, 'rust');
    assert.equal(g.LastEnemyDebuffDecayPacket.owner, 'rust');
    assert.equal(g.LastEnemyDebuffDecayPacket.actionType, 'status.enemyDebuffDecay');
  }
});
