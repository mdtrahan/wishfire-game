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

  assert.match(shadowSrc, /window\.__ORKA_SIMULATION_CORE_SHADOW__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowStatus/);
  assert.match(shadowSrc, /dataset\.simCoreShadowSingleHitChecks/);
  assert.match(shadowSrc, /WebAssembly\.instantiateStreaming|WebAssembly\.instantiate/);
  assert.match(shadowSrc, /Math\.abs\(rustValue - jsValue\) > 0\.000001/);
  assert.match(shadowSrc, /return jsValue;/);
});

test('simulation core can be built as a static wasm asset', () => {
  const cargoSrc = fs.readFileSync(cargoPath, 'utf8');
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  const serveSrc = fs.readFileSync(servePath, 'utf8');

  assert.match(cargoSrc, /crate-type = \["cdylib", "rlib"\]/);
  assert.match(rustSrc, /extern "C" fn combat_power_shadow/);
  assert.match(rustSrc, /extern "C" fn combat_power_full_shadow/);
  assert.match(rustSrc, /extern "C" fn single_hit_damage_shadow/);
  assert.match(serveSrc, /'\.wasm':'application\/wasm'/);
});

test('serve fingerprint identifies the source without guessing ownership from Beads or history', () => {
  const serveSrc = fs.readFileSync(servePath, 'utf8');
  assert.ok(serveSrc.includes("String(branch || '').match("));
  assert.doesNotMatch(serveSrc, /safeExec\('bd'|fromHistory/);
  for (const field of ['commit:', 'origin:', 'sourceRoot:', 'sourceDirty:', 'presentation:']) assert.ok(serveSrc.includes(field), field);
  assert.match(serveSrc, /bag-conveyor/);
});

test('static simulation core wasm exposes the canonical combat power shadow export', async () => {
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  assert.equal(typeof result.instance.exports.combat_power_shadow, 'function');
  assert.equal(typeof result.instance.exports.combat_power_full_shadow, 'function');
  assert.equal(typeof result.instance.exports.single_hit_damage_shadow, 'function');
  assert.equal(result.instance.exports.combat_power_full_shadow(10, 4, 5, 4, 100, 10, 1, 0, .01, 1.25, 0, 0, 0, 0, 0, 0, 1), 30.6);
});

test('CP shadow diagnostic records compared full-stat fields for an explicit zero direct packet', () => { const source=fs.readFileSync(shadowModulePath,'utf8'); assert.match(source,/actor: input,\n    jsValue,\n    rustValue/); assert.match(source,/combat_power_full_shadow/); });
