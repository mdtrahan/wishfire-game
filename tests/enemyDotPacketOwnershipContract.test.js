const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

function loadFunctionBank(modulePath, packetOwner) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  QueueEnemyDamageOverTime,
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
    createEnemyDotPacketSimulationPacket: (payload) => {
      const { ownerHook, ...submitted } = payload;
      const result = ownerHook(submitted);
      return {
        ...result,
        simulationCoreRequest: {
          action: { type: 'status.enemyDotPacket' },
        },
        simulationCoreResponse: {
          result: 'enemy_dot_packet',
          diagnostics: submitted,
        },
      };
    },
    __ORKA_ENEMY_DOT_PACKET_OWNER__: packetOwner,
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeContext() {
  const actor = {
    uid: 100,
    kind: 'hero',
    name: 'Kojonn',
    hp: 40,
  };
  const enemy = {
    uid: 200,
    kind: 'enemy',
    name: 'Marid',
    hp: 100,
    maxHP: 100,
  };
  return {
    state: {
      globals: {
        RegenTickCounter: 4,
        TurnSerial: 20,
        CombatLog: [],
        EnemyDamageOverTime: [{
          targetUID: enemy.uid,
          sourceUID: actor.uid,
          remainingFires: 1,
          totalDamageRemaining: 1,
          cadence: 'turn',
          effectName: 'RiftBurn',
          taintedGroundZoneId: 'zone-a',
        }],
      },
      entities: [actor, enemy],
    },
  };
}

test('simulation core module exposes a Rust-owned enemy DoT packet marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_ENEMY_DOT_PACKET_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreEnemyDotPacketResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.enemyDotPacketOwner/);
  assert.match(shadowSrc, /enemyDotPacketOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemyDotPacketOwner/);
});

test('enemy DoT queue packet follows Rust owner when Rust and JS disagree', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const mod = loadFunctionBank(modulePath, () => ({
      owner: 'rust',
      targetUID: 200,
      sourceUID: 100,
      remainingFires: 9,
      totalDamageRemaining: 77,
      firesEveryTicks: 8,
      nextFireTick: 123,
      firesEveryTurns: 6,
      nextFireTurnSerial: 456,
      lastProcessedTurnSerial: 321,
      cadence: 'turn',
      effectName: 'RiftBurn',
      taintedGroundZoneId: 'zone-a',
    }));
    const ctx = makeContext();

    const applied = mod.QueueEnemyDamageOverTime(ctx, 100, 200, 25, {
      totalTicks: 3,
      cadence: 'turn',
      effectName: 'RiftBurn',
      taintedGroundZoneId: 'zone-a',
    });
    const dot = ctx.state.globals.EnemyDamageOverTime[0];

    assert.equal(applied, 1, `${modulePath} queued packet`);
    assert.equal(ctx.state.globals.EnemyDamageOverTime.length, 1, `${modulePath} reset matching packet`);
    assert.equal(dot.remainingFires, 9, `${modulePath} Rust-owned remainingFires`);
    assert.equal(dot.totalDamageRemaining, 77, `${modulePath} Rust-owned totalDamageRemaining`);
    assert.equal(dot.firesEveryTicks, 8, `${modulePath} Rust-owned firesEveryTicks`);
    assert.equal(dot.nextFireTick, 123, `${modulePath} Rust-owned nextFireTick`);
    assert.equal(dot.firesEveryTurns, 6, `${modulePath} Rust-owned firesEveryTurns`);
    assert.equal(dot.nextFireTurnSerial, 456, `${modulePath} Rust-owned nextFireTurnSerial`);
    assert.equal(dot.lastProcessedTurnSerial, 321, `${modulePath} Rust-owned lastProcessedTurnSerial`);
    assert.equal(dot.cadence, 'turn', `${modulePath} JS string field preserved`);
    assert.equal(dot.effectName, 'RiftBurn', `${modulePath} JS effect field preserved`);
    assert.equal(dot.taintedGroundZoneId, 'zone-a', `${modulePath} JS zone field preserved`);
    assert.equal(ctx.state.globals.LastEnemyDotPacketOwner.owner, 'rust');
    assert.equal(ctx.state.globals.LastEnemyDotPacketOwner.totalDamageRemaining, 77);
    assert.equal(ctx.state.globals.LastEnemyDotApplicationPacket.owner, 'rust');
    assert.equal(ctx.state.globals.LastEnemyDotApplicationPacket.actionType, 'status.enemyDotPacket');
  }
});
