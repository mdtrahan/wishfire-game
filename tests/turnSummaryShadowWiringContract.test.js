const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

test('simulation core shadow module exposes observe-only turn summary checks', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_TURN_SUMMARY_SHADOW__/);
  assert.match(shadowSrc, /export function shadowTurnSummary/);
  assert.match(shadowSrc, /turn_summary_code_shadow/);
  assert.match(shadowSrc, /dataset\.simCoreShadowTurnSummaryChecks/);
  assert.match(shadowSrc, /return jsValue;/);
});

test('functionBank mirrors submit turn summary facts without owning Rust imports', () => {
  for (const filePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const src = fs.readFileSync(filePath, 'utf8');

    assert.match(src, /function collectTurnSummaryShadowSnapshot/);
    assert.match(src, /function maybeShadowTurnSummary/);
    assert.match(src, /turnSummaryShadowHook/);
    assert.match(src, /__ORKA_TURN_SUMMARY_SHADOW__/);
    assert.match(src, /maybeShadowTurnSummary\(ctx, 'functionBank\.ApplyDamageToTarget'\);/);
    assert.match(src, /maybeShadowTurnSummary\(ctx, 'functionBank\.ApplyPartyDamage'\);/);
    assert.match(src, /export function ApplyPartyDamage[\s\S]*maybeShadowTurnSummary\(ctx, 'functionBank\.ApplyPartyDamage'\);[\s\S]*\n}/);
  }
});
