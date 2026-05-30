const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

test('simulation core module exposes a Rust-owned CalculateDamage marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreCalculateDamageResolution/);
  assert.match(shadowSrc, /window\.__ORKA_CALCULATE_DAMAGE_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowCalculateDamageOwner/);
});

test('CalculateDamage routes final damage through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /calculateDamageFromJs/);
    assert.match(src, /__ORKA_CALCULATE_DAMAGE_OWNER__/);
    assert.match(src, /maybeResolveCalculateDamageOwner/);
    assert.match(src, /jsDamage: Number\(jsDecision\.damage \|\| 0\)/);
  }
});
