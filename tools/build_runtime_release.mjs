import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { sha256, ensureWasmRelease, generatedRuntimeFiles, publishRelease } from './build_wasm_support.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'dist');
const candidate = `${output}.next-${process.pid}`;
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const simulationCore = ensureWasmRelease(root);
const allowedExtensions = new Set(['.html', '.js', '.mjs', '.json', '.css', '.wasm', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.ogg', '.wav']);
const files = [...new Set([...git('ls-files', '-z', '--', 'web-runner', 'src').split('\0').filter(file =>
  file && allowedExtensions.has(path.extname(file)) && !file.endsWith('/prompts.json')), ...generatedRuntimeFiles])];
if (!files.includes('web-runner/app.js')) throw new Error('Release requires tracked runtime');
fs.rmSync(candidate, { recursive: true, force: true });
try {
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(candidate, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(candidate, file));
  }
  fs.writeFileSync(path.join(candidate, 'web-runner/runtime-fingerprint.js'), `window.__ORKA_RUNTIME_FINGERPRINT__ = ${JSON.stringify({ commit, release: true })};\n`);
  if (!files.includes('web-runner/runtime-fingerprint.js')) files.push('web-runner/runtime-fingerprint.js');
  fs.writeFileSync(path.join(candidate, '_redirects'), '/ /web-runner/ 301\n/web-runner /web-runner/ 301\n');
  files.push('_redirects');
  const manifest = { commit, simulationCore, files: Object.fromEntries(files.sort().map(file => [file, sha256(fs.readFileSync(path.join(candidate, file)))])) };
  fs.writeFileSync(path.join(candidate, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  publishRelease(candidate, output);
  console.log(`Runtime release: ${files.length} files from ${commit} in ${output}`);
} finally { fs.rmSync(candidate, { recursive: true, force: true }); }
