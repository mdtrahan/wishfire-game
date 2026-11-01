/* Headless file:// capture; own code generalized from the approved study harnesses. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const D = __dirname, smoke = process.argv.includes('--smoke'), stillsOnly = process.argv.includes('--stills');
const out = path.resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) || path.join(D, 'proof'));
const digest = data => createHash('sha256').update(data).digest('hex');
const seeds = [91731, 284731, 705831], sourceFps = 60;
const devices = [[390, 844, 3], [360, 640, 2], [820, 1180, 2], [1440, 900, 2]];
const fileURL = pathToFileURL(path.join(D, 'index.html')).href;
const crop = { x: 40, y: 190, width: 220, height: 240 };
const commands = [];
function ffmpeg(args) {
  commands.push(['ffmpeg', ...args]);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', ...args], { stdio: 'inherit' });
}
async function main() {
  if (!smoke) {
    if (fs.existsSync(out)) throw new Error('Output exists; choose a fresh --out=directory to preserve rounds.');
    fs.mkdirSync(out, { recursive: true });
  }
  const browser = await chromium.launch({ headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let report;
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 1050 }, deviceScaleFactor: 1, colorScheme: 'light' });
    const errors = [], failed = [];
    function watch(p) {
      p.on('pageerror', e => errors.push(e.message));
      p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      p.on('requestfailed', r => failed.push(r.url()));
    }
    watch(page);
    await page.goto(fileURL + '?capture=1');
    await page.waitForFunction(() => window.STUDY?.ready, null, { timeout: 15000 });
    const stats = await page.evaluate(() => STUDY.stats());
    assert.equal(stats.revision, '160'); assert.deepEqual(stats.internal, stats.output);
    assert.deepEqual(stats.output, [360, 640]); assert.deepEqual(stats.actorFlips, [false, true]);
    const capture = async (seed, t) => page.evaluate(({ seed, t }) => {
      STUDY.cast(seed); STUDY.setTime(t); return STUDY.renderer.domElement.toDataURL();
    }, { seed, t });
    const first = await capture(seeds[0], .5);
    await capture(seeds[1], 1.2);
    assert.equal(await capture(seeds[0], .5), first, 'seed/time replay must match pixels');
    assert.notEqual(await capture(seeds[1], .5), first, 'seed must vary visible motion');
    const end = await capture(seeds[0], 2.2), beginning = await capture(seeds[0], 0);
    assert.equal(end, beginning, 'all effects must release to the original actor/arena pixels');
    const samples = [];
    await page.evaluate(() => { STUDY.cast(91731); STUDY.setTime(0); });
    for (const t of [.1, .5, .9, 1.2, 2.2, .5]) {
      const frame = await page.evaluate(t => { STUDY.setTime(t); return STUDY.renderer.domElement.toDataURL(); }, t);
      samples.push({ t, sha256: digest(frame) });
    }
    assert.equal(samples[1].sha256, samples[5].sha256, 'reverse scrub must preserve pixels');
    for (const t of [-1, NaN, 3]) {
      assert(await page.evaluate(t => { try { STUDY.setTime(t); return false; } catch { return true; } }, t));
    }
    await page.locator('[data-speed="0.5"]').click();
    assert.equal((await page.evaluate(() => STUDY.state)).speed, .5);
    await page.locator('[data-speed="1"]').click();
    assert.equal((await page.evaluate(() => STUDY.state)).speed, 1);
    await page.locator('#seed').fill('4294967296'); await page.locator('#replay').click();
    assert(await page.locator('#error').isVisible());
    await page.locator('#seed').fill('91731'); await page.locator('#replay').click();
    assert.equal((await page.evaluate(() => STUDY.state)).seed, 91731);
    await page.locator('#recast').click();
    assert.notEqual((await page.evaluate(() => STUDY.state)).seed, 91731);
    await page.evaluate(() => STUDY.setTime(.5));
    const memory = await page.evaluate(() => {
      STUDY.cast(1); STUDY.setTime(1.2); const before = STUDY.stats();
      for (let i = 2; i < 22; i++) { STUDY.cast(i); STUDY.setTime(1.2); }
      return { before, after: STUDY.stats() };
    });
    assert.equal(memory.before.geometries, memory.after.geometries, 'recast geometry leak');
    assert.equal(memory.before.textures, memory.after.textures, 'recast texture leak');
    report = { fileURL: true, browser: browser.version(), stats, samples, memory,
      checks: ['seed replay', 'seed variation', 'reverse scrub', 'clean release pixels', 'time/seed validation', 'speed/recast controls', 'recast disposal'], errors, failed };
    const nativeStills = [], fidelity = [];
    function checkSize(s, ratio) {
      assert.equal(s.dpr, ratio);
      assert.deepEqual(s.output, s.css.map(n => Math.floor(n * ratio)));
      assert.deepEqual(s.internal, s.output.map(n => Math.max(1, Math.round(n / [6, 3, 1.5, 1][s.level]))));
      assert.deepEqual(s.snapGrid, s.internal);
      assert(Math.abs(s.css[0] / s.css[1] - 360 / 640) < .0001, 'world framing aspect');
    }
    for (const [width, height, deviceScaleFactor] of devices) {
      const device = await browser.newPage({ viewport: { width, height }, deviceScaleFactor, colorScheme: 'light' });
      watch(device);
      const name = `${width}x${height}@${deviceScaleFactor}`, comparisons = [];
      for (const level of [0, 1, 2, 3]) {
        await device.goto(`${fileURL}?capture=1&vfxres=${level}&ps1=1`);
        await device.waitForFunction(() => window.STUDY?.ready);
        const sample = await device.evaluate(() => {
          STUDY.setTime(0);
          const source = STUDY.renderer.domElement, c = document.createElement('canvas');
          c.width = source.width; c.height = source.height;
          const ctx = c.getContext('2d'); ctx.drawImage(source, 0, 0);
          const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
          const bounds = [[c.width, c.height, -1, -1], [c.width, c.height, -1, -1]];
          for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4, r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            const actor = b > r * 1.15 && b > g * 1.4 ? 0 : r < 150 && g < 140 && b < 110 && g > r * .65 ? 1 : -1;
            if (actor >= 0) { const v = bounds[actor]; v[0] = Math.min(v[0], x); v[1] = Math.min(v[1], y); v[2] = Math.max(v[2], x); v[3] = Math.max(v[3], y); }
          }
          STUDY.setTime(.5); ctx.drawImage(source, 0, 0);
          const effect = ctx.getImageData(0, 0, c.width, c.height).data;
          const effectBounds = [c.width, c.height, -1, -1], faintBounds = [...effectBounds];
          for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4;
            const contrast = Math.max(...[0, 1, 2].map(k => Math.abs(effect[i + k] - pixels[i + k])));
            // L0 cannot resolve the faint subpixel tail; retain its bounds as diagnostics.
            for (const b of [contrast > 32 ? faintBounds : null, contrast > 64 ? effectBounds : null]) if (b) {
              b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
            }
          }
          const logical = b => b.map((v, i) => v / (i % 2 ? c.height / 640 : c.width / 360));
          return { stats: STUDY.stats(), bounds: [...bounds, effectBounds].map(logical), faintBounds: logical(faintBounds), effectContrast: 64,
            anchors: [STUDY.caster, STUDY.target].map(o => o.position.clone().project(STUDY.camera).toArray()) };
        });
        checkSize(sample.stats, deviceScaleFactor); comparisons.push(sample);
      }
      assert.deepEqual(comparisons[0].anchors, comparisons[3].anchors);
      const tolerance = 2 * Math.max(360 / comparisons[0].stats.internal[0], 640 / comparisons[0].stats.internal[1]);
      comparisons[0].bounds.forEach((b, object) => b.forEach((v, i) => {
        assert(b[2] > b[0] && b[3] > b[1], 'actor/effect silhouette must be visible');
        assert(Math.abs(v - comparisons[3].bounds[object][i]) <= tolerance,
          `${name}: L0/L3 object ${object} edge ${i}: ${v} vs ${comparisons[3].bounds[object][i]}, tolerance ${tolerance}`);
      }));
      fidelity.push({ device: name, comparisons, tolerance });
      for (const t of [.1, .5, .9, 1.2, 2.2]) {
        const data = await device.evaluate(({ t, crop }) => {
          STUDY.setTime(t);
          const source = STUDY.renderer.domElement, sx = source.width / 360, sy = source.height / 640;
          const c = document.createElement('canvas'); c.width = Math.round(crop.width * sx); c.height = Math.round(crop.height * sy);
          c.getContext('2d').drawImage(source, Math.round(crop.x * sx), Math.round(crop.y * sy), c.width, c.height, 0, 0, c.width, c.height);
          return { stats: STUDY.stats(), canvas: source.toDataURL().split(',')[1], crop: c.toDataURL().split(',')[1], cropPixels: [c.width, c.height] };
        }, { t, crop });
        const base = `${name}-${t.toFixed(3)}`, files = [`${base}-page.png`, `${base}-canvas.png`, `${base}-crop.png`];
        if (!smoke) {
          await device.screenshot({ path: path.join(out, files[0]), scale: 'device' });
          for (const [i, key] of [[1, 'canvas'], [2, 'crop']]) fs.writeFileSync(path.join(out, files[i]), Buffer.from(data[key], 'base64'));
        }
        nativeStills.push({ device: name, t, files, stats: data.stats, cropPixels: data.cropPixels });
      }
      await device.evaluate(() => STUDY.setTime(.5));
      const before = await device.evaluate(() => STUDY.renderer.domElement.toDataURL());
      await device.setViewportSize({ width: 300, height: 700 });
      await device.waitForFunction(() => STUDY.stats().css[0] === document.querySelector('#stage').getBoundingClientRect().width);
      checkSize(await device.evaluate(() => STUDY.stats()), deviceScaleFactor);
      assert.equal((await device.evaluate(() => STUDY.state)).time, .5);
      const resized = await device.evaluate(() => STUDY.renderer.domElement.toDataURL());
      assert.equal(await device.evaluate(() => { STUDY.setTime(.5); return STUDY.renderer.domElement.toDataURL(); }), resized,
        'resized frame must equal an explicit redraw');
      if (!smoke) await device.screenshot({ path: path.join(out, `${name}-resized.png`), scale: 'device' });
      await device.setViewportSize({ width, height });
      await device.waitForFunction(() => STUDY.stats().css[0] === document.querySelector('#stage').getBoundingClientRect().width);
      assert.equal(await device.evaluate(() => STUDY.renderer.domElement.toDataURL()), before, 'resize must preserve cast pixels');
      await device.locator('#play').click();
      await device.setViewportSize({ width: 300, height: 700 });
      await device.waitForFunction(() => STUDY.state.time > .5 && STUDY.stats().css[0] < 300);
      assert.equal((await device.evaluate(() => STUDY.state)).playing, true, 'resize must preserve playback');
      checkSize(await device.evaluate(() => STUDY.stats()), deviceScaleFactor);
      await device.evaluate(() => STUDY.setTime(.5));
      // CDP changes the live DPR in this page, exercising the paused redraw path.
      const cdp = await device.context().newCDPSession(device);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await device.waitForFunction(() => STUDY.stats().dpr === 1);
      checkSize(await device.evaluate(() => STUDY.stats()), 1);
      await device.goto(`${fileURL}?capture=1&vfxres=3&ps1=0`);
      await device.waitForFunction(() => window.STUDY?.ready);
      assert.equal((await device.evaluate(() => STUDY.stats())).stylized, false);
      await device.close();
    }
    Object.assign(report, { nativeStills, fidelity, crop });
    report.checks.push('four native device sizes', 'L0–L3 targets/snap/dither', 'L0/L3 silhouettes and positions', 'paused/playing mid-effect resize', 'live DPR change', 'native PS1 bypass');
    if (!smoke && !stillsOnly) {
      const duration = await page.evaluate(() => STUDY.duration);
      const framesPerCast = Math.ceil(duration * sourceFps), total = seeds.length * framesPerCast;
      for (const view of ['ingame', 'closeup']) fs.mkdirSync(path.join(out, view));
      await page.close();
      // Native 360 CSS px at DPR 3 supplies secondary GIFs without an output-scale override.
      const motion = await browser.newPage({ viewport: { width: 800, height: 1050 }, deviceScaleFactor: 3 });
      watch(motion);
      await motion.goto(fileURL + '?capture=1'); await motion.waitForFunction(() => window.STUDY?.ready);
      for (let cast = 0; cast < seeds.length; cast++) {
        await motion.evaluate(seed => { STUDY.cast(seed); STUDY.setTime(0); }, seeds[cast]);
        for (let i = 0; i < framesPerCast; i++) {
          const data = await motion.evaluate(({ t, crop, cast }) => {
            STUDY.setTime(t);
            const source = STUDY.renderer.domElement;
            function frame(view) {
              const c = document.createElement('canvas');
              c.width = view === 'ingame' ? 720 : crop.width * 3;
              c.height = view === 'ingame' ? 1280 : crop.height * 3;
              const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
              if (view === 'ingame') x.drawImage(source, 0, 0, c.width, c.height);
              else x.drawImage(source, crop.x * 3, crop.y * 3, crop.width * 3, crop.height * 3, 0, 0, c.width, c.height);
              x.fillStyle = '#faf8f2'; x.fillRect(4, 4, c.width - 8, 28);
              x.fillStyle = '#403523'; x.font = '16px monospace';
              x.fillText(`Cast ${cast + 1} / seed ${STUDY.state.seed} / ${t.toFixed(3)} s`, 12, 24);
              return c.toDataURL().split(',')[1];
            }
            return { ingame: frame('ingame'), closeup: frame('closeup') };
          }, { t: i / sourceFps, crop, cast });
          for (const view of ['ingame', 'closeup']) {
            fs.writeFileSync(path.join(out, view, `${String(cast * framesPerCast + i).padStart(4, '0')}.png`), Buffer.from(data[view], 'base64'));
          }
        }
        console.log(`Captured cast ${cast + 1}/${seeds.length}, seed ${seeds[cast]}`);
      }
      const media = [];
      for (const view of ['ingame', 'closeup']) for (const speed of [1, .5]) {
        const name = `${view}-${speed === 1 ? '1x' : '0.5x'}.gif`;
        const filter = `setpts=PTS/${speed},fps=30,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`;
        ffmpeg(['-framerate', '60', '-i', path.join(out, view, '%04d.png'), '-filter_complex', filter, '-loop', '0', path.join(out, name)]);
        // Inspect encoded dimensions/timing. GIF delays have centisecond precision.
        const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames:format=duration', '-of', 'json', path.join(out, name)], { encoding: 'utf8' }));
        const stream = probe.streams[0], expected = view === 'ingame' ? [720, 1280] : [660, 720];
        assert.deepEqual([stream.width, stream.height], expected);
        assert(Math.abs(Number(probe.format.duration) - total / sourceFps / speed) < .08);
        media.push({ name, ...probe, bytes: fs.statSync(path.join(out, name)).size });
      }
      // Decode the delivered GIF: every fourth frame, chronological, across all casts.
      const tileRows = Math.ceil(Math.ceil(total / 2 / 4) / 6);
      ffmpeg(['-i', path.join(out, 'closeup-1x.gif'), '-vf', `select=not(mod(n\\,4)),scale=220:240:flags=neighbor,tile=6x${tileRows}:padding=4:margin=4:color=white`, '-frames:v', '1', path.join(out, 'closeup-strip.png')]);
      Object.assign(report, { seeds, sourceFps, framesPerCast, total, crop, closeupMagnification: 3, media, commands });
    }
    if (!smoke) {
      const media = report.media || [];
      fs.writeFileSync(path.join(out, 'gallery.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Spell review</title><style>:root{color-scheme:light}body{background:#faf8f2;color:#403523;font:16px system-ui;margin:24px}article{margin:12px 0}.pixels{overflow:auto}img{image-rendering:pixelated;max-width:none}.game{width:360px}.close{width:330px}</style><h1>Starter native PNG proof</h1><p>PNG pixels display 1:1 at 100% browser zoom. Scroll to inspect. Construction proof; sibling specs own spell approval.</p>${nativeStills.map(s => `<article><h2>${s.device}, ${s.t.toFixed(3)} s</h2><a href="${s.files[0]}">Device page</a> / <a href="${s.files[1]}">Native canvas</a><div class="pixels"><img src="${s.files[2]}" width="${s.cropPixels[0]}" height="${s.cropPixels[1]}" alt="1:1 device pixel crop"></div></article>`).join('')}<h2>Secondary motion proof</h2>${media.map(m => `<article><a href="${m.name}"><img class="${m.name.startsWith('ingame') ? 'game' : 'close'}" src="${m.name}" alt="${m.name}, seeds ${seeds.join(', ')}"></a></article>`).join('')}${media.length ? '<p><a href="closeup-strip.png">Decoded strip</a></p><div class="pixels"><img src="closeup-strip.png" alt="Every fourth decoded close-up frame"></div>' : ''}</html>`);
      const nojs = await browser.newPage({ javaScriptEnabled: false });
      await nojs.goto(pathToFileURL(path.join(out, 'gallery.html')).href);
      const images = nojs.locator('img'), count = nativeStills.length + media.length + (media.length ? 1 : 0);
      assert.equal(await images.count(), count);
      for (let i = 0; i < count; i++) assert(await images.nth(i).evaluate(img => img.complete && img.naturalWidth > 0));
      await nojs.close();
      report.galleryNoJS = true;
    }
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    if (!smoke) fs.writeFileSync(path.join(out, 'capture.json'), JSON.stringify(report, null, 2) + '\n');
  } finally { await browser.close(); }
  console.log(JSON.stringify({ pass: true, fileURL: report.fileURL, checks: report.checks,
    errors: report.errors, failed: report.failed, galleryNoJS: report.galleryNoJS,
    media: report.media?.map(m => ({ name: m.name, dimensions: [m.streams[0].width, m.streams[0].height],
      frames: Number(m.streams[0].nb_frames), seconds: Number(m.format.duration) })) }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
