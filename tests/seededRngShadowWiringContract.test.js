const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

test('simulation core module exposes seeded RNG parity checks and ownership adapter', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_SEEDED_RNG_SHADOW__/);
  assert.match(shadowSrc, /window\.__ORKA_SEEDED_RNG_OWNER__/);
  assert.match(shadowSrc, /export function shadowSeededRng/);
  assert.match(shadowSrc, /export function createSimulationCoreSeededRng/);
  assert.match(shadowSrc, /seeded_rng_next_state_shadow/);
  assert.match(shadowSrc, /seeded_rng_next_value_shadow/);
  assert.match(shadowSrc, /seeded_rng_index_shadow/);
  assert.match(shadowSrc, /seededRngChecks/);
  assert.match(shadowSrc, /seededRngOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowSeededRngChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowSeededRngOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowSeededRngOwner/);
  assert.match(shadowSrc, /return jsValue;/);
  assert.match(shadowSrc, /return rustValue;/);
});

test('app submits seeded RNG fixture facts and delegates runtime RNG decisions to Rust owner', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');

  assert.match(appSrc, /createSimulationCoreSeededRng/);
  assert.match(appSrc, /shadowSeededRng/);
  assert.match(appSrc, /const simulationCoreShadowReady = initializeSimulationCoreShadow\(\);/);
  assert.match(appSrc, /function runSeededRngShadowStartupChecks/);
  assert.match(appSrc, /createSeededRng\(seed\)/);
  assert.match(appSrc, /return createSimulationCoreSeededRng\(seed, \{ source: 'app\.createSeededRng' \}\);/);
  assert.match(appSrc, /shadowSeededRng\(\{/);
  assert.match(appSrc, /source: 'app\.createSeededRng'/);
  assert.match(appSrc, /jsState/);
  assert.match(appSrc, /jsValue/);
  assert.match(appSrc, /jsIndex/);
});
