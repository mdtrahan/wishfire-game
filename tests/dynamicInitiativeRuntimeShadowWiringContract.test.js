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

test('dynamic initiative shadow adapter is wired into functionBank mirrors without becoming authoritative', () => {
  for (const relPath of functionBankPaths) {
    const src = read(relPath);

    assert.match(src, /dynamicInitiativeRuntimeShadow\.mjs/);
    assert.match(src, /function isTimeInitiative\(ctx\) \{\s*return false;\s*\}/);
    assert.match(src, /function recordDynamicInitiativeShadowAfterAction\(ctx, currentUID, currentType\)/);
    assert.match(src, /function recordDynamicInitiativeShadowSelectionComparison\(ctx, prediction\)/);

    const advanceTurn = extractFunctionSource(src, 'AdvanceTurn');
    assert.match(advanceTurn, /recordDynamicInitiativeShadowAfterAction\(ctx, currentUID, currentType\)/);
    assert.match(advanceTurn, /recordDynamicInitiativeShadowSelectionComparison\(ctx, dynamicInitiativeShadowPrediction\)/);
    assert.match(advanceTurn, /ProcessCurrentTurn\(ctx\)/);
    assert.doesNotMatch(advanceTurn, /selectDynamicInitiativeTurn\(/);
    assert.match(advanceTurn, /if \(timeMode\)/);
  }
});
