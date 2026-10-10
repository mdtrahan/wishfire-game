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

test('Hondo and Kaja reuse the Fara skeleton and motion channels across every state', () => {
  const base = new URL('../web-runner/assets/puppets/', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', base), 'utf8'));
  const normalize = source => {
    const ids = new Map();
    return source.replace(/[A-F0-9]{32}/g, id => {
      if (!ids.has(id)) ids.set(id, `bone${ids.size}`);
      return ids.get(id);
    }).replace(/<name>(?:fara|hondo|kaja) ([^<]+)<\/name>/, '<name>actor $1</name>')
      .replace(/(<param name="filename">\s*<string>)[^<]+(<\/string>)/g, '$1paint.png$2');
  };
  for (const actor of ['hondo', 'kaja']) {
    assert.ok(manifest.actors[actor], `${actor} is adopted`);
    for (const [state, facings] of Object.entries(manifest.actors.fara.clips)) {
      for (const [facing, reference] of Object.entries(facings)) {
        const clip = manifest.actors[actor].clips[state][facing];
        const source = fs.readFileSync(new URL(clip.source, base), 'utf8');
        assert.equal(normalize(source), normalize(fs.readFileSync(new URL(reference.source, base), 'utf8')), `${actor}/${state}/${facing} shares the rig and motion`);
        assert.deepEqual(clip.frameHoldMs, reference.frameHoldMs);
        assert.deepEqual(clip.footOrigin, reference.footOrigin);
        for (const frame of clip.frames) assert.ok(fs.existsSync(new URL(frame, base)), frame);
      }
    }
  }
});

test('nonzero basic and cast torso channels lean forward at sixty percent in both facings', () => {
  const base = new URL('../web-runner/assets/puppets/', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', base), 'utf8'));
  const changed = {
    fara: { sourceFacing: 'right', peaks: { basic: 18, cast: 8 }, curves: { basic: [0, 10.8, 4.8, 1.8, 0], cast: [0, 4.8, 3.6, 1.8, 0] } },
    gobloc: { sourceFacing: 'left', peaks: { basic: 18, cast: 8 }, curves: { basic: [0, -10.8, -4.8, -1.8, 0], cast: [0, -4.8, -3.6, -1.8, 0] } },
    runa: { sourceFacing: 'right', peaks: { basic: 12, cast: 5 }, curves: { basic: [0, 7.2, 4.2, 1.8, 0], cast: [0, 3, 3, 1.8, 0] } },
    lizardo: { sourceFacing: 'left', peaks: { basic: 12, cast: 5 }, curves: { basic: [0, -7.2, -4.2, -1.8, 0], cast: [0, -3, -3, -1.8, 0] } },
    hondo: { sourceFacing: 'right', peaks: { basic: 18, cast: 8 }, curves: { basic: [0, 10.8, 4.8, 1.8, 0], cast: [0, 4.8, 3.6, 1.8, 0] } },
    kaja: { sourceFacing: 'right', peaks: { basic: 18, cast: 8 }, curves: { basic: [0, 10.8, 4.8, 1.8, 0], cast: [0, 4.8, 3.6, 1.8, 0] } },
  };
  const torsoTrack = source => {
    const marker = source.indexOf('<string>torso</string>');
    assert.notEqual(marker, -1, 'torso bone exists');
    const start = source.lastIndexOf('<bone type="bone_object"', marker);
    const end = source.indexOf('</bone>', marker) + '</bone>'.length;
    const bone = source.slice(start, end);
    const angle = bone.match(/<angle>\s*<animated type="angle">([\s\S]*?)<\/animated>\s*<\/angle>/);
    assert.ok(angle, 'torso angle track exists');
    return [...angle[1].matchAll(/<waypoint time="([^"]+)"[^>]*>[\s\S]*?<angle value="([^"]+)"\s*\/>/g)]
      .map(([, time, value]) => ({ time, value: Number(value) }));
  };
  const originXTrack = (source, name) => {
    const marker = source.indexOf(`<string>${name}</string>`);
    assert.notEqual(marker, -1, `${name} bone exists`);
    const start = source.lastIndexOf('<bone type="bone_object"', marker);
    const end = source.indexOf('</bone>', marker) + '</bone>'.length;
    const bone = source.slice(start, end);
    const origin = bone.match(/<origin>\s*<animated type="vector">([\s\S]*?)<\/animated>\s*<\/origin>/);
    if (!origin) return null;
    return [...origin[1].matchAll(/<waypoint time="([^"]+)"[^>]*>[\s\S]*?<x>([^<]+)<\/x>/g)]
      .map(([, time, value]) => ({ time, value: Number(value) }));
  };

  for (const [actor, actorData] of Object.entries(manifest.actors)) {
    const facingTracks = { basic: {}, cast: {} };
    for (const state of ['basic', 'cast']) {
      for (const facing of ['left', 'right']) {
        const clip = actorData.clips[state][facing];
        const source = fs.readFileSync(new URL(clip.source, base), 'utf8');
        const track = torsoTrack(source);
        facingTracks[state][facing] = track;
        for (const file of clip.frames) assert.ok(fs.existsSync(new URL(file, base)), file);
        if (changed[actor]) {
          assert.deepEqual(track.map(key => key.value), changed[actor].curves[state], `${actor}/${state}/${facing}`);
          assert.equal(actorData.sourceFacing, changed[actor].sourceFacing);
          const peak = Math.max(...track.map(key => Math.abs(key.value)));
          assert.ok(Math.abs(peak / changed[actor].peaks[state] - 0.6) < 1e-9, `${actor}/${state} amplitude`);
          const forward = actorData.sourceFacing === 'right' ? 1 : -1;
          const torsoX = originXTrack(source, 'torso');
          assert.ok(torsoX && (torsoX[1].value - torsoX[0].value) * forward > 0, `${actor}/${state}/${facing} torso anticipation moves toward target`);
          const headX = originXTrack(source, 'head');
          if (headX?.some(key => key.value !== headX[0].value)) assert.ok((headX[1].value - headX[0].value) * forward > 0, `${actor}/${state}/${facing} head anticipation stays connected to torso`);
        } else {
          assert.ok(track.every(key => key.value === 0), `${actor}/${state}/${facing} keeps its zero torso channel`);
        }
      }
      assert.deepEqual(facingTracks[state].left.map(key => key.time), facingTracks[state].right.map(key => key.time), `${actor}/${state} key timing is unchanged by facing`);
      assert.deepEqual(facingTracks[state].left.map(key => key.value), facingTracks[state].right.map(key => key.value), `${actor}/${state} source orientations share the same authored channel`);
    }
  }
});
