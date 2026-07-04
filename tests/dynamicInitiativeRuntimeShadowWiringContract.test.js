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

test('dynamic initiative shadow adapter remains wired while authority stays dev-flag gated', () => {
  for (const relPath of functionBankPaths) {
    const src = read(relPath);

    assert.match(src, /dynamicInitiativeRuntimeShadow\.mjs/);
    assert.match(src, /dynamicInitiativeAuthorityExperiment\.mjs/);
    assert.match(src, /function isTimeInitiative\(ctx\) \{\s*return false;\s*\}/);
    assert.match(src, /function recordDynamicInitiativeShadowAfterAction\(ctx, currentUID, currentType, cadenceEvents = \[\]\)/);
    assert.match(src, /function recordDynamicInitiativeShadowSelectionComparison\(ctx, prediction\)/);
    assert.match(src, /function tryApplyDynamicInitiativeAuthoritySelection\(ctx, prediction, cadenceEvents = \[\]\)/);
    assert.match(src, /function isDynamicInitiativeAuthorityFlagEnabled\(g\)/);
    assert.match(src, /if \(!isDynamicInitiativeAuthorityFlagEnabled\(g\)\)/);
    const openingPolicy = extractFunctionSource(src, 'createDynamicInitiativeOpeningPolicy');
    assert.match(openingPolicy, /const opener = openingHeroes\[0\]\?\.actor \|\| null/);
    assert.match(openingPolicy, /remainingUIDs = opener \? \{ \[Number\(opener\.uid\)\]: true \} : \{\}/);
    assert.doesNotMatch(openingPolicy, /for \(const actor of actors\)/);

    const advanceTurn = extractFunctionSource(src, 'AdvanceTurn');
    assert.match(advanceTurn, /recordDynamicInitiativeShadowAfterAction\(ctx, currentUID, currentType, dynamicInitiativeCadenceEvents\)/);
    assert.match(advanceTurn, /tryApplyDynamicInitiativeAuthoritySelection\(ctx, dynamicInitiativeShadowPrediction, dynamicInitiativeCadenceEvents\)/);
    assert.match(advanceTurn, /recordDynamicInitiativeShadowSelectionComparison\(ctx, dynamicInitiativeShadowPrediction\)/);
    assert.match(advanceTurn, /ProcessCurrentTurn\(ctx\)/);
    assert.doesNotMatch(advanceTurn, /selectDynamicInitiativeTurn\(/);
    assert.match(advanceTurn, /if \(timeMode\)/);
  }
});
