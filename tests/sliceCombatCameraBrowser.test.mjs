import test from 'node:test';
import { chromium } from 'playwright';
import { launchBrowserTest } from './browserTestResources.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { installObservers } from '../tools/verify_handoff_probe.mjs';

// Real page, real WFM config and WASM. Observers wrap render entry without changing snapshots.
for (const { width, height, dpr } of [{ width: 360, height: 640, dpr: 2 }, { width: 216, height: 384, dpr: 3 }]) {
test(`WFM boss admission and observed Special framing at ${width}x${height} DPR${dpr}`, { timeout: 120000 }, async t => {
  const { browser, port, close } = await launchBrowserTest(t, chromium);
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.clear();
      window.cameraProof = { startPainted: false, configs: [], raw: [], skills: [], frames: [], snapshots: [], unchanged: true };
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
        if (text === 'START') cameraProof.startPainted = true;
        return fillText.call(this, text, ...args);
      };
      const descriptor = Object.getOwnPropertyDescriptor(WebAssembly.Instance.prototype, 'exports'), cache = new WeakMap();
      Object.defineProperty(WebAssembly.Instance.prototype, 'exports', { ...descriptor, get() {
        const exports = descriptor.get.call(this);
        if (!exports.wf_combat_call) return exports;
        if (!cache.has(this)) {
          const facade = { ...exports };
          facade.wf_combat_call = (ptr, len) => {
            const request = JSON.parse(new TextDecoder().decode(new Uint8Array(exports.memory.buffer, ptr, len)));
            if (request.operation.kind === 'create') cameraProof.configs.push(request.operation.data.config);
            const handle = exports.wf_combat_call(ptr, len);
            if (['create', 'step'].includes(request.operation.kind)) {
              const result = JSON.parse(new TextDecoder().decode(new Uint8Array(exports.memory.buffer, exports.wf_response_ptr(handle), exports.wf_response_len(handle))));
              if (result.ok) {
                const { snapshot, events } = result.result;
                for (const e of events ?? []) if (e.body.kind === 'presentation' && ['skill_started','spotlight_began','spotlight_ended'].includes(e.body.data.event.kind)) cameraProof.skills.push({ time: snapshot.time, combat: snapshot.combat_time, event: e.body.data.event });
                if (snapshot?.actors.some(a => a.kind.startsWith('boss')) && snapshot.step === '0') cameraProof.raw.push({ snapshot, events });
              }
            }
            return handle;
          };
          cache.set(this, facade);
        }
        return cache.get(this);
      } });
    });
    await page.addInitScript(installObservers);
    await page.goto(`http://localhost:${port}/web-runner/index.html`);
    await page.waitForFunction(() => window.__codexGame && JSON.parse(render_game_to_text()).flags.layout0Ready);
    await page.evaluate(() => {
      __codexGame.setEncounterRequest({ seed: 7 });
      const g = __codexGame.globals, seen = new Set(); let presentation;
      Object.defineProperty(g, 'RustCombatPresentation', { configurable: true, get: () => presentation, set(api) {
        presentation = api;
        const s = api.state.snapshot, key = s.encounter_id + ':' + s.step;
        if (!seen.has(key) && (s.step === '0' || Number(s.step) % 36 === 0)) {
          seen.add(key); cameraProof.snapshots.push(structuredClone(s));
        }
        if (api.cameraObserved) return;
        api.cameraObserved = true;
        const ground = api.ground;
        api.ground = function(...args) {
          const s = api.state.snapshot, before = JSON.stringify(s), key = s.encounter_id + ':' + s.step;
          if (!seen.has(key) && (s.step === '0' || Number(s.step) % 36 === 0)) {
            seen.add(key); cameraProof.snapshots.push(structuredClone(s));
          }
          ground.apply(this, args);
          cameraProof.unchanged &&= before === JSON.stringify(s);
          const c = api.camera, boss = s.actors.find(a => a.kind.startsWith('boss') && a.hp > 0);
          cameraProof.frames.push({ encounter: s.encounter_id, step: s.step, time: s.time, combat: s.combat_time, spotlight: structuredClone(api.spotlightCamera.active), hitStop: !!s.hit_stop,
            x: c.centreX, y: c.centreY, z: c.zoom, floor: s.geometry.floor, boss: boss && { state: boss.state, x: boss.pos.x, y: boss.pos.y },
            heroes: s.actors.filter(a => a.team === 'hero' && a.hp > 0).map(a => ({ x: c.x(a.pos.x), y: c.y(a.pos.y) })) });
        };
      } });
    });
    await page.waitForFunction(() => cameraProof.startPainted);
    await page.evaluate(() => handoffProbe.start());
    const canvas = await page.locator('#view').boundingBox();
    await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height * .67);
    await page.evaluate(() => { __codexGame.globals.DevCombatSpeedMultiplier = 2; });
    await page.waitForFunction(() => {
      const frames = cameraProof.frames, start = frames.findIndex(f => f.spotlight);
      if (start < 0) return false;
      const end = frames.findIndex((f, i) => i > start && !f.spotlight && f.encounter === frames[start].encounter);
      return end >= 0 && frames.slice(end).some(f => f.encounter === frames[start].encounter && f.time - frames[end].time > 1);
    }, null, { timeout: 80000 }).catch(async error => {
      const summary = await page.evaluate(() => ({ configs: cameraProof.configs.map(c => ({ spotlight: c.spotlight, boss: c.enemies.some(e => e.definition_id.includes('boss')) })), skills: cameraProof.skills.slice(-10), frames: cameraProof.frames.length, last: cameraProof.frames.at(-1), spotlights: cameraProof.frames.filter(f => f.spotlight).length, error: __codexGame.globals.RustCombatError }));
      throw new Error(`${error.message}: ${JSON.stringify(summary)}`);
    });
    await page.waitForFunction(() => cameraProof.snapshots.some(s => Number(s.step) >= 360));
    await page.getByRole('button', { name: 'Open developer tooling modal', exact: true }).click();
    await page.locator('[data-devtool-boss-chapter]').fill('1');
    await page.locator('[data-devtool-launch-boss]').click();
    await page.waitForFunction(() => cameraProof.frames.some(f => f.boss));
    await page.waitForFunction(() => cameraProof.frames.filter(f => f.boss && f.step === '0').length >= 2);
    await page.waitForFunction(() => cameraProof.snapshots.filter(s => s.actors.some(a => a.kind.startsWith('boss'))).length >= 10);
    const viewport = await page.evaluate(() => {
      const c = document.querySelector('#view'), r = c.getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scroll: document.documentElement.scrollWidth,
        canvas: { left: r.left, right: r.right, width: r.width, height: r.height, backing: [c.width, c.height] } };
    });
    assert.deepEqual([viewport.width, viewport.height, viewport.dpr], [width, height, dpr]);
    assert.ok(viewport.scroll <= width && viewport.canvas.left >= 0 && viewport.canvas.right <= width);
    assert.ok(Math.abs(viewport.canvas.backing[0] - viewport.canvas.width * dpr) <= 1);
    assert.ok(Math.abs(viewport.canvas.backing[1] - viewport.canvas.height * dpr) <= 1);
    const clips = await page.evaluate(() => { handoffProbe.stop(); return handoffProbe.clips; });
    assert.deepEqual(clips, [], 'production spotlight participants and all actors outside framing remain unclipped');
    const proof = await page.evaluate(() => cameraProof);
    assert.deepEqual(errors, []);
    assert.ok(proof.configs.length >= 2 && proof.configs.every(c => c.spotlight === undefined));
    assert.equal(proof.unchanged, true, 'ground render cannot write snapshots or hashes');
    const admission = proof.raw.find(row => row.snapshot.actors.some(a => a.kind.startsWith('boss')));
    assert.ok(admission);
    assert.ok(proof.snapshots.some(s => s.encounter_id === admission.snapshot.encounter_id && s.step === '0'));
    const initialHeroes = proof.snapshots[0].actors.filter(a => a.team === 'hero');
    assert.deepEqual(initialHeroes.map(a => Math.round(a.pos.y * 1e4) / 1e4), [670.9333, 670.9333, 910.9333, 910.9333]);
    assert.equal(admission.snapshot.actors.find(a => a.kind.startsWith('boss')).state, 'idle');
    assert.ok(admission.events.some(e => e.body.kind === 'spawned' && e.body.data.kind.startsWith('boss')));
    const initial = proof.frames.filter(f => f.encounter === admission.snapshot.encounter_id && f.step === '0');
    assert.ok(initial.length >= 2, 'inspect successive production entry frames');
    for (const f of initial) {
      assert.equal(f.z, .5); assert.ok(Math.abs(f.x - 456) < .003);
      const halfY = 388 / (.5 * .75) / 2;
      assert.ok(f.y >= f.floor.min.y + halfY - .003 && f.y <= f.floor.max.y - halfY + .003);
      // Slice boss conservative body extent: -370..+40 world Y.
      assert.ok((f.boss.y - 370 - f.y) * .5 * .75 + 236 >= 42 - .003);
      assert.ok((f.boss.y + 40 - f.y) * .5 * .75 + 236 <= 476 + .003);
      assert.ok((f.boss.x - 160 - f.x) * .5 + 180 >= 8 - .003 && (f.boss.x + 160 - f.x) * .5 + 180 <= 352 + .003);
      for (const h of f.heroes) assert.ok(h.x >= 8 && h.x <= 352 && h.y >= 42 && h.y <= 476);
    }
    assert.ok(Math.abs(initial[1].y - initial[0].y) < .003, 'Idle entry never cuts and snaps back');
    const start = proof.frames.findIndex(f => f.spotlight), first = proof.frames[start];
    const end = proof.frames.findIndex((f, i) => i > start && !f.spotlight && f.encounter === first.encounter);
    const active = proof.frames.slice(start, end);
    assert.ok(active.length > 5);
    assert.ok(active.at(-1).combat > active[0].combat, 'spotlight cannot hold combat time');
    assert.ok(proof.skills.every(row => !row.event.kind.startsWith('spotlight_')), 'Rust spotlight scheduler stays off');
    assert.ok(active.every(f => f.z >= .5 - .001 && f.z <= .8 + .001));
    assert.ok(active.some(f => f.z > .5), 'natural offensive Special zooms');
    const returning = proof.frames.slice(end).filter(f => f.encounter === first.encounter);
    assert.ok(returning.some(f => f.z > .5));
    const lastActive = active.at(-1);
    for (const f of returning.filter(f => f.time - lastActive.time <= .6)) {
      const t = Math.min(1, (f.time - lastActive.time) / .5), u = t * t * (3 - 2 * t);
      assert.ok(Math.abs(f.z - (lastActive.z + (.5 - lastActive.z) * u)) < 1e-8, 'production return uses the slice .5-second smoothstep');
    }
    assert.ok(returning.some(f => f.time - lastActive.time >= .5 && f.z === .5));
    assert.ok(returning.at(-1).combat > returning[0].combat, 'ordinary combat resumes after spotlight');
    if (process.env.RECORD_SLICE_CAMERA === '1') {
      const file = new URL('./fixtures/slice-camera-stage7.json', import.meta.url), fixture = JSON.parse(readFileSync(file));
      fixture.recording = 'Real WFM Chapter1 seed7 LV1 ordinary/boss; base geometry and scheduler OFF; every36th step, replay dt1/30';
      fixture.frames = proof.snapshots.filter(s => !s.actors.some(a => a.kind.startsWith('boss')) || s.encounter_id === admission.snapshot.encounter_id).map(snapshot => ({ dt: 1/30, snapshot }));
      writeFileSync(file, JSON.stringify(fixture, null, 2) + '\n');
    }
    console.log(JSON.stringify({ frames: proof.frames.length, bossEntryFrames: initial.length, attackDuration: active.at(-1).time - active[0].time, maxZoom: Math.max(...active.map(f => f.z)), snapshots: proof.snapshots.length }));
  } finally { await close(); }
});
}
