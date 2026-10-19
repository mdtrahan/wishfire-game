import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { arenaBackgroundAsset, drawCombatArenaBackground } from '../web-runner/systems/combatArenaBackground.mjs';
import { createCombatCameraProjection } from '../src/core/combatOrientation.mjs';

test('only chapters 1–4 resolve to shipped artwork; later chapters keep the grid', () => {
  for (let chapter = 1; chapter <= 4; chapter++) {
    assert.ok(existsSync(new URL('../web-runner/assets/' + arenaBackgroundAsset(chapter), import.meta.url)));
  }
  for (const chapter of [0, 1.5, 5, 6, 100, NaN]) assert.equal(arenaBackgroundAsset(chapter), null);
});

test('decoded panorama follows both camera orientations and leaves pending/later art unpainted', () => {
  const previous = globalThis.Image;
  const loaded = [];
  globalThis.Image = class {
    complete = false;
    naturalWidth = 0;
    constructor() { loaded.push(this); }
  };
  const calls = [];
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'scale', 'drawImage'].map(key => [key, (...args) => calls.push([key, ...args])]));
  const options = orientation => ({
    region: 1, worldWidth: 2160, layoutH: 640,
    project: createCombatCameraProjection({ centerX: 1080, orientation }).project,
    worldToCanvas: (x, y) => ({ x: x * 1.25 + 20, y: y * 1.25 + 10 }),
  });
  // The renderer's project already includes the outer Canvas scale and offset.
  const scaled = orientation => {
    const value = options(orientation);
    const project = value.project;
    value.project = (x, y) => { const p = project(x, y); return { x: p.x * 1.25 + 20, y: p.y * 1.25 + 10 }; };
    return value;
  };
  try {
    assert.equal(drawCombatArenaBackground(ctx, scaled('left-wise')), false);
    assert.deepEqual(calls, []);
    loaded[0].complete = true;
    loaded[0].naturalWidth = 1728;
    for (const orientation of ['left-wise', 'right-wise']) {
      calls.length = 0;
      assert.equal(drawCombatArenaBackground(ctx, scaled(orientation)), true);
      assert.deepEqual(calls.find(c => c[0] === 'scale'), ['scale', orientation === 'right-wise' ? -1 : 1, 1]);
      assert.deepEqual(calls.find(c => c[0] === 'drawImage').slice(2), [0, 0, 1350, 800]);
      assert.equal(calls.find(c => c[0] === 'translate')[2], 10);
    }
    calls.length = 0;
    assert.equal(drawCombatArenaBackground(ctx, { ...scaled('left-wise'), region: 5 }), false);
    assert.deepEqual(calls, []);
    assert.equal(loaded.length, 1);
  } finally { globalThis.Image = previous; }
});
