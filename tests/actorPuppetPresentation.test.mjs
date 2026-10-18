import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { actorClipAgeMs, actorPuppetKey, actorPuppetState, actorScreenFacing, createActorPuppetPresentation, drawActorPuppetFrame } from '../web-runner/systems/actorPuppetPresentation.mjs';

const clip = Object.freeze({ frames: [{ frame: 0 }, { frame: 1 }], frameHoldMs: [500, 500], durationMs: 1000, impactTimeMs: 400, releaseTimeMs: 500, loop: false, canvas: { width: 128, height: 128 }, footOrigin: { x: 64, y: 125 } });

test('puppet selection uses semantic actor state and leaves unsupported actors on static art', () => {
  assert.equal(actorPuppetKey({ portraitName: 'Fara' }), 'fara');
  assert.equal(actorPuppetKey({ name: 'Gobloc' }), 'gobloc');
  assert.equal(actorPuppetKey({ portraitName: 'portrait_fara_alt', baseHeroName: 'Falie' }), 'fara');
  for (const hero of Object.values(HERO_DEFINITIONS)) {
    assert.equal(actorPuppetKey({ portraitName: hero.name }), hero.name.toLowerCase());
    assert.equal(actorPuppetKey({ portraitName: `skin_${hero.key}`, baseHeroName: hero.key }), hero.name.toLowerCase());
  }
  const enemyNames = JSON.parse(readFileSync(new URL('../web-runner/assets/enemies.json', import.meta.url), 'utf8')).data[0].slice(1).flat().filter(Boolean);
  for (const name of enemyNames) assert.equal(actorPuppetKey({ name }), name.toLowerCase().replaceAll(' ', ''));
  assert.equal(actorPuppetKey({ name: 'Unknown' }), null);
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

test('positive HP ignores a stale KO cue and its facing without mutating actor clocks', async () => {
  for (const locomotion of ['idle', 'walk']) {
    for (const orientation of ['left-wise', 'right-wise']) {
      const requests = [];
      const presentation = createActorPuppetPresentation({ loadClip: async (...request) => { requests.push(request); return clip; } });
      const actor = { uid: 1, name: 'Fara', hp: 10, facing: 'right', locomotion, locomotionStartedAt: 4,
        actionState: 'ko', actionStateStartedAt: 1, actionStateUntil: 86401, actionFacing: 'left' };
      const before = { ...actor };
      assert.equal(actorPuppetState(actor, 4), locomotion);
      assert.equal(presentation.frameFor(actor, 4, orientation), null);
      await new Promise(resolve => setImmediate(resolve));
      const ready = presentation.frameFor(actor, 4, orientation);
      assert.equal(ready.state, locomotion);
      assert.equal(ready.facing, orientation === 'left-wise' ? 'right' : 'left');
      assert.deepEqual(requests, [['fara', locomotion, ready.facing]]);
      assert.deepEqual(actor, before);
      assert.equal(actorPuppetState({ ...actor, hp: 0 }, 4), 'ko');
    }
  }
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
  const shown = presentation.frameFor(actor, 2.1);
  assert.equal(shown.facing, 'left');
  assert.equal(presentation.frameFor(actor, 2.1, 'right-wise'), shown);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(presentation.frameFor(actor, 2.1, 'right-wise')?.facing, 'right');
});

test('pending state and facing switches hold the displayed frame without restarting its clock', async () => {
  const pending = [];
  const presentation = createActorPuppetPresentation({
    loadClip: () => new Promise(resolve => pending.push(resolve)),
  });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const actor = { uid: 7, name: 'Fara', hp: 10, facing: 'right', locomotion: 'idle', locomotionStartedAt: 1 };
  presentation.frameFor(actor, 1); await flush(); pending.shift()(clip); await flush();
  const shown = presentation.frameFor(actor, 1.7);
  assert.equal(shown.frame, clip.frames[1]);
  actor.actionState = 'hurt'; actor.actionStateStartedAt = 1.7; actor.actionStateUntil = 2;
  actor.actionFacing = 'left';
  assert.equal(presentation.frameFor(actor, 1.71), shown);
  await flush();
  assert.equal(presentation.frameFor(actor, 1.8), shown);
  pending.shift()(clip); await flush();
  const replacement = presentation.frameFor(actor, 1.8);
  assert.equal(replacement.state, 'hurt');
  assert.equal(replacement.facing, 'left');
  assert.equal(replacement.frame, clip.frames[0]);
});

test('initial load survives action and facing churn so the actor can appear', async () => {
  const requests = [];
  const presentation = createActorPuppetPresentation({ loadClip: (...key) => new Promise(resolve => requests.push({ key, resolve })) });
  const actor = { uid: 1, name: 'Fara', hp: 10, facing: 'right', locomotion: 'idle' };
  presentation.frameFor(actor, 1); await Promise.resolve();
  actor.facing = 'left'; actor.locomotion = 'walk';
  presentation.frameFor(actor, 1.1); await Promise.resolve();
  assert.equal(requests.length, 1, 'initial load is allowed to finish');
  requests[0].resolve(clip); await new Promise(resolve => setImmediate(resolve));
  const shown = presentation.frameFor(actor, 1.2);
  assert.equal(shown.frame, clip.frames[0]);
  assert.equal(shown.state, 'idle');
  await Promise.resolve();
  assert.equal(requests.length, 2, 'latest state loads after a puppet image exists');
});

test('decoded facing changes are sampled synchronously without another load', () => {
  const load = () => { throw new Error('decoded clips must not reload'); };
  load.peek = () => clip;
  const presentation = createActorPuppetPresentation({ loadClip: load });
  const actor = { uid: 1, name: 'Fara', hp: 10, facing: 'right', locomotionStartedAt: 1 };
  assert.equal(presentation.frameFor(actor, 1.6).frame, clip.frames[1]);
  actor.facing = 'left';
  const flipped = presentation.frameFor(actor, 1.6);
  assert.equal(flipped.frame, clip.frames[1]);
  assert.equal(flipped.facing, 'left');
});

test('a delayed defeat clip gets its full duration and committed facing on the presentation copy', async () => {
  let resolve;
  const presentation = createActorPuppetPresentation({ loadClip: () => new Promise(r => { resolve = r; }) });
  const actor = { uid: 9, name: 'Gobloc', hp: 0, isPuppetDefeat: true, facing: 'right',
    actionState: 'ko', actionFacing: 'left', actionStateStartedAt: 1, actionStateUntil: 2, puppetDefeatEndsAt: 2 };
  presentation.frameFor(actor, 1); await Promise.resolve();
  resolve(clip); await new Promise(r => setImmediate(r));
  const first = presentation.frameFor(actor, 1.4);
  assert.equal(first.frame, clip.frames[0]);
  assert.equal(actor.actionStateStartedAt, 1.4);
  assert.equal(actor.puppetDefeatEndsAt, 2.4);
  assert.equal(actor.actionStateUntil, 2.4);
  assert.equal(presentation.frameFor(actor, 2.2).facing, 'left');
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

test('transparent overscan preserves body scale and foot anchoring', () => {
  const draws = [];
  const ctx = { drawImage: (...args) => draws.push(args) };
  const padded = { ...clip, canvas: { width: 192, height: 192, referenceHeight: 128 }, footOrigin: { x: 96, y: 157 } };
  const result = drawActorPuppetFrame(ctx, { frame: {}, clip: padded }, { footX: 100, footY: 200, height: 64 });
  assert.equal(result.width, 96);
  assert.equal(result.height, 96);
  assert.equal(result.drawX + padded.footOrigin.x * .5, 100);
  assert.equal(result.drawY + padded.footOrigin.y * .5, 200);
  assert.equal(draws.length, 1);
});

test('presentation protects displayed replacement, ignores stale loads and retires absent actors', async () => {
  const pending = [];
  let protectedKeys = [];
  const load = (actor, state, facing) => new Promise(resolve => pending.push({ state, facing, resolve }));
  load.protect = keys => { protectedKeys = keys; };
  const presentation = createActorPuppetPresentation({ loadClip: load });
  const actor = { uid: 1, portraitName: 'Fara', hp: 10, facing: 'right', locomotion: 'idle', locomotionStartedAt: 1 };
  presentation.frameFor(actor, 1); await Promise.resolve();
  pending[0].resolve(clip); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(presentation.frameFor(actor, 1)?.state, 'idle');
  actor.locomotion = 'walk'; presentation.frameFor(actor, 2); await Promise.resolve();
  assert.ok(protectedKeys.includes('fara/idle/right'));
  assert.ok(protectedKeys.includes('fara/walk/right'));
  actor.actionState = 'hurt'; actor.actionStateUntil = 5; actor.actionStateStartedAt = 2;
  presentation.frameFor(actor, 2); await Promise.resolve();
  pending[1].resolve(clip); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(presentation.frameFor(actor, 2)?.state, 'idle', 'old walking load cannot overwrite latest hurt');
  pending[2].resolve(clip); await new Promise(resolve => setTimeout(resolve, 0));
  const frozen = presentation.frameFor(actor, 2);
  assert.equal(frozen.state, 'hurt');
  assert.equal(presentation.frameFor(actor, 2).frame, frozen.frame);
  const enemy = { uid: 2, name: 'Gobloc', hp: 1, facing: 'left' };
  presentation.frameFor(enemy, 3); presentation.frameFor(enemy, 4);
  assert.equal(presentation.retention().displayedActors, 1);
  assert.ok(!protectedKeys.some(key => key.startsWith('fara/')));
});

test('render boundaries retire empty and unsupported scenes even at a paused clock', async () => {
  let release;
  let pins = [];
  const load = () => new Promise(resolve => { release = resolve; });
  load.protect = keys => { pins = keys; };
  const presentation = createActorPuppetPresentation({ loadClip: load });
  const actor = { uid: 1, name: 'Fara', hp: 1, facing: 'right' };
  presentation.beginFrame(); presentation.frameFor(actor, 2); presentation.endFrame();
  await Promise.resolve();
  presentation.beginFrame(); presentation.endFrame();
  assert.equal(presentation.retention().displayedActors, 0);
  assert.deepEqual(pins, []);
  release(clip); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(presentation.retention().displayedActors, 0, 'retired pending completion cannot re-pin');
  presentation.beginFrame(); presentation.frameFor(actor, 2); presentation.endFrame(); await Promise.resolve();
  release(clip); await new Promise(resolve => setTimeout(resolve, 0));
  presentation.beginFrame(); const frame = presentation.frameFor(actor, 2); presentation.endFrame();
  presentation.beginFrame(); assert.equal(presentation.frameFor(actor, 2).frame, frame.frame); presentation.endFrame();
  presentation.beginFrame(); presentation.frameFor({ uid: 2, name: 'Unknown', hp: 1 }, 2); presentation.endFrame();
  assert.equal(presentation.retention().displayedActors, 0);
  assert.deepEqual(pins, []);
  presentation.beginFrame(); presentation.frameFor({ uid: 2, name: 'Unknown', hp: 1 }, 0); presentation.endFrame();
  assert.equal(presentation.retention().displayedActors, 0);
});

test('death and revival retain the outgoing puppet image until their HP-selected clip is ready', async () => {
  const pending = [];
  let pins;
  const load = (actor, state, facing) => new Promise(resolve => pending.push({ state, facing, resolve }));
  load.protect = keys => { pins = keys; };
  const presentation = createActorPuppetPresentation({ loadClip: load });
  const actor = { uid: 1, name: 'Fara', hp: 10, facing: 'right', locomotion: 'idle' };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  presentation.frameFor(actor, 1); await flush(); pending[0].resolve(clip); await flush();
  const alive = presentation.frameFor(actor, 1);
  assert.equal(alive.state, 'idle');
  actor.hp = 0;
  assert.equal(presentation.frameFor(actor, 1), alive, 'pending KO retains the last puppet image');
  assert.ok(pins.includes('fara/idle/right'));
  assert.ok(pins.includes('fara/ko/right'));
  await flush(); pending[1].resolve(clip); await flush();
  const defeated = presentation.frameFor(actor, 1);
  assert.equal(defeated.state, 'ko');
  actor.hp = 10;
  assert.equal(presentation.frameFor(actor, 1), defeated, 'pending revival retains the last puppet image');
  await flush(); pending[2].resolve(clip); await flush();
  assert.equal(presentation.frameFor(actor, 1).state, 'idle');
  actor.locomotion = 'walk';
  assert.equal(presentation.frameFor(actor, 1).state, 'idle', 'ordinary live-state transitions retain the ready clip');
});
