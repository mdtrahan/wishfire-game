// Hosted release: build the Rust app (tools/build_wf_app.sh) and publish rust/wf_app/web as dist/web-runner,
// the public URL the game has always served from. The previous release survives a failed build.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const web = path.join(root, 'rust', 'wf_app', 'web');
const output = path.join(root, 'dist');
const candidate = `${output}.next-${process.pid}`;
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const commit = git('rev-parse', 'HEAD');
if (!process.argv.includes('--no-build')) execFileSync('bash', [path.join(root, 'tools', 'build_wf_app.sh')], { cwd: root, stdio: 'inherit' });
for (const required of ['index.html', 'mq_js_bundle.js', 'wf_app.wasm', 'art/manifest.json', 'data/enemies.json']) {
  if (!fs.existsSync(path.join(web, required))) throw new Error(`Release requires rust/wf_app/web/${required}; run tools/build_wf_app.sh`);
}
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  if (entry.name.startsWith('.')) return [];
  return entry.isDirectory() ? walk(full) : [full];
});
fs.rmSync(candidate, { recursive: true, force: true });
try {
  const files = [];
  for (const file of walk(web)) {
    const rel = path.join('web-runner', path.relative(web, file));
    fs.mkdirSync(path.dirname(path.join(candidate, rel)), { recursive: true });
    fs.copyFileSync(file, path.join(candidate, rel));
    files.push(rel);
  }
  fs.copyFileSync(path.join(root, 'favicon.ico'), path.join(candidate, 'favicon.ico'));
  files.push('favicon.ico');
  fs.writeFileSync(path.join(candidate, '_redirects'), '/ /web-runner/ 301\n/web-runner /web-runner/ 301\n');
  files.push('_redirects');
  const manifest = { commit, files: Object.fromEntries(files.sort().map(file => [file, sha256(fs.readFileSync(path.join(candidate, file)))])) };
  fs.writeFileSync(path.join(candidate, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const previous = `${output}.previous-${process.pid}`;
  if (fs.existsSync(output)) fs.renameSync(output, previous);
  fs.renameSync(candidate, output);
  fs.rmSync(previous, { recursive: true, force: true });
  console.log(`Runtime release: ${files.length} files from ${commit} in ${output}`);
} finally { fs.rmSync(candidate, { recursive: true, force: true }); }
