const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const systems = path.join(__dirname, '..', 'web-runner', 'systems');

function member(index, overrides = {}) {
  return {
    name: `Hero ${index}`, instanceName: `hero-${index}`,
    baseHeroName: `definition-${index}`, heroInstanceKey: `owned-${index}`,
    cloneOrdinal: 0, cloneLabel: '', canonicalIndex: index,
    hp: 20 + index, maxHP: 40 + index,
    ATK: 10 + index, DEF: 8, MAG: 12, RES: 9, SPD: 20 - index,
    attackType: 'melee', ...overrides,
  };
}

async function initialize(heroMembers, escortMember = null, withEnemy = false) {
  const { resetCombatSessionConditions } = await import(pathToFileURL(path.join(systems, 'combatSessionReset.mjs')));
  const filename = path.join(systems, 'combatSessionInitializer.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/^export /gm, '');
  // Match the existing browser-module test convention without changing module packaging.
  const context = {
    module: { exports: {} }, resetCombatSessionConditions,
    DEV_TOOL_EMPTY_SLOT: '', DEV_TOOL_RANDOM_ENEMY_SLOT: '__RANDOM__',
    runtimeDebugLogging: { startupDebugLog() {} },
  };
  vm.runInNewContext(source + '\nmodule.exports = { createCombatSessionInitializer };', context, { filename });
  const state = { globals: {}, entities: [] };
  const gameState = {};
  const calls = [];
  const init = context.module.exports.createCombatSessionInitializer({
    state, gameState, fnContext: {},
    callFunctionWithContext(_ctx, name, ...args) {
      calls.push(name);
      if (name === 'InitPartyHPFromHeroes' || name === 'UpdateHeroHPUI') {
        const heroes = state.entities.filter(actor => actor.kind === 'hero');
        state.globals.PartyHP = heroes.reduce((total, hero) => total + hero.hp, 0);
        state.globals.PartyMaxHP = heroes.reduce((total, hero) => total + hero.maxHP, 0);
      }
      if (name === 'SpawnEnemy') state.entities.push({
        uid: state.globals.NextUID++, kind: 'enemy', name: args[0].name,
      });
    },
    assertCombatLayoutDev() {},
    computeCombatPower: (atk, def, hp) => atk + def + hp / 10,
    createSeededRng: () => () => 0,
    resetBootstrapRngSession() {},
    generateEncounterSeed: () => 123,
    deriveCombatRuntimeRngSeed: seed => seed,
    installCombatRuntimeRandom() {},
    getConfiguredHeroSlots: () => heroMembers.map(hero => hero?.instanceName || ''),
    readEscortPartyConfig: () => escortMember,
    buildConfiguredCombatPartyMembers: () => ({ heroMembers, escortMember }),
    getConfiguredEnemySlots: () => ['TestEnemy'],
    syncFromGlobals() {},
  });
  init(withEnemy ? [{ name: 'TestEnemy', HP: 25, ATK: 5, DEF: 2 }] : []);
  return { state, gameState, calls };
}

for (let count = 1; count <= 6; count += 1) {
  test(`initializer constructs every member of a ${count}-hero configured party`, async () => {
    const members = Array.from({ length: count }, (_, i) => member(i));
    const before = JSON.stringify(members);
    const { state, gameState, calls } = await initialize(members);
    assert.equal(state.entities.length, count);
    members.forEach((input, i) => {
      const actor = state.entities[i];
      assert.equal(actor.uid, i + 1);
      assert.equal(actor.heroDisplaySlot, i);
      assert.equal(actor.heroInstanceKey, input.heroInstanceKey);
      assert.equal(actor.baseHeroName, input.baseHeroName);
      assert.equal(actor.name, input.instanceName);
      assert.equal(actor.heroIndex, input.canonicalIndex);
      assert.equal(actor.hp, input.hp);
      assert.equal(actor.maxHP, input.maxHP);
      for (const stat of ['ATK', 'DEF', 'MAG', 'RES', 'SPD']) assert.equal(actor.stats[stat], input[stat]);
      assert.equal(gameState.partyHP[i], input.hp);
      assert.equal(gameState.partyMaxHP[i], input.maxHP);
    });
    assert.equal(state.globals.NextUID, count + 1);
    assert.equal(state.globals.PartyHP, members.reduce((sum, input) => sum + input.hp, 0));
    assert.equal(JSON.stringify(members), before);
    assert.ok(calls.includes('InitPartyHPFromHeroes'));
  });
}

test('sparse formation slots retain their indexes and exclude slots beyond six', async () => {
  const slots = [null, member(1), null, null, null, member(5), member(6)];
  const { state, gameState } = await initialize(slots);
  assert.deepEqual(Array.from(state.entities, actor => actor.uid), [2, 6]);
  assert.deepEqual(Array.from(state.entities, actor => actor.heroDisplaySlot), [1, 5]);
  assert.deepEqual(Array.from(gameState.partyHP), [0, 21, 0, 0, 0, 25]);
  assert.deepEqual(Array.from(gameState.partyMaxHP), [0, 41, 0, 0, 0, 45]);
  assert.equal(state.globals.NextUID, 7);
});

test('fifth and sixth heroes keep existing HP sanitization', async () => {
  const { state } = await initialize([
    member(0, { hp: 0 }), member(1, { hp: -1 }),
    member(2, { hp: NaN }), member(3, { hp: 999 }),
    member(4, { maxHP: 0, hp: 9 }), member(5, { maxHP: 30, hp: 999 }),
  ]);
  assert.deepEqual(Array.from(state.entities, actor => [actor.hp, actor.maxHP]), [
    [0, 40], [41, 41], [42, 42], [43, 43], [1, 1], [30, 30],
  ]);
});

test('escort and spawned enemy IDs follow all six heroes without collisions', async () => {
  const { state } = await initialize(
    Array.from({ length: 6 }, (_, i) => member(i)),
    { name: 'Escort', baseHeroName: 'escort', kind: 'escort', hp: 20, maxHP: 20, heroDisplaySlot: 6 },
    true,
  );
  assert.deepEqual(Array.from(state.entities, actor => actor.uid), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(state.globals.EscortNPCState.uid, 7);
  assert.equal(state.entities[7].kind, 'enemy');
  assert.equal(state.globals.NextUID, 9);
});
