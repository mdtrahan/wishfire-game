import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { activeBossReadout, bossBattlePlacement } from '../web-runner/systems/renderBossBattleHud.mjs';
const require = createRequire(import.meta.url);
const { detectChromeExecutable } = require('../tools/playwright_support.js');

test('boss readout resolves the exact live encounter actor and rejects ended attempts', () => {
  const boss = { uid: 42, kind: 'enemy', name: 'Troll', hp: 100, maxHP: 200, stats: { ATK: 20, MAG: 6, DEF: 12, RES: 10, SPD: 5 } };
  const hero = { uid: 1, kind: 'hero', hp: 20 };
  const state = { globals: { time: 15, ContinuousCombatStage: { bossActive: true, bossUID: 42, bossTimerStartedAt: 0, bossTimeLimitSec: 18 } }, entities: [{ ...boss, uid: 41, hp: 999 }, boss, hero] };
  assert.equal(activeBossReadout(state).actor, boss);
  assert.equal(activeBossReadout(state).timeFraction, 0.5);
  assert.equal(activeBossReadout(state).hpFraction, 0.5);
  boss.stats.ATK = 27;
  assert.equal(activeBossReadout(state).rows.find(row => row[0] === 'ATK')[1], '27');
  for (const change of [() => { state.globals.ContinuousCombatStage.bossActive = false; }, () => { state.globals.ContinuousCombatStage.bossUID = 99; }]) {
    boss.hp = 100; hero.hp = 20; state.globals.time = 15;
    Object.assign(state.globals.ContinuousCombatStage, { bossActive: true, bossUID: 42 });
    change(); assert.equal(activeBossReadout(state), null);
  }
  Object.assign(state.globals.ContinuousCombatStage, { bossActive: true, bossUID: 42 });
  let last = activeBossReadout(state);
  boss.hp = 0; hero.hp = 0; state.globals.time = 30;
  last = activeBossReadout(state, last);
  assert.equal(last.actor, boss, 'KO and expired clock retain inspection through the active stage');
  assert.equal(last.hpFraction, 0);
  state.entities = [hero];
  last = activeBossReadout(state, last);
  assert.equal(last.actor, boss, 'removed boss retains its original actor reference during death presentation');
  assert.equal(last.rows[0][1], '0 / 200');
  for (const now of [30.5, 31, 31.999]) {
    state.globals.time = now;
    assert.equal(activeBossReadout(state, last).actor, boss);
  }
  state.globals.ContinuousCombatStage.bossActive = false;
  assert.equal(activeBossReadout(state, last), null, 'actual stage exit closes immediately');
  state.globals.ContinuousCombatStage = { ...state.globals.ContinuousCombatStage, bossActive: true };
  assert.equal(activeBossReadout(state, last), null, 'another attempt cannot inherit retained stats');
  for (const [width, height] of [[360, 640], [216, 384], [233, 452], [316, 452]]) {
    const p = bossBattlePlacement({ left: 0, top: 0, width, height });
    assert.equal(p.left + 124 * p.scale, width / 2);
    assert.ok(p.left >= 0 && p.left + 248 * p.scale <= width);
  }
});

test('boss battle HUD: real summon, live identity, dismissal and phone containment', { timeout: 90000 }, async () => {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ['tools/serve_web.js', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  const directory = 'test-results/boss-hud';
  try {
    await new Promise((resolve, reject) => { server.stdout.on('data', data => { if (String(data).includes('Serving ')) resolve(); }); server.once('error', reject); server.once('exit', code => reject(Error(`Boss QA server exited ${code}`))); });
    browser = await chromium.launch({ executablePath: detectChromeExecutable(), headless: true });
    const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${port}/web-runner/index.html`);
    page.setDefaultTimeout(15000);
    await page.waitForFunction(() => window.__codexGame && JSON.parse(render_game_to_text()).flags.layout0Ready);
    await page.waitForFunction(() => document.querySelector('canvas').width > 0);
    await page.evaluate(() => __codexGame.stepFrames(2));
    console.log('Boss HUD QA: startup ready');
    await page.mouse.click(180, 426);
    await page.waitForFunction(() => JSON.parse(render_game_to_text()).flags.layoutId === 'combat' && __codexGame.globals.time > 1.5);
    await page.evaluate(() => {
      const g = __codexGame.globals;
      g.QaScenarioPaused = true;
      Object.assign(g.ContinuousCombatStage, { bossAvailable: true, bossSummonRequired: true, bossActive: false, bossArmed: false });
      __codexGame.stepFrames(1);
    });
    console.log('Boss HUD QA: combat ready');
    await page.locator('#combat-boss-fallback button').click();
    await page.locator('#boss-battle-hud').waitFor({ state: 'visible' });
    console.log('Boss HUD QA: actual boss HUD visible');
    // Let the authored entry reveal finish, preserving the spawned actor and stats.
    await page.evaluate(() => { __codexGame.globals.QaScenarioPaused = false; });
    await page.waitForFunction(() => {
      const g = __codexGame.globals;
      if (g.ContinuousCombatStage.bossTimerStartedAt == null || g.time - g.ContinuousCombatStage.bossTimerStartedAt < 1) return false;
      g.QaScenarioPaused = true; return true;
    });
    await page.locator('#boss-battle-hud button').click();
    console.log('Boss HUD QA: inspector open');
    const identity = await page.evaluate(() => {
      const s = __codexGame.state, boss = s.entities.find(a => a.uid === s.globals.ContinuousCombatStage.bossUID);
      return { uid: boss.uid, hudUid: Number(document.querySelector('#boss-battle-hud').dataset.bossUid), name: boss.name, title: document.querySelector('#boss-battle-hud strong').textContent, stats: boss.stats, rows: [...document.querySelectorAll('#boss-info-panel tr')].map(row => [...row.cells].map(cell => cell.textContent)) };
    });
    assert.equal(identity.uid, identity.hudUid); assert.equal(identity.name, identity.title);
    assert.equal(identity.rows.find(row => row[0] === 'ATK')[1], String(identity.stats.ATK));
    assert.equal(identity.rows.find(row => row[0] === 'MATK')[1], String(identity.stats.MAG));
    const measurements = [];
    await mkdir(directory, { recursive: true });
    for (const [width, height] of [[360, 640], [216, 384], [233, 452], [316, 452]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const metrics = await page.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const c = document.querySelector('canvas');
        return { viewport: [innerWidth, innerHeight, devicePixelRatio], canvas: rect('canvas'), backing: [c.width, c.height], hud: rect('#boss-battle-hud'), hp: rect('.boss-hp'), timer: rect('.boss-timer'), panel: rect('#boss-info-panel'), overflow: document.documentElement.scrollWidth > innerWidth, timerText: document.querySelector('.boss-timer').textContent, hpText: document.querySelector('.boss-hp span').textContent, closeButtons: document.querySelectorAll('#boss-info-panel button').length, rows: document.querySelector('#boss-info-panel').scrollWidth <= document.querySelector('#boss-info-panel').clientWidth };
      });
      assert.equal(metrics.overflow, false); assert.equal(metrics.rows, true);
      assert.equal(metrics.timerText, ''); assert.match(metrics.hpText, /^\d+%$/); assert.equal(metrics.closeButtons, 0);
      assert.ok(Math.abs((metrics.hud.left + metrics.hud.right) / 2 - (metrics.canvas.left + metrics.canvas.right) / 2) < 1);
      assert.ok(Math.abs((metrics.hp.left + metrics.hp.right) / 2 - (metrics.canvas.left + metrics.canvas.right) / 2) < 1);
      assert.ok(Math.abs((metrics.timer.left + metrics.timer.right) / 2 - (metrics.canvas.left + metrics.canvas.right) / 2) < 1);
      assert.ok(metrics.timer.top > metrics.hp.bottom);
      assert.ok(metrics.panel.left >= metrics.canvas.left && metrics.panel.right <= metrics.canvas.right);
      assert.ok(metrics.panel.bottom < metrics.canvas.bottom);
      measurements.push(metrics);
      await page.screenshot({ path: `${directory}/${width}x${height}-inspector.png` });
    }
    await page.mouse.click(2, 200);
    assert.equal(await page.locator('#boss-info-panel').isVisible(), false);
    await page.locator('#boss-battle-hud button').click();
    // Same live actor changes, no catalog lookup or clone.
    await page.evaluate(() => { const s = __codexGame.state; s.entities.find(a => a.uid === s.globals.ContinuousCombatStage.bossUID).stats.ATK = 27; __codexGame.stepFrames(1); });
    assert.equal(await page.locator('#boss-info-panel tr').nth(1).locator('td').textContent(), '27');
    for (const outcome of ['victory', 'wipe', 'timeout', 'replacement']) {
      const result = await page.evaluate(outcome => {
        const s = __codexGame.state, stage = s.globals.ContinuousCombatStage, boss = s.entities.find(a => a.uid === stage.bossUID), hero = s.entities.find(a => a.kind === 'hero');
        const saved = { hp: boss.hp, heroHP: hero.hp, start: stage.bossTimerStartedAt };
        if (outcome === 'victory') boss.hp = 0;
        if (outcome === 'wipe') hero.hp = 0;
        if (outcome === 'timeout') stage.bossTimerStartedAt = s.globals.time - 30;
        if (outcome === 'replacement') s.entities[s.entities.indexOf(boss)] = { ...boss };
        __codexGame.stepFrames(1);
        const stayedOpen = !document.querySelector('#boss-info-panel').hidden;
        if (outcome !== 'replacement') {
          if (!stayedOpen) throw Error(`${outcome} closed before the boss stage exited`);
          if (outcome === 'victory') {
            s.entities.splice(s.entities.indexOf(boss), 1);
            __codexGame.stepFrames(1);
            if (document.querySelector('#boss-info-panel').hidden) throw Error('boss removal closed during death presentation');
            s.entities.push(boss);
          }
          stage.bossActive = false;
          __codexGame.stepFrames(1);
        }
        const hidden = document.querySelector('#boss-info-panel').hidden;
        stage.bossActive = true;
        boss.hp = saved.hp; hero.hp = saved.heroHP; stage.bossTimerStartedAt = saved.start;
        __codexGame.stepFrames(1);
        return hidden;
      }, outcome);
      assert.equal(result, true, `${outcome} dismisses inspector in the next render`);
      await page.locator('#boss-battle-hud button').click();
    }
    // Inspector leaves combat running while open.
    const before = await page.evaluate(() => { __codexGame.globals.QaScenarioPaused = false; return __codexGame.globals.time; });
    await page.waitForFunction(before => __codexGame.globals.time > before + 0.2, before);
    assert.equal(await page.locator('#boss-info-panel').isVisible(), true);
    const death = await page.evaluate(async () => {
      const g = __codexGame.globals;
      g.QaScenarioPaused = true;
      const boss = __codexGame.state.entities.find(actor => actor.uid === g.ContinuousCombatStage.bossUID);
      __codexGame.callFunction('ApplyDamageToTarget', boss.uid, boss.hp + 1);
      __codexGame.stepFrames(1);
      const openAtZeroHP = !document.querySelector('#boss-info-panel').hidden;
      const frames = [], start = performance.now();
      g.QaScenarioPaused = false;
      await new Promise(resolve => {
        function sample() {
          const active = !!g.ContinuousCombatStage.bossActive;
          const open = !document.querySelector('#boss-info-panel').hidden;
          frames.push({ active, open });
          if ((!active && !open) || performance.now() - start > 6000) { g.QaScenarioPaused = true; resolve(); }
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      return { openAtZeroHP, frames };
    });
    assert.equal(death.openAtZeroHP, true);
    assert.ok(death.frames.some(frame => frame.active && frame.open), 'inspector survives actual death presentation');
    assert.equal(death.frames.filter(frame => frame.active && !frame.open).length, 0, 'no early closure on any sampled frame');
    assert.deepEqual(death.frames.at(-1), { active: false, open: false }, 'closes with the actual stage exit');
    assert.deepEqual(errors, []);
    await writeFile(`${directory}/report.json`, JSON.stringify({ identity, measurements, lifecycle: ['outside', 'victory', 'wipe', 'timeout', 'replacement'], death, errors }, null, 2));
  } finally { await browser?.close(); server.kill(); }
});
