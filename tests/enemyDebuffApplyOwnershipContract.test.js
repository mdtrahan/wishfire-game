const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

function loadFunctionBank(modulePath, applyOwner) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ExecutePurpleDebuff,
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
    __ORKA_ENEMY_DEBUFF_APPLY_OWNER__: (payload) => {
      calls.push(payload);
      return applyOwner(payload);
    },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return { mod: context.module.exports, calls };
}

function makeContext() {
  const actor = {
    uid: 100,
    kind: 'hero',
    name: 'Kojonn',
    hp: 40,
    stats: {
      ATK: 10,
      DEF: 10,
      MAG: 10,
      SPD: 10,
      RES: 10,
    },
  };
  const enemy = {
    uid: 200,
    kind: 'enemy',
    name: 'Marid',
    hp: 100,
    maxHP: 100,
    stats: {
      ATK: 6,
      DEF: 6,
      MAG: 6,
      SPD: 6,
      RES: 6,
    },
  };
  return {
    state: {
      globals: {
        RuntimeRandom: () => 0,
        RoundActive: 1,
        CombatLog: [],
        EnemyDebuffs: {
          200: { ATK: 4 },
        },
        EnemyDebuffTurns: {
          200: { ATK: 1 },
        },
        EnemyDebuffSlots: {
          200: ['ATK'],
        },
      },
      entities: [actor, enemy],
    },
  };
}

test('simulation core module exposes a Rust-owned enemy debuff apply marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_ENEMY_DEBUFF_APPLY_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreEnemyDebuffApplyResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.enemyDebuffApplyOwner/);
  assert.match(shadowSrc, /enemyDebuffApplyOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemyDebuffApplyOwner/);
});

test('enemy debuff apply follows Rust owner when Rust and JS disagree', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const { mod, calls } = loadFunctionBank(modulePath, () => ({
      owner: 'rust',
      amountAfter: 11,
      turnsAfter: 9,
      active: 1,
    }));
    const ctx = makeContext();

    mod.ExecutePurpleDebuff(ctx, 100);

    const g = ctx.state.globals;
    assert.deepEqual(calls.map((payload) => payload.stat), ['ATK'], `${modulePath} submitted chosen stat`);
    assert.equal(calls[0].amountBefore, 4, `${modulePath} submitted amountBefore`);
    assert.equal(calls[0].turnsBefore, 1, `${modulePath} submitted turnsBefore`);
    assert.equal(calls[0].jsAmountAfter, 6, `${modulePath} submitted JS amount`);
    assert.equal(calls[0].jsTurnsAfter, 3, `${modulePath} submitted JS turns`);
    assert.equal(g.EnemyDebuffs[200].ATK, 11, `${modulePath} Rust-owned amount`);
    assert.equal(g.EnemyDebuffTurns[200].ATK, 9, `${modulePath} Rust-owned turns`);
    assert.deepEqual(Array.from(g.EnemyDebuffSlots[200]), ['ATK'], `${modulePath} slot preserved`);
    assert.equal(g.LastEnemyDebuffApplyOwner.owner, 'rust');
    assert.equal(g.LastEnemyDebuffApplyOwner.amountAfter, 11);
    assert.equal(g.LastEnemyDebuffApplyOwner.turnsAfter, 9);
  }
});
