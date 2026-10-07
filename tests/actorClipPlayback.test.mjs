import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActorClipLoader, sampleActorClip } from '../web-runner/systems/actorClipPlayback.mjs';

test('actor clips load once per explicit facing and sample only supplied time', async () => {
  const entry = { frames: ['fara/right/idle_001.png', 'fara/right/idle_002.png'], frameHoldMs: [100, 200], impactTimeMs: 100, loop: true, canvas: { width: 192, height: 192 }, footOrigin: { x: 96, y: 176 } };
  let manifests = 0;
  const images = [];
  const load = createActorClipLoader({ loadManifest: () => { manifests++; return { actors: { fara: { clips: { idle: { right: entry }, defeated: { right: { ...entry, loop: false } }, bad: { right: { ...entry, frameHoldMs: [0, 1] } } } } } }; }, loadImage: async name => { images.push(name); return { name }; }, frameUrl: name => name });
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
