import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { createLampEconomy, generateLampItem } from '../web-runner/src/core/lampGear.mjs';
const require = createRequire(import.meta.url);
const { detectChromeExecutable } = require('../tools/playwright_support.js');

test('eight-slot cooldown HUD preserves quest, equipment access and combat-time shading at phone sizes', { timeout: 120000 }, async () => {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ['tools/serve_web.js', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  const directory = 'test-results/hero-cooldown-strip';
  let browser;
  try {
    await new Promise((resolve, reject) => { server.stdout.on('data', data => { if (String(data).includes('Serving ')) resolve(); }); server.once('error', reject); });
    browser = await chromium.launch({ executablePath: detectChromeExecutable(), headless: true });
    await mkdir(directory, { recursive: true });
    const measurements = [];
    for (const [width, height, dpr] of [[360, 640, 1], [216, 384, 2], [233, 452, 1], [316, 452, 1], [1280, 800, 2]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
      const equipment = createLampEconomy(42);
      const item = generateLampItem(42, 1, 0);
      equipment.items.push(item); equipment.lamp.pending.push(item.instanceId); equipment.lamp.sequence = 1;
      await context.addInitScript(save => { save.lamp.lastActivationAt = Date.now(); localStorage.setItem('wishfire.equipment-economy.v5', JSON.stringify(save)); }, equipment);
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://localhost:${port}/web-runner/index.html`);
      await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
      await page.waitForTimeout(2000);
      const canvas = await page.locator('canvas').first().boundingBox();
      await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + 426 * canvas.width / 360);
      await page.locator('.hero-cooldowns').waitFor();
      await page.waitForTimeout(900);
      const read = () => page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, canvas: rect('#view'), backing: [document.querySelector('#view').width, document.querySelector('#view').height],
          row: rect('.hero-cooldowns'), quest: rect('.cot-objective'), lamp: rect('#wishfire-lamp'),
          slots: [...document.querySelectorAll('.hero-cooldown')].map(node => ({ label: node.getAttribute('aria-label'), state: node.dataset.state, shade: node.style.getPropertyValue('--cooldown'), rect: node.getBoundingClientRect().toJSON() })),
          text: document.querySelector('.hero-cooldowns').innerText, overflow: document.documentElement.scrollWidth > innerWidth,
          imagesLoaded: [...document.querySelectorAll('.hero-cooldown img')].every(image => image.complete && image.naturalWidth > 0) };
      });
      await page.waitForFunction(() => [...document.querySelectorAll('.hero-cooldown img')].every(image => image.naturalWidth > 0));
      const current = await read(), scale = current.canvas.width / 360;
      assert.equal(current.slots.length, 8); assert.equal(current.slots.filter(slot => slot.state !== 'empty').length, 4);
      assert.ok(current.slots.slice(4).every(slot => slot.state === 'empty'));
      assert.equal(current.text, ''); assert.equal(current.overflow, false); assert.equal(current.imagesLoaded, true);
      assert.ok(Math.abs(current.row.x + current.row.width / 2 - current.canvas.x - current.canvas.width / 2) < 1);
      assert.ok(Math.abs(current.quest.x - current.canvas.x - 8 * scale) < 1);
      assert.ok(Math.abs(current.row.height / scale - 41.28) < .1);
      assert.ok(current.quest.bottom <= current.row.top + .5, 'quest remains above cooldown row');
      assert.ok(current.row.bottom < current.lamp.top, 'equipment strip stays separate');
      await page.screenshot({ path: `${directory}/${width}-${height}-combat.png` });
      // Controlled presentation fixture: use real skill clocks and production pause handling.
      await page.evaluate(async () => {
        const { state } = await import('./modules/state.js'); state.globals.DevToolingPaused = 1;
        const { heroDefinition } = await import('./src/core/heroDefinitions.mjs');
        const actor = state.entities.find(actor => actor.kind === 'hero');
        const skill = heroDefinition(actor).actives[0];
        const clocks = state.globals.RealtimeHeroBasicClocks ||= {};
        const clock = clocks[actor.uid] ||= { skillReadyAt: {} };
        (clock.skillReadyAt ||= {})[skill.skillId] = state.globals.time + skill.cooldownSeconds / 2;
      });
      await page.waitForFunction(() => document.querySelector('.hero-cooldown').dataset.state === 'cooldown');
      const paused = (await read()).slots[0].shade;
      assert.ok(Math.abs(parseFloat(paused) - 180) < 3);
      await page.waitForTimeout(150); assert.equal((await read()).slots[0].shade, paused);
      await page.screenshot({ path: `${directory}/${width}-${height}-paused-clock.png` });
      await page.evaluate(async () => { const { state } = await import('./modules/state.js'); state.globals.DevToolingPaused = 0; });
      await page.waitForFunction(old => document.querySelector('.hero-cooldown').style.getPropertyValue('--cooldown') !== old, paused);
      const bag = page.locator('#wishfire-lamp [data-action="collect"]');
      await bag.click();
      await page.locator('#lamp-overlay').waitFor();
      assert.equal(await page.locator('#lamp-dialog').isVisible(), true, 'Bag remains operable');
      await page.screenshot({ path: `${directory}/${width}-${height}-bag.png` });
      if (width === 360) {
        await page.locator(`#lamp-dialog .lamp-tile[data-id="${item.instanceId}"]`).click();
        await page.locator('#lamp-dialog .lamp-hero').first().click();
        const equip = page.locator('#lamp-dialog [data-action="equip"]');
        await equip.click();
        await page.waitForFunction(id => JSON.stringify(JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).loadouts).includes(id), item.instanceId);
        await page.screenshot({ path: `${directory}/360-640-equipped.png` });
      }
      assert.deepEqual(errors, []); measurements.push(current);
      await context.close();
    }
    await writeFile(`${directory}/report.json`, JSON.stringify(measurements, null, 2));
  } finally { await browser?.close(); server.kill(); }
});
