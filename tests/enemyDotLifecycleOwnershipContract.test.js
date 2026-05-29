const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

function loadFunctionBank(modulePath, lifecycleOwner) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  ProcessEnemyTurnDamageOverTime,
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
    __ORKA_ENEMY_DOT_LIFECYCLE_OWNER__: lifecycleOwner,
    __ORKA_ENEMY_DOT_TICK_OWNER__: () => ({
      owner: 'rust',
      damage: 7,
      totalDamageRemaining: 23,
      remainingFires: 2,
      nextFireTurnSerial: 17,
    }),
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeContext(overrides = {}) {
  const enemy = {
    uid: 200,
    kind: 'enemy',
    name: 'Marid',
    hp: 100,
    maxHP: 100,
    x: 20,
    y: 20,
  };
  return {
    state: {
      globals: {
        time: 0,
        CombatLog: [],
        SpawnDamageText: 0,
        TurnSerial: 10,
        EnemyDamageOverTime: [{
          targetUID: enemy.uid,
          sourceUID: 100,
          remainingFires: 3,
          totalDamageRemaining: 30,
          cadence: 'turn',
          firesEveryTurns: 2,
          nextFireTurnSerial: 99,
          lastProcessedTurnSerial: 9,
          effectName: 'Blight',
          ...overrides.dot,
        }],
        ...overrides.globals,
      },
      entities: overrides.entities || [enemy],
    },
  };
}

test('simulation core module exposes a Rust-owned enemy DoT lifecycle marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_ENEMY_DOT_LIFECYCLE_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreEnemyDotLifecycleResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.enemyDotLifecycleOwner/);
  assert.match(shadowSrc, /enemyDotLifecycleOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemyDotLifecycleOwner/);
});

test('enemy DoT lifecycle follows Rust owner process decision when JS would skip', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const mod = loadFunctionBank(modulePath, () => ({ owner: 'rust', action: 2 }));
    const ctx = makeContext();

    const appliedTicks = mod.ProcessEnemyTurnDamageOverTime(ctx, 200);
    const enemy = ctx.state.entities.find((entity) => entity.uid === 200);
    const dot = ctx.state.globals.EnemyDamageOverTime[0];

    assert.equal(appliedTicks, 1, `${modulePath} Rust-owned lifecycle processes`);
    assert.equal(enemy.hp, 93, `${modulePath} Rust-owned tick damage`);
    assert.equal(dot.nextFireTurnSerial, 17, `${modulePath} Rust-owned tick next turn`);
    assert.equal(ctx.state.globals.LastEnemyDotLifecycleOwner.owner, 'rust');
    assert.equal(ctx.state.globals.LastEnemyDotLifecycleOwner.action, 2);
  }
});

test('enemy DoT lifecycle follows Rust owner remove decision when JS would keep', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const mod = loadFunctionBank(modulePath, () => ({ owner: 'rust', action: 1 }));
    const ctx = makeContext();

    const appliedTicks = mod.ProcessEnemyTurnDamageOverTime(ctx, 200);

    assert.equal(appliedTicks, 0, `${modulePath} no tick when Rust removes`);
    assert.equal(ctx.state.globals.EnemyDamageOverTime, undefined, `${modulePath} Rust-owned lifecycle removes`);
    assert.equal(ctx.state.globals.LastEnemyDotLifecycleOwner.owner, 'rust');
    assert.equal(ctx.state.globals.LastEnemyDotLifecycleOwner.action, 1);
  }
});
