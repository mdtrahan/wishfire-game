import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActorClipLoader, sampleActorClip } from '../web-runner/systems/actorClipPlayback.mjs';

test('actor clips load once per explicit facing and sample only supplied time', async () => {
  const entry = { frames: ['fara/right/idle_001.png', 'fara/right/idle_002.png'], frameHoldMs: [100, 200], impactTimeMs: 100, loop: true, canvas: { width: 192, height: 192 }, footOrigin: { x: 96, y: 176 } };
  let manifests = 0;
  const images = [];
  const load = createActorClipLoader({ loadManifest: () => { manifests++; return { actors: { fara: { clips: { idle: { right: entry }, defeated: { right: { ...entry, loop: false } }, bad: { right: { ...entry, frameHoldMs: [0, 1] } } } } } }; }, loadImage: async name => { images.push(name); return { name, width: 192, height: 192 }; }, frameUrl: name => name });
  assert.equal(manifests, 0);
  const [a, b] = await Promise.all([load('fara', 'idle', 'right'), load('fara', 'idle', 'right')]);
  assert.equal(a, b);
  assert.equal(manifests, 1);
  assert.equal(images.length, 2);
  assert.equal(a.impactTimeMs, 100);
  assert.equal(sampleActorClip(a, 99).name, entry.frames[0]);
  assert.equal(sampleActorClip(a, 100).name, entry.frames[1]);
  assert.equal(sampleActorClip(a, 300).name, entry.frames[0]);
  assert.equal(sampleActorClip(a, -1).name, entry.frames[0]);
  assert.equal(sampleActorClip(a, NaN), null);
  assert.equal(sampleActorClip(await load('fara', 'defeated', 'right'), 9999).name, entry.frames[1]);
  assert.equal(await load('fara', 'idle', 'left'), null, 'asymmetric facing cannot silently mirror');
  assert.equal(await load('../fara', 'idle', 'right'), null);
  assert.equal(await load('fara', 'bad', 'right'), null);
});

test('the Fara/Gobloc pilot ships editable bones and complete transparent state clips', () => {
  const base = new URL('../web-runner/assets/puppets/', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', base), 'utf8'));
  for (const actor of ['fara', 'gobloc']) {
    for (const state of ['idle', 'walk', 'basic', 'cast', 'hurt', 'ko', 'spawn']) {
      for (const facing of ['left', 'right']) {
        const clip = manifest.actors[actor].clips[state][facing];
        const source = fs.readFileSync(new URL(clip.source, base), 'utf8');
        assert.match(source, /type="skeleton"/);
        assert.match(source, /bone_link type="transformation"/);
        assert.equal(clip.frames.length, clip.frameHoldMs.length);
        assert.equal(clip.loop, ['idle', 'walk'].includes(state));
        if (state === 'basic') assert.equal(clip.impactTimeMs, 5 * 1000 / 12);
        if (state === 'cast') assert.equal(clip.releaseTimeMs, 500);
        assert.ok(clip.footOrigin.y <= clip.canvas.height);
        for (const file of clip.frames) {
          const bytes = fs.readFileSync(new URL(file, base));
          assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
          assert.equal(bytes.readUInt32BE(16), clip.canvas.width);
          assert.equal(bytes.readUInt32BE(20), clip.canvas.height);
          assert.equal(bytes[25], 6, `${file} retains RGBA transparency`);
        }
      }
    }
  }
});

test('roster stress bounds settled and in-flight clips, protects paint and retries failures', async () => {
  const names = Array.from({ length: 14 }, (_, i) => `actor${i}`);
  const states = ['idle', 'walk', 'basic', 'cast', 'hurt', 'ko', 'spawn'];
  const actors = Object.fromEntries(names.map(actor => [actor, { clips: Object.fromEntries(states.map(state => [state, Object.fromEntries(['left', 'right'].map(facing => [facing, { frames: Array.from({ length: 12 }, (_, n) => `${actor}/${state}/${facing}_${n}.png`), frameHoldMs: Array(12).fill(80), loop: true, canvas: { width: 128, height: 128 }, footOrigin: { x: 64, y: 125 } }]))])) }]));
  let release;
  let blocked = false;
  let fail = false;
  const gate = () => new Promise(resolve => { release = resolve; });
  let waiting;
  const load = createActorClipLoader({ loadManifest: () => ({ actors }), loadImage: async name => { if (blocked) await waiting; if (fail) throw Error('transient'); return { name, naturalWidth: 128, naturalHeight: 128 }; }, frameUrl: name => name });
  const pinned = await load(names[0], 'idle', 'right');
  load.protect(['actor0/idle/right']);
  let highWater = 0;
  for (let i = 0; i < 1000; i++) {
    const actor = names[i % 14];
    const state = states[Math.floor(i / 14) % 7];
    const facing = Math.floor(i / 98) % 2 ? 'left' : 'right';
    assert.ok(await load(actor, state, facing));
    highWater = Math.max(highWater, load.retention().retainedBytes);
    assert.ok(load.retention().retainedBytes <= 24 * 1024 * 1024);
    assert.ok(load.retention().entries <= 32);
  }
  assert.equal(await load('actor0', 'idle', 'right'), pinned);
  assert.ok(load.retention().evictions > 0);
  assert.equal(sampleActorClip(pinned, 120), sampleActorClip(pinned, 120), 'pause age stays supplied');
  blocked = true; waiting = gate();
  const pending = names.flatMap(actor => states.flatMap(state => ['left', 'right'].map(facing => load(actor, state, facing))));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(load.retention().pending <= 32);
  assert.ok(load.retention().retainedBytes <= 24 * 1024 * 1024);
  release(); blocked = false; await Promise.all(pending);
  load.protect([]);
  // Force a fresh key after eviction, then prove a failed image load is recoverable.
  for (const actor of names) for (const state of states) await load(actor, state, 'left');
  fail = true; assert.equal(await load('actor0', 'idle', 'right'), null);
  fail = false; assert.ok(await load('actor0', 'idle', 'right'));
  console.log(JSON.stringify({ rosterKeys: 196, transitions: 1000, logicalHighWaterBytes: highWater, ...load.retention() }));
});
