const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

function loadFunctionBank(modulePath, { applyOwner, slotOwner }) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ExecutePurpleDebuff,
  decayEnemyDebuffsForTurn,
};`;
  const applyCalls = [];
  const slotCalls = [];
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
      applyCalls.push(payload);
      return applyOwner(payload);
    },
    __ORKA_ENEMY_DEBUFF_SLOT_OWNER__: (payload) => {
      slotCalls.push(payload);
      return slotOwner(payload);
    },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return { mod: context.module.exports, applyCalls, slotCalls };
}

function makeApplyContext() {
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
        RuntimeRandom: () => 0.7,
        RoundActive: 1,
        CombatLog: [],
        EnemyDebuffs: {
          200: { ATK: 4, DEF: 3, MAG: 2 },
        },
        EnemyDebuffTurns: {
          200: { ATK: 3, DEF: 3, MAG: 3 },
        },
        EnemyDebuffSlots: {
          200: ['ATK', 'DEF', 'MAG'],
        },
      },
      entities: [actor, enemy],
    },
  };
}

test('simulation core module exposes a Rust-owned enemy debuff slot transition marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_ENEMY_DEBUFF_SLOT_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreEnemyDebuffSlotTransition/);
  assert.match(shadowSrc, /simulationCore\.startup\.enemyDebuffSlotOwner/);
  assert.match(shadowSrc, /enemyDebuffSlotOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemyDebuffSlotOwner/);
});

test('functionBank mirrors Rust-owned enemy debuff slot transition without Rust imports', () => {
  for (const filePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const src = fs.readFileSync(filePath, 'utf8');

    assert.match(src, /function maybeResolveEnemyDebuffSlotOwner/);
    assert.match(src, /function applyEnemyDebuffSlotDecision/);
    assert.match(src, /enemyDebuffSlotOwnerHook/);
    assert.match(src, /__ORKA_ENEMY_DEBUFF_SLOT_OWNER__/);
    assert.match(src, /LastEnemyDebuffSlotOwner/);
  }
});

test('enemy debuff slot transition follows Rust owner when Rust and JS disagree', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const { mod, applyCalls, slotCalls } = loadFunctionBank(modulePath, {
      applyOwner: () => ({
        owner: 'rust',
        amountAfter: 2,
        turnsAfter: 3,
        active: 1,
      }),
      slotOwner: () => ({
        owner: 'rust',
        action: 2,
        dropSlotIndex: 1,
        appendSlotIndex: 4,
      }),
    });
    const ctx = makeApplyContext();

    mod.ExecutePurpleDebuff(ctx, 100);

    const g = ctx.state.globals;
    assert.deepEqual(applyCalls.map((payload) => payload.stat), ['SPD'], `${modulePath} submitted chosen stat`);
    assert.deepEqual(slotCalls.map((payload) => payload.stat), ['SPD'], `${modulePath} submitted slot stat`);
    assert.equal(slotCalls[0].statIndex, 4, `${modulePath} submitted stat index`);
    assert.equal(slotCalls[0].slotCount, 3, `${modulePath} submitted slot count`);
    assert.equal(slotCalls[0].slot0Index, 0, `${modulePath} submitted slot 0`);
    assert.equal(slotCalls[0].slot1Index, 1, `${modulePath} submitted slot 1`);
    assert.equal(slotCalls[0].slot2Index, 2, `${modulePath} submitted slot 2`);
    assert.equal(slotCalls[0].jsAction, 2, `${modulePath} submitted JS action`);
    assert.equal(slotCalls[0].jsDropSlotIndex, 0, `${modulePath} submitted JS drop`);
    assert.equal(slotCalls[0].jsAppendSlotIndex, 4, `${modulePath} submitted JS append`);
    assert.deepEqual(Array.from(g.EnemyDebuffSlots[200]), ['ATK', 'MAG', 'SPD'], `${modulePath} Rust-owned slots`);
    assert.equal(g.EnemyDebuffs[200].ATK, 4, `${modulePath} preserved ATK`);
    assert.equal(g.EnemyDebuffs[200].DEF, 0, `${modulePath} Rust-dropped DEF`);
    assert.equal(g.EnemyDebuffs[200].SPD, 2, `${modulePath} Rust-appended SPD`);
    assert.equal(g.EnemyDebuffTurns[200].DEF, 0, `${modulePath} Rust-cleared DEF turns`);
    assert.equal(g.EnemyDebuffTurns[200].SPD, 3, `${modulePath} Rust-set SPD turns`);
    assert.equal(g.LastEnemyDebuffSlotOwner.owner, 'rust');
    assert.equal(g.LastEnemyDebuffSlotOwner.action, 2);
    assert.equal(g.LastEnemyDebuffSlotOwner.dropSlotIndex, 1);
    assert.equal(g.LastEnemyDebuffSlotOwner.appendSlotIndex, 4);
  }
});
