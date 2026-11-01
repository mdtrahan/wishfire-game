import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';
import { createCombatAuthorityDriver } from '../web-runner/src/core/combatAuthorityDriver.mjs';
const wasm = new WebAssembly.Module(readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url)));
const fixture = JSON.parse(readFileSync(new URL('../rust/simulation_core/tests/permanent_revision_scenario.json', import.meta.url)));
const bridge = () => createCombatBridge(new WebAssembly.Instance(wasm));
const inputs = hp => ({ stats: { ...fixture.config.heroes[0].stats, hp }, host_max_hp: hp / 5.6, skill_modifiers: { special_potency: 1, meter_rate: 1 } });

test('revision scenario has identical native and wasm events, snapshots and gameplay hashes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ORKA-kx5y-parity-'));
  try {
    const output = join(directory, 'native.json');
    const native = spawnSync(process.env.CARGO || 'cargo', ['test', '--manifest-path', 'rust/simulation_core/Cargo.toml', '--locked', '--offline', 'native_revision_trace'], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 120000,
      env: { ...process.env, CARGO_TARGET_DIR: '/tmp/ORKA-kx5y-target', WF_REVISION_PARITY_OUTPUT: output },
    });
    assert.equal(native.status, 0, native.stderr + native.stdout);
    const b = bridge(), created = b.create(fixture.config), trace = [created];
    for (let step = 0; step < 12; step++) trace.push(b.step(created.world, {
      encounter_id: fixture.config.encounter_id, expected_previous_step: String(step), commands: step === 0 ? fixture.commands : [],
    }));
    assert.deepEqual(trace, JSON.parse(readFileSync(output)));
    b.destroy(created.world);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('driver coalesces revisions while paused, applies R1 at next step, deduplicates acknowledgements', () => {
  const b = bridge(), errors = [], snapshots = [];
  const driver = createCombatAuthorityDriver({ bridge: b, consume: (s,e) => snapshots.push({ snapshot:s,events:e }), onError:e => errors.push(e) });
  driver.start(fixture.config);
  driver.advance(0); driver.advance(1000, true);
  driver.replacePermanentInputs('Falie', inputs(560)); driver.replacePermanentInputs('Falie', inputs(700));
  assert.equal(driver.read().pendingRevisions, 1); assert.equal(driver.read().snapshot.actors[0].max_hp, 420);
  driver.advance(2000); driver.advance(2034);
  assert.equal(driver.read().snapshot.actors[0].max_hp, 700); assert.equal(driver.read().snapshot.actors[0].hp, 480);
  assert.equal(driver.read().revisions.Falie.acknowledged, '2'); assert.equal(driver.read().pendingRevisions, 0);
  const accepted = snapshots.at(-1); driver.accept(accepted);
  assert.equal(driver.read().snapshot.actors[0].hp, 480); assert.deepEqual(errors, []);
  driver.replacePermanentInputs('Falie', inputs(100)); driver.advance(2068);
  assert.equal(driver.read().snapshot.actors[0].hp, 100);
  const staleAck = structuredClone(accepted);
  staleAck.events = [structuredClone(accepted.events.find(e => e.body.kind === 'permanent_inputs_applied'))];
  staleAck.events[0].sequence = String(BigInt(driver.read().snapshot.last_event_sequence) + 1n);
  assert.throws(() => driver.accept(staleAck), /revision ack conflict/);
  driver.stop();
});

test('stale/duplicate revisions and invalid mixed batches leave step, HP, events and RNG hash unchanged', () => {
  const b = bridge(), created = b.create(fixture.config), original = b.inspect(created.world);
  const request = { encounter_id: fixture.config.encounter_id, expected_previous_step: '0', commands: fixture.commands };
  const mixed = structuredClone(request); mixed.commands.push(structuredClone(mixed.commands[0])); mixed.commands[1].sequence = '2'; mixed.commands[1].body.data.actor = 999;
  assert.throws(() => b.step(created.world, mixed)); assert.deepEqual(b.inspect(created.world), original);
  const applied = b.step(created.world, request), before = b.inspect(created.world);
  const duplicate = structuredClone(request); duplicate.expected_previous_step = '1'; duplicate.commands[0].step = '2'; duplicate.commands[0].sequence = '2';
  assert.throws(() => b.step(created.world, duplicate), /revision conflict/); assert.deepEqual(b.inspect(created.world), before);
  assert.equal(applied.events.filter(e => e.body.kind === 'permanent_inputs_applied').length, 1);
  b.destroy(created.world);
});

test('downed hero remains downed when revised in a live party', () => {
  const b = bridge(), config = structuredClone(fixture.config);
  config.heroes[0].hp = 0;
  config.heroes.push({ ...structuredClone(config.heroes[0]), instance_id: 'Huun', definition_id: 'slice.hero.hondo', slot: 1, hp: 420, formation_offset: { x: 90, y: 0 } });
  const created = b.create(config), result = b.step(created.world, { encounter_id: config.encounter_id, expected_previous_step: '0', commands: fixture.commands });
  assert.equal(result.snapshot.actors[0].hp, 0); assert.equal(result.snapshot.actors[0].downed, true);
  assert.ok(!result.events.some(e => ['revived', 'healed', 'died'].includes(e.body.kind)));
  b.destroy(created.world);
});

// Adapted from the independent verifier's phoenix.mjs.
test('real wasm Phoenix retains its committed recipient maximum through growth and shrink', () => {
  for (const maximum of [420, 840, 210, 100]) {
    const b = bridge(), config = structuredClone(fixture.config);
    config.heroes[0].hp = 0;
    config.heroes.push({ ...structuredClone(config.heroes[0]), instance_id: 'Huun', definition_id: 'slice.hero.hondo', slot: 1, hp: 420, formation_offset: { x: 100, y: 0 } });
    const created = b.create(config), events = [];
    let snapshot = created.snapshot;
    try {
      for (let i = 0; i < 250; i++) {
        const commands = [];
        if (i === 10) {
          assert.equal(snapshot.phoenix_channel.hero, snapshot.actors[0].actor_id);
          assert.ok(snapshot.phoenix_channel.progress > 0);
          const command = structuredClone(fixture.commands[0]);
          command.step = String(i + 1);
          command.body.data.stats.hp = maximum;
          command.body.data.host_max_hp = maximum / 5.6;
          command.body.data.skill_modifiers = { special_potency: 1, meter_rate: 1 };
          commands.push(command);
        }
        const result = b.step(created.world, { encounter_id: config.encounter_id, expected_previous_step: snapshot.step, commands });
        snapshot = result.snapshot; events.push(...result.events);
        if (snapshot.actors[0].hp > 0) break;
      }
      assert.equal(snapshot.actors[0].max_hp, maximum);
      assert.equal(snapshot.actors[0].hp, Math.min(168, maximum));
      const presentation = events.filter(e=>e.body.kind==='presentation').map(e=>e.body.data.event);
      const heals = presentation.filter(e => e.kind === 'healed' && e.data.source.kind === 'phoenix');
      assert.equal(heals.length, 1);
      assert.equal(heals[0].data.amount, Math.min(168, maximum));
      assert.equal(presentation.filter(e => e.kind === 'phoenix_completed').length, 1);
    } finally { b.destroy(created.world); }
  }
});

test('real wasm hash distinguishes accepted host maxima, independent stats and revision history', () => {
  const run = ({ host = 10, mag = 26.4, res = 28, revision = '1' } = {}) => {
    const b = bridge(), config = structuredClone(fixture.config), c = b.create(config);
    const commands = structuredClone(fixture.commands);
    Object.assign(commands[0].body.data, { revision, host_max_hp: host });
    Object.assign(commands[0].body.data.stats, { hp: 420, mag, res });
    try { return b.step(c.world, { encounter_id: config.encounter_id, expected_previous_step: '0', commands }).snapshot; }
    finally { b.destroy(c.world); }
  };
  const reference = run();
  for (const input of [{ host: 11 }, { mag: 27 }, { res: 29 }, { revision: '2' }]) {
    const alternate = run(input);
    assert.equal(reference.actors[0].hp, alternate.actors[0].hp);
    assert.notEqual(reference.gameplay_hash, alternate.gameplay_hash);
  }
});

test('real wasm create, marker spawn and revision preserve all four stat channels', () => {
  for (const markers of [false, true]) {
    const b = bridge(), config = structuredClone(fixture.config);
    config.spawn_markers = markers;
    Object.assign(config.heroes[0].stats, { atk: 7, def: 12, mag: 4, res: 8 });
    const c = b.create(config);
    try {
      assert.deepEqual(c.snapshot.actors[0].stats, { atk: 7, def: 12, mag: 4, res: 8 });
      const enemy = { spawn_key: 'djinn-channel', definition_id: 'wfm.enemy.djinn', position: { x: 700, y: 1100 }, stats: { ...config.heroes[0].stats, atk: 6, def: 3, mag: 26, res: 13 }, hp: 420 };
      const spawned = b.spawn(c.world, config.encounter_id, [enemy]);
      if (markers) assert.equal(spawned.snapshot.pending_spawns.length, 1);
      const commands = structuredClone(fixture.commands);
      Object.assign(commands[0].body.data.stats, { atk: 70, def: 120, mag: 40, res: 80 });
      let snapshot = b.step(c.world, { encounter_id: config.encounter_id, expected_previous_step: '0', commands }).snapshot;
      assert.deepEqual(snapshot.actors[0].stats, { atk: 70, def: 120, mag: 40, res: 80 });
      for (let i = 0; i < 180 && snapshot.pending_spawns.length; i++) {
        snapshot = b.step(c.world, { encounter_id: config.encounter_id, expected_previous_step: snapshot.step, commands: [] }).snapshot;
      }
      assert.equal(snapshot.pending_spawns.length, 0);
      assert.deepEqual(snapshot.actors.find(a => a.host_id === enemy.spawn_key).stats, { atk: 6, def: 3, mag: 26, res: 13 });
    } finally { b.destroy(c.world); }
  }
});
