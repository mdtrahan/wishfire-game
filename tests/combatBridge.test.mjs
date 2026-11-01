import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';

const binary = readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url));
const module = new WebAssembly.Module(binary);
function setup() {
  const instance = new WebAssembly.Instance(module);
  return { bridge: createCombatBridge(instance), wasm: instance.exports };
}
const stats = (hp, atk) => ({ hp, atk, def: 5, speed: 100, reach: 80, interval: 0.5, evade: 0, special: 10 });
function config() {
  return {
    encounter_id: 'node-fight', seed: '18446744073709551615',
    geometry: { floor: { min: { x: 96, y: 40 }, max: { x: 864, y: 1592 } },
      viewport_world: { x: 720, y: 1280 }, formation_origin: { x: 480, y: 800 }, screen_bound: false },
    heroes: [{ instance_id: 'fara-1', definition_id: 'slice.hero.fara', slot: 0,
      formation_offset: { x: 0, y: 0 }, stats: stats(1000, 100), hp: 1000 }],
    enemies: [{ spawn_key: 'orc-1', definition_id: 'slice.enemy.orc',
      position: { x: 480, y: 700 }, stats: stats(80, 5), hp: 80 }],
  };
}
function fight(bridge, cfg = config(), cap = 1800) {
  const created = bridge.create(cfg);
  const events = [...created.events];
  let snapshot = created.snapshot;
  try {
    for (let i = 0; i < cap && snapshot.state === 'running'; i++) {
      const next = bridge.step(created.world, { encounter_id: cfg.encounter_id, expected_previous_step: snapshot.step });
      assert.equal(BigInt(next.snapshot.step), BigInt(snapshot.step) + 1n);
      events.push(...next.events);
      snapshot = next.snapshot;
    }
    assert.deepEqual(bridge.inspect(created.world).events, events);
    return { snapshot, events };
  } finally { bridge.destroy(created.world); }
}
function raw(wasm, bytes, alter = (p, n) => [p, n]) {
  const ptr = wasm.wf_input_alloc(bytes.length) >>> 0;
  assert.ok(ptr);
  let handle = 0;
  try {
    new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes);
    handle = wasm.wf_combat_call(...alter(ptr, bytes.length)) >>> 0;
    assert.ok(handle);
    return readResponse(wasm, handle);
  } finally {
    if (handle) assert.equal(wasm.wf_response_free(handle), 1);
    assert.equal(wasm.wf_input_free(ptr, bytes.length), 1);
  }
}
function readResponse(wasm, handle) {
  const ptr = wasm.wf_response_ptr(handle) >>> 0;
  const len = wasm.wf_response_len(handle) >>> 0;
  return JSON.parse(new TextDecoder().decode(new Uint8Array(wasm.memory.buffer, ptr, len).slice()));
}
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
const envelope = operation => ({ schema: { major: 1, minor: 0 }, request_id: 'echo-me', operation });
const describe = { kind: 'describe', data: {} };
const code = (fn, expected) => assert.throws(fn, error => error.code === expected);
function noLeaks(bridge) {
  assert.deepEqual(bridge.describe().resources, { worlds: 0, responses: 0, inputs: 1 });
}

test('whole fight terminates and the same seed/config reproduces every event and hash', () => {
  const { bridge } = setup();
  const first = fight(bridge);
  assert.equal(first.snapshot.state, 'ended');
  assert.equal(first.snapshot.live_enemies, 0);
  assert.match(first.snapshot.gameplay_hash, /^[a-f0-9]{16}$/);
  for (const kind of ['spawned', 'damage', 'died', 'ended']) assert.ok(first.events.some(e => e.body.kind === kind), kind);
  assert.deepEqual(fight(bridge), first);
  assert.deepEqual(fight(setup().bridge), first);
  assert.deepEqual(first.events.map(e => e.sequence), first.events.map((_, i) => String(i + 1)));
  noLeaks(bridge);
});

test('an unresolved encounter reaches a fixed cap with contiguous 30 Hz steps', () => {
  const { bridge } = setup(); const c = config();
  c.heroes[0].stats.atk = c.enemies[0].stats.atk = 0;
  const result = fight(bridge, c, 60);
  assert.equal(result.snapshot.step, '60'); assert.equal(result.snapshot.state, 'running'); noLeaks(bridge);
});

test('downed precedes all_down and terminal worlds reject further steps', () => {
  const { bridge } = setup(); const c = config(); c.heroes[0].hp = 0;
  const created = bridge.create(c);
  assert.equal(created.snapshot.state, 'all_down');
  assert.ok(created.snapshot.actors.find(a => a.team === 'hero').downed);
  assert.deepEqual(created.events.slice(-2).map(e => e.body.kind), ['downed', 'all_down']);
  code(() => bridge.step(created.world, { encounter_id: c.encounter_id, expected_previous_step: '0' }), 'terminal');
  bridge.destroy(created.world);
  const lethal = config(); lethal.heroes[0].hp = 1; lethal.heroes[0].stats.atk = 0; lethal.enemies[0].stats.atk = 10000;
  const result = fight(bridge, lethal);
  assert.equal(result.snapshot.state, 'all_down');
  assert.ok(result.events.some(e => e.body.kind === 'damage'));
  assert.deepEqual(result.events.slice(-2).map(e => e.body.kind), ['downed', 'all_down']);
  noLeaks(bridge);
});

test('repeated, skipped and wrong-encounter steps fail atomically; inspect filters events', () => {
  const { bridge } = setup(); const { world } = bridge.create(config());
  const request = { encounter_id: 'node-fight', expected_previous_step: '0' };
  const first = bridge.step(world, request);
  for (const next of [request, { ...request, expected_previous_step: '2' },
    { ...request, encounter_id: 'wrong', expected_previous_step: '1' }]) {
    assert.throws(() => bridge.step(world, next), e => e.code === 'step_conflict' && e.current_step === '1');
    assert.deepEqual(bridge.inspect(world).snapshot, first.snapshot);
  }
  const all = bridge.inspect(world);
  assert.deepEqual(bridge.inspect(world, '1').events, all.events.slice(1));
  code(() => bridge.inspect(world, '9999'), 'invalid_cursor');
  code(() => bridge.inspect(world, 0), 'invalid_input');
  bridge.destroy(world); noLeaks(bridge);
});

test('world generations reject stale handles and double destroy', () => {
  const { bridge } = setup();
  const first = bridge.create(config()); bridge.destroy(first.world);
  const second = bridge.create(config()); assert.notEqual(second.world, first.world);
  for (const id of [0, 1, 0xffffffff, first.world]) {
    code(() => bridge.inspect(id), 'bad_handle'); code(() => bridge.destroy(id), 'bad_handle');
  }
  assert.equal(bridge.inspect(second.world).snapshot.step, '0'); bridge.destroy(second.world); noLeaks(bridge);
});

test('config validation rejects invalid inputs without allocating worlds', () => {
  const { bridge } = setup();
  const changes = [c => c.heroes[0].slot = 4, c => c.heroes = Array(5).fill(c.heroes[0]),
    c => { c.geometry.contain_bodies = true; c.geometry.floor.max.y = c.geometry.floor.min.y + 256; },c => c.seed = '18446744073709551616', c => c.seed = 1,
    c => c.heroes = [], c => c.heroes.push(...Array(4).fill(c.heroes[0])),
    c => c.heroes[0].definition_id = 'unknown', c => c.heroes[0].hp = -1,
    c => c.heroes[0].hp = 2000, c => c.heroes[0].stats.interval = 0,
    c => c.heroes[0].stats.atk = Infinity, c => c.heroes[0].stats.typo = 10,
    c => c.heroes[0].formation_offset.x = 10000,
    c => c.geometry.floor.max.x = c.geometry.floor.min.x,
    c => c.geometry.viewport_world.x = 0,
    c => c.enemies[0].spawn_key = c.heroes[0].instance_id,
    c => c.enemies[0].definition_id = 'slice.hero.fara',
    c => c.enemies[0].definition_id = 'slice.boss.troll_brute'];
  for (const change of changes) { const c = config(); change(c); code(() => bridge.create(c), 'invalid_input'); noLeaks(bridge); }
});

test('all four slice heroes accept final stats; enemies may have different stats for one kind', () => {
  const { bridge } = setup(); const c = config();
  c.heroes = ['fara', 'hondo', 'runa', 'kaja'].map((name, slot) => ({ ...c.heroes[0],
    definition_id: `slice.hero.${name}`, instance_id: name, slot, formation_offset: { x: (slot - 1) * 50, y: 0 } }));
  c.enemies.push({ ...c.enemies[0], spawn_key: 'orc-2', position: { x: 550, y: 700 }, stats: stats(160, 10), hp: 160 });
  const { world, snapshot } = bridge.create(c);
  assert.equal(snapshot.actors.length, 6);
  assert.deepEqual(snapshot.actors.filter(a => a.team === 'enemy').map(a => a.max_hp), [80, 160]);
  bridge.destroy(world); noLeaks(bridge);
});

test('host floor applies outside slice bounds and participates in the state hash', () => {
  const { bridge } = setup(); const c = config();
  c.geometry.floor = { min: { x: 2000, y: 3000 }, max: { x: 2600, y: 4000 } };
  c.geometry.formation_origin = { x: 2300, y: 3700 }; c.enemies[0].position = { x: 2300, y: 3600 };
  const a = bridge.create(c); const changed = structuredClone(c); changed.geometry.floor.max.x += 100;
  const b = bridge.create(changed);
  assert.notEqual(a.snapshot.gameplay_hash, b.snapshot.gameplay_hash); bridge.destroy(b.world);
  let previous = '0';
  for (let i = 0; i < 90; i++) {
    const { snapshot } = bridge.step(a.world, { encounter_id: c.encounter_id, expected_previous_step: previous });
    previous = snapshot.step;
    for (const actor of snapshot.actors) {
      assert.ok(actor.pos.x >= 2000 && actor.pos.x < 2600); assert.ok(actor.pos.y >= 3000 && actor.pos.y < 4000);
    }
    if (snapshot.state !== 'running') break;
  }
  bridge.destroy(a.world); noLeaks(bridge);
});

test('malformed UTF-8, JSON, schemas, operations and unknown keys return envelopes', () => {
  const { wasm, bridge } = setup();
  assert.equal(raw(wasm, new Uint8Array([0xff])).error.code, 'invalid_utf8');
  assert.equal(raw(wasm, new TextEncoder().encode('{')).error.code, 'invalid_json');
  const wrongSchema = envelope(describe); wrongSchema.schema.major = 2;
  const response = raw(wasm, bytes(wrongSchema)); assert.equal(response.error.code, 'unsupported_schema'); assert.equal(response.request_id, 'echo-me');
  for (const value of [envelope({ kind: 'acknowledge', data: {} }), { ...envelope(describe), extra: true },
    { ...envelope(describe), request_id: 3 }, envelope({ kind: 'describe', data: { extra: 1 } })]) {
    assert.equal(raw(wasm, bytes(value)).error.code, 'invalid_input');
  }
  noLeaks(bridge);
});

test('input pointers require exact lengths and reject oversized values and double free', () => {
  const { wasm, bridge } = setup(); const input = bytes(envelope(describe));
  for (const alter of [(p, n) => [p + 1, n], (p, n) => [p, n - 1],
    (p, n) => [p, n + 1], () => [0, 0], () => [0xffffffff, 0xffffffff]]) {
    assert.equal(raw(wasm, input, alter).error.code, 'invalid_pointer');
  }
  for (const n of [0, 1048577, 0xffffffff]) assert.equal(wasm.wf_input_alloc(n), 0);
  const ptr = wasm.wf_input_alloc(10); assert.ok(ptr);
  assert.equal(wasm.wf_input_free(ptr + 1, 10), 0); assert.equal(wasm.wf_input_free(ptr, 9), 0);
  assert.equal(wasm.wf_input_free(ptr, 10), 1); assert.equal(wasm.wf_input_free(ptr, 10), 0);
  noLeaks(bridge);
});

test('response generation, double free and independent lifetime survive world destroy', () => {
  const { wasm, bridge } = setup(); const { world } = bridge.create(config());
  const input = bytes(envelope({ kind: 'inspect', data: { world, events_after: '0' } }));
  const ptr = wasm.wf_input_alloc(input.length); new Uint8Array(wasm.memory.buffer, ptr, input.length).set(input);
  const handle = wasm.wf_combat_call(ptr, input.length);
  assert.equal(wasm.wf_input_free(ptr, input.length), 1);
  bridge.destroy(world); assert.equal(readResponse(wasm, handle).result.snapshot.step, '0');
  assert.equal(wasm.wf_response_free(handle), 1); assert.equal(wasm.wf_response_free(handle), 0);
  assert.equal(wasm.wf_response_ptr(handle), 0); assert.equal(wasm.wf_response_len(handle), 0);
  const next = raw(wasm, bytes(envelope(describe))); assert.ok(next.ok);
  assert.equal(wasm.wf_response_free(handle), 0); noLeaks(bridge);
});

test('resource limits fail without advancing and freed slots can be reused', () => {
  const { wasm, bridge } = setup(); const first = bridge.create(config()), second = bridge.create(config());
  code(() => bridge.create(config()), 'resource_limit'); bridge.destroy(first.world); bridge.destroy(second.world);
  const input = bytes(envelope(describe)); const ptr = wasm.wf_input_alloc(input.length);
  new Uint8Array(wasm.memory.buffer, ptr, input.length).set(input);
  const handles = Array.from({ length: 8 }, () => wasm.wf_combat_call(ptr, input.length));
  assert.ok(handles.every(Boolean)); assert.equal(wasm.wf_combat_call(ptr, input.length), 0);
  for (const h of handles) assert.equal(wasm.wf_response_free(h), 1);
  assert.equal(wasm.wf_input_free(ptr, input.length), 1);
  const pointers = Array.from({ length: 8 }, () => wasm.wf_input_alloc(10));
  assert.ok(pointers.every(Boolean)); assert.equal(wasm.wf_input_alloc(10), 0);
  for (const p of pointers) assert.equal(wasm.wf_input_free(p, 10), 1);
  for (let i = 0; i < 100; i++) {
    const { world } = bridge.create(config()); bridge.inspect(world); bridge.destroy(world);
  }
  noLeaks(bridge);
});

test('wrapper reacquires wasm memory after growth and frees on decode/operation failures', () => {
  const { wasm, bridge } = setup(); const original = wasm.memory.buffer;
  wasm.memory.grow(2); assert.notEqual(wasm.memory.buffer, original);
  const growing = createCombatBridge({ exports: { ...wasm,
    wf_input_alloc: n => { const ptr = wasm.wf_input_alloc(n); wasm.memory.grow(1); return ptr; },
    wf_combat_call: (...args) => { const handle = wasm.wf_combat_call(...args); wasm.memory.grow(1); return handle; },
  } });
  assert.equal(growing.describe().abi_version, 0x10000);
  code(() => bridge.inspect(0), 'bad_handle'); noLeaks(bridge);
  const broken = createCombatBridge({ exports: { ...wasm, wf_response_len: () => 1 } });
  assert.throws(() => broken.describe(), SyntaxError); noLeaks(bridge);
  const failedCall = createCombatBridge({ exports: { ...wasm, wf_combat_call: () => { throw new Error('test call failure'); } } });
  assert.throws(() => failedCall.describe(), /test call failure/); noLeaks(bridge);
  assert.throws(() => createCombatBridge({ exports: {} }), /Unsupported combat ABI/);
});

test('combat snapshots expose presentation suspension and poison observations without changing input contracts',()=>{
 const {bridge}=setup(),created=bridge.create(config());try{assert.ok(Object.hasOwn(created.snapshot,'hit_stop'));assert.ok(Object.hasOwn(created.snapshot,'spotlight'));assert.ok(Object.hasOwn(created.snapshot,'phoenix_channel'));assert.equal(typeof created.snapshot.phoenix_cooldown,'number');for(const a of created.snapshot.actors)assert.equal(typeof a.poisoned,'number');}finally{bridge.destroy(created.world);}
});
