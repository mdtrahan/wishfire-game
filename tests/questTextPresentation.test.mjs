import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { detectChromeExecutable } = require('../tools/playwright_support.js');

test('combat quest descriptions and counters stay white across rarities and completion at 360x640', {timeout:60000}, async () => {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ['tools/serve_web.js', '--port', String(port)], {stdio:['ignore','pipe','pipe']});
  let browser;
  const directory = 'output/ORKA-u6q';
  try {
    await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('Quest QA server did not start')), 10000);
      server.stdout.on('data', data => { if (String(data).includes('Serving ')) { clearTimeout(timer); resolve(); } });
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Quest QA server exited ${code}`)); });
    });
    browser = await chromium.launch({executablePath:detectChromeExecutable(), headless:true});
    const context = await browser.newContext({viewport:{width:360,height:640}, deviceScaleFactor:1});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/quest-text-fixture', route => route.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0;background:#171b1d}canvas{display:block;width:360px;height:640px}</style><canvas width="360" height="640"></canvas>'}));
    await page.goto(`http://localhost:${port}/web-runner/quest-text-fixture`);
    await page.evaluate(async () => {
      const {createCombatProgressionUI} = await import('./systems/combatProgressionUI.mjs');
      window.questTextUI = createCombatProgressionUI({canvas:document.querySelector('canvas')});
    });
    await mkdir(directory, {recursive:true});
    const measurements = [];
    for (const rarity of ['common','uncommon','rare','epic','legendary']) {
      for (const progress of [0,4]) {
        // Disclosed presentation fixture includes retired objectives for legacy-save display.
        await page.evaluate(async ({rarity,progress}) => {
          window.questTextUI.update({layoutId:'combat', phase:'combat', scale:1, progression:{objective:{id:'quest-text-fixture',type:'equip_rarity',rarity,target:4,progress},wallet:{}}});
        }, {rarity,progress});
        const result = await page.evaluate(() => {
          const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
          const text = document.querySelector('.cot-challenge'), category = document.querySelector('.cot-category');
          return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,canvas:rect('canvas'),backing:[document.querySelector('canvas').width,document.querySelector('canvas').height],row:rect('.cot-objective'),challenge:rect('.cot-challenge'),text:text.textContent,color:getComputedStyle(text).color,categoryColor:getComputedStyle(category).color,category:category.textContent,overflow:document.documentElement.scrollWidth > innerWidth};
        });
        assert.deepEqual(result.viewport, [360,640]);
        assert.equal(result.color, 'rgb(255, 255, 255)');
        assert.equal(result.categoryColor, 'rgb(255, 212, 92)');
        assert.equal(result.overflow, false);
        assert.ok(result.challenge.x >= 0 && result.challenge.right <= 360);
        measurements.push({rarity,progress,...result});
        if (rarity === 'epic' && progress === 0) await page.screenshot({path:`${directory}/quest-hud-360x640.png`});
      }
    }
    assert.deepEqual(errors, []);
    await writeFile(`${directory}/quest-text-render.json`, JSON.stringify({fixture:'Isolated production HUD module on a 360x640 Canvas with controlled rarity objectives, including retired saved quests',measurements,errors},null,2));
  } finally {
    try { await browser?.close(); }
    finally {
      if (server.exitCode === null) {
        const stopped = new Promise(resolve => server.once('exit',resolve));
        server.kill('SIGTERM');
        await stopped;
      }
    }
  }
});
