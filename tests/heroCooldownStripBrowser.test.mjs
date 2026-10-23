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
      // Buff signals: a party-wide Elevate roll plus own buffs on the first two clocks.
      // HP is pinned at 60% so no passive condition adds badges of its own.
      await page.evaluate(async () => {
        const { state } = await import('./modules/state.js'); const g = state.globals;
        const heroes = state.entities.filter(actor => actor.kind === 'hero' && actor.hp > 0);
        for (const actor of heroes) actor.hp = Math.ceil(actor.maxHP * .6);
        g.HeroWardHPByUID = {}; g.RealtimeSkillEffects = {};
        const until = g.time + 60, effects = g.RealtimeSkillEffects, kaja = heroes.find(actor => /Kojonn|Kaja/.test(actor.name)) || heroes[0];
        for (const actor of heroes) effects[actor.uid] = { elevate: { sourceUID: kaja.uid, expiresAt: until, data: { set: 'swift' }, modifiers: [{ channel: 'SPD', direction: 'up', magnitude: .05 }, { channel: 'ATK', direction: 'up', magnitude: .05 }] } };
        effects[heroes[0].uid].fixture_def = { sourceUID: heroes[0].uid, expiresAt: until, damageCutPct: 20 };
        effects[heroes[0].uid].fixture_mag = { sourceUID: heroes[1].uid, expiresAt: until, modifiers: [{ channel: 'MAG', direction: 'up' }] };
        effects[heroes[1].uid].fixture_res = { sourceUID: heroes[1].uid, expiresAt: until, modifiers: [{ channel: 'RES', direction: 'up' }, { channel: 'DEF', direction: 'down' }] };
      });
      await page.waitForFunction(() => document.querySelectorAll('.hero-buff-party .hero-buff').length === 2);
      const buffs = await page.evaluate(() => ({
        party: [...document.querySelectorAll('.hero-buff-party .hero-buff')].map(node => ({ icon: node.dataset.icon, rect: node.getBoundingClientRect().toJSON() })),
        badges: [...document.querySelectorAll('.hero-cooldown')].map(slot => [...slot.querySelectorAll('.hero-buff')].map(node => ({ icon: node.dataset.icon, rect: node.getBoundingClientRect().toJSON() }))),
        slots: [...document.querySelectorAll('.hero-cooldown')].map(node => node.getBoundingClientRect().toJSON()),
        quest: document.querySelector('.cot-objective').getBoundingClientRect().toJSON(),
        sheetLoaded: getComputedStyle(document.querySelector('.hero-buff')).backgroundImage.includes('buff-signals.png'),
      }));
      assert.deepEqual(buffs.party.map(entry => entry.icon), ['party-spd', 'party-atk']);
      const partyCenter = (buffs.party[0].rect.left + buffs.party.at(-1).rect.right) / 2;
      assert.ok(Math.abs(partyCenter - (current.row.x + current.row.width / 2)) < 1, 'party icons centered on the eight-slot strip');
      assert.ok(buffs.party.every(entry => entry.rect.bottom <= current.row.top + .5 && entry.rect.top >= buffs.quest.bottom), 'party row sits below the whole mini-quest box and above the strip');
      assert.deepEqual(buffs.badges.map(list => list.map(entry => entry.icon)), [['hero-offense', 'hero-defense'], ['hero-defense'], [], [], [], [], [], []]);
      for (const [index, list] of buffs.badges.entries()) list.forEach((entry, order) => {
        const slot = buffs.slots[index];
        assert.ok(entry.rect.bottom <= slot.bottom + .5 && entry.rect.bottom >= slot.bottom - slot.height * .1, 'badge bottom-aligned');
        if (order === 0) assert.ok(entry.rect.left - slot.left < slot.width * .1, 'first badge fills from the left');
        else assert.ok(entry.rect.left > list[order - 1].rect.right - .5, 'badges fill left to right');
      });
      assert.equal(buffs.sheetLoaded, true);
      await page.screenshot({ path: `${directory}/${width}-${height}-buffs.png` });
      // A party icon owns its hit area and opens its exact Party Skills entry; the quest never receives it.
      const icon = buffs.party[0].rect, at = { x: icon.left + icon.width / 2, y: icon.top + icon.height / 2 };
      assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.dataset.icon, at), 'party-spd');
      const questBefore = await page.locator('.cot-objective').textContent();
      await page.mouse.click(at.x, at.y);
      await page.locator('#training-ground').waitFor();
      await page.waitForFunction(() => { const host = document.querySelector('#training-ground'), card = host.querySelector('.tg-skill[data-focused=true]'), list = host.querySelector('.tg-party'); if (!card) return false; const c = card.getBoundingClientRect(), l = list.getBoundingClientRect(); return c.top >= l.top - 1 && c.bottom <= l.bottom + 1 && document.activeElement === card; });
      const party = await page.evaluate(() => {
        const host = document.querySelector('#training-ground'), card = host.querySelector('.tg-skill[data-focused=true]'), list = host.querySelector('.tg-party');
        const c = card?.getBoundingClientRect(), l = list.getBoundingClientRect();
        return { tab: host.dataset.tab, focused: card?.dataset.partySkill, inView: !!c && c.top >= l.top - 1 && c.bottom <= l.bottom + 1, selected: host.querySelector('.tg-tab[aria-selected=true]').textContent,
          entries: [...host.querySelectorAll('.tg-skill')].map(node => node.dataset.partySkill), strengthen: host.textContent.includes('Strengthen') };
      });
      assert.deepEqual(party, { tab: 'party', focused: 'elevate:swift', inView: true, selected: 'Party Skills', entries: ['crimson_ward', 'elevate:swift', 'elevate:vital', 'elevate:reach'], strengthen: false });
      assert.equal(await page.locator('.cot-objective').textContent(), questBefore, 'the click never reaches the mini-quest');
      await page.screenshot({ path: `${directory}/${width}-${height}-party-skills.png` });
      await page.keyboard.press('Escape'); await page.waitForFunction(() => document.querySelector('#training-ground').hidden);
      await page.evaluate(async () => {
        const { state } = await import('./modules/state.js'); state.globals.RealtimeSkillEffects = {};
      });
      await page.waitForFunction(() => !document.querySelector('.hero-buff'));
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
      // A hero clock opens that hero's Hero screen with the Special selected and in view.
      if (await page.locator('#lamp-overlay').isVisible()) { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#lamp-overlay') || getComputedStyle(document.querySelector('#lamp-overlay')).display === 'none' || document.querySelector('#lamp-overlay').hidden); }
      const runa = page.locator('.hero-cooldown').nth(2), runaBox = await runa.boundingBox();
      await page.mouse.click(runaBox.x + runaBox.width / 2, runaBox.y + runaBox.height / 3);
      await page.waitForFunction(() => document.querySelector('#hero-details:not([hidden]) h1')?.textContent === 'Runa' && document.querySelector('#hero-details').dataset.tab === 'skills');
      const special = await page.evaluate(() => {
        const host = document.querySelector('#hero-details'), card = host.querySelector('.skill-card[aria-pressed=true]'), article = host.querySelector('.pane article[data-slot=special]');
        const r = article?.getBoundingClientRect();
        return { card: card?.getAttribute('aria-label'), skill: article?.dataset.skill, visible: !!r && r.top < innerHeight && r.bottom > 0 };
      });
      assert.deepEqual(special, { card: 'Inspect Special: Bubble Pop', skill: 'bubble_pop', visible: true });
      await page.screenshot({ path: `${directory}/${width}-${height}-hero-special.png` });
      assert.deepEqual(errors, []); measurements.push(current);
      await context.close();
    }
    await writeFile(`${directory}/report.json`, JSON.stringify(measurements, null, 2));
  } finally { await browser?.close(); server.kill(); }
});
