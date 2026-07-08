const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const functionBankPaths = [
  'web-runner/modules/functionBank.js',
  'Scripts/functionBank.js',
];

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

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

test('dynamic initiative runtime keeps shadow diagnostics while default combat uses scheduler authority', () => {
  for (const relPath of functionBankPaths) {
    const src = read(relPath);

    assert.match(src, /dynamicInitiativeRuntimeShadow\.mjs/);
    assert.match(src, /dynamicInitiativeAuthorityExperiment\.mjs/);
    assert.match(src, /function isTimeInitiative\(ctx\) \{\s*return false;\s*\}/);
    assert.match(src, /function recordDynamicInitiativeShadowAfterAction\(ctx, currentUID, currentType, cadenceEvents = \[\]\)/);
    assert.match(src, /function recordDynamicInitiativeShadowSelectionComparison\(ctx, prediction\)/);
    assert.match(src, /function ensureDynamicInitiativeDefaultState\(g\)/);
    assert.match(src, /function buildDynamicInitiativeDefaultSpeedSelection\(ctx, options = null\)/);
    assert.match(src, /function initializeDynamicInitiativeDefaultCurrent\(ctx, source = 'initialize'\)/);
    assert.match(src, /function recordDynamicInitiativeDefaultAfterAction\(ctx, currentUID, currentType, cadenceEvents = \[\]\)/);
    assert.match(src, /function applyDynamicInitiativeDefaultSelection\(ctx, prediction, cadenceEvents = \[\]\)/);
    assert.match(src, /function tryApplyDynamicInitiativeAuthoritySelection\(ctx, prediction, cadenceEvents = \[\]\)/);
    assert.match(src, /function isDynamicInitiativeAuthorityFlagEnabled\(g\)/);
    assert.match(src, /if \(!isDynamicInitiativeAuthorityFlagEnabled\(g\)\)/);

    const initializeDefault = extractFunctionSource(src, 'initializeDynamicInitiativeDefaultCurrent');
    assert.match(initializeDefault, /buildDynamicInitiativeDefaultSpeedSelection\(ctx, \{ currentUID: 0, source \}\)/);
    assert.match(initializeDefault, /formatDynamicSpeedInitiativeTrace\(trace\)/);
    assert.match(initializeDefault, /dynamic_initiative_default_initial_selection/);
    assert.doesNotMatch(initializeDefault, /createDynamicInitiativeOpeningPolicy/);
    assert.doesNotMatch(initializeDefault, /dynamic_initiative_default_opening_selection/);

    const defaultSpeedSelection = extractFunctionSource(src, 'buildDynamicInitiativeDefaultSpeedSelection');
    assert.match(defaultSpeedSelection, /const roster = getInitiativeRoster\(ctx\)/);
    assert.match(defaultSpeedSelection, /advanceDynamicInitiativeShadow\(\{/);
    assert.match(defaultSpeedSelection, /selectionReason: trace\.selectionReason/);
    assert.match(defaultSpeedSelection, /progressBeforeSelection: trace\.progressBeforeSelection/);
    assert.match(defaultSpeedSelection, /thresholdSubtraction:/);
    assert.doesNotMatch(defaultSpeedSelection, /buildFixedCycleSlots\(roster, 0\)/);
    assert.doesNotMatch(defaultSpeedSelection, /selectionReason: 'speed_sorted_cycle'/);

    const shadowPrediction = extractFunctionSource(src, 'recordDynamicInitiativeShadowAfterAction');
    assert.match(shadowPrediction, /openingPolicy: null/);
    assert.doesNotMatch(shadowPrediction, /createDynamicInitiativeOpeningPolicy/);

    const advanceTurn = extractFunctionSource(src, 'AdvanceTurn');
    assert.match(advanceTurn, /recordDynamicInitiativeShadowAfterAction\(ctx, currentUID, currentType, dynamicInitiativeCadenceEvents\)/);
    assert.match(advanceTurn, /recordDynamicInitiativeDefaultAfterAction\(ctx, currentUID, currentType, dynamicInitiativeCadenceEvents\)/);
    assert.match(advanceTurn, /applyDynamicInitiativeDefaultSelection\(ctx, dynamicInitiativeDefaultPrediction, dynamicInitiativeCadenceEvents\)/);
    assert.match(advanceTurn, /tryApplyDynamicInitiativeAuthoritySelection\(ctx, dynamicInitiativeShadowPrediction, dynamicInitiativeCadenceEvents\)/);
    assert.match(advanceTurn, /recordDynamicInitiativeShadowSelectionComparison\(ctx, dynamicInitiativeShadowPrediction\)/);
    assert.match(advanceTurn, /ProcessCurrentTurn\(ctx\)/);
    assert.doesNotMatch(advanceTurn, /selectDynamicInitiativeTurn\(/);
    assert.match(advanceTurn, /if \(timeMode\)/);

    const getCurrentTurn = extractFunctionSource(src, 'GetCurrentTurn');
    assert.match(getCurrentTurn, /getDynamicInitiativeAuthorityCurrent\(g\)/);
    assert.match(getCurrentTurn, /getDynamicInitiativeDefaultCurrent\(g\)/);
    assert.ok(
      getCurrentTurn.indexOf('getDynamicInitiativeDefaultCurrent(g)') < getCurrentTurn.indexOf('g.RoundActive'),
      'default scheduler current must be read before legacy RoundGroups',
    );

    const buildRoundGroups = extractFunctionSource(src, 'BuildRoundGroups');
    assert.match(buildRoundGroups, /initializeDynamicInitiativeDefaultCurrent\(ctx, 'BuildRoundGroups'\)/);
    assert.match(buildRoundGroups, /resetDynamicInitiativeDefaultState\(g, getDynamicInitiativeSessionId\(g\), 'empty_round_roster'\)/);
  }
});
