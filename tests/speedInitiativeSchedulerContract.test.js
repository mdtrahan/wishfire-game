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

  const proofCycle = scheduler.buildFixedCycleSlots([
    { uid: 2, type: 0, spd: 20, name: 'Huun' },
    { uid: 101, type: 1, spd: 22, name: 'Skeleton' },
  ], 0).map(slot => slot.uid);
  assert.deepEqual(proofCycle, [101, 2]);
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
    assert.match(defaultSpeedSelection, /const queue = buildFixedCycleSlots\(roster, 0\)/);
    assert.match(defaultSpeedSelection, /selectionReason: 'speed_sorted_cycle'/);
    assert.match(defaultSpeedSelection, /completedIndex === -1 \|\| completedIndex >= queue\.length - 1 \? 0 : completedIndex \+ 1/);
    assert.match(defaultSpeedSelection, /progressBeforeSelection: \{\}/);
    assert.match(defaultSpeedSelection, /thresholdSubtraction: null/);
    assert.doesNotMatch(defaultSpeedSelection, /advanceDynamicInitiativeShadow\(\{/);
    assert.doesNotMatch(defaultSpeedSelection, /selectionReason: trace\.selectionReason/);
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
