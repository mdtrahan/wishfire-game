const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');
const rustLibPath = path.join(repoRoot, 'rust', 'simulation_core', 'src', 'lib.rs');
const shadowPath = path.join(repoRoot, 'web-runner', 'systems', 'simulationCoreShadow.js');
const packetPath = path.join(repoRoot, 'src', 'core', 'simulationCorePacket.cjs');
const contractPath = path.join(repoRoot, 'governance', 'planning', 'simulation-core-rust-js-contract.md');
const gatewayPath = path.join(repoRoot, 'src', 'core', 'combatRuntimeGateway.cjs');
const heroGemStoragePath = path.join(repoRoot, 'web-runner', 'systems', 'heroProgressStorage.js');

test('only supported CP and meta RNG scalar exports survive beside the world ABI', async () => {
 const { instance }=await WebAssembly.instantiate(fs.readFileSync(path.join(repoRoot,'web-runner/assets/simulation_core.wasm')),{});
 const scalar=Object.keys(instance.exports).filter(name=>name.endsWith('_shadow')).sort();
 assert.deepEqual(scalar,['combat_power_full_shadow','combat_power_shadow','seeded_rng_index_shadow','seeded_rng_next_state_shadow','seeded_rng_next_value_shadow']);
});

test('headless combat ABI retains the world protocol', () => {
 const source=fs.readFileSync(path.join(repoRoot,'rust/simulation_core/src/combat_abi.rs'),'utf8');
 for(const name of ['wf_combat_call','wf_input_alloc','wf_response_free'])assert.match(source,new RegExp('fn '+name+'\\b'));
});

test('SimulationCore packets normalize GameState and exclude browser-owned state', () => {
  const packetSrc = fs.readFileSync(packetPath, 'utf8');
  assert.match(packetSrc, /normalizeGameStateEnvelope/);
  assert.match(packetSrc, /gameState: normalizeGameStateEnvelope\(gameState\)/);
  assert.match(packetSrc, /nextGameState: normalizeGameStateEnvelope\(nextGameState\)/);
  assert.match(packetSrc, /context: normalizeSimulationContext\(context\)/);
  assert.doesNotMatch(packetSrc, /\bdocument\b|\bwindow\b|\blocalStorage\b|getContext\(/);
});

test('browser save/load wrappers stay outside Rust-owned deterministic simulation', () => {
  const gatewaySrc = fs.readFileSync(path.join(repoRoot,'web-runner/systems/combatNavigationState.mjs'), 'utf8');
  const storageSrc = fs.readFileSync(heroGemStoragePath, 'utf8');
  assert.match(gatewaySrc, /resume\(snapshot\)/);
  assert.doesNotMatch(gatewaySrc, /localStorage/);
  assert.match(storageSrc, /window\.localStorage\.getItem/);
  assert.match(storageSrc, /window\.localStorage\.setItem/);
  assert.doesNotMatch(storageSrc, /createSimulationCoreRequest|createSimulationCoreResponse/);
});

test('contract doc names the intended Rust and JS ownership split', () => {
  const contract = fs.readFileSync(contractPath, 'utf8');
  for (const phrase of [
    'Rust owns deterministic simulation',
    '`GameState`',
    'turn resolution',
    'combat formulas',
    'status effect application, ticking, and expiry',
    'RNG seed/state logic',
    'win/loss checks',
    'JavaScript owns browser integration',
    'save/load wrapper',
    'Netlify deployment',
  ]) {
    assert.match(contract, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
