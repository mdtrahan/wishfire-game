import test from 'node:test';
import assert from 'node:assert/strict';
import { actorClipAgeMs, actorPuppetKey, actorPuppetState, actorScreenFacing, createActorPuppetPresentation, drawActorPuppetFrame } from '../web-runner/systems/actorPuppetPresentation.mjs';

const clip = Object.freeze({ frames: [{ frame: 0 }, { frame: 1 }], frameHoldMs: [500, 500], durationMs: 1000, impactTimeMs: 400, releaseTimeMs: 500, loop: false, canvas: { width: 128, height: 128 }, footOrigin: { x: 64, y: 125 } });

test('puppet selection uses semantic actor state and leaves unsupported actors on static art', () => {
  assert.equal(actorPuppetKey({ portraitName: 'Fara' }), 'fara');
  assert.equal(actorPuppetKey({ name: 'Gobloc' }), 'gobloc');
  assert.equal(actorPuppetKey({ portraitName: 'portrait_fara_alt', baseHeroName: 'Falie' }), 'fara');
  assert.equal(actorPuppetKey({ portraitName: 'Hondo' }), null);
  assert.equal(actorPuppetState({ hp: 3, locomotion: 'walk' }, 4), 'walk');
  assert.equal(actorPuppetState({ hp: 3, actionState: 'basic', actionStateUntil: 5 }, 4), 'basic');
  assert.equal(actorPuppetState({ hp: 0, actionState: 'basic', actionStateUntil: 5 }, 4), 'ko');
});

test('puppet clips face the projected target direction once per combat orientation', () => {
  assert.equal(actorScreenFacing('right', 'left-wise'), 'right');
  assert.equal(actorScreenFacing('left', 'left-wise'), 'left');
  assert.equal(actorScreenFacing('right', 'right-wise'), 'left');
  assert.equal(actorScreenFacing('left', 'right-wise'), 'right');
});

test('puppet presentation aligns native markers without changing simulation timing', async () => {
  const basic = { hp: 10, actionState: 'basic', actionStateStartedAt: 10, actionImpactAt: 10.52, actionStateUntil: 10.72, facing: 'left' };
  assert.equal(actorClipAgeMs(basic, 'basic', clip, 10.52), 400);
  assert.equal(actorClipAgeMs({ ...basic, actionState: 'cast', actionImpactAt: 10 }, 'cast', clip, 10), 500);
  const presentation = createActorPuppetPresentation({ loadClip: async () => clip });
  assert.equal(presentation.frameFor({ ...basic, portraitName: 'Fara' }, 10), null);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(presentation.frameFor({ ...basic, portraitName: 'Fara' }, 10.52)?.state, 'basic');
});

test('locomotion and KO age from the simulation clock while action facing remains committed', () => {
  const walk = { hp: 10, locomotion: 'walk', locomotionStartedAt: 4 };
  assert.equal(actorClipAgeMs(walk, 'walk', clip, 4), 0);
  assert.ok(Math.abs(actorClipAgeMs(walk, 'walk', clip, 4.6) - 600) < 1e-6);
  const ko = { hp: 0, actionStateStartedAt: 5 };
  assert.ok(Math.abs(actorClipAgeMs(ko, 'ko', clip, 5.6) - 600) < 1e-6);
});

test('active cues retain their facing snapshot until their simulation window ends', async () => {
  const presentation = createActorPuppetPresentation({ loadClip: async () => clip });
  const actor = { hp: 10, portraitName: 'Fara', actionState: 'basic', actionStateStartedAt: 2, actionImpactAt: 2.52, actionStateUntil: 2.72, actionFacing: 'left', facing: 'right' };
  presentation.frameFor(actor, 2);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(presentation.frameFor(actor, 2.1)?.facing, 'left');
  assert.equal(presentation.frameFor(actor, 2.1, 'right-wise'), null);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(presentation.frameFor(actor, 2.1, 'right-wise')?.facing, 'right');
});

test('puppet Shrink uses the shared visual scale and keeps its semantic foot fixed', () => {
  const ctx = { drawImage() {} };
  const presentation = { frame: {}, clip };
  const active = drawActorPuppetFrame(ctx, presentation, { footX: 100, footY: 200, height: 100, actorUID: 10, effects: { 10: { shrink: { expiresAt: 5 } } }, now: 1 });
  assert.equal(active.visualScale, 0.7);
  assert.equal(active.height, 70);
  assert.equal(active.drawY + active.height * (clip.footOrigin.y / clip.canvas.height), 200);
  const expired = drawActorPuppetFrame(ctx, presentation, { footX: 100, footY: 200, height: 100, actorUID: 10, effects: { 10: { shrink: { expiresAt: 5 } } }, now: 5 });
  assert.equal(expired.visualScale, 1);
  assert.equal(expired.height, 100);
  assert.equal(expired.drawY + expired.height * (clip.footOrigin.y / clip.canvas.height), 200);
});
