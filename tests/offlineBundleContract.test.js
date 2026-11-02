const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.join(__dirname, '..');
const output = path.join(root, 'dist-offline');
const runtimeData = ['layouts.json', 'objectTypes.json', 'enemies.json', 'elemental-impact/manifest.json', 'puppets/manifest.json', 'simulation_core.manifest.json', 'rust-combat/manifest.json'];

function listFiles(directory, prefix = '') {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute, relative));
    else files.push(relative);
  }
  return files;
}

test.before(() => {
  execFileSync(process.execPath, ['tools/build_offline_release.mjs'], { cwd: root, stdio: 'pipe' });
});

test('offline artifact has one local classic entry and embedded data payloads', () => {
  const index = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  const bundle = fs.readFileSync(path.join(output, 'wishfire.bundle.js'), 'utf8');

  assert.match(index, /href="\.\/favicon\.ico"/);
  assert.match(index, /src="\.\/runtime-fingerprint\.js"/);
  assert.match(index, /src="\.\/wishfire\.bundle\.js"/);
  assert.doesNotMatch(index, /type="module"/);
  assert.doesNotMatch(index, /src="\.\/app\.js"/);
  assert.doesNotMatch(bundle, /import\.meta/);
  assert.match(bundle, /__ORKA_OFFLINE_RUNTIME__/);
  for (const name of ['layouts.json', 'objectTypes.json', 'enemies.json', 'simulation_core.wasm']) {
    assert.match(bundle, new RegExp(name.replace('.', '\\.')));
  }
  assert.ok(bundle.length > 1_000_000);
  assert.ok(fs.existsSync(path.join(output, 'runtime-fingerprint.js')));
  assert.ok(fs.existsSync(path.join(output, 'favicon.ico')));
});

test('embedded JSON and WASM branches precede hosted fetch fallbacks', () => {
  const bundle = fs.readFileSync(path.join(output, 'wishfire.bundle.js'), 'utf8');
  const embeddedJson = bundle.indexOf('const embedded = getEmbeddedJson(requestUrl)');
  const jsonFetch = bundle.indexOf('const res = await fetch(u');
  const loader = fs.readFileSync(path.join(root, 'web-runner/systems/simulationCoreLoader.mjs'), 'utf8');
  const embeddedWasm = loader.indexOf('getEmbeddedWasmBytes(url)');
  const wasmFetch = loader.indexOf('await (await read(url)).arrayBuffer()');

  assert.ok(embeddedJson >= 0 && embeddedJson < jsonFetch, 'JSON startup data must resolve before fetch');
  assert.ok(embeddedWasm >= 0 && embeddedWasm < wasmFetch, 'WASM startup data must resolve before fetch');
});

test('offline artifact retains relative presentation assets and omits JSON/WASM sidecars', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'release-manifest.json'), 'utf8'));
  assert.ok(manifest.embedded.assets.includes('fonts/Bungee-Regular.ttf'));
  assert.ok(manifest.embedded.assets.some(name => name.startsWith('puppets/fara/')));
  const sidecars = listFiles(path.join(output, 'assets')).filter((file) => /\.(json|wasm)$/i.test(file));
  assert.deepEqual(sidecars, []);

  const embeddedNames = new Set([...runtimeData, 'simulation_core.wasm']);
  const stagedAssets = listFiles(path.join(root, 'dist', 'web-runner', 'assets'))
    .filter((file) => !embeddedNames.has(file) && !manifest.embedded.assets.includes(file) && !/\.(json|wasm)$/i.test(file))
    .sort();
  const offlineAssets = listFiles(path.join(output, 'assets')).sort();
  assert.deepEqual(offlineAssets, stagedAssets, 'offline bundle must retain every non-embedded staged asset');
  if (fs.existsSync(path.join(root, 'dist', 'web-runner', 'assets', 'elemental-impact', 'manifest.json'))) {
    const release = JSON.parse(fs.readFileSync(path.join(output, 'release-manifest.json'), 'utf8'));
    assert.ok(release.embedded.json.includes('elemental-impact/manifest.json'));
    assert.equal(manifest.embedded.assets.filter(file => file.startsWith('elemental-impact/frames/')).length, 111);
  }
});

test('offline resolver maps document assets and embedded payloads without network APIs', async () => {
  const oldDocument = global.document;
  const oldRuntime = global.__ORKA_OFFLINE_RUNTIME__;
  global.document = { baseURI: 'file:///offline/index.html' };
  global.__ORKA_OFFLINE_RUNTIME__ = {
    json: { 'layouts.json': { version: 1 }, 'elemental-impact/manifest.json': { effects: [] } },
    wasm: { 'simulation_core.wasm': Buffer.from([0, 97, 115, 109]).toString('base64') },
  };
  try {
    const resolver = await import(pathToFileURL(path.join(root, 'web-runner', 'systems', 'runtimeAssetUrl.mjs')).href);
    assert.equal(resolver.runtimeAssetUrl('images/Fara.png'), 'file:///offline/assets/images/Fara.png');
    assert.deepEqual(resolver.getEmbeddedJson('file:///offline/assets/layouts.json'), { version: 1 });
    assert.deepEqual(resolver.getEmbeddedJson('file:///offline/assets/elemental-impact/manifest.json'), { effects: [] });
    assert.deepEqual([...resolver.getEmbeddedWasmBytes('./assets/simulation_core.wasm')], [0, 97, 115, 109]);
  } finally {
    if (oldDocument === undefined) delete global.document;
    else global.document = oldDocument;
    if (oldRuntime === undefined) delete global.__ORKA_OFFLINE_RUNTIME__;
    else global.__ORKA_OFFLINE_RUNTIME__ = oldRuntime;
  }
});

test('offline manifest hashes every generated file and records the exact source commit', () => {
  const manifestPath = path.join(output, 'release-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const actualFiles = listFiles(output).filter((file) => file !== 'release-manifest.json').sort();
  assert.equal(manifest.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
  assert.equal(manifest.format, 'offline-portable');
  assert.equal(manifest.entry, 'index.html');
  assert.equal(manifest.standaloneEntry, 'wishfire.html');
  assert.ok(manifest.embedded.json.includes('simulation_core.manifest.json'));
  assert.deepEqual(manifest.simulationCore, JSON.parse(fs.readFileSync(path.join(root, 'dist/release-manifest.json'), 'utf8')).simulationCore);
  assert.equal(manifest.hostedManifestSha256, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'dist/release-manifest.json'))).digest('hex'));
  assert.deepEqual(Object.keys(manifest.files).sort(), actualFiles);
  for (const file of actualFiles) {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex');
    assert.equal(manifest.files[file], digest, `manifest hash mismatch: ${file}`);
  }
});

test('missing or failed bundler preserves the last playable offline artifact', () => {
  const sentinel = path.join(output, 'preservation-sentinel.txt');
  fs.writeFileSync(sentinel, 'keep\n');
  try {
    assert.throws(() => execFileSync(process.execPath, ['tools/build_offline_release.mjs'], {
      cwd: root,
      env: { ...process.env, ORKA_OFFLINE_ESBUILD: path.join(root, 'missing-esbuild') },
      stdio: 'pipe',
    }), /Offline release requires the repository esbuild dev dependency/);
    assert.throws(() => execFileSync(process.execPath, ['tools/build_offline_release.mjs'], {
      cwd: root,
      env: { ...process.env, ORKA_OFFLINE_ESBUILD: process.execPath },
      stdio: 'pipe',
    }));
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep\n');
    assert.ok(fs.existsSync(path.join(output, 'wishfire.bundle.js')));
    assert.ok(fs.existsSync(path.join(output, 'release-manifest.json')));
  } finally {
    fs.rmSync(sentinel, { force: true });
  }
});

test('hosted release contract remains a separate module/data release', () => {
  const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  const hostedIndex = fs.readFileSync(path.join(root, 'web-runner', 'index.html'), 'utf8');
  const hostedManifest = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'release-manifest.json'), 'utf8'));
  assert.match(netlify, /command = "node tools\/build_runtime_release\.mjs"/);
  assert.match(hostedIndex, /type="module" src="\.\/app\.js"/);
  assert.ok(hostedManifest.files['web-runner/app.js']);
  assert.ok(fs.existsSync(path.join(root, 'dist', 'web-runner', 'assets', 'layouts.json')));
});


test('failed real wasm compiler preserves shipped bytes and both playable releases', () => {
  const files = ['web-runner/assets/simulation_core.wasm', 'web-runner/assets/simulation_core.manifest.json',
    'dist/release-manifest.json', 'dist-offline/release-manifest.json', 'dist-offline/wishfire.bundle.js', 'dist-offline/wishfire.html'];
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  const before = files.map(hash);
  assert.throws(() => execFileSync(process.execPath, ['tools/build_simulation_core_wasm.js'], {
    cwd: root, env: { ...process.env, RUSTFLAGS: '--eo3h-invalid-rustc-option' }, stdio: 'pipe',
  }), /wasm build failed.*previous artifacts preserved/);
  assert.deepEqual(files.map(hash), before);
});

test('disconnected Chromium starts a real Rust fight from the offline file', { timeout: 120000 }, async () => {
  const { chromium } = require('playwright');
  const { detectChromeExecutable } = require('../tools/playwright_support.js');
  const browser = await chromium.launch({ headless: true, executablePath: detectChromeExecutable() || undefined });
  const context = await browser.newContext({ offline: true, viewport: { width: 360, height: 640 } });
  const page = await context.newPage();
  const network = [], errors = [];
  const singleFileRoot = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'eo3h-standalone-'));
  const singleFile = path.join(singleFileRoot, 'wishfire.html');
  fs.copyFileSync(path.join(output, 'wishfire.html'), singleFile);
  const fileUrl = pathToFileURL(singleFile).href;
  page.on('request', request => { if (/^https?:/.test(request.url()) || (request.url().startsWith('file:') && !request.url().startsWith(fileUrl))) network.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.offlineFetches = [];
    window.offlineFileDraws = [];
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      if (image?.src?.startsWith('file:') && !window.offlineFileDraws.includes(image.src)) window.offlineFileDraws.push(image.src);
      return draw.call(this, image, ...args);
    };
    window.fetch = (...args) => { window.offlineFetches.push(String(args[0])); throw new Error('Offline artifact attempted fetch: ' + String(args[0])); };
  });
  try {
    await page.goto(fileUrl + '?rustCombat=1');
    await page.waitForFunction(() => window.__codexGame && JSON.parse(window.render_game_to_text()).flags.layout0Ready);
    await page.evaluate(() => __codexGame.setEncounterRequest({ seed: 7 }));
    await page.getByRole('button', { name: 'Open developer tooling modal', exact: true }).click();
    await page.locator('[data-devtool-boss-chapter]').fill('1');
    await page.locator('[data-devtool-launch-boss]').click();
    await page.waitForFunction(() => {
      const g = __codexGame.globals, snapshot = g.RustCombatPresentation?.state.snapshot;
      if (g.RustCombatError) throw new Error(g.RustCombatError);
      return snapshot && Number(snapshot.step) >= 90 && Number(g.RustCombatReceipt?.kills) > 0;
    }, undefined, { timeout: 90000 }).catch(async error => {
      const diagnostic = await page.evaluate(() => {
        const g = window.__codexGame?.globals, s = g?.RustCombatPresentation?.state.snapshot;
        return { authority: g?.RustCombatAuthority, error: g?.RustCombatError, receipt: g?.RustCombatReceipt, hidden: document.hidden, phase: g?.GamePhase, time: g?.time,
          snapshot: s && { step: s.step, state: s.state, actors: s.actors.map(a => ({ hp: a.hp, max_hp: a.max_hp })) },
          fetches: window.offlineFetches, fileDraws: window.offlineFileDraws.slice(0, 30), quest: JSON.parse(render_game_to_text()).quest };
      });
      throw new Error(error.message + ' ' + JSON.stringify({ ...diagnostic, errors }));
    });
    const proof = await page.evaluate(() => {
      const g = __codexGame.globals, s = g.RustCombatPresentation.state.snapshot;
      return { protocol: location.protocol, authority: g.RustCombatAuthority, step: s.step, actors: s.actors.length,
        enemyDeaths: Number(g.RustCombatReceipt?.kills || 0), hash: s.gameplay_hash, fetches: window.offlineFetches, error: g.RustCombatError || null };
    });
    assert.equal(proof.protocol, 'file:'); assert.equal(proof.authority, true);
    assert.ok(proof.enemyDeaths > 0, 'offline Rust fight must kill an enemy'); assert.match(proof.hash, /^[a-f0-9]{16}$/);
    assert.deepEqual(proof.fetches, []); assert.deepEqual(network, []); assert.deepEqual(errors, []);
    console.log('OFFLINE_RUST_FIGHT ' + JSON.stringify(proof));
  } finally { await context.close(); await browser.close(); fs.rmSync(singleFileRoot, { recursive: true, force: true }); }
});
