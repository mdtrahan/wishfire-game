const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

test('simulation core module exposes single-hit parity checks and ownership adapter', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /export function shadowSingleHitResolution/);
  assert.match(shadowSrc, /export function createSimulationCoreSingleHitResolution/);
  assert.match(shadowSrc, /window\.__ORKA_SINGLE_HIT_OWNER__/);
  assert.match(shadowSrc, /single_hit_damage_shadow/);
  assert.match(shadowSrc, /single_hit_applied_damage_shadow/);
  assert.match(shadowSrc, /single_hit_after_hp_shadow/);
  assert.match(shadowSrc, /dataset\.simCoreShadowSingleHitChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowSingleHitOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowSingleHitOwner/);
  assert.match(shadowSrc, /return jsValue;/);
});

test('functionBank mirrors record, submit, and apply Rust-owned single-hit transactions without Rust imports', () => {
  for (const filePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const src = fs.readFileSync(filePath, 'utf8');

    assert.match(src, /function recordSingleHitDamageShadow/);
    assert.match(src, /function maybeShadowSingleHitResolution/);
    assert.match(src, /function maybeResolveSingleHitOwner/);
    assert.match(src, /LastSingleHitDamageShadow/);
    assert.match(src, /LastSingleHitOwner/);
    assert.match(src, /singleHitShadowHook/);
    assert.match(src, /singleHitOwnerHook/);
    assert.match(src, /if \(typeof singleHitShadowHook === 'function'\)/);
    assert.match(src, /return appliedDamage;/);
  }
});
