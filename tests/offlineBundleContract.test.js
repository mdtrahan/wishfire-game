const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.join(__dirname, '..');
const output = path.join(root, 'dist-offline');
const runtimeData = ['layouts.json', 'objectTypes.json', 'enemies.json'];

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
  const embeddedWasm = bundle.indexOf('const embeddedBytes = getEmbeddedWasmBytes(wasmUrl)');
  const wasmFetch = bundle.indexOf('instantiateStreaming(fetch(wasmUrl)');

  assert.ok(embeddedJson >= 0 && embeddedJson < jsonFetch, 'JSON startup data must resolve before fetch');
  assert.ok(embeddedWasm >= 0 && embeddedWasm < wasmFetch, 'WASM startup data must resolve before fetch');
});

test('offline artifact retains relative presentation assets and omits JSON/WASM sidecars', () => {
  assert.ok(fs.existsSync(path.join(output, 'assets', 'images', 'navigation', 'flow.png')));
  assert.ok(fs.existsSync(path.join(output, 'assets', 'fonts', 'Bungee-Regular.ttf')));
  const sidecars = listFiles(path.join(output, 'assets')).filter((file) => /\.(json|wasm)$/i.test(file));
  assert.deepEqual(sidecars, []);

  const embeddedNames = new Set([...runtimeData, 'simulation_core.wasm']);
  const stagedAssets = listFiles(path.join(root, 'dist', 'web-runner', 'assets'))
    .filter((file) => !embeddedNames.has(path.basename(file)))
    .sort();
  const offlineAssets = listFiles(path.join(output, 'assets')).sort();
  assert.deepEqual(offlineAssets, stagedAssets, 'offline bundle must retain every non-embedded staged asset');
});

test('offline resolver maps document assets and embedded payloads without network APIs', async () => {
  const oldDocument = global.document;
  const oldRuntime = global.__ORKA_OFFLINE_RUNTIME__;
  global.document = { baseURI: 'file:///offline/index.html' };
  global.__ORKA_OFFLINE_RUNTIME__ = {
    json: { 'layouts.json': { version: 1 } },
    wasm: { 'simulation_core.wasm': Buffer.from([0, 97, 115, 109]).toString('base64') },
  };
  try {
    const resolver = await import(pathToFileURL(path.join(root, 'web-runner', 'systems', 'runtimeAssetUrl.mjs')).href);
    assert.equal(resolver.runtimeAssetUrl('images/Fara.png'), 'file:///offline/assets/images/Fara.png');
    assert.deepEqual(resolver.getEmbeddedJson('file:///offline/assets/layouts.json'), { version: 1 });
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
