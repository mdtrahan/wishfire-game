import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
test('bombs stay upright for both teams through launch, apex and landing', () => {
  const source = readFileSync(new URL('../web-runner/systems/rustCombatPresentation.mjs', import.meta.url), 'utf8');
  const loop = source.slice(source.indexOf('    for(const p of snapshot.projectiles??[])'), source.indexOf("    for(const a of snapshot.actors)if(a.team==='enemy'&&a.hp>0&&a.slowed>0)"));
  assert.ok(loop.length > 0);
  const draw = new Function('snapshot', 'camera', 'state', 'gpu', 'z', loop);
  const calls = [], camera = { x: x => x, y: y => y, zoom: .5 };
  for (const team of ['hero', 'enemy']) for (const height of [0, 40, 100, 40, 0]) for (const dir of [{ x: -1, y: 1 }, { x: 1, y: -1 }, { x: 0, y: -1 }]) {
    const snapshot = { projectiles: [{ id: 1, kind: 'bomb', team, pos: { x: 10, y: 20 }, height, dir }] }, before = structuredClone(snapshot);
    draw(snapshot, camera, { projectiles: new Map() }, { bitmap: (...args) => calls.push(args) }, 1);
    assert.deepEqual(snapshot, before);
  }
  assert.equal(calls.length, 30);
  for (const c of calls) { assert.equal(c[0], 'bomb'); assert.equal(c[6], 0); }
});


test('idle formation drops exactly 1.5 painted hero heights while clearing the bottom HUD', async () => {
  const { SLICE_FLOOR, SLICE_ORIGIN, SLICE_TRAVEL_SLOTS, sliceHeroPosition } = await import('../web-runner/systems/rustCombatArena.mjs');
  const { createSliceCombatCamera } = await import('../web-runner/systems/rustCombatCamera.mjs');
  const { HERO_COOLDOWN_LAYOUT } = await import('../web-runner/systems/heroCooldownStrip.mjs');
  const oldOriginY = (SLICE_FLOOR.min.y + SLICE_FLOOR.max.y) / 2 + 80;
  const actors = SLICE_TRAVEL_SLOTS.map((offset, slot) => ({ team: 'hero', actor_id: slot + 1, kind: 'fara', hp: 100, scale: 1, state: 'idle', pos: sliceHeroPosition(slot) }));
  const snapshot = { actors, geometry: { floor: SLICE_FLOOR } }, before = structuredClone(snapshot);
  const camera = createSliceCombatCamera();
  camera.update(snapshot, 1);
  for (const [width, height, dpr] of [[360, 640, 1], [216, 384, 2], [233, 452, 1], [316, 452, 2]]) {
    const scale = Math.min(width / 360, height / 640), heroHeight = 128 * .6 * camera.zoom * scale;
    for (const [slot, actor] of actors.entries()) {
      const oldY = oldOriginY + SLICE_TRAVEL_SLOTS[slot].y;
      const drop = (camera.y(actor.pos.y) - camera.y(oldY)) * scale;
      assert.ok(Math.abs(drop - 1.5 * heroHeight) < 1e-9);
      const hpBottom = (camera.y(actor.pos.y) + 8 + 1.5) * scale;
      const bottomHudTop = (HERO_COOLDOWN_LAYOUT.top - 14) * scale;
      assert.ok(hpBottom < bottomHudTop, `${width}x${height}@${dpr}: hero and HP clear the cooldown/bag/navigation band`);
      assert.equal(actor.pos.x, SLICE_ORIGIN.x + SLICE_TRAVEL_SLOTS[slot].x);
    }
  }
  assert.deepEqual(snapshot, before);
});
