const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const servePath = path.join(__dirname, '..', 'tools', 'serve_web.js');
const cargoPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'Cargo.toml');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');

test('simulation core shadow mode is wired as observe-only browser support', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(appSrc, /initializeSimulationCoreShadow\(\);/);
  assert.match(appSrc, /import \{[\s\S]*shadowCombatPower[\s\S]*\} from '\.\/systems\/simulationCoreShadow\.js';/);
  assert.match(appSrc, /return shadowCombatPower\(\{[\s\S]*jsValue: result[\s\S]*\}\);/);

  assert.match(shadowSrc, /SHADOW_STATE_KEY/);
  assert.match(shadowSrc, /dataset\.simCoreShadowStatus/);
  assert.match(shadowSrc, /loadSimulationCore\(wasmUrl\)/);
  const loaderSrc = fs.readFileSync(path.join(path.dirname(shadowModulePath), 'simulationCoreLoader.mjs'), 'utf8');
  assert.match(loaderSrc, /WebAssembly\.instantiate/);
  assert.match(shadowSrc, /Math\.abs\(rustValue - jsValue\) > 1e-6/);
  assert.match(shadowSrc, /return jsValue;/);
});

test('simulation core can be built as a static wasm asset', () => {
  const cargoSrc = fs.readFileSync(cargoPath, 'utf8');
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  const serveSrc = fs.readFileSync(servePath, 'utf8');

  assert.match(cargoSrc, /crate-type = \["cdylib", "rlib"\]/);
  assert.match(rustSrc, /extern "C" fn combat_power_shadow/);
  assert.match(rustSrc, /extern "C" fn combat_power_full_shadow/);
  assert.match(serveSrc, /'\.wasm':'application\/wasm'/);
});

test('serve fingerprint identifies the source without guessing ownership from Beads or history', () => {
  const serveSrc = fs.readFileSync(servePath, 'utf8');
  assert.ok(serveSrc.includes("String(branch || '').match("));
  assert.doesNotMatch(serveSrc, /safeExec\('bd'|fromHistory/);
  for (const field of ['commit:', 'origin:', 'sourceRoot:', 'sourceDirty:', 'presentation:']) assert.ok(serveSrc.includes(field), field);
  assert.match(serveSrc, /bag-conveyor/);
});

test('verified loader supplies the world ABI, CP and meta RNG exports', async () => {
  const bytes = fs.readFileSync(wasmPath);
  const { loadSimulationCore } = await import('../web-runner/systems/simulationCoreLoader.mjs');
  const { createCombatBridge } = await import('../web-runner/src/core/combatBridge.mjs');
  const { parseCsvRows } = require('./helpers/fixtureCsv');
  const previous = globalThis.__ORKA_OFFLINE_RUNTIME__;
  globalThis.__ORKA_OFFLINE_RUNTIME__ = {
    json: { 'simulation_core.manifest.json': JSON.parse(fs.readFileSync(path.join(path.dirname(wasmPath), 'simulation_core.manifest.json'))) },
    wasm: { 'simulation_core.wasm': bytes.toString('base64') },
  };
  try {
    const instance = await loadSimulationCore('file:///cp-meta-proof/assets/simulation_core.wasm');
    assert.equal(await loadSimulationCore('file:///cp-meta-proof/assets/simulation_core.wasm'), instance);
    assert.equal(createCombatBridge(instance).describe().abi_version, 0x10000);
    assert.equal(instance.exports.combat_power_shadow(10, 5, 100), 25.6);
    assert.equal(instance.exports.combat_power_full_shadow(10, 4, 5, 4, 100, 10, 1, 0, .01, 1.25, 0, 0, 0, 0, 0, 0, 1), 26.1);
    for (const row of parseCsvRows(fs.readFileSync(path.join(__dirname, 'fixtures/seeded_rng_cases.csv'), 'utf8'))) {
      assert.equal(instance.exports.seeded_rng_next_state_shadow(+row.seed, +row.draws), +row.expectedState, row.name);
      assert.ok(Math.abs(instance.exports.seeded_rng_next_value_shadow(+row.seed, +row.draws) - +row.expectedValue) < 1e-12, row.name);
      assert.equal(instance.exports.seeded_rng_index_shadow(+row.seed, +row.draws, +row.size), +row.expectedIndex, row.name);
    }
  } finally { globalThis.__ORKA_OFFLINE_RUNTIME__ = previous; }
});

test('CP shadow diagnostic records compared full-stat fields for an explicit zero direct packet', () => { const source=fs.readFileSync(shadowModulePath,'utf8'); assert.match(source,/actor: input,\n    jsValue,\n    rustValue/); assert.match(source,/combat_power_full_shadow/); });
