// Optional capture of the shipped wf_app, using its existing seed, saves and player controls.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { command } from './verify_rust_handoff.mjs';

export async function captureReplays({ cwd, out, scenarios, env, timeout }) {
  const { chromium } = await import('playwright');
  const build = await command('bash', ['tools/build_wf_app.sh'], { cwd, env, timeout,
    log: join(out, 'gif-build.log') });
  if (build.exit_code !== 0 || build.infrastructure_error) return { status: 'FAIL', build };
  // Reserve a free local port; the existing serve script owns the HTTP behavior.
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(done => reservation.close(done));
  const server = spawn('bash', ['tools/serve_wf_app.sh', String(port)], { cwd, env,
    detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const scratch = mkdtempSync(join(tmpdir(), 'wishfire-gif-'));
  let browser;
  const results = [];
  try {
    await new Promise((done, reject) => {
      const timer = setTimeout(() => reject(Error('Rust app server did not start')), 10000);
      server.stdout.once('data', () => { clearTimeout(timer); done(); });
      server.once('error', e => { clearTimeout(timer); reject(e); });
      server.once('exit', code => { clearTimeout(timer); reject(Error(`Rust app server exited ${code}`)); });
    });
    browser = await chromium.launch({ headless: true });
    for (const scenario of scenarios) {
      console.log(`GIF: ${scenario.name} (720x1280, 30 fps, 1x)`);
      const context = await browser.newContext({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ save }) => {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('orka.hero_progress.v2', JSON.stringify(save));
        // Only the browser clock/RAF is driven here. wf_app still owns every host/sim/render step.
        let time = 0, nextId = 1;
        const callbacks = new Map();
        Date.now = () => 1700000000000 + time;
        Object.defineProperty(performance, 'now', { value: () => time });
        window.requestAnimationFrame = callback => { const id = nextId++; callbacks.set(id, callback); return id; };
        window.cancelAnimationFrame = id => callbacks.delete(id);
        window.__replayFrame = delta => {
          time += delta;
          const batch = [...callbacks.values()]; callbacks.clear();
          for (const callback of batch) callback(time);
        };
      }, { save: scenario.initial_save });
      await page.goto(`http://localhost:${port}/?qa&seed=${scenario.seed}`, { waitUntil: 'load' });
      let ready = false;
      for (let n = 0; n < 3000; n++) {
        ready = await page.evaluate(() => {
          window.__replayFrame(0);
          return typeof wasm_exports !== 'undefined' && wasm_exports.wf_client_asset_status() === 1 && wasm_exports.wf_app_probe(4) > 0;
        });
        if (ready || errors.length) break;
      }
      if (!ready || errors.length) throw Error(`Renderer boot failed: ${errors.join('; ') || 'assets/probe not ready'}`);
      const frame = delta => page.evaluate(dt => window.__replayFrame(dt), delta);
      const key = async value => { await page.keyboard.down(value); await frame(0); await page.keyboard.up(value); await frame(0); };
      // The app boots with Default spotlight; its existing S control cycles Often then Off.
      await key('s'); await key('s'); await key('1');
      const video = join(scratch, `${scenario.name}.mkv`);
      const encoderLog = join(out, `${scenario.name}-encoder.log`);
      const encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe',
        '-framerate', '30', '-vcodec', 'png', '-i', 'pipe:0', '-c:v', 'ffv1', video], { stdio: ['pipe', 'ignore', 'pipe'] });
      let encoderError = '';
      encoder.stderr.on('data', data => { encoderError += data; });
      encoder.on('error', error => { encoderError += error.message; });
      // Keep the completion promise attached while screenshots are flowing.
      const encoded = new Promise(resolve => encoder.on('close', code => resolve(code)));
      encoder.stdin.on('error', () => {});
      let frames = 0, probe, outcome = false;
      try {
        for (let tick = 0; tick < scenario.deadline_seconds * 30; tick++) {
          for (const input of scenario.script.filter(input => input.tick === tick)) {
            await key(input.action === 'summon_boss' ? 'b' : 'p');
          }
          await frame(tick === 0 ? 0 : 1000 / 30);
          const png = await page.screenshot({ animations: 'allow', timeout: 10000 });
          if (encoder.stdin.destroyed) throw Error(`ffmpeg exited: ${encoderError}`);
          if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
          frames++;
          probe = await page.evaluate(() => [0, 1, 2, 4, 8].map(i => wasm_exports.wf_app_probe(i)));
          outcome = scenario.expected === 'chapter_2' ? probe[4] >= 1 : probe[1] >= 2;
          if (outcome || errors.length) break;
        }
      } finally { encoder.stdin.end(); }
      const code = await encoded;
      writeFileSync(encoderLog, encoderError);
      if (code !== 0 || errors.length || !outcome) throw Error(`Renderer replay ${scenario.name} failed: encoder=${code}, outcome=${outcome}, ${errors.join('; ')}`);
      const palette = join(scratch, 'palette.png');
      const run = (suffix, args) => command('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
        cwd, env, timeout, log: join(out, `${scenario.name}-${suffix}.log`) });
      const p = await run('palette', ['-i', video, '-vf', 'palettegen', '-frames:v', '1', palette]);
      const path = join(out, `${scenario.name}.gif`);
      const gif = await run('gif', ['-i', video, '-i', palette, '-lavfi', 'paletteuse', '-loop', '0', path]);
      if (p.exit_code !== 0 || gif.exit_code !== 0 || gif.infrastructure_error) throw Error(`GIF encoding failed; see ${gif.log}`);
      const header = readFileSync(path).subarray(0, 10);
      if (header.readUInt16LE(6) !== 720 || header.readUInt16LE(8) !== 1280) throw Error('GIF dimensions differ from 720x1280');
      results.push({ name: scenario.name, status: 'PASS', path, frames, fps: 30, speed: 1,
        width: 720, height: 1280, outcome: scenario.expected, final_probe: probe });
      await context.close();
    }
    return { status: 'PASS', build, replays: results };
  } finally {
    await browser?.close();
    try { process.kill(-server.pid, 'SIGKILL'); } catch { /* server already exited */ }
    rmSync(scratch, { recursive: true, force: true });
  }
}
