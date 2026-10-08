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
    baseHeroName: ['Falie','Huun','Runa','Kojonn'][index%4], heroInstanceKey: `owned-${index}`,
    cloneOrdinal: 0, cloneLabel: '', canonicalIndex: index,
    hp: 20 + index, maxHP: 40 + index,
    ATK: 10 + index, DEF: 8, MAG: 12, RES: 9, SPD: 20 - index,
    attackType: 'melee', ...overrides,
  };
}

function productionPartyMembers() {
  const configSource = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'state', 'heroScreenConfig.js'), 'utf8')
    .replace(/^export \{[^\n]+\} from [^\n]+\n/gm, '')
    .replace(/^export \{[^\n]+\};\n/gm, '')
    .replace(/^export /gm, '');
  const configContext = { module: { exports: {} } };
  vm.runInNewContext(`${configSource}\nmodule.exports = { CANONICAL_HERO_ROSTER };`, configContext);
  const runtimeSource = fs.readFileSync(path.join(systems, 'devToolingRuntime.js'), 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/^export \{[\s\S]*?\};\n/gm, '')
    .replace(/^export /gm, '');
  const runtimeContext = { module: { exports: {} }, normalizeCombatOrientation: value => value || 'left-wise', window: { addEventListener() {} }, document: { getElementById() { return null; } } };
  vm.runInNewContext(`${runtimeSource}\nmodule.exports = { createDevToolingRuntime };`, runtimeContext);
  const runtime = runtimeContext.module.exports.createDevToolingRuntime({
    state: { globals: {}, entities: [] }, gameState: {},
    CANONICAL_HERO_ROSTER: configContext.module.exports.CANONICAL_HERO_ROSTER,
    getLayoutState: () => null,
  });
  const slots = runtime.createDefaultDevToolingConfig().heroSlots;
  return runtime.buildConfiguredCombatPartyMembers(slots).heroMembers;
}

async function initialize(heroMembers, escortMember = null, withEnemy = false, {
  continuousStage = null, enemyRows = null, encounterSeed = 0, encounterSeedExplicit = false, generatedEncounterSeed = 123,
} = {}) {
  const { resetCombatSessionConditions } = await import(pathToFileURL(path.join(systems, 'combatSessionReset.mjs')));
  const filename = path.join(systems, 'combatSessionInitializer.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/^export /gm, '');
  // Match the existing browser-module test convention without changing module packaging.
  const context = {
    module: { exports: {} }, resetCombatSessionConditions, crypto:require('node:crypto').webcrypto,
    ...require('../web-runner/src/core/heroProgression.mjs'),
    ...require('../web-runner/src/core/routineEnemyScaling.mjs'),
    buildContinuousCombatSpawnPlan: require('../web-runner/src/core/continuousCombatStage.mjs').buildContinuousCombatSpawnPlan,
    getContinuousCombatPartyCP: require('../web-runner/src/core/continuousCombatStage.mjs').getContinuousCombatPartyCP,
    DEV_TOOL_EMPTY_SLOT: '', DEV_TOOL_RANDOM_ENEMY_SLOT: '__RANDOM__',
    runtimeDebugLogging: { startupDebugLog() {} },
  };
  vm.runInNewContext(source + '\nmodule.exports = { createCombatSessionInitializer };', context, { filename });
  const state = { globals: continuousStage ? {
    ContinuousCombatStageLoop: 1, ContinuousCombatStage: continuousStage, EncounterMaxSlots: 36,
    EncounterSeed: encounterSeed, EncounterSeedExplicit: encounterSeedExplicit ? 1 : 0,
  } : {}, entities: [] };
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
      if (name === 'SpawnEnemy') {
        const data=args[0];
        const enemy={uid:state.globals.NextUID++,kind:'enemy',name:data.name,hp:data.HP,maxHP:data.HP,stats:{ATK:data.ATK,DEF:data.DEF,MAG:data.MAG,RES:data.RES,SPD:data.SPD},slotIndex:args[1]};
        state.entities.push(enemy);return enemy;
      }
    },
    assertCombatLayoutDev() {},
    computeCombatPower: require('../web-runner/src/core/combatPower.mjs').computeCombatPower,
    createSeededRng: () => () => 0,
    resetBootstrapRngSession() {},
    generateEncounterSeed: () => generatedEncounterSeed,
    deriveCombatRuntimeRngSeed: seed => seed,
    installCombatRuntimeRandom() {},
    getConfiguredHeroSlots: () => heroMembers.map(hero => hero?.instanceName || ''),
    readEscortPartyConfig: () => escortMember,
    buildConfiguredCombatPartyMembers: () => ({ heroMembers, escortMember }),
    getConfiguredEnemySlots: () => ['TestEnemy'],
    syncFromGlobals() { gameState.partyHP=Array(6).fill(0);gameState.partyMaxHP=Array(6).fill(0);for(const h of state.entities.filter(a=>a.kind==='hero')){gameState.partyHP[h.heroDisplaySlot]=h.hp;gameState.partyMaxHP[h.heroDisplaySlot]=h.maxHP;} },
  });
  init(enemyRows || (withEnemy ? [{ name: 'TestEnemy', HP: 25, ATK: 5, DEF: 2 }] : []));
  return { state, gameState, calls };
}

test('fresh continuous initializer pads weak packs and finalize preserves each planned sector', async () => {
  const { buildContinuousCombatSpawnPlan, createContinuousCombatStageState, finalizeContinuousCombatProduction, getContinuousCombatPartyCP } = await import('../web-runner/src/core/continuousCombatStage.mjs');
  const rows=['Gobloc','Skeleton'].map(name=>({name,HP:1,ATK:1,DEF:1,MAG:1,RES:1,SPD:1}));
  const {state}=await initialize(productionPartyMembers(),null,false,{continuousStage:createContinuousCombatStageState(31),enemyRows:rows});
  const initialEnemies=state.entities.filter(actor=>actor.kind==='enemy');
  assert.equal(state.globals.ContinuousCombatStage.seed, 123, 'fresh stage padding follows the seed selected after beforeInit configured the stage');
  assert.ok(initialEnemies.length>12&&initialEnemies.length<=36);
  const expectedPlan=buildContinuousCombatSpawnPlan(state.globals.EnemyData,state.globals.ContinuousCombatStage,{partyCP:getContinuousCombatPartyCP(state.entities)});
  assert.equal(JSON.stringify(initialEnemies.map(actor=>[actor.continuousStageSectorIndex,actor.continuousStageEntryOrder,actor.continuousStageSectorSize])),JSON.stringify(expectedPlan.map(entry=>[entry.sectorIndex,entry.entryOrder,entry.sectorSize])),'the fresh seed is applied before the initializer builds the spawn plan');
  assert.ok(initialEnemies.every(actor=>Number.isInteger(actor.continuousStageSectorIndex)),'initializer keeps the spawn plan sector on each created actor');
  assert.equal(finalizeContinuousCombatProduction(state.globals,state.entities),true);
  const sectors=new Map();
  for(const enemy of state.entities.filter(actor=>actor.kind==='enemy')) {
    const sector=enemy.streamSectorIndex%6;
    const pack=sectors.get(sector)||[];pack.push(enemy);sectors.set(sector,pack);
    assert.equal(enemy.continuousStageSectorIndex,undefined,'initializer metadata is consumed by production finalization');
  }
  assert.equal(sectors.size,6);
  assert.ok([...sectors.values()].every(pack=>pack.length>=3&&pack.length<=6));
  for(const pack of sectors.values())assert.deepEqual(pack.map(enemy=>enemy.streamEntryOrder).sort((a,b)=>a-b),Array.from({length:pack.length},(_,index)=>index));
});

test('continuous initializer applies an explicit QA encounter seed to pack-count randomness', async () => {
  const { buildContinuousCombatSpawnPlan, createContinuousCombatStageState, getContinuousCombatPartyCP } = await import('../web-runner/src/core/continuousCombatStage.mjs');
  const rows=['Gobloc','Skeleton'].map(name=>({name,HP:1,ATK:1,DEF:1,MAG:1,RES:1,SPD:1}));
  const {state}=await initialize(productionPartyMembers(),null,false,{
    continuousStage:createContinuousCombatStageState(31),enemyRows:rows,encounterSeed:77,encounterSeedExplicit:true,generatedEncounterSeed:123,
  });
  assert.equal(state.globals.EncounterSeed,77,'an explicit QA seed bypasses fresh seed generation');
  assert.equal(state.globals.ContinuousCombatStage.seed,77,'pack-count randomness uses that same explicit QA seed');
  const expectedPlan=buildContinuousCombatSpawnPlan(state.globals.EnemyData,state.globals.ContinuousCombatStage,{partyCP:getContinuousCombatPartyCP(state.entities)});
  const plannedActors=state.entities.filter(actor=>actor.kind==='enemy');
  assert.equal(JSON.stringify(plannedActors.map(actor=>[actor.continuousStageSectorIndex,actor.continuousStageEntryOrder,actor.continuousStageSectorSize])),JSON.stringify(expectedPlan.map(entry=>[entry.sectorIndex,entry.entryOrder,entry.sectorSize])));
});

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
      const expected=require('../web-runner/src/core/heroProgression.mjs').newHeroProgress(input.baseHeroName);
      assert.equal(actor.hp, expected.hp);
      assert.equal(actor.maxHP, expected.maxHP);
      for (const stat of ['ATK', 'DEF', 'MAG', 'RES', 'SPD']) assert.equal(actor.stats[stat], expected.stats[stat]);
      assert.equal(gameState.partyHP[i], expected.hp);
      assert.equal(gameState.partyMaxHP[i], expected.maxHP);
    });
    assert.equal(state.globals.NextUID, count + 1);
    assert.equal(state.globals.PartyHP, state.entities.reduce((sum, actor) => sum + actor.hp, 0));
    assert.equal(JSON.stringify(members), before);
    assert.ok(calls.includes('InitPartyHPFromHeroes'));
  });
}

test('production starting party maps canonical identities', async () => {
  const { state } = await initialize(productionPartyMembers());
  const definitions = require('../web-runner/src/core/heroDefinitions.mjs');
  const mapping = state.entities.map((hero, index) => {
    const definition = definitions.heroDefinition(hero);
    return [index, hero.uid, hero.name, definition.name, definition.role, definition.key];
  });
  assert.deepEqual(JSON.parse(JSON.stringify(mapping)), [
    [0, 1, 'Falie', 'Fara', 'Tank', 'Falie'],
    [1, 2, 'Huun', 'Hondo', 'Damage', 'Huun'],
    [2, 3, 'Runa', 'Runa', 'Mage', 'Runa'],
    [3, 4, 'Kojonn', 'Kaja', 'Support', 'Kojonn'],
  ]);
});

test('sparse formation slots retain their indexes and exclude slots beyond six', async () => {
  const slots = [null, member(1), null, null, null, member(5), member(6)];
  const { state, gameState } = await initialize(slots);
  assert.deepEqual(Array.from(state.entities, actor => actor.uid), [2, 6]);
  assert.deepEqual(Array.from(state.entities, actor => actor.heroDisplaySlot), [1, 5]);
  const expectedHP=[0, ...state.entities.map(actor=>actor.hp)];
  assert.deepEqual(Array.from(gameState.partyHP), [0, expectedHP[1], 0, 0, 0, expectedHP[2]]);
  assert.deepEqual(Array.from(gameState.partyMaxHP), [0, expectedHP[1], 0, 0, 0, expectedHP[2]]);
  assert.equal(state.globals.NextUID, 7);
});

test('canonical progression owns HP for every configured hero', async () => {
  const { state } = await initialize([
    member(0, { hp: 0 }), member(1, { hp: -1 }),
    member(2, { hp: NaN }), member(3, { hp: 999 }),
    member(4, { maxHP: 0, hp: 9 }), member(5, { maxHP: 30, hp: 999 }),
  ]);
  assert.equal(JSON.stringify(Array.from(state.entities, actor => [actor.hp, actor.maxHP])), JSON.stringify(state.entities.map(actor => { const p=require('../web-runner/src/core/heroProgression.mjs').newHeroProgress(actor.baseHeroName); return [p.hp,p.maxHP]; })));
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
