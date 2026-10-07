import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRealtimeSkillGroundVfx } from '../web-runner/systems/realtimeSkillGroundPresentation.mjs';

test('committed ground cues follow recipients, preserve planted zones and expire on combat time without mutation', () => {
  const state = { globals: { ContinuousCombatStageLoop: 1, time: 2,
    RealtimeSkillZones: [{ kind: 'burn_sigil', sourceUID: 1, point: { x: 190, y: 180 }, radius: 60, appliedAt: 1, expiresAt: 5 }],
    RealtimeSkillEffects: {
      1: { cover: { sourceUID: 1, appliedAt: 1, expiresAt: 5 }, brace: { sourceUID: 1, appliedAt: 1, expiresAt: 5, charges: 1 } },
      2: { cover: { sourceUID: 1, appliedAt: 1, expiresAt: 5 }, destiny: { sourceUID: 1, appliedAt: 1, expiresAt: 5 } },
      3: { blight: { sourceUID: 1, appliedAt: 1, expiresAt: 5 } },
    } }, entities: [
    { uid: 1, kind: 'hero', hp: 10, footX: 90, footY: 220 },
    { uid: 2, kind: 'hero', hp: 10, footX: 120, footY: 250 },
    { uid: 3, kind: 'enemy', hp: 10, footX: 200, footY: 180 },
  ] };
  const draw = () => {
    const before = structuredClone(state), calls = [];
    const ctx = Object.fromEntries(['save', 'restore', 'beginPath', 'closePath', 'ellipse', 'fill', 'stroke', 'moveTo', 'lineTo', 'setLineDash', 'fillText']
      .map(name => [name, (...args) => calls.push([name, ...args])]));
    renderRealtimeSkillGroundVfx(ctx, { state, layoutScale: .5,
      worldToCanvas: (x, y) => ({ x: (360 - x) * .5 + 10, y: y * .5 + 20 }) });
    assert.deepEqual(state, before, 'renderer must never own simulation or effect lifetimes');
    return calls;
  };
  const initial = draw();
  assert.equal(initial.filter(c => c[0] === 'moveTo' && c[1] === 145 && c[2] === 134).length, 1, 'Cover marks its source once across self and recipient effects');
  assert.deepEqual(draw(), initial, 'paused combat clock freezes every cue');
  assert.ok(initial.some(c => c[0] === 'ellipse' && c[1] === 95 && c[2] === 110 && c[3] === 30 && c[4] === 30), 'zone uses recorded point and true world radius');
  assert.ok(initial.some(c => c[0] === 'lineTo' && c[1] === 130 && c[2] === 145), 'Cover follows current recipient foot');
  state.entities[0].footX = 50; state.entities[1].footY = 270;
  const moved = draw();
  assert.ok(moved.some(c => c[0] === 'ellipse' && c[1] === 95 && c[2] === 110 && c[3] === 30));
  assert.ok(moved.some(c => c[0] === 'lineTo' && c[1] === 130 && c[2] === 155));
  state.entities[0].hp = 0;
  const sourceKO = draw();
  assert.ok(!sourceKO.some(c => c[0] === 'ellipse' && c[3] === 30), 'caster-owned zone disappears with source KO');
  assert.ok(!sourceKO.some(c => c[0] === 'setLineDash'), 'Cover disappears with source KO');
  assert.ok(sourceKO.some(c => c[0] === 'ellipse' && c[1] === 90 && c[2] === 110), 'committed Blight survives source KO');
  state.entities[2].hp = 0;
  assert.ok(!draw().some(c => c[0] === 'ellipse' && c[1] === 90 && c[2] === 110));
  state.globals.time = 5;
  assert.ok(!draw().some(c => ['ellipse', 'fillText', 'lineTo'].includes(c[0])), 'exact expiry removes all cues');
  state.globals.time = 2; state.globals.ContinuousCombatStageLoop = 0;
  assert.deepEqual(draw(), [], 'unsupported scene keeps no presentation state');
});
