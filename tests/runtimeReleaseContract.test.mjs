import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

test('hosted release preserves its playable output when a tracked dependency or Rust input is missing', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'orka-runtime-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'tools'));
  mkdirSync(path.join(root, 'web-runner'));
  for (const file of ['tools/build_runtime_release.mjs', 'tools/build_wasm_support.mjs',
    'web-runner/systems/simulationCoreLoader.mjs', 'web-runner/systems/runtimeAssetUrl.mjs',
    'web-runner/src/core/combatBridge.mjs', 'web-runner/src/core/specialClockContent.mjs', 'web-runner/assets/simulation_core.wasm', 'web-runner/assets/simulation_core.manifest.json']) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    copyFileSync(new URL('../' + file, import.meta.url), path.join(root, file));
  }
  const identity = JSON.parse(readFileSync(new URL('../web-runner/assets/simulation_core.manifest.json', import.meta.url), 'utf8'));
  for (const file of Object.keys(identity.sources)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    copyFileSync(new URL('../' + file, import.meta.url), path.join(root, file));
  }
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
  const originalManifest = readFileSync(manifest, 'utf8');
  assert.ok(JSON.parse(originalManifest).files['web-runner/required.mjs']);

  rmSync(dependency);
  const missing = build();
  assert.notEqual(missing.status, 0, 'missing tracked dependency must fail the release');
  assert.match(missing.stderr, /ENOENT/);
  assert.match(missing.stderr, /required\.mjs/);
  assert.equal(readFileSync(manifest, 'utf8'), originalManifest);
  assert.equal(readFileSync(path.join(root, 'dist/web-runner/required.mjs'), 'utf8'), 'export const required = true;\n');
  writeFileSync(dependency, 'export const required = true;\n');
  const clocks = path.join(root, 'web-runner/src/core/specialClockContent.mjs');
  const originalClocks = readFileSync(clocks, 'utf8');
  writeFileSync(clocks, originalClocks.replace('10,', '120,'));
  const staleClocks = build();
  assert.notEqual(staleClocks.status, 0);
  assert.match(staleClocks.stderr, /special clock content mismatch/);
  assert.equal(readFileSync(manifest, 'utf8'), originalManifest);
  writeFileSync(clocks, originalClocks);
  writeFileSync(path.join(root, 'rust/wf_combat/src/combat.rs'), '// changed Rust content\n');
  const stale = build();
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /source provenance mismatch/);
  assert.equal(readFileSync(manifest, 'utf8'), originalManifest);
});
