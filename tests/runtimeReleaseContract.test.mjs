import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

test('hosted release fails when a tracked runtime dependency is missing', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'orka-runtime-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'tools'));
  mkdirSync(path.join(root, 'web-runner'));
  copyFileSync(new URL('../tools/build_runtime_release.mjs', import.meta.url), path.join(root, 'tools/build_runtime_release.mjs'));
  writeFileSync(path.join(root, 'web-runner/app.js'), "import './required.mjs';\n");
  const dependency = path.join(root, 'web-runner/required.mjs');
  writeFileSync(dependency, 'export const required = true;\n');
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init', '--quiet');
  git('add', 'web-runner');
  git('-c', 'user.name=Release fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Runtime fixture bd-ORKA-5t0w');
  const build = () => spawnSync(process.execPath, ['tools/build_runtime_release.mjs'], { cwd: root, encoding: 'utf8' });
  const complete = build();
  assert.equal(complete.status, 0, complete.stderr);
  const manifest = path.join(root, 'dist/release-manifest.json');
  assert.ok(JSON.parse(readFileSync(manifest, 'utf8')).files['web-runner/required.mjs']);

  rmSync(dependency);
  const missing = build();
  assert.notEqual(missing.status, 0, 'missing tracked dependency must fail the release');
  assert.match(missing.stderr, /ENOENT/);
  assert.match(missing.stderr, /required\.mjs/);
  assert.equal(existsSync(manifest), false, 'failed build must not leave a successful manifest');
});
