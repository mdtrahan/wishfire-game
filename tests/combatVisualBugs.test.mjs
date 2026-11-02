import test from 'node:test';
import assert from 'node:assert/strict';
import { actorPuppetState } from '../web-runner/systems/actorPuppetPresentation.mjs';
import { SliceSprites } from '../web-runner/systems/rustCombatSprites.mjs';

test('dead enemies keep standing dimensions throughout the authoritative death fade', t => {
  const previous = globalThis.window;
  globalThis.window = { devicePixelRatio: 1 };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const a = { actor_id: 1, kind: 'gobloc', team: 'enemy', hp: 0, state: 'dead', scale: 1, pos: { x: 10, y: 20 } };
  assert.equal(actorPuppetState({ kind: 'enemy', hp: 0, actionState: 'dead' }, 0), 'idle');
  assert.equal(actorPuppetState({ kind: 'hero', hp: 0 }, 0), 'ko');
  const calls = [], noop = () => {}, ctx = { save: noop, restore: noop, translate: noop, rotate: noop, drawImage: noop };
  const sprites = Object.assign(Object.create(SliceSprites.prototype), {
    s: 1, ox: 0, oy: 0, camera: { x: x => x, y: y => y, zoom: .5 },
    state: { actors: new Map([[1, a]]), snapshot: { time: 0, combat_time: 0 }, effects: [] },
    motion: { records: new Map([[1, { visualX: 10, visualY: 20, dx: 0, lift: 0, sy: 1, dark: 0, immuneAt: -100, angle: 0 }]]), featured: () => true },
    gpu: { begin: noop, actor: (...args) => calls.push(args), composite: noop }, maskCtx: ctx,
  });
  const p = { frame: {}, clip: { canvas: { width: 80, height: 100 }, footOrigin: { x: 40, y: 95 } } };
  for (const age of [0, 1, 1.21, 1.42, 2]) {
    a.state_age = age;
    sprites.sprite(ctx, p, { rustActorId: 1, height: 50, footX: 10, footY: 20 });
  }
  assert.deepEqual(calls.map(c => c.slice(3, 5)), Array(5).fill([40, 50]));
  assert.deepEqual(calls.map(c => Math.round(c[5] * 100)), [100, 100, 50, 0, 0]);
});
