import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';
import { createCombatShadowDriver } from '../web-runner/src/core/combatShadowDriver.mjs';
import { installRustCombatShadow } from '../web-runner/systems/rustCombatShadow.mjs';

const wasm = new WebAssembly.Module(readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url)));
const stats = { hp: 500, atk: 10, def: 5, speed: 100, reach: 80, interval: 1, evade: 0, special: 10 };
const enemy = (id = 'spawn-1') => ({ spawn_key: id, definition_id: 'slice.enemy.gobloc',
  position: { x: 500, y: 400 }, stats: { ...stats }, hp: 500 });
const config = () => ({ encounter_id: 'host-stage', seed: '7',
  geometry: { floor: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    viewport_world: { x: 720, y: 760 }, formation_origin: { x: 500, y: 500 }, screen_bound: false },
  heroes: [{ instance_id: 'Falie#1', definition_id: 'slice.hero.fara', slot: 0,
    formation_offset: { x: 0, y: 0 }, stats: { ...stats }, hp: 500 }], enemies: [enemy()] });
function setup(overrides = {}) {
  const bridge = createCombatBridge(new WebAssembly.Instance(wasm));
  const warnings = [];
  return { bridge, warnings, driver: createCombatShadowDriver({ bridge: { ...bridge, ...overrides }, warn: (...args) => warnings.push(args) }) };
}
function noLeaks(bridge) { assert.deepEqual(bridge.describe().resources, { worlds: 0, responses: 0, inputs: 1 }); }
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

test('scripted host start, wave spawns and stage end leave frozen JS combat, saves and economy byte-identical and leak no worlds', () => {
  const { driver, bridge, warnings } = setup();
  const js = freeze({ entities: [{ hp: 75 }], saves: { gold: 20 }, rewards: [], outcome: 'running' });
  const before = JSON.stringify(js), cfg = freeze(config());
  for (let attempt = 0; attempt < 3; attempt++) {
    driver.start(cfg, 0);
    for (let tick = 1; tick <= 60; tick++) {
      driver.advance({ time: tick / 30, enemies: tick >= 15 ? [enemy(), enemy('wave-2')] : [enemy()], comparison: js });
    }
    const view = driver.read();
    assert.equal(view.snapshot.step, '60'); assert.equal(view.snapshot.actors.length, 3);
    assert.equal(view.snapshot.actors.filter(a => a.team === 'enemy').length, 2);
    assert.deepEqual(view.js, js); view.js.saves.gold = 999;
    assert.equal(JSON.stringify(js), before);
    driver.stop(); driver.stop(); noLeaks(bridge);
  }
  assert.deepEqual(warnings, []);
});

test('30 Hz stepping follows admitted host time; pauses reset debt and stalled frames have a bounded budget', () => {
  const { driver, bridge } = setup(); driver.start(config(), 0);
  driver.advance({ time: .5 / 30 }); assert.equal(driver.read().snapshot.step, '0');
  driver.advance({ time: 1 / 30 }); assert.equal(driver.read().snapshot.step, '1');
  driver.advance({ time: 100, paused: true });
  driver.advance({ time: 200 }); assert.equal(driver.read().snapshot.step, '1');
  driver.advance({ time: 201 }); assert.equal(driver.read().snapshot.step, '8');
  driver.stop(); noLeaks(bridge);
});

test('bridge failure disables this session once, destroys the world and prevents future calls', () => {
  let calls = 0;
  const { driver, bridge, warnings } = setup({ step: () => { calls++; throw new Error('bridge fault'); } });
  driver.start(config(), 0); driver.advance({ time: 1 / 30 });
  assert.equal(driver.read().disabled, true); assert.equal(driver.read().active, false);
  driver.start(config(), 0); driver.advance({ time: 1 });
  assert.equal(calls, 1); assert.equal(warnings.length, 1); noLeaks(bridge);
});

test('additive spawn validates batches atomically, rejects duplicate IDs and can follow a cleared wave', () => {
  const { bridge } = setup(), cfg = config();
  cfg.enemies[0].hp = 0;
  const created = bridge.create(cfg); assert.equal(created.snapshot.state, 'ended');
  const before = bridge.inspect(created.world);
  assert.throws(() => bridge.spawn(created.world, cfg.encounter_id, [enemy('valid'), { ...enemy('invalid'), position: { x: -1, y: 0 } }]));
  assert.deepEqual(bridge.inspect(created.world), before);
  assert.throws(() => bridge.spawn(created.world, 'wrong', [enemy('valid')]), e => e.code === 'step_conflict');
  const next = bridge.spawn(created.world, cfg.encounter_id, [enemy('valid')]);
  assert.equal(next.snapshot.state, 'running'); assert.equal(next.snapshot.live_enemies, 1);
  assert.equal(next.snapshot.step, '0');
  assert.throws(() => bridge.spawn(created.world, cfg.encounter_id, [enemy('valid')]));
  bridge.destroy(created.world); noLeaks(bridge);
});

test('flag-off and non-dev origins never load runtime or bridge, instantiate WASM, or call combat exports', async () => {
  let loads = 0;
  const load = () => { loads++; throw new Error('must not load'); };
  for (const location of [{ hostname: 'localhost', search: '' }, { hostname: 'localhost', search: '?rustShadow=0' },
    { hostname: 'example.com', search: '?rustShadow=1' }]) {
    assert.equal(installRustCombatShadow({}, { location, load }), undefined);
  }
  assert.equal(loads, 0);
});

test('flag-on lazy startup failure warns once without rejecting into the game', async () => {
  const warnings = [];
  const controller = installRustCombatShadow({}, { location: { hostname: 'localhost', search: '?rustShadow=1' },
    load: async () => { throw new Error('missing WASM'); }, warn: (...args) => warnings.push(args) });
  await controller.ready; controller.update(); controller.dispose();
  assert.equal(warnings.length, 1);
});
