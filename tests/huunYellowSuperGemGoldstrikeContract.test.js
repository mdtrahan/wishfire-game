const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadSuperGemRuntime() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'superGemRuntime.js'), 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { activateSuperGemEffect };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

function createContext({ rollUnit, selectedEnemyUID = 101 }) {
  const actor = { uid: 2, name: 'Huun', kind: 'hero', attackType: 'melee' };
  const enemies = [
    { uid: 101, name: 'Djinn', kind: 'enemy', hp: 50 },
    { uid: 102, name: 'Marid', kind: 'enemy', hp: 50 },
  ];
  const state = {
    globals: {
      time: 8,
      goldTotal: 15,
      RuntimeRandom: () => rollUnit,
    },
    entities: [actor, ...enemies],
  };
  const calls = [];
  const callFunctionWithContext = (_ctx, name, ...args) => {
    calls.push({ name, args });
    if (name === 'GetActorByUID') return state.entities.find((entity) => Number(entity.uid) === Number(args[0])) || null;
    if (name === 'StartHeroLunge') return true;
    if (name === 'LogCombat') return undefined;
    if (name === 'CalculateDamage') throw new Error('Huun yellow goldstrike should use banked gold and consumed yellow gems');
    return 0;
  };
  return { actor, state, calls, callFunctionWithContext, selectedEnemyUID };
}

function activate({ rollUnit, selectedEnemyUID = 101 }) {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const ctx = createContext({ rollUnit, selectedEnemyUID });
  const activated = activateSuperGemEffect({
    superGem: { baseColor: 3 },
    actorUID: ctx.actor.uid,
    selectedEnemyUID: ctx.selectedEnemyUID,
    state: ctx.state,
    callFunctionWithContext: ctx.callFunctionWithContext,
    fnContext: {},
    sourceItems: [],
    consumedColorGemCount: 10,
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  });
  return { ...ctx, activated };
}

test('Huun yellow super-gem low roll deals banked gold plus consumed yellow board value', () => {
  const { state, calls, activated } = activate({ rollUnit: 0.30 });

  assert.equal(activated, true);
  assert.equal(state.globals.goldTotal, 25);
  assert.equal(state.globals.PendingHeroHits.length, 1);
  assert.equal(state.globals.PendingHeroHits[0].targetUID, 101);
  assert.equal(state.globals.PendingHeroHits[0].finalDmg, 25);
  assert.equal(state.globals.PendingHeroHits[0].huunGoldstrikeRoll, 30);
  assert.equal(state.globals.PendingHeroHits[0].huunGoldstrikeBranch, 'low');
  assert.equal(Number(state.globals.PendingHeroHits[0].superGemClusterApplyTotalOnHit || 0), 0);
  assert.equal(state.globals.LastHuunYellowSuperGemGoldstrike.baseDamage, 25);
  assert.ok(calls.some((call) => call.name === 'LogCombat' && /Huun rolled 30/.test(String(call.args[0]))));
});

test('Huun yellow super-gem cannot be stolen by a stale CurrentHeroUID', () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const falie = { uid: 1, name: 'Falie', kind: 'hero', attackType: 'melee' };
  const huun = { uid: 2, name: 'Huun', kind: 'hero', attackType: 'melee' };
  const enemy = { uid: 101, name: 'Djinn', kind: 'enemy', hp: 50 };
  const state = {
    globals: {
      time: 8,
      goldTotal: 15,
      CurrentHeroUID: huun.uid,
      RuntimeRandom: () => 0,
    },
    entities: [falie, huun, enemy],
  };
  const calls = [];
  const activated = activateSuperGemEffect({
    superGem: { baseColor: 3 },
    actorUID: falie.uid,
    selectedEnemyUID: enemy.uid,
    state,
    callFunctionWithContext: (_ctx, name, ...args) => {
      calls.push({ name, args });
      if (name === 'GetActorByUID') return state.entities.find((entity) => Number(entity.uid) === Number(args[0])) || null;
      if (name === 'StartHeroLunge') return true;
      if (name === 'LogCombat') return undefined;
      if (name === 'CalculateDamage') throw new Error('non-Huun yellow supergem should not calculate combat damage');
      return 0;
    },
    fnContext: {},
    sourceItems: [],
    consumedColorGemCount: 10,
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  });

  assert.equal(activated, true);
  assert.equal(state.globals.goldTotal, 23);
  assert.equal(state.globals.PendingHeroHits, undefined);
  assert.equal(state.globals.LastHuunYellowSuperGemGoldstrike, undefined);
  assert.ok(!calls.some((call) => call.name === 'StartHeroLunge'));
  assert.ok(calls.some((call) => call.name === 'LogCombat' && /Falie found 8 gold/.test(String(call.args[0]))));
});

test('Huun yellow super-gem high roll triples bank plus consumed yellow board value', () => {
  const { state, activated } = activate({ rollUnit: 0.60 });

  assert.equal(activated, true);
  assert.equal(state.globals.PendingHeroHits.length, 1);
  assert.equal(state.globals.PendingHeroHits[0].targetUID, 101);
  assert.equal(state.globals.PendingHeroHits[0].finalDmg, 75);
  assert.equal(state.globals.PendingHeroHits[0].huunGoldstrikeRoll, 60);
  assert.equal(state.globals.PendingHeroHits[0].huunGoldstrikeBranch, 'high');
  assert.equal(Number(state.globals.PendingHeroHits[0].superGemClusterApplyTotalOnHit || 0), 0);
});

test('Huun yellow super-gem roll boundaries force low high and jackpot branches', () => {
  const cases = [
    { rollUnit: 0.504, expectedRoll: 50, expectedBranch: 'low', expectedDamage: 25, expectedTargets: 1 },
    { rollUnit: 0.505, expectedRoll: 51, expectedBranch: 'high', expectedDamage: 75, expectedTargets: 1 },
    { rollUnit: 0.985, expectedRoll: 99, expectedBranch: 'high', expectedDamage: 75, expectedTargets: 1 },
    { rollUnit: 0.999, expectedRoll: 100, expectedBranch: 'jackpot', expectedDamage: 100, expectedTargets: 2 },
  ];

  for (const expected of cases) {
    const { state, activated } = activate({ rollUnit: expected.rollUnit });
    const goldstrike = state.globals.LastHuunYellowSuperGemGoldstrike;

    assert.equal(activated, true, `roll ${expected.expectedRoll} should activate`);
    assert.equal(goldstrike.roll, expected.expectedRoll);
    assert.equal(goldstrike.branch, expected.expectedBranch);
    assert.equal(goldstrike.finalDmg, expected.expectedDamage);
    assert.equal(goldstrike.targetCount, expected.expectedTargets);
    assert.equal(state.globals.PendingHeroHits.length, expected.expectedTargets);
    assert.ok(state.globals.PendingHeroHits.every((hit) => hit.finalDmg === expected.expectedDamage));
    assert.ok(state.globals.PendingHeroHits.every((hit) => hit.huunGoldstrikeBranch === expected.expectedBranch));
  }
});

test('Huun yellow super-gem perfect roll deals 100 damage to all enemies', () => {
  const { state, calls, activated } = activate({ rollUnit: 0.999 });

  assert.equal(activated, true);
  assert.equal(state.globals.PendingHeroHits.length, 2);
  assert.equal(JSON.stringify(state.globals.PendingHeroHits.map((hit) => hit.targetUID)), JSON.stringify([101, 102]));
  assert.equal(JSON.stringify(state.globals.PendingHeroHits.map((hit) => hit.finalDmg)), JSON.stringify([100, 100]));
  assert.ok(state.globals.PendingHeroHits.every((hit) => hit.huunGoldstrikeRoll === 100));
  assert.ok(state.globals.PendingHeroHits.every((hit) => hit.huunGoldstrikeBranch === 'jackpot'));
  assert.equal(state.globals.LastHuunYellowSuperGemGoldstrike.targetCount, 2);
  assert.ok(calls.some((call) => call.name === 'LogCombat' && /perfect goldstrike/.test(String(call.args[0]))));
});

test('non-Huun yellow super-gem keeps the standard gold award behavior', () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const actor = { uid: 4, name: 'Falie', kind: 'hero' };
  const state = {
    globals: {
      time: 8,
      goldTotal: 15,
      RuntimeRandom: () => 0,
    },
    entities: [actor],
  };
  const calls = [];
  const activated = activateSuperGemEffect({
    superGem: { baseColor: 3 },
    actorUID: actor.uid,
    selectedEnemyUID: 0,
    state,
    callFunctionWithContext: (_ctx, name, ...args) => {
      calls.push({ name, args });
      if (name === 'GetActorByUID') return actor;
      return undefined;
    },
    fnContext: {},
    sourceItems: [],
    consumedColorGemCount: 10,
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  });

  assert.equal(activated, true);
  assert.equal(state.globals.goldTotal, 23);
  assert.equal(state.globals.PendingHeroHits, undefined);
  assert.ok(calls.some((call) => call.name === 'LogCombat' && /found 8 gold/.test(String(call.args[0]))));
});
