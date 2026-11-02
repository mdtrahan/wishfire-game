const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('enemy HP tracks exactly match hero geometry and suppress enemy meters', async () => {
  const { drawSliceActorBars } = await import('../web-runner/systems/rustCombatWorldHud.mjs');
  for (const zoom of [.5, .8]) for (const scale of [.6, 1, 1.5]) {
    const calls = [];
    const ctx = new Proxy({}, { get: (target, key) => key in target ? target[key] : (...args) => { if (key === 'fillRect') calls.push({ rect: args, color: target.fillStyle }); }, set: (target, key, value) => { target[key] = value; return true; } });
    const actor = { pos: { x: 100, y: 200 }, kind: 'gobloc', hp: 50, max_hp: 100, groove: 'power', meter: 3 };
    const snapshot = { actors: [{ ...actor, kind: 'fara', team: 'hero' }, { ...actor, team: 'enemy' }, { ...actor, team: 'enemy', kind: 'boss' }] };
    const before = structuredClone(snapshot);
    drawSliceActorBars(ctx, snapshot, { zoom, x: x => x, y: y => y }, scale, 0, 0);
    assert.equal(calls.length, 6); // hero track + full meter/glow; enemy track only
    assert.deepEqual(calls[0].rect.slice(2), calls[5].rect.slice(2));
    assert.equal(calls[5].color, '#292E34');
    assert.equal(calls[5].rect[1], 204);
    assert.deepEqual(snapshot, before);
  }
});

test('enemy HP bars paint flat vector tracks without sprite sampling', async () => {
  const { drawCombatHealthBar } = await import('../web-runner/systems/combatHealthBarPresentation.mjs');
  const calls = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => { assert.notEqual(key, 'drawImage'); calls.push([key, ...args]); }, set: () => true });
  drawCombatHealthBar(ctx, { x: 10, y: 20, width: 48, height: 4, fillWidth: 24, trailWidth: 36, team: 'enemy' });
  assert.deepEqual(calls.filter(([key]) => key === 'roundRect').map(call => call[3]), [48, 36, 24, 48]);
  assert.equal(calls.filter(([key]) => key === 'fill').length, 2);
});
