import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { publishRelease } from './build_wasm_support.mjs';

const root = path.resolve(import.meta.dirname, '..');
const staging = path.join(root, 'dist');
const output = path.join(root, 'dist-offline');
const buildId = `${process.pid}-${Date.now()}`;
const candidate = `${output}.next-${buildId}`;
const runtimeData = [
  'layouts.json',
  'objectTypes.json',
  'enemies.json',
  'elemental-impact/manifest.json',
  'puppets/manifest.json',
  'simulation_core.manifest.json',
  'rust-combat/manifest.json',
];
const wasmName = 'simulation_core.wasm';
const esbuild = process.env.ORKA_OFFLINE_ESBUILD || path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');

const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root,
  encoding: 'utf8',
  stdio: options.stdio || 'pipe',
});
const git = (...args) => run('git', args).trim();
const commit = git('rev-parse', 'HEAD');

if (!fs.existsSync(esbuild)) {
  throw new Error('Offline release requires the repository esbuild dev dependency; run npm ci first');
}

run(process.execPath, ['tools/build_runtime_release.mjs'], { stdio: 'inherit' });

const sourceIndex = path.join(root, 'web-runner', 'index.html');
const sourceAssets = path.join(staging, 'web-runner', 'assets');
if (!fs.existsSync(sourceIndex) || !fs.existsSync(sourceAssets)) {
  throw new Error('Offline release requires the staged runtime release and asset tree');
}
const embeddedJson = runtimeData.filter(name => fs.existsSync(path.join(sourceAssets, name)));

fs.rmSync(candidate, { recursive: true, force: true });
fs.mkdirSync(candidate, { recursive: true });
process.on('exit', () => fs.rmSync(candidate, { recursive: true, force: true }));

const index = fs.readFileSync(sourceIndex, 'utf8');
const iconTag = '<link rel="icon" href="/favicon.ico" sizes="any">';
const scriptTags = '  <script src="./runtime-fingerprint.js"></script>\n  <script type="module" src="./app.js"></script>';
if (!index.includes(iconTag) || !index.includes(scriptTags)) {
  throw new Error('Offline release template changed; expected the current runtime entry tags');
}
const offlineIndex = index
  .replace(iconTag, '<link rel="icon" href="./favicon.ico" sizes="any">')
  .replace(scriptTags, '  <script src="./runtime-fingerprint.js"></script>\n  <script src="./wishfire.bundle.js"></script>');
fs.writeFileSync(path.join(candidate, 'index.html'), offlineIndex);

const fingerprint = {
  commit,
  issueId: 'ORKA-6ei.6',
  release: 'offline-portable',
};
fs.writeFileSync(
  path.join(candidate, 'runtime-fingerprint.js'),
  `window.__ORKA_RUNTIME_FINGERPRINT__ = ${JSON.stringify(fingerprint)};\n`,
);
fs.copyFileSync(path.join(root, 'favicon.ico'), path.join(candidate, 'favicon.ico'));

const offlineAssets = path.join(candidate, 'assets');

const jsonPayload = Object.fromEntries(embeddedJson.map((name) => {
  const file = path.join(staging, 'web-runner', 'assets', name);
  return [name, JSON.parse(fs.readFileSync(file, 'utf8'))];
}));
const wasmPayload = fs.readFileSync(path.join(staging, 'web-runner', 'assets', wasmName)).toString('base64');
// WebGL uploads and scene readback require origin-clean images under file://.
const puppetFiles = new Set();
function collectPuppetFiles(value) {
  if (typeof value === 'string' && /\.(png|webp|jpe?g|svg)$/i.test(value)) puppetFiles.add(`puppets/${value}`);
  else if (value && typeof value === 'object') Object.values(value).forEach(collectPuppetFiles);
}
collectPuppetFiles(jsonPayload['puppets/manifest.json']);
puppetFiles.add('puppets/hondo/source/head.png'); // Canvas chapter-progress portrait.
const mimeTypes = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const embeddedAssets = listFiles(sourceAssets).filter(name => (mimeTypes[path.extname(name)] || name.endsWith('.css')) && (!name.startsWith('puppets/') || puppetFiles.has(name)));
const assetUrls = Object.fromEntries(embeddedAssets.filter(name => !name.endsWith('.css')).map(name => [name,
  `data:${mimeTypes[path.extname(name)]};base64,${fs.readFileSync(path.join(sourceAssets, name)).toString('base64')}`]));
for (const name of embeddedAssets.filter(name => name.endsWith('.css'))) {
  const css = fs.readFileSync(path.join(sourceAssets, name), 'utf8').replace(/url\((['"]?)([^)'"]+)\1\)/g, (match, quote, reference) => {
    const key = path.posix.normalize(path.posix.join(path.posix.dirname(name), reference));
    return assetUrls[key] ? `url("${assetUrls[key]}")` : match;
  });
  assetUrls[name] = `data:text/css;base64,${Buffer.from(css).toString('base64')}`;
}
fs.cpSync(sourceAssets, offlineAssets, {
  recursive: true,
  filter(source) {
    const relative = path.relative(sourceAssets, source).split(path.sep).join('/');
    return !embeddedAssets.includes(relative) && !embeddedJson.includes(relative) && !relative.endsWith('.json') && path.basename(source) !== wasmName;
  },
});
const resolvedIndex = offlineIndex.replace(/url\(["']?\.\/assets\/([^"')]+)["']?\)/g,
  (match, name) => assetUrls[name] ? `url("${assetUrls[name]}")` : match);
fs.writeFileSync(path.join(candidate, 'index.html'), resolvedIndex);
const payloadPrelude = `globalThis.__ORKA_OFFLINE_RUNTIME__ = Object.freeze({json:${JSON.stringify(jsonPayload)},wasm:${JSON.stringify({[wasmName]: wasmPayload})},assetUrls:${JSON.stringify(assetUrls)}});\n`;

const generatedBundle = path.join(candidate, 'wishfire.bundle.generated.js');
run(esbuild, [
  'web-runner/app.js',
  '--bundle',
  '--format=iife',
  '--platform=browser',
  '--target=es2020',
  `--outfile=${generatedBundle}`,
], { stdio: 'inherit' });
// esbuild emits quoted static asset paths used by DOM icons and stylesheet links.
// Resolve those paths through the same payload as dynamic runtimeAssetUrl consumers.
const bundle = fs.readFileSync(generatedBundle, 'utf8').replace(/(['"])(?:\.\/)?assets\/([^'"\n]+)\1/g,
  (match, quote, name) => {
    if (assetUrls[name]) return quote + assetUrls[name] + quote;
    // HTML attributes inside template literals retain their authored interpolation.
    if (name.includes('${')) return quote + '${globalThis.__ORKA_OFFLINE_RUNTIME__.assetUrls[`' + name + '`]}' + quote;
    return match;
  });
fs.writeFileSync(path.join(candidate, 'wishfire.bundle.js'), payloadPrelude + bundle);
fs.rmSync(generatedBundle, { force: true });

const standaloneName = 'wishfire.html';
const standalone = path.join(candidate, standaloneName);
const entryTags = '  <script src="./runtime-fingerprint.js"></script>\n  <script src="./wishfire.bundle.js"></script>';
const [beforeScripts, afterScripts] = resolvedIndex.replace('href="./favicon.ico"',
  `href="data:image/x-icon;base64,${fs.readFileSync(path.join(root, 'favicon.ico')).toString('base64')}"`).split(entryTags);
if (afterScripts === undefined) throw new Error('Offline standalone entry tags changed');
fs.writeFileSync(standalone, beforeScripts + '<script>\n' + fs.readFileSync(path.join(candidate, 'runtime-fingerprint.js'), 'utf8'));
// Keep inline payloads safe when authored JSON contains a closing script tag.
fs.appendFileSync(standalone, payloadPrelude.replace(/<\/script/gi, '<\\/script'));
fs.appendFileSync(standalone, bundle.replace(/<\/script/gi, '<\\/script'));
fs.appendFileSync(standalone, '\n</script>' + afterScripts);

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

const files = listFiles(candidate).filter((file) => file !== 'release-manifest.json');
const hostedManifest = JSON.parse(fs.readFileSync(path.join(staging, 'release-manifest.json'), 'utf8'));
const manifest = {
  commit,
  simulationCore: hostedManifest.simulationCore,
  hostedManifestSha256: createHash('sha256').update(fs.readFileSync(path.join(staging, 'release-manifest.json'))).digest('hex'),
  format: 'offline-portable',
  entry: 'index.html',
  standaloneEntry: standaloneName,
  embedded: { json: embeddedJson, wasm: [wasmName], assets: Object.keys(assetUrls), assetSha256: Object.fromEntries(embeddedAssets.map(name => [name, createHash('sha256').update(Buffer.from(assetUrls[name].split(',')[1], 'base64')).digest('hex')])) },
  files: Object.fromEntries(files.map((file) => [
    file,
    createHash('sha256').update(fs.readFileSync(path.join(candidate, file))).digest('hex'),
  ])),
};
fs.writeFileSync(path.join(candidate, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

publishRelease(candidate, output);
console.log(`Offline runtime release: ${files.length + 1} files from ${commit} in ${output}`);
