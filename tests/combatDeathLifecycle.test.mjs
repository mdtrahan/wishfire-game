import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
const { detectChromeExecutable } = createRequire(import.meta.url)('../tools/playwright_support.js');

test('real WASM deaths retain painted size and fade monotonically through actor eviction', { timeout: 90000 }, async t => {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const server = spawn(process.execPath, ['tools/serve_web.js', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.stdout.on('data', data => { if (String(data).includes('Serving ')) resolve(); }); server.once('error', reject); });
    browser = await chromium.launch({ headless: true, executablePath: detectChromeExecutable() });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${port}/web-runner/index.html`);
    await page.waitForFunction(() => window.__codexGame && JSON.parse(render_game_to_text()).flags.layout0Ready);
    await page.evaluate(async () => {
      const { SliceGpu } = await import('/web-runner/systems/rustCombatGpu.mjs');
      const { combatEnemiesForPresentation } = await import('/web-runner/systems/actorPuppetDefeats.mjs');
      const proof = window.deathProof = { tracks: {}, frames: 0, active: null, complete: [] };
      const draw = SliceGpu.prototype.actor;
      SliceGpu.prototype.actor = function(...args) {
        if (proof.active && args[12] === 'alpha') proof.active.draws.push({ width: args[3] * this.scale, height: args[4] * this.scale, alpha: args[5] * this.ctx.globalAlpha });
        return draw.apply(this, args);
      };
      let previous;
      function observe() {
        const game = __codexGame, p = game.globals.RustCombatPresentation;
        if (p && previous !== p) {
          previous = p;
          const sprite = p.sprite;
          p.sprite = function(ctx, puppet, options) {
            const host = combatEnemiesForPresentation(game.state.entities, game.globals).find(a => a.uid === options.actorUID);
            if (!host) return sprite.call(this, ctx, puppet, options);
            const key = `${game.globals.CombatSessionId}:${host.uid}`;
            const track = proof.tracks[key] ||= { living: null, dead: [], missing: false, finished: false };
            const sample = { time: game.globals.time, retained: !!host.isPuppetDefeat, inSnapshot: p.state.actors.has(options.rustActorId), draws: [] };
            proof.active = sample;
            try { return sprite.call(this, ctx, puppet, options); }
            finally {
              proof.active = null;
              if (host.hp > 0 && sample.draws.length) track.living = sample;
              if (host.isPuppetDefeat) track.dead.push(sample);
            }
          };
        }
        const visible = new Set(combatEnemiesForPresentation(game.state.entities, game.globals).map(a => `${game.globals.CombatSessionId}:${a.uid}`));
        for (const [key, track] of Object.entries(proof.tracks)) {
          if (track.dead.length && !visible.has(key) && !track.finished) {
            track.finished = true; proof.complete.push(key);
          }
        }
        proof.frames++;
        requestAnimationFrame(observe);
      }
      observe();
      __codexGame.setEncounterRequest({ seed: 7 });
    });
    const canvas = await page.locator('#view').boundingBox();
    await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height * .67);
    await page.waitForFunction(() => deathProof.complete.length >= 3, null, { timeout: 65000 });
    const result = await page.evaluate(() => ({ tracks: deathProof.complete.map(key => deathProof.tracks[key]), frames: deathProof.frames }));
    assert.deepEqual(errors, []);
    for (const track of result.tracks) {
      assert.ok(track.living, 'death has a preceding living paint');
      const dimensions = track.living.draws[0];
      const draws = track.dead.flatMap(sample => sample.draws);
      assert.ok(track.dead.every(sample => sample.draws.length === 1), 'exactly one corpse draw every retained frame');
      assert.ok(track.dead.some(sample => !sample.inSnapshot), 'corpse survives Rust snapshot eviction');
      assert.ok(draws.filter(draw => draw.alpha > 0 && draw.alpha < 1).length >= 5, 'multiple intermediate alpha draws');
      assert.ok(draws[0].alpha > .9, 'death starts opaque');
      assert.equal(draws.at(-1).alpha, 0, 'corpse reaches zero before retirement');
      for (const [index, draw] of draws.entries()) {
        assert.equal(draw.width, dimensions.width, 'painted width preserved');
        assert.equal(draw.height, dimensions.height, 'painted height preserved');
        if (index) assert.ok(draw.alpha <= draws[index - 1].alpha, 'alpha never increases after death');
      }
      t.diagnostic(JSON.stringify({ height: dimensions.height, alpha: [draws[0], ...[.75, .5, .25].map(alpha => draws.reduce((best, draw) => Math.abs(draw.alpha - alpha) < Math.abs(best.alpha - alpha) ? draw : best)), draws.at(-1)].map(draw => draw.alpha), frames: track.dead.length }));
    }
  } finally {
    await browser?.close();
    server.kill();
  }
});
