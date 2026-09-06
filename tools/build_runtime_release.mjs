import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'dist');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const allowedExtensions = new Set(['.html', '.js', '.mjs', '.json', '.css', '.wasm', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.ogg', '.wav']);
const files = git('ls-files', '-z', '--', 'web-runner', 'src').split('\0').filter(file =>
  file && allowedExtensions.has(path.extname(file)) && !file.endsWith('/prompts.json'));
if (!files.includes('web-runner/app.js') || !files.includes('web-runner/assets/images/navigation/flow.png')) throw new Error('Release requires tracked runtime and navigation assets');
fs.rmSync(output, { recursive: true, force: true });
for (const file of files) {
  fs.mkdirSync(path.dirname(path.join(output, file)), { recursive: true });
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}
fs.writeFileSync(path.join(output, 'web-runner/runtime-fingerprint.js'), `window.__ORKA_RUNTIME_FINGERPRINT__ = ${JSON.stringify({ commit, issueId: 'ORKA-aoq', release: true })};\n`);
files.push('web-runner/runtime-fingerprint.js');
fs.writeFileSync(path.join(output, '_redirects'), '/ /web-runner/ 301\n/web-runner /web-runner/ 301\n');
files.push('_redirects');
const manifest = { commit, files: Object.fromEntries(files.sort().map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex')])) };
fs.writeFileSync(path.join(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Runtime release: ${files.length} files from ${commit} in ${output}`);
