import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';
import { loadSimulationCore, validateSimulationCore } from '../web-runner/systems/simulationCoreLoader.mjs';
import { WFM_COMBAT_CONTENT_VERSION } from '../web-runner/src/core/heroProgression.mjs';
import { installRustCombat } from '../web-runner/systems/rustCombat.mjs';

const binary = fs.readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(new URL('../web-runner/assets/simulation_core.manifest.json', import.meta.url)));
const fresh = () => new WebAssembly.Instance(new WebAssembly.Module(binary));

test('release identity rejects ABI, schema, content version and corrupted bytes before use', async () => {
  assert.doesNotThrow(() => validateSimulationCore(fresh(), manifest));
  for (const changed of [{ ...manifest, abiVersion: 2 }, { ...manifest, schema: { major: 2, minor: 0 } },
    { ...manifest, content: { ...manifest.content, version: 2 } }]) {
    assert.throws(() => validateSimulationCore(fresh(), changed), /SimulationCore .*mismatch/);
  }
  assert.throws(() => validateSimulationCore({ exports: {} }, manifest), /Unsupported combat ABI/);
  const previous = globalThis.__ORKA_OFFLINE_RUNTIME__;
  const fetchBefore = globalThis.fetch;
  try {
    globalThis.fetch = () => { throw new Error('Offline loader attempted fetch'); };
    globalThis.__ORKA_OFFLINE_RUNTIME__ = { json: { 'simulation_core.manifest.json': manifest },
      wasm: { 'simulation_core.wasm': binary.toString('base64') } };
    const [a, b] = await Promise.all([loadSimulationCore('file:///proof/assets/simulation_core.wasm'), loadSimulationCore('file:///proof/assets/simulation_core.wasm')]);
    assert.equal(a, b, 'CP/meta and combat consumers share one verified instance');
    const corrupt = Buffer.from(binary); corrupt[corrupt.length - 1] ^= 1;
    globalThis.__ORKA_OFFLINE_RUNTIME__.wasm['simulation_core.wasm'] = corrupt.toString('base64');
    await assert.rejects(loadSimulationCore('file:///corrupt/assets/simulation_core.wasm'), /SimulationCore binary hash mismatch/);
  } finally {
    globalThis.fetch = fetchBefore;
    globalThis.__ORKA_OFFLINE_RUNTIME__ = previous;
  }
});

test('binary-owned content negotiation rejects stale or absent definitions and fails combat startup closed', async () => {
  assert.equal(createCombatBridge(fresh()).describe().content_version, WFM_COMBAT_CONTENT_VERSION);
  assert.equal(manifest.content.version, WFM_COMBAT_CONTENT_VERSION);
  const previous = globalThis.__ORKA_OFFLINE_RUNTIME__;
  const fetchBefore = globalThis.fetch;
  try {
    globalThis.fetch = () => { throw new Error('Content mismatch proof attempted fetch'); };
    for (const [from, to] of [[WFM_COMBAT_CONTENT_VERSION, 'wfm-slice-v2'], ['content_version', 'unknown_version']]) {
      const bytes = Buffer.from(binary), offset = bytes.indexOf(from);
      assert.ok(offset >= 0);
      assert.equal(bytes.indexOf(from, offset + from.length), -1, 'mutate only the binary description');
      assert.equal(Buffer.byteLength(to), Buffer.byteLength(from));
      bytes.write(to, offset);
      const changed = new WebAssembly.Instance(new WebAssembly.Module(bytes));
      assert.throws(() => validateSimulationCore(changed, manifest), /SimulationCore content\/version mismatch/);
      assert.throws(() => validateSimulationCore(changed, { ...manifest, content: { ...manifest.content, version: to } }), /SimulationCore content\/version mismatch/);
      globalThis.__ORKA_OFFLINE_RUNTIME__ = {
        json: { 'simulation_core.manifest.json': { ...manifest, binarySha256: createHash('sha256').update(bytes).digest('hex') } },
        wasm: { 'simulation_core.wasm': bytes.toString('base64') },
      };
      const globals = {};
      const combat = installRustCombat({ globals }, {
        load: async () => ({ mountRustCombat: () => loadSimulationCore(`file:///${to}/assets/simulation_core.wasm`) }),
        warn: () => {},
      });
      await assert.rejects(combat.requireReady(), /SimulationCore content\/version mismatch/);
      assert.match(globals.RustCombatError, /SimulationCore content\/version mismatch/);
      assert.equal(combat.tick({}), false);
      combat.dispose();
    }
  } finally {
    globalThis.fetch = fetchBefore;
    globalThis.__ORKA_OFFLINE_RUNTIME__ = previous;
  }
});

test('committed wasm records every Rust input and the exact binary hash', () => {
  const root = new URL('../', import.meta.url);
  for (const [file, hash] of Object.entries(manifest.sources)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file, root))).digest('hex'), hash, file);
  }
  assert.ok(manifest.sources['rust/simulation_core/Cargo.lock']);
  assert.ok(manifest.sources['rust/wf_combat/src/combat.rs']);
  assert.equal(createHash('sha256').update(binary).digest('hex'), manifest.binarySha256);
  assert.match(manifest.sourceCommit, /^[0-9a-f]{40}$/);
  assert.ok(manifest.toolchain.rustc);
  assert.ok(manifest.build.args.includes('--locked'));
});

test('hosted loader accepts byte responses with non-wasm MIME and fails clearly on missing assets', async () => {
  const original = globalThis.fetch, requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    if (url.includes('/missing/')) return new Response('missing', { status: 404 });
    return url.endsWith('.json') ? new Response(JSON.stringify(manifest)) : new Response(binary, { headers: { 'Content-Type': 'text/plain' } });
  };
  try {
    const instance = await loadSimulationCore('https://release.invalid/assets/simulation_core.wasm');
    assert.equal(createCombatBridge(instance).describe().abi_version, 0x10000);
    assert.equal(await loadSimulationCore('https://release.invalid/assets/simulation_core.wasm'), instance);
    assert.equal(requests.length, 2);
    await assert.rejects(loadSimulationCore('https://release.invalid/missing/simulation_core.wasm'), /SimulationCore HTTP 404/);
  } finally { globalThis.fetch = original; }
});

test('ten real Rust fights release every world, response and input; warmed wasm memory stays flat', () => {
  const instance = fresh(), bridge = createCombatBridge(instance);
  const stats = (hp, atk) => ({ hp, atk, def: 5, speed: 100, reach: 80, interval: .5, evade: 0, special: 10 });
  const config = { encounter_id: 'release-fight', seed: '7',
    geometry: { floor: { min: { x: 96, y: 40 }, max: { x: 864, y: 1592 } }, viewport_world: { x: 720, y: 1280 }, formation_origin: { x: 480, y: 800 }, screen_bound: false },
    heroes: [{ instance_id: 'fara', definition_id: 'slice.hero.fara', slot: 0, formation_offset: { x: 0, y: 0 }, stats: stats(1000, 100), hp: 1000 }],
    enemies: [{ spawn_key: 'orc', definition_id: 'slice.enemy.orc', position: { x: 480, y: 700 }, stats: stats(80, 5), hp: 80 }] };
  let warmedBytes;
  for (let cycle = 0; cycle <= 10; cycle++) {
    const { world, snapshot: initial } = bridge.create(config);
    let snapshot = initial, damage = false;
    try {
      for (let n = 0; n < 1800 && snapshot.state === 'running'; n++) {
        const next = bridge.step(world, { encounter_id: config.encounter_id, expected_previous_step: snapshot.step });
        damage ||= next.events.some(event => event.body.kind === 'damage');
        snapshot = next.snapshot;
      }
      assert.equal(snapshot.state, 'ended'); assert.equal(snapshot.live_enemies, 0); assert.ok(damage);
    } finally { bridge.destroy(world); }
    assert.deepEqual(bridge.describe().resources, { worlds: 0, responses: 0, inputs: 1 });
    if (!cycle) warmedBytes = instance.exports.memory.buffer.byteLength;
    else assert.equal(instance.exports.memory.buffer.byteLength, warmedBytes, `cycle ${cycle}`);
  }
});
