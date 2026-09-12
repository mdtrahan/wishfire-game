const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

function extractFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = src.indexOf('{', start);
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('runtime initiative rosters use individual HP across six slots', () => {
  const vm = require('node:vm');
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    const context = {
      getGlobals: ctx => ctx.globals,
      getEntities: ctx => ctx.entities,
      GetEffectiveStat: (_ctx, actor) => actor.stats.SPD,
    };
    vm.createContext(context);
    vm.runInContext(['getDeployedHeroes', 'getHeroes', 'getEnemies', 'getInitiativeRoster', 'getDynamicInitiativeRoster']
      .map(name => extractFunctionSource(src, name)).join('\n'), context);
    for (let size = 1; size <= 6; size += 1) {
      const heroes = Array.from({ length: size }, (_, i) => ({
        uid: i + 1, kind: 'hero', hp: 10, stats: { SPD: 12 - i },
      }));
      for (const PartyHP of [0, 50]) {
        const ctx = { globals: { PartyHP }, entities: [...heroes, { uid: 100, kind: 'enemy', hp: 10, stats: { SPD: 8 } }] };
        for (const ko of [false, true]) {
          heroes[0].hp = ko ? 0 : 10;
          const expected = [...heroes.filter(hero => hero.hp > 0).map(hero => hero.uid), 100];
          for (const name of ['getInitiativeRoster', 'getDynamicInitiativeRoster']) {
            assert.deepEqual(Array.from(context[name](ctx), actor => actor.uid), expected, `${relPath} ${name} size=${size} pool=${PartyHP} ko=${ko}`);
          }
          assert.equal(heroes[0].hp, ko ? 0 : 10);
        }
      }
    }
  }
});

for (const schedulerPath of ['src/core/schedulerRules.mjs', 'web-runner/src/core/schedulerRules.mjs']) {
test(`speed initiative scheduler can weave heroes and enemies by SPD in ${schedulerPath}`, async () => {
  const scheduler = await import(pathToFileURL(path.join(__dirname, '..', schedulerPath)).href);
  const roster = [
    { uid: 1, type: 0, spd: 11, name: 'Falie' },
    { uid: 2, type: 0, spd: 20, name: 'Huun' },
    { uid: 3, type: 0, spd: 15, name: 'Runa' },
    { uid: 4, type: 0, spd: 8, name: 'Kojonn' },
    { uid: 101, type: 1, spd: 18, name: 'Djinn' },
    { uid: 102, type: 1, spd: 12, name: 'Marid' },
    { uid: 103, type: 1, spd: 3, name: 'Chimerilass' },
  ];

  const cycle = scheduler.buildFixedCycleSlots(roster, 0).map(slot => slot.uid);

  assert.deepEqual(cycle, [2, 101, 3, 102, 1, 4, 103]);

  const proofRoster = [
    { uid: 2, type: 0, spd: 20, name: 'Quick Hero' },
    { uid: 101, type: 1, spd: 22, name: 'Fast Enemy' },
  ];
  const proofCycle = scheduler.buildFixedCycleSlots(proofRoster, 0).map(slot => slot.uid);
  assert.deepEqual(proofCycle, [101, 2]);

  const renamedProofCycle = scheduler.buildFixedCycleSlots(
    proofRoster.map((slot, index) => ({ ...slot, name: `Renamed Actor ${index + 1}` })),
    0,
  ).map(slot => slot.uid);
  assert.deepEqual(renamedProofCycle, proofCycle);
});

test(`speed initiative anchor preserves the current actor then continues the cycle in ${schedulerPath}`, async () => {
  const scheduler = await import(pathToFileURL(path.join(__dirname, '..', schedulerPath)).href);
  const roster = [
    { uid: 2, type: 0, spd: 20, hp: 35, name: 'Huun' },
    { uid: 3, type: 0, spd: 15, hp: 30, name: 'Runa' },
    { uid: 101, type: 1, spd: 18, hp: 20, name: 'Djinn' },
    { uid: 102, type: 1, spd: 12, hp: 20, name: 'Marid' },
    { uid: 103, type: 1, spd: 3, hp: 20, name: 'Chimerilass' },
  ];

  assert.deepEqual(scheduler.buildFixedCycleSlots(roster, 102).map(slot => slot.uid), [102, 103, 2, 101, 3]);
});


test(`speed initiative ability gate classifies dead and disabled actors in ${schedulerPath}`, async () => {
  const scheduler = await import(pathToFileURL(path.join(__dirname, '..', schedulerPath)).href);

  assert.equal(scheduler.isAbleToActSlot({ uid: 1, hp: 40, name: 'Falie' }), true);
  assert.equal(scheduler.isAbleToActSlot({ uid: 2, hp: 35, stunned: true, name: 'Huun' }), false);
  assert.equal(scheduler.isAbleToActSlot({ uid: 3, hp: 0, name: 'Runa' }), false);
  assert.equal(scheduler.isAbleToActSlot({ uid: 4, hp: 30, statusEffects: ['paralyzed'], name: 'Kojonn' }), false);
  assert.equal(scheduler.isAbleToActSlot({ uid: 102, hp: 20, disabled: true, name: 'Marid' }), false);
});
}

for (const schedulerPath of ['src/core/schedulerRules.mjs', 'web-runner/src/core/schedulerRules.mjs']) {
test(`speed initiative ability gate normalizes freeze and object statuses in ${schedulerPath}`, async () => {
  const scheduler = await import(pathToFileURL(path.join(__dirname, '..', schedulerPath)).href);
  for (const actor of [
    { uid: 1, hp: 20, status: 'Frozen' },
    { uid: 2, hp: 20, state: 'freeze' },
    { uid: 3, hp: 20, statuses: [{ statusEffect: 'stunned' }] },
    { uid: 4, hp: 20, statusEffects: [{ type: 'disabled' }] },
    { uid: 5, hp: 20, ableToAct: false },
  ]) assert.equal(scheduler.isAbleToActSlot(actor), false, `${schedulerPath} blocks ${actor.uid}`);
  assert.equal(scheduler.isAbleToActSlot({ uid: 6, hp: 20, statuses: [{ statusEffect: 'haste' }] }), true);
});
}

test('browser scheduler gate accepts scalar status effects and blocks truthy object flags', async () => {
  const scheduler = await import(pathToFileURL(path.join(__dirname, '..', 'web-runner/src/core/schedulerRules.mjs')).href);
  assert.equal(scheduler.isAbleToActSlot({ uid: 7, hp: 20, statusEffects: 'frozen' }), false);
  assert.equal(scheduler.isAbleToActSlot({ uid: 8, hp: 20, statuses: { paralyzed: true } }), false);
  assert.equal(scheduler.isAbleToActSlot({ uid: 9, hp: 20, statusEffects: { status: 'haste' } }), true);
});

test('runtime default actor selection uses fixed effective-Speed cycling', () => {
  const initiativeDoc = fs.readFileSync(path.join(__dirname, '..', 'governance/planning/combat-initiative-paths.md'), 'utf8');
  const runtimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner/modules/functionBank.js'), 'utf8');

  assert.match(runtimeSrc, /function isTimeInitiative\(ctx\)/);
  assert.match(runtimeSrc, /function buildDynamicInitiativeDefaultSpeedSelection\(ctx, options = null\)/);
  assert.match(runtimeSrc, /const roster = getInitiativeRoster\(ctx\)/);
  assert.match(runtimeSrc, /buildFixedCycleSlots\(roster, 0\)/);
  assert.match(runtimeSrc, /selectionReason: 'speed_sorted_cycle'/);

  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    const defaultSpeedSelection = extractFunctionSource(src, 'buildDynamicInitiativeDefaultSpeedSelection');
    assert.match(src, /function isTimeInitiative\(ctx\)\s*\{\s*return false;\s*\}/);
    assert.match(src, /function selectNextInitiativeActor\(ctx\)/);
    assert.match(src, /resolveCurrentTurnPhase\(ctx, 'functionBank\.ProcessCurrentTurn\.timeInitiative'\)/);
    assert.match(src, /function buildDynamicInitiativeDefaultSpeedSelection\(ctx, options = null\)/);
    assert.match(src, /function shouldApplyDynamicInitiativeAuthorityForDefaultSelection\(authorityPrediction, defaultPrediction\)/);
    assert.match(src, /function recordDynamicInitiativeAuthorityAlignmentSkip\(ctx, authorityPrediction, defaultPrediction, cadenceEvents = \[\]\)/);
    assert.match(defaultSpeedSelection, /const queue = buildFixedCycleSlots\(roster, 0\)/);
    assert.match(defaultSpeedSelection, /selectionReason: 'speed_sorted_cycle'/);
    assert.match(defaultSpeedSelection, /completedIndex === -1 \|\| completedIndex >= queue\.length - 1 \? 0 : completedIndex \+ 1/);
    assert.match(defaultSpeedSelection, /progressBeforeSelection: \{\}/);
    assert.match(defaultSpeedSelection, /thresholdSubtraction: null/);
    assert.doesNotMatch(defaultSpeedSelection, /advanceDynamicInitiativeShadow\(\{/);
    assert.doesNotMatch(defaultSpeedSelection, /selectionReason: trace\.selectionReason/);
    assert.match(src, /!isDynamicInitiativeAuthorityFlagEnabled\(g\)/);
    assert.match(src, /recordDynamicInitiativeAuthorityAlignmentSkip\(ctx, dynamicInitiativeShadowPrediction, dynamicInitiativeDefaultPrediction, dynamicInitiativeCadenceEvents\)/);
    assert.match(src, /authority_prediction_mismatched_speed_cycle/);
    assert.doesNotMatch(src, /dynamic_progress_math/);
  }

  assert.match(runtimeSrc, /BuildRoundGroups\(ctx\);/);
  assert.match(initiativeDoc, /Current Live Browser Runtime Path/);
  assert.match(initiativeDoc, /Dormant Time-Initiative Branch/);
  assert.match(initiativeDoc, /Shared Scheduler Rules/);
  assert.match(initiativeDoc, /Shadow And SimulationCore Ownership/);
  assert.match(initiativeDoc, /Experiment And Follow-Up Lanes/);
  assert.match(initiativeDoc, /Do not flip this guard as cleanup\./);
});
