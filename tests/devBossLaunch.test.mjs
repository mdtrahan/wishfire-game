import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import * as stageCore from '../web-runner/src/core/continuousCombatStage.mjs';
import { resetCombatSessionConditions } from '../web-runner/systems/combatSessionReset.mjs';
import { restoreHeroesToFullHP } from '../web-runner/systems/questCombatSession.mjs';
const require = createRequire(import.meta.url);
const { detectChromeExecutable } = require('../tools/playwright_support.js');
const source = readFileSync(new URL('../web-runner/systems/devToolingControls.js', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/export /g, '');
const controls = vm.runInNewContext(source + '\n({parseDeveloperBossChapter,launchDeveloperBossBattle})', { ...stageCore, resetCombatSessionConditions, restoreHeroesToFullHP });
const columns = JSON.parse(readFileSync(new URL('../web-runner/assets/enemies.json', import.meta.url), 'utf8')).data;
const rows = columns[0].slice(1).map((_, index) => Object.fromEntries(columns.map(column => [column[0][0], column[index + 1][0]]))).filter(row => row.name);

test('developer boss chapter validation and canonical chapter encounters', async () => {
  for (const value of ['', '0', '-1', '1.5', 'abc', '1e3', '9007199254740992']) {
    assert.throws(() => controls.parseDeveloperBossChapter(value), /whole chapter/);
    let refreshed = false;
    await assert.rejects(controls.launchDeveloperBossBattle({ chapter: value, refresh: () => { refreshed = true; } }), /whole chapter/);
    assert.equal(refreshed, false);
  }
  const hero = { uid: 1, kind: 'hero', name: 'Fara', hp: 0, maxHP: 75, stats: { ATK: 12, DEF: 8, MAG: 4, RES: 8, SPD: 10 }, x: 180, y: 290 };
  const state = { globals: { time: 1, EnemyData: rows, EncounterSeed: 42, goldTotal: 87 }, entities: [hero] };
  let uid = 10;
  const call = (name, row) => {
    if (name !== 'SpawnEnemy') return;
    const actor = { ...row, uid: uid++, kind: 'enemy', hp: row.HP, maxHP: row.HP, stats: Object.fromEntries(['ATK', 'DEF', 'MAG', 'RES', 'SPD'].map(key => [key, row[key]])) };
    state.entities.push(actor); return actor;
  };
  for (const chapter of [1, 2, 5, 25]) {
    const stage = await controls.launchDeveloperBossBattle({ chapter, state, gameState: {}, call, refresh: async options => options.forceCombat, resumeBossActivity: async () => true });
    assert.equal(stage.region, chapter); assert.equal(stage.bossActive, true); assert.equal(stage.bossTimeLimitSec, 30);
    assert.equal(state.entities.filter(actor => actor.kind === 'enemy').length, 1);
    const actor = state.entities.find(actor => actor.uid === stage.bossUID);
    const expected = stageCore.buildContinuousCombatSpawnPlan(rows, stage)[0].row;
    assert.equal(actor.name, expected.name); assert.equal(actor.maxHP, expected.HP);
    for (const key of ['ATK', 'DEF', 'MAG', 'RES', 'SPD']) assert.equal(actor.stats[key], expected[key]);
    assert.equal(hero.hp, hero.maxHP); assert.equal(state.globals.goldTotal, 87);
    assert.equal(stage.ordinaryWaveClears, 0); assert.equal(stage.clearedBosses, 0);
  }
  const previousStage = state.globals.ContinuousCombatStage;
  await assert.rejects(controls.launchDeveloperBossBattle({ chapter: 7, state, gameState: {}, call, refresh: async () => true, resumeBossActivity: async () => false }), /cannot leave/);
  assert.equal(state.globals.ContinuousCombatStage, previousStage, 'blocked handoff preserves the current chapter');
});

test('DEV chapter input launches real bosses from the map and repeated combat sessions', { timeout: 180000 }, async () => {
  const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ['tools/serve_web.js', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  const directory = 'test-results/dev-boss-launch';
  try {
    await new Promise((resolve, reject) => { server.stdout.on('data', data => { if (String(data).includes('Serving ')) resolve(); }); server.once('error', reject); });
    console.log('Boss launch QA: server ready');
    browser = await chromium.launch({ executablePath: detectChromeExecutable(), headless: true });
    console.log('Boss launch QA: browser ready');
    const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${port}/web-runner/index.html`);
    await page.waitForFunction(() => window.__codexGame && JSON.parse(render_game_to_text()).flags.layout0Ready);
    await page.getByRole('button', { name: 'Open developer tooling modal', exact: true }).click();
    console.log('Boss launch QA: developer panel ready');
    await page.locator('[data-devtool-boss-chapter]').fill('0');
    await page.locator('[data-devtool-launch-boss]').click();
    await page.waitForFunction(() => document.querySelector('[data-devtool-boss-status]').textContent.includes('whole chapter'));
    const launches = [];
    for (const chapter of [1, 2, 5, 25]) {
      console.log('Boss launch QA: starting chapter', chapter);
      if (chapter !== 1) await page.getByRole('button', { name: 'Open developer tooling modal', exact: true }).click();
      await page.locator('[data-devtool-boss-chapter]').fill(String(chapter));
      await page.locator('[data-devtool-launch-boss]').click();
      await page.waitForFunction(chapter => {
        const g = __codexGame.globals;
        if (g.ContinuousCombatStage?.bossActive && g.ContinuousCombatStage.region === chapter && !g.DevToolingConfig.open) { g.QaScenarioPaused = true; return true; }
        return false;
      }, chapter).catch(async error => {
        const observed = await page.evaluate(() => ({ stage: __codexGame.globals.ContinuousCombatStage, quest: JSON.parse(render_game_to_text()).quest, devOpen: __codexGame.globals.DevToolingConfig.open, error: document.querySelector('[data-devtool-boss-status]').textContent }));
        throw new Error(`${error.message}; boss launch state: ${JSON.stringify(observed)}`);
      });
      await page.locator('#boss-battle-hud').waitFor({ state: 'visible' });
      const result = await page.evaluate(async () => {
        const { buildContinuousCombatSpawnPlan } = await import('./src/core/continuousCombatStage.mjs');
        const s = __codexGame.state, g = s.globals, stage = g.ContinuousCombatStage;
        const boss = s.entities.find(actor => actor.uid === stage.bossUID);
        const expected = buildContinuousCombatSpawnPlan(g.EnemyData, stage)[0].row;
        return { chapter: stage.region, bossUID: boss.uid, hudUID: Number(document.querySelector('#boss-battle-hud').dataset.bossUid), name: boss.name, maxHP: boss.maxHP, expectedHP: expected.HP, stats: boss.stats, expectedStats: Object.fromEntries(['ATK', 'DEF', 'MAG', 'RES', 'SPD'].map(key => [key, expected[key]])), phase: JSON.parse(render_game_to_text()).quest.phase, timeLimit: stage.bossTimeLimitSec, allFull: s.entities.filter(actor => actor.kind === 'hero').every(hero => hero.hp === hero.maxHP), ordinaryClears: stage.ordinaryWaveClears, enemyCount: s.entities.filter(actor => actor.kind === 'enemy').length };
      });
      assert.equal(result.chapter, chapter); assert.equal(result.phase, 'combat'); assert.equal(result.timeLimit, 30);
      assert.equal(result.bossUID, result.hudUID); assert.equal(result.maxHP, result.expectedHP); assert.deepEqual(result.stats, result.expectedStats);
      assert.equal(result.allFull, true); assert.equal(result.enemyCount, 1); assert.equal(result.ordinaryClears, 0);
      launches.push(result);
      console.log('Boss launch QA: verified chapter', chapter);
    }
    await page.getByRole('button', { name: 'Open developer tooling modal', exact: true }).click();
    await mkdir(directory, { recursive: true });
    const geometry = [];
    for (const [width, height] of [[360, 640], [216, 384], [233, 452], [316, 452]]) {
      await page.setViewportSize({ width, height });
      await page.locator('[data-devtool-launch-boss]').scrollIntoViewIfNeeded();
      const measured = await page.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        return { viewport: [innerWidth, innerHeight, devicePixelRatio], panel: rect('#orka-dev-tooling-modal > div'), input: rect('[data-devtool-boss-chapter]'), button: rect('[data-devtool-launch-boss]'), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(measured.overflow, false);
      for (const control of [measured.input, measured.button]) assert.ok(control.left >= 0 && control.right <= width && control.top >= 0 && control.bottom <= height);
      geometry.push(measured);
      await page.screenshot({ path: `${directory}/${width}x${height}.png` });
    }
    assert.deepEqual(errors, []);
    await writeFile(`${directory}/report.json`, JSON.stringify({ launches, geometry, errors }, null, 2));
  } finally { await browser?.close(); server.kill(); }
});
