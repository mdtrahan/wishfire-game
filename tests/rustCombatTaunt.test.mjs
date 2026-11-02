import test from 'node:test';
import assert from 'node:assert/strict';
import { drawTauntIcons } from '../web-runner/systems/rustCombatTaunt.mjs';
import { SLICE_ACTOR_HEIGHT } from '../web-runner/systems/rustCombatArena.mjs';

const enemy = { actor_id: 2, team: 'enemy', kind: 'orc', hp: 100, scale: 1,
  pos: { x: 100, y: 200 }, taunted_by: 1, taunt_age: 0 };
const camera = { zoom: .5, x: x => x / 2, y: y => y * .375 };
function draw(actors, time = 0, view = camera) {
  const calls = [];
  const snapshot = { actors, time }, before = structuredClone(snapshot);
  drawTauntIcons({ bitmap: (...args) => calls.push(args) }, snapshot, view);
  assert.deepEqual(snapshot, before);
  return calls;
}

test('every living taunted enemy has one eye until its snapshot clears taunt', () => {
  const boss = { ...enemy, actor_id: 3, kind: 'boss', scale: 2.2 };
  const actors = [enemy, boss, { ...enemy, actor_id: 4, taunted_by: null },
    { ...enemy, actor_id: 5, hp: 0 }, { ...enemy, actor_id: 6, team: 'hero' }];
  assert.equal(draw(actors).length, 2);
  assert.equal(draw(actors.map(a => ({ ...a, taunt_age: 5.999 })), 6).length, 2);
  assert.equal(draw(actors.map(a => ({ ...a, taunted_by: null, taunt_age: null })), 6).length, 0);
  assert.equal(draw(actors.map(a => ({ ...a, hp: 0 }))).length, 0);
  assert.equal(draw([]).length, 0);
});

test('eye keeps full alpha, source pop and bob, and camera-scaled head placement', () => {
  for (const zoom of [.25, .5, 1]) for (const age of [0, .1, .2, 5.999]) {
    const view = { ...camera, zoom }, z = zoom / .5, time = 1.25;
    const [call] = draw([{ ...enemy, taunt_age: age }], time, view);
    const size = 20 * z * (1 + .35 * Math.sin(Math.PI * Math.min(age / .2, 1)));
    assert.deepEqual(call, ['warn', 0, 50,
      75 - SLICE_ACTOR_HEIGHT * .6 * zoom - 8 * z + Math.sin(time * 4) * 1.5 * z,
      size, size, 0, 1, 0xffdb80]);
  }
});
