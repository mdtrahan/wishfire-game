const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const superGemRuntimePath = path.join(repoRoot, 'web-runner', 'systems', 'superGemRuntime.js');

function loadFunctionBank() {
  const raw = fs.readFileSync(runtimePath, 'utf8');
  const transformed = raw
    .replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];\n/g, '')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+\{[^}]*\};\n/g, '');
  const names = Array.from(transformed.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g), match => match[1]);
  const uniqueNames = [...new Set(names)];
  const context = {
    console,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Date,
    structuredClone: (value) => JSON.parse(JSON.stringify(value)),
    document: { documentElement: { setAttribute() {}, getAttribute() { return null; } } },
    globalThis: {},
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(`${transformed}\nmodule.exports = { ${uniqueNames.join(', ')} };`, context, { filename: runtimePath });
  return context.module.exports;
}

function loadSuperGemRuntime() {
  const src = fs.readFileSync(superGemRuntimePath, 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { activateSuperGemEffect, executePendingSuperGemAction };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: superGemRuntimePath });
  return context.module.exports;
}

function makeContext({ heroName = 'Falie', heroUID = 100, rollUnit = 0, activeDestiny = true } = {}) {
  const hero = {
    uid: heroUID,
    name: heroName,
    kind: 'hero',
    hp: 60,
    maxHP: 100,
    heroIndex: 0,
    attackType: 'melee',
    x: 100,
    y: 100,
  };
  const enemies = [
    { uid: 201, name: 'Gobloc', kind: 'enemy', hp: 500, maxHP: 500, slotIndex: 0, x: 240, y: 90 },
    { uid: 202, name: 'Lizardo', kind: 'enemy', hp: 500, maxHP: 500, slotIndex: 1, x: 240, y: 140 },
    { uid: 203, name: 'Djinn', kind: 'enemy', hp: 500, maxHP: 500, slotIndex: 2, x: 240, y: 190 },
  ];
  const sharedSkills = [
    { id: 'party_chain_strike_i', definitionId: 'party_chain_strike_i', selectionCount: 1 },
    { id: 'party_chain_strike_ii', definitionId: 'party_chain_strike_ii', selectionCount: 1 },
  ];
  if (activeDestiny) {
    sharedSkills.push({ id: 'party_destiny', definitionId: 'party_destiny', selectionCount: 1 });
  }
  const state = {
    globals: {
      time: 3,
      goldTotal: 15,
      SelectedEnemyUID: 201,
      RuntimeRandom: () => rollUnit,
      SpawnDamageText: 0,
      PartyHP: 60,
      PartyMaxHP: 100,
      PartyHPByIndex: [60],
      PartyMaxHPByIndex: [100],
      TurnOrderArray: [{ uid: heroUID, type: 0, spd: 10 }],
      CurrentTurnIndex: 0,
      PowerAmpByUID: {},
      SessionSkillsByHeroUID: {
        __party_shared__: sharedSkills,
      },
    },
    entities: [hero, ...enemies],
  };
  const functionBank = loadFunctionBank();
  const ctx = {
    state,
    callFunction(name, ...args) {
      if (name === 'StartHeroLunge') return true;
      if (name === 'CalculateDamage') return 60;
      const fn = functionBank[name];
      if (typeof fn !== 'function') return undefined;
      return fn(ctx, ...args);
    },
  };
  const callFunctionWithContext = (fnContext, name, ...args) => fnContext.callFunction(name, ...args);
  return { ctx, state, hero, enemies, functionBank, callFunctionWithContext };
}

test('red super-gem cluster remains subject to Chain Strike II and Destiny per real hit', () => {
  const runtime = loadSuperGemRuntime();
  const { ctx, state, hero, functionBank, callFunctionWithContext } = makeContext({ heroName: 'Falie', rollUnit: 0 });

  assert.equal(runtime.activateSuperGemEffect({
    superGem: { id: 'sg-red', baseColor: 1 },
    actorUID: hero.uid,
    selectedEnemyUID: 201,
    state,
    callFunctionWithContext,
    fnContext: ctx,
    sourceItems: [],
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  }), true);
  assert.equal(runtime.executePendingSuperGemAction({ state, callFunctionWithContext, fnContext: ctx }), true);

  const hits = state.globals.PendingHeroHits;
  const clusterHits = hits.filter(hit => Number(hit.superGemClusterBatchId || 0) > 0 && !hit.generatedBySkillId);
  const chainHits = hits.filter(hit => hit.generatedBySkillId === 'party_chain_strike_ii');

  assert.equal(clusterHits.length, 3);
  assert.equal(chainHits.length, 6);
  assert.equal(JSON.stringify(hits.map(hit => hit.targetUID)), JSON.stringify([201, 202, 203, 201, 202, 203, 201, 202, 203]));
  assert.ok(clusterHits.every(hit => Number(hit.superGemClusterVisualOnly || 0) === 0));
  assert.ok(clusterHits.every(hit => Number(hit.superGemClusterApplyTotalOnHit || 0) === 0));
  assert.ok(chainHits.every(hit => hit.actionName === 'Chain Strike II'));
  assert.ok(chainHits.every(hit => hit.chainStrikeDamagePct === 66));
  assert.equal(state.globals.PartyChainStrikeIIProcs, 3);

  for (const hit of clusterHits) {
    functionBank.ApplyDamageToTarget(ctx, hit.targetUID, hit.finalDmg, { sourceUID: hit.heroUID });
  }
  assert.equal(state.globals.PartyDestinyAttempts, 3);
  assert.equal(state.globals.PartyDestinyProcs, 3);
  assert.equal(state.globals.PartyDestinyHeals, 3);
});

test('Huun yellow goldstrike queues Chain Strike II bounds for single and jackpot attacks', () => {
  const runtime = loadSuperGemRuntime();
  const single = makeContext({ heroName: 'Huun', heroUID: 102, rollUnit: 0.6, activeDestiny: false });

  assert.equal(runtime.activateSuperGemEffect({
    superGem: { id: 'sg-yellow', baseColor: 3 },
    actorUID: single.hero.uid,
    selectedEnemyUID: 201,
    state: single.state,
    callFunctionWithContext: single.callFunctionWithContext,
    fnContext: single.ctx,
    sourceItems: [],
    consumedColorGemCount: 10,
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  }), true);

  assert.equal(single.state.globals.PendingHeroHits.length, 3);
  assert.equal(single.state.globals.PendingHeroHits[0].calcPath, 'goldstrike');
  assert.equal(single.state.globals.PendingHeroHits.filter(hit => hit.generatedBySkillId === 'party_chain_strike_ii').length, 2);
  assert.equal(single.state.globals.PartyChainStrikeIIProcs, 1);

  const jackpot = makeContext({ heroName: 'Huun', heroUID: 102, rollUnit: 0.999, activeDestiny: false });
  assert.equal(runtime.activateSuperGemEffect({
    superGem: { id: 'sg-yellow', baseColor: 3 },
    actorUID: jackpot.hero.uid,
    selectedEnemyUID: 201,
    state: jackpot.state,
    callFunctionWithContext: jackpot.callFunctionWithContext,
    fnContext: jackpot.ctx,
    sourceItems: [],
    consumedColorGemCount: 10,
    startGemMergeFx: () => {},
    getGoldLabelTargetWorld: () => null,
  }), true);

  const jackpotPrimaries = jackpot.state.globals.PendingHeroHits.filter(hit => hit.calcPath === 'goldstrike');
  const jackpotBounces = jackpot.state.globals.PendingHeroHits.filter(hit => hit.generatedBySkillId === 'party_chain_strike_ii');
  assert.equal(jackpotPrimaries.length, 3);
  assert.equal(jackpotBounces.length, 6);
  assert.equal(jackpot.state.globals.PartyChainStrikeIIProcs, 3);
});
