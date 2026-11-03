import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSliceCombatCamera, COMBAT_VIEW } from '../web-runner/systems/rustCombatCamera.mjs';
import { SLICE_FLOOR } from '../web-runner/systems/rustCombatArena.mjs';
import { SliceSpotlightCamera } from '../web-runner/systems/rustCombatSpotlightCamera.mjs';
const trace = JSON.parse(fs.readFileSync(new URL('./fixtures/slice-camera-stage7.json', import.meta.url)));
const hero = (actor_id, x, y) => ({ actor_id, kind: 'hondo', team: 'hero', hp: 100, scale: 1, state: 'idle', pos: { x, y } });
const snapshot = () => ({ encounter_id: 'camera-proof', time: 0, camera_focus: { x: 456, y: 650 }, geometry: { floor: structuredClone(SLICE_FLOOR) }, actors: [hero(1, 418, 650), hero(2, 494, 650)], hazards: [], projectiles: [] });
const near = (a, b, tolerance = .003) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const frame = c => [c.centreX, c.centreY, c.zoom];
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };

test('recorded seed-7 WFM ordinary and boss snapshots match pinned Rust f32 formulas', () => {
  const camera = createSliceCombatCamera();
  for (const { snapshot: s, dt, expected } of trace.frames) {
    const before = structuredClone(s); freeze(s); camera.update(s, dt);
    frame(camera).forEach((value, i) => near(value, expected[i]));
    assert.deepEqual(s, before);
  }
  assert.ok(trace.frames.some(f => f.snapshot.actors.some(a => a.kind.startsWith('boss'))));
});

test('D13 keeps approved gameplay floor and viewport geometry', () => {
  const height = SLICE_FLOOR.max.y - SLICE_FLOOR.min.y;
  const useful = (COMBAT_VIEW.bottom - COMBAT_VIEW.top) / (.5 * .75);
  assert.equal((SLICE_FLOOR.max.x - SLICE_FLOOR.min.x) * .5, 360);
  near(height, useful, 1e-12);
  near(SLICE_FLOOR.max.y, 1074.6666666666667, 1e-9);
  assert.equal(COMBAT_VIEW.top, 42); assert.equal(COMBAT_VIEW.bottom, 430);
});

test('nearest spawn marker supplies 30% look-ahead; springs have no positional dead zone', () => {
  const s = snapshot(); s.geometry.floor = { min: { x: 0, y: 0 }, max: { x: 6000, y: 6000 } };
  s.actors = [hero(1, 2900, 3000), hero(2, 3100, 3000)]; s.camera_focus = { x: 3000, y: 2950 };
  const camera = createSliceCombatCamera(); camera.update(s, 0);
  near(camera.centreX, 3000); near(camera.centreY, 2950);
  s.hazards = [{ kind: 'spawn_marker', origin: { x: 3100, y: 3100 } }];
  camera.update(s, .1);
  near(camera.centreX, 3000 + 30 * (1 - (1 + .35) * Math.exp(-.35)), 1e-9);
  near(camera.centreY, 2950 + 30 * (1 - (1 + .7) * Math.exp(-.7)), 1e-9);
  assert.ok(camera.centreX > 3000);
});

test('arena clamp, body overscan and infeasible groups preserve party priority', () => {
  const s = snapshot(), camera = createSliceCombatCamera();
  for (const y of [SLICE_FLOOR.min.y + 210, SLICE_FLOOR.max.y - 30]) {
    s.actors = [hero(1, 456, y)]; camera.reset(); camera.update(s, 1);
    near(camera.centreX, 456);
    assert.ok(camera.y(y - 210) >= COMBAT_VIEW.top - .001);
    assert.ok(camera.y(y + 30) <= COMBAT_VIEW.bottom + .001);
    assert.ok(camera.centreY >= SLICE_FLOOR.min.y + 388 / .75 - .001);
    assert.ok(camera.centreY <= SLICE_FLOOR.max.y - 388 / .75 + .001);
  }
  s.actors = [hero(1, 100, 650), hero(2, 1000, 650), { ...hero(3, 4000, 650), kind: 'boss', team: 'enemy' }];
  camera.reset(); camera.update(s, 1);
  near(camera.centreX, 550); assert.equal(camera.zoom, .5);
  near(camera.x(100 - 96), 360 - camera.x(1000 + 96));
  s.actors = [hero(1, 456, 70)]; camera.reset(); camera.update(s, 1);
  assert.ok(camera.centreY < SLICE_FLOOR.min.y + 388 / .75);
  near(camera.y(70 - 210), 42);
});

test('real WFM Idle boss ignores generic Spawned, stays inside floor and holds on defeat/reset', () => {
  const s = structuredClone(trace.frames.find(f => f.snapshot.time === 0 && f.snapshot.actors.some(a => a.kind.startsWith('boss'))).snapshot);
  const boss = s.actors.find(a => a.kind.startsWith('boss'));
  assert.equal(boss.state, 'idle');
  const camera = createSliceCombatCamera(), control = createSliceCombatCamera();
  const events = [{ body: { kind: 'spawned', data: { actor: boss.actor_id, kind: boss.kind } } }];
  camera.update(s, 0, events); control.update(s, 0);
  assert.deepEqual(frame(camera), frame(control));
  const initial = frame(camera); camera.update(s, 0); assert.deepEqual(frame(camera), initial);
  near(camera.centreX, 456);
  assert.ok(camera.y(boss.pos.y - 370) >= COMBAT_VIEW.top - .003);
  assert.ok(camera.centreY <= s.geometry.floor.max.y - 388 / .75 + .003);
  s.actors.forEach(a => { a.hp = 0; a.state = 'dead'; }); camera.update(s, 1);
  assert.deepEqual(frame(camera), initial);
  const reset = snapshot(); reset.encounter_id = 'next-attempt'; camera.update(reset, 0);
  const fresh = createSliceCombatCamera(); fresh.update(reset, 0); assert.deepEqual(frame(camera), frame(fresh));
});

test('runtime has one combat projection and no retired enemy hit helper', () => {
  const runtime = fs.readFileSync(new URL('../web-runner/systems/renderRuntime.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../web-runner/app.js', import.meta.url), 'utf8');
  const orientation = fs.readFileSync(new URL('../src/core/combatOrientation.mjs', import.meta.url), 'utf8');
  for (const source of [runtime, app, orientation]) assert.doesNotMatch(source, /createCombatCameraProjection/);
  assert.doesNotMatch(app, /combatActorWorldToCanvas|getEnemyHit/);
  assert.match(runtime, /if \(!state\.globals\.RustCombatPresentation\) \{\s*drawStartupLoadingFrame\(\);\s*return;/);
});

test('normal follow freezes through spotlight/hit-stop and excludes downed/dead heroes', () => {
  const s = snapshot(), camera = createSliceCombatCamera(); camera.update(s, 0); const held = frame(camera);
  s.actors[0].pos.y += 300; s.spotlight = {}; camera.update(s, 1); assert.deepEqual(frame(camera), held);
  delete s.spotlight; s.hit_stop = {}; camera.update(s, 1); assert.deepEqual(frame(camera), held);
  delete s.hit_stop; s.actors[0].state = 'downed';
  const only = structuredClone(s); only.actors.shift(); const a = createSliceCombatCamera(), b = createSliceCombatCamera();
  a.update(s, 0); b.update(only, 0); assert.deepEqual(frame(a), frame(b));
});

const spotlight = (extra = {}) => ({ caster: 1, started: 0, participants: [1], hazards: [], entry: 1.2, ...extra });
function apply(camera, spot, s, reduced = false, wallDt = 0) { const before = structuredClone(s); camera.update(s, 0); spot.active = s.spotlight; spot.apply(camera, s, reduced, wallDt); assert.deepEqual(s, before); }
test('spotlight enters with 1.2s smoothstep and corrects the asymmetric safe-band centre', () => {
  const s = snapshot(), camera = createSliceCombatCamera(), spot = new SliceSpotlightCamera({});
  camera.update(s, 0); const normal = frame(camera); s.spotlight = spotlight();
  apply(camera, spot, s); near(camera.zoom, .5);
  s.time = .6; apply(camera, spot, s); near(camera.zoom, .65, 1e-12);
  s.time = 1.2; apply(camera, spot, s); near(camera.zoom, .8, 1e-12);
  // Hero fallback body at .6 visual scale, with 12 projected-world units of padding.
  const boxMid = 650 * .75 + (-110 * .6 + 5 * .6) / 2;
  near(camera.centreY, (boxMid + 2 / .8) / .75, 1e-9);
  assert.deepEqual(normal[2], .5);
});

test('spotlight holds expanding core, excludes nonparticipants, and returns calmly on frozen sim time', () => {
  const s = snapshot(), camera = createSliceCombatCamera(), spot = new SliceSpotlightCamera({});
  const before = structuredClone(s); camera.update(s, 0); s.spotlight = spotlight(); s.actors[1].pos.x = 4000;
  apply(camera, spot, s, true); const featured = frame(camera);
  s.actors[1].pos.x = 6000; apply(camera, spot, s, true); assert.deepEqual(frame(camera), featured);
  s.actors[0].pos.x += 100; apply(camera, spot, s, true); const expanded = { ...spot.held };
  s.actors[0].pos.x -= 100; apply(camera, spot, s, true); assert.deepEqual(spot.held, expanded);
  s.spotlight = null; apply(camera, spot, s, false, .25); near(camera.zoom, .65, 1e-12);
  apply(camera, spot, s, false, .25); assert.equal(spot.current, null); near(camera.zoom, .5);
  const fresh = createSliceCombatCamera(); fresh.update({ ...before, encounter_id: s.encounter_id }, 0);
  near(camera.centreX, fresh.centreX);
  s.spotlight = spotlight({ started: 2 }); apply(camera, spot, s, true); near(camera.zoom, .8);
  s.spotlight = null; apply(camera, spot, s, true); assert.equal(spot.current, null);
});

const castEvent = (skill = 'shadow', id = 1, target = 3) => ({ sequence: '1', body: { kind: 'presentation', data: { event: { kind: 'skill_started', data: { id, skill, target } } } } });
function observedAttack() {
  const s = snapshot();
  s.actors[0] = { ...s.actors[0], state: 'cast', special_casting: true, state_duration: .7 };
  s.actors.push({ ...hero(3, 470, 620), team: 'enemy' });
  return s;
}
test('offensive cast observations zoom within the attack and return without writing snapshot or events', () => {
  const s = observedAttack(), camera = createSliceCombatCamera(), spot = new SliceSpotlightCamera({}), events = freeze([castEvent()]);
  const draw = () => { const before = structuredClone(s); spot.observe(freeze(s), events); camera.update(s, 0); spot.apply(camera, s, false); assert.deepEqual(s, before); };
  draw(); near(camera.zoom, .5); assert.equal(s.spotlight, undefined);
  const advance = (time, casting = true) => {
    const next = structuredClone(s); next.time = time; next.actors[0].special_casting = casting;
    const before = structuredClone(next); spot.observe(freeze(next)); camera.update(next, 0); spot.apply(camera, next, false); assert.deepEqual(next, before);
  };
  advance(.175); near(camera.zoom, .65, 1e-12);
  advance(.35); near(camera.zoom, .8, 1e-12);
  advance(.45); near(camera.zoom, .8, 1e-12);
  advance(.7, false); assert.equal(spot.active, null); near(camera.zoom, .65, 1e-12);
  advance(.95, false); near(camera.zoom, .5, 1e-12); assert.equal(spot.current, null);
});
test('support skills and enemy casts cannot start presentation spotlight', () => {
  for (const skill of ['taunt', 'elevate', 'healing_spring', 'crimson_ward', 'faze']) {
    const s = freeze(observedAttack()), spot = new SliceSpotlightCamera({});
    spot.observe(s, freeze([castEvent(skill)])); assert.equal(spot.active, null);
  }
  const s = observedAttack(), spot = new SliceSpotlightCamera({}); s.actors[0].team = 'enemy';
  spot.observe(freeze(s), freeze([castEvent()])); assert.equal(spot.active, null);
});
test('attack framing ends at owned hazard completion, caster loss or encounter replacement', () => {
  const s = observedAttack(), spot = new SliceSpotlightCamera({}); spot.observe(s, [castEvent('ground_pound')]);
  s.actors[0].special_casting = false;
  s.hazards = [{ id: 9, owner: 1, kind: 'ground_pound', phase: 'active' }]; spot.observe(s); assert.deepEqual(spot.active.hazards, [9]);
  s.hazards[0].phase = 'resolved'; spot.observe(s); assert.equal(spot.active, null);
  spot.observe(s, [castEvent()]); s.actors[0].hp = 0; spot.observe(s); assert.equal(spot.active, null);
  s.actors[0].hp = 100; spot.observe(s, [castEvent()]); s.encounter_id = 'next'; spot.observe(s); assert.equal(spot.active, null); assert.equal(spot.current, null);
});

test('a frozen terminal cast cannot hold framing past its committed attack duration', () => {
  const s = observedAttack(), spot = new SliceSpotlightCamera({});
  spot.observe(s, [castEvent()]); s.time = .7; spot.observe(freeze(s)); assert.equal(spot.active, null);
});


test('spotlight contains caster and every target; nonparticipants may cross the frame until return ends', () => {
  const boxes = JSON.parse(fs.readFileSync(new URL('../web-runner/assets/rust-combat/manifest.json', import.meta.url))).actor_boxes;
  const s = observedAttack(), camera = createSliceCombatCamera(), spot = new SliceSpotlightCamera(boxes);
  s.actors[1].pos.x = 850;
  s.actors.push({ ...hero(4, 500, 640), kind: 'orc', team: 'enemy' });
  const contained = a => {
    const scale = a.scale * (a.kind.startsWith('boss') ? 1 : .6);
    for (const q of [[-55,-110,55,5], boxes[a.kind]?.idle, boxes[a.kind]?.[a.state]].filter(Boolean)) {
      assert.ok(camera.x(a.pos.x + q[0] * scale) >= COMBAT_VIEW.left, `${a.actor_id} left`);
      assert.ok(camera.x(a.pos.x + q[2] * scale) <= COMBAT_VIEW.right, `${a.actor_id} right`);
      assert.ok(camera.y(a.pos.y) + q[1] * scale * camera.zoom >= COMBAT_VIEW.top, `${a.actor_id} top`);
      assert.ok(camera.y(a.pos.y) + q[3] * scale * camera.zoom <= COMBAT_VIEW.bottom, `${a.actor_id} bottom`);
    }
  };
  const draw = (time, events = [], wallDt = 0) => {
    s.time = time;
    const before = structuredClone(s);
    spot.observe(s, events); camera.update(s, 0); spot.apply(camera, s, false, wallDt);
    assert.deepEqual(s, before);
    const participants = spot.current?.participants;
    for (const a of s.actors.filter(a => a.hp > 0 && (!participants || participants.includes(a.actor_id)))) contained(a);
  };
  camera.update(s, 0); s.actors.forEach(contained);
  draw(0, [castEvent()]); draw(.175); draw(.35, [{ body: { kind: 'damage', data: { source: 1, target: 4 } } }]);
  assert.deepEqual(spot.current.participants, [1,3,4]);
  assert.ok(camera.x(s.actors[1].pos.x) > COMBAT_VIEW.right);
  draw(.5);
  s.actors[0].special_casting = false;
  draw(.7); assert.equal(spot.active, null); assert.deepEqual(spot.current.participants, [1,3,4]);
  draw(.7, [], .3); assert.equal(spot.current, null);
  s.actors.forEach(contained);
});


test('spotlight return keeps the moving boss participant inside the visible band', () => {
  const boxes = JSON.parse(fs.readFileSync(new URL('../web-runner/assets/rust-combat/manifest.json', import.meta.url))).actor_boxes;
  const s = snapshot(), camera = createSliceCombatCamera(), spot = new SliceSpotlightCamera(boxes);
  s.actors = [hero(1, 340, 910), { ...hero(5, 576, 934), kind: 'boss', team: 'enemy', scale: 2.2, state: 'walk' }];
  camera.update(s, 0);
  // Seed-7 Fara/boss frame at attack completion; the target keeps walking during return.
  spot.current = { x: 503.735, y: 859.47, z: .8, participants: [1,5] };
  spot.key = '1:cast'; spot.time = 0;
  for (let step = 1; step <= 15; step++) {
    s.time = step / 30;
    s.actors[1].pos.x = 576 + step * 5.312;
    s.actors[1].pos.y = 934 - step * 3.556;
    const before = structuredClone(s);
    camera.update(s, 1/30); spot.apply(camera, s, false);
    const t = Math.min(1, s.time / .5);
    near(camera.zoom, .8 + (.5 - .8) * t * t * (3 - 2 * t), 1e-12);
    for (const a of s.actors) {
      const q = [-64, -125, 64, 3], scale = a.scale * (a.kind === 'boss' ? 1 : .6);
      assert.ok(camera.x(a.pos.x + q[0] * scale) >= COMBAT_VIEW.left, `step ${step}: ${a.actor_id} left`);
      assert.ok(camera.x(a.pos.x + q[2] * scale) <= COMBAT_VIEW.right, `step ${step}: ${a.actor_id} right`);
      assert.ok(camera.y(a.pos.y) + q[1] * scale * camera.zoom >= COMBAT_VIEW.top, `step ${step}: ${a.actor_id} top`);
      assert.ok(camera.y(a.pos.y) + q[3] * scale * camera.zoom <= COMBAT_VIEW.bottom, `step ${step}: ${a.actor_id} bottom`);
    }
    assert.deepEqual(s, before);
  }
  assert.equal(spot.current, null);
});
