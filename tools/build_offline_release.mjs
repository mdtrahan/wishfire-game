import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const staging = path.join(root, 'dist');
const output = path.join(root, 'dist-offline');
const runtimeData = [
  'layouts.json',
  'objectTypes.json',
  'enemies.json',
];
const wasmName = 'simulation_core.wasm';
const esbuild = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');

const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root,
  encoding: 'utf8',
  stdio: options.stdio || 'pipe',
});
const git = (...args) => run('git', args).trim();
const commit = git('rev-parse', 'HEAD');

run(process.execPath, ['tools/build_runtime_release.mjs'], { stdio: 'inherit' });

const sourceIndex = path.join(root, 'web-runner', 'index.html');
const sourceAssets = path.join(staging, 'web-runner', 'assets');
if (!fs.existsSync(sourceIndex) || !fs.existsSync(sourceAssets)) {
  throw new Error('Offline release requires the staged runtime release and asset tree');
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const index = fs.readFileSync(sourceIndex, 'utf8');
const iconTag = '<link rel="icon" href="/favicon.ico" sizes="any">';
const scriptTags = '  <script src="./runtime-fingerprint.js"></script>\n  <script type="module" src="./app.js"></script>';
if (!index.includes(iconTag) || !index.includes(scriptTags)) {
  throw new Error('Offline release template changed; expected the current runtime entry tags');
}
const offlineIndex = index
  .replace(iconTag, '<link rel="icon" href="./favicon.ico" sizes="any">')
  .replace(scriptTags, '  <script src="./runtime-fingerprint.js"></script>\n  <script src="./wishfire.bundle.js"></script>');
fs.writeFileSync(path.join(output, 'index.html'), offlineIndex);

const fingerprint = {
  commit,
  issueId: 'ORKA-6ei.6',
  release: 'offline-portable',
};
fs.writeFileSync(
  path.join(output, 'runtime-fingerprint.js'),
  `window.__ORKA_RUNTIME_FINGERPRINT__ = ${JSON.stringify(fingerprint)};\n`,
);
fs.copyFileSync(path.join(root, 'favicon.ico'), path.join(output, 'favicon.ico'));

const offlineAssets = path.join(output, 'assets');
fs.cpSync(sourceAssets, offlineAssets, {
  recursive: true,
  filter(source) {
    return !runtimeData.includes(path.basename(source)) && path.basename(source) !== wasmName;
  },
});

const jsonPayload = Object.fromEntries(runtimeData.map((name) => {
  const file = path.join(staging, 'web-runner', 'assets', name);
  return [name, JSON.parse(fs.readFileSync(file, 'utf8'))];
}));
const wasmPayload = fs.readFileSync(path.join(staging, 'web-runner', 'assets', wasmName)).toString('base64');
const payloadPrelude = `globalThis.__ORKA_OFFLINE_RUNTIME__ = Object.freeze({json:${JSON.stringify(jsonPayload)},wasm:${JSON.stringify({[wasmName]: wasmPayload})}});\n`;

const generatedBundle = path.join(output, 'wishfire.bundle.generated.js');
if (!fs.existsSync(esbuild)) {
  throw new Error('Offline release requires the repository esbuild dev dependency; run npm ci first');
}
run(esbuild, [
  'web-runner/app.js',
  '--bundle',
  '--format=iife',
  '--platform=browser',
  '--target=es2020',
  `--outfile=${generatedBundle}`,
], { stdio: 'inherit' });
const bundle = fs.readFileSync(generatedBundle, 'utf8');
fs.writeFileSync(path.join(output, 'wishfire.bundle.js'), payloadPrelude + bundle);
fs.rmSync(generatedBundle, { force: true });

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

const files = listFiles(output).filter((file) => file !== 'release-manifest.json');
const manifest = {
  commit,
  format: 'offline-portable',
  entry: 'index.html',
  embedded: { json: runtimeData, wasm: [wasmName] },
  files: Object.fromEntries(files.map((file) => [
    file,
    createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex'),
  ])),
};
fs.writeFileSync(path.join(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Offline runtime release: ${files.length + 1} files from ${commit} in ${output}`);
