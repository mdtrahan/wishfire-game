const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'singleHitRules.mjs');

function loadFunctionBank(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  CalculateDamage,
  ApplyDamageToTarget,
};`;
  const context = {
    console,
    Math,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
    createSingleHitSimulationPacket: (payload) => {
      const { ownerHook, ...submitted } = payload;
      const result = ownerHook(submitted);
      return {
        ...result,
        simulationCoreRequest: {
          action: { type: 'combat.singleHit' },
        },
        simulationCoreResponse: {
          result: 'single_hit',
          diagnostics: submitted,
        },
      };
    },
    __ORKA_SINGLE_HIT_OWNER__: ({ targetHp }) => ({
      owner: 'rust',
      damage: 19,
      appliedDamage: 7,
      afterHp: Math.max(0, Number(targetHp || 0) - 7),
    }),
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function withRandomSequence(sequence, fn) {
  const original = Math.random;
  let index = 0;
  Math.random = () => {
    const value = sequence[Math.min(index, sequence.length - 1)];
    index += 1;
    return value;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function makeContext() {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: 'Falie',
    heroIndex: 0,
    hp: 40,
    maxHP: 40,
    ATK: 4,
    DEF: 0,
    MAG: 2,
    RES: 0,
    SPD: 1,
    x: 10,
    y: 10,
    stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
  };
  const enemy = {
    uid: 200,
    kind: 'enemy',
    name: 'Marid',
    hp: 999,
    maxHP: 999,
    ATK: 30,
    DEF: 0,
    MAG: 30,
    RES: 0,
    SPD: 1,
    x: 20,
    y: 20,
    stats: { ATK: 30, DEF: 0, MAG: 30, RES: 0, SPD: 1 },
  };
  return {
    state: {
      globals: {
        time: 0,
        SpawnDamageText: 0,
        CombatActionLines: ['', '', '', ''],
        CombatLog: [],
        PartyHP: 40,
        PartyMaxHP: 40,
        PartyHPByIndex: [40],
        PartyMaxHPByIndex: [40],
        HeroIconPosByIndex: [{ x: 10, y: 10 }],
        TurnOrderArray: [{ uid: enemy.uid, type: 1, spd: 1 }],
        CurrentTurnIndex: 0,
        IsAOEMatch: 0,
      },
      entities: [hero, enemy],
    },
  };
}

test('simulation core module exposes a Rust-owned single-hit transaction marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_SINGLE_HIT_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreSingleHitResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.singleHitOwner/);
  assert.match(shadowSrc, /singleHitOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowSingleHitOwner/);
});

test('single-hit packet follows Rust owner when Rust and JS disagree', async () => {
  const { createSingleHitSimulationPacket } = await import(pathToFileURL(rulesPath));
  const packet = createSingleHitSimulationPacket({
    source: 'test.packetizedSingleHit',
    attackerUID: 200,
    targetUID: 100,
    mode: 'melee',
    power: 30,
    resist: 0,
    roll01: 0.5,
    critRoll01: 0.9,
    sourceIsHero: 0,
    heroAoe: 0,
    chainActive: 0,
    chainMultiplier: 1,
    targetHp: 40,
    shield: 0,
    jsDamage: 30,
    jsAppliedDamage: 30,
    jsAfterHp: 10,
    ownerHook: () => ({
      owner: 'rust',
      damage: 19,
      appliedDamage: 7,
      afterHp: 33,
    }),
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.damage, 19);
  assert.equal(packet.appliedDamage, 7);
  assert.equal(packet.afterHp, 33);
  assert.equal(packet.simulationCoreRequest.action.type, 'combat.singleHit');
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'singleHit');
  assert.equal(packet.simulationCoreResponse.result, 'single_hit');
  assert.equal(packet.simulationCoreResponse.nextGameState.combat.lastSingleHit.afterHp, 33);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreRequest)), packet.simulationCoreRequest);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});

test('single-hit ApplyDamageToTarget follows Rust owner when Rust and JS disagree', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const mod = loadFunctionBank(modulePath);
    const ctx = makeContext();
    const jsDamage = withRandomSequence([0.5, 0.9], () => mod.CalculateDamage(ctx, 200, 100, 'melee'));
    assert.notEqual(jsDamage, 19, `${modulePath} test needs JS and Rust sentinel damage to disagree`);

    const applied = mod.ApplyDamageToTarget(ctx, 100, jsDamage);
    const hero = ctx.state.entities.find((entity) => entity.uid === 100);

    assert.equal(applied, 7, `${modulePath} applied damage`);
    assert.equal(hero.hp, 33, `${modulePath} after HP`);
    assert.equal(ctx.state.globals.PartyHP, 33, `${modulePath} party HP`);
    assert.equal(ctx.state.globals.LastSingleHitOwner.owner, 'rust');
    assert.equal(ctx.state.globals.LastSingleHitOwner.damage, 19);
    assert.equal(ctx.state.globals.LastSingleHitPacket.owner, 'rust');
    assert.equal(ctx.state.globals.LastSingleHitPacket.actionType, 'combat.singleHit');
  }
});
