const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

test('simulation core shadow module exposes observe-only seeded RNG checks', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_SEEDED_RNG_SHADOW__/);
  assert.match(shadowSrc, /export function shadowSeededRng/);
  assert.match(shadowSrc, /seeded_rng_next_state_shadow/);
  assert.match(shadowSrc, /seeded_rng_next_value_shadow/);
  assert.match(shadowSrc, /seeded_rng_index_shadow/);
  assert.match(shadowSrc, /seededRngChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowSeededRngChecks/);
  assert.match(shadowSrc, /return jsValue;/);
});

test('app submits seeded RNG fixture facts without giving Rust control of RNG', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');

  assert.match(appSrc, /shadowSeededRng/);
  assert.match(appSrc, /const simulationCoreShadowReady = initializeSimulationCoreShadow\(\);/);
  assert.match(appSrc, /function runSeededRngShadowStartupChecks/);
  assert.match(appSrc, /createSeededRng\(seed\)/);
  assert.match(appSrc, /shadowSeededRng\(\{/);
  assert.match(appSrc, /source: 'app\.createSeededRng'/);
  assert.match(appSrc, /jsState/);
  assert.match(appSrc, /jsValue/);
  assert.match(appSrc, /jsIndex/);
});
