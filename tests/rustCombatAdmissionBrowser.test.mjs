import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
const { detectChromeExecutable } = createRequire(import.meta.url)('../tools/playwright_support.js');

// One browser, serial isolated contexts. Fault injection needs request interception
// and a WASM export facade; the normal page and visible controls remain unchanged.
test('Rust admission rejects HTTP 503/ABI 0 and navigation retains 37 enemies in nine subwaves', async () => {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const server = spawn(process.execPath, ['tools/serve_web.js', '--port', String(port)], { stdio: 'ignore' });
  const url = `http://localhost:${port}/web-runner/index.html`;
  let browser;
  try {
    for (let n = 0; ; n++) {
      try { if ((await fetch(url)).ok) break; } catch {}
      if (n === 50) throw new Error('QA server did not start');
      await delay(100);
    }
    browser = await chromium.launch({ headless: true, executablePath: detectChromeExecutable() });
    for (const mode of ['http503', 'abi0', 'navigation']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      try {
        const page = await context.newPage();
        await page.addInitScript(mode => {
          localStorage.clear();
          window.admissionProof = { creates: 0, text: [] };
          const fillText = CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
            admissionProof.text.push(String(text));
            if (admissionProof.text.length > 200) admissionProof.text.shift();
            return fillText.call(this, text, ...args);
          };
          const descriptor = Object.getOwnPropertyDescriptor(WebAssembly.Instance.prototype, 'exports'), cache = new WeakMap();
          Object.defineProperty(WebAssembly.Instance.prototype, 'exports', { ...descriptor, get() {
            const exports = descriptor.get.call(this);
            if (!exports.wf_combat_call) return exports;
            if (!cache.has(this)) {
              const facade = { ...exports };
              if (mode === 'abi0') facade.wf_combat_abi_version = () => 0;
              facade.wf_combat_call = (ptr, len) => {
                const request = JSON.parse(new TextDecoder().decode(new Uint8Array(exports.memory.buffer, ptr, len)));
                if (request.operation.kind === 'create') admissionProof.creates++;
                return exports.wf_combat_call(ptr, len);
              };
              cache.set(this, facade);
            }
            return cache.get(this);
          } });
        }, mode);
        if (mode === 'http503') await page.route('**/simulation_core.wasm', route => route.fulfill({ status: 503, body: 'fixture' }));
        await page.goto(url);
        await page.waitForFunction(() => window.__codexGame && typeof render_game_to_text === 'function');
        if (mode !== 'navigation') {
          await page.waitForFunction(() => JSON.parse(render_game_to_text()).flags.layout0Failed);
          const canvas = await page.locator('#view').boundingBox();
          await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height * .67);
          const proof = await page.evaluate(() => ({ flags: JSON.parse(render_game_to_text()).flags,
            error: __codexGame.globals.RustCombatError, enemies: __codexGame.state.entities.filter(a => a.kind === 'enemy').length, ...admissionProof }));
          assert.match(proof.error, mode === 'http503' ? /503/ : /Unsupported combat ABI/);
          assert.equal(proof.flags.layoutId, 'storyMock');
          assert.equal(proof.creates, 0);
          assert.equal(proof.enemies, 0);
          assert.ok(proof.text.includes('Combat failed to load. Reload to retry.'), 'existing startup error surface is painted');
          continue;
        }
        await page.waitForFunction(() => JSON.parse(render_game_to_text()).flags.layout0Ready);
        await page.waitForFunction(() => admissionProof.text.includes('START'));
        await page.evaluate(() => __codexGame.setEncounterRequest({ seed: 7 }));
        const canvas = await page.locator('#view').boundingBox();
        await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height * .67);
        await page.waitForFunction(() => Number(__codexGame.globals.RustCombatReceipt?.step) >= 5);
        const read = () => {
          const g = __codexGame.globals, stage = g.ContinuousCombatStage;
          const groups = g.RustCombatSubwaveAuthoring.stages.find(s => s.stage === stage.stage).waves[stage.wave - 1].subwaves;
          return { subwaves: groups.length, enemies: groups.flat().reduce((n, e) => n + e.count, 0),
            encounter: g.RustCombatReceipt.encounterId, creates: admissionProof.creates };
        };
        const assertPaused = async label => {
          const step = await page.evaluate(() => __codexGame.globals.RustCombatReceipt.step);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.equal(await page.evaluate(() => __codexGame.globals.RustCombatReceipt.step), step, label);
        };
        const before = await page.evaluate(read);
        assert.equal(before.enemies, 37); assert.equal(before.subwaves, 9); assert.equal(before.creates, 1);
        await page.getByRole('button', { name: 'HERO', exact: true }).click();
        await page.locator('#hero-details').waitFor();
        await assertPaused('Hero pauses Rust steps');
        assert.deepEqual(await page.evaluate(read), before);
        await page.getByRole('button', { name: 'QUESTS', exact: true }).click();
        await page.getByRole('button', { name: 'Continue Battle', exact: true }).waitFor();
        await assertPaused('Quests pauses Rust steps');
        await page.getByRole('button', { name: 'Continue Battle', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(render_game_to_text()).flags.layoutId === 'combat');
        assert.deepEqual(await page.evaluate(read), before);
        await page.getByRole('button', { name: 'Bag upgrades', exact: true }).click();
        await page.locator('#lamp-dialog').waitFor();
        await assertPaused('Bag pauses Rust steps');
        assert.deepEqual(await page.evaluate(read), before);
        await page.locator('#lamp-dialog [data-action="close"]').click();
        await page.getByRole('button', { name: 'Open developer tooling modal', exact: true }).click();
        await assertPaused('DEV pauses Rust steps');
        assert.deepEqual(await page.evaluate(read), before);
        await page.keyboard.press('Escape');
        // Browser visibility fixture exercises the actual hidden-page listeners.
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await assertPaused('hidden page pauses Rust steps');
        assert.deepEqual(await page.evaluate(read), before);
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: false });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        assert.deepEqual(await page.evaluate(read), before);
      } finally { await context.close(); }
    }
  } finally { await browser?.close(); server.kill(); }
});
