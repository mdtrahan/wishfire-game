#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

async function main() {
  const { sha256, sourceHashes, describeBinary, readWasmRelease, wasmFile, wasmManifestFile } = await import('./build_wasm_support.mjs');
  const root = path.resolve(__dirname, '..');
  const rustup = '/opt/homebrew/opt/rustup/bin/rustup';
  const rustc = path.join(process.env.HOME || '', '.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc');
  const env = { ...process.env };
  const useRustup = !env.CARGO && fs.existsSync(rustup) && fs.existsSync(rustc);
  const command = env.CARGO || (useRustup ? rustup : 'cargo');
  const prefix = useRustup ? ['run', 'stable', 'cargo'] : [];
  if (useRustup) env.RUSTC = rustc;
  const args = [...prefix, 'build', '--manifest-path', path.join(root, 'rust/simulation_core/Cargo.toml'), '--locked', '--target', 'wasm32-unknown-unknown', '--release'];
  const build = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (build.status !== 0) throw new Error(`SimulationCore wasm build failed (${build.error?.message || build.status}); previous artifacts preserved`);
  const source = path.resolve(root, env.CARGO_TARGET_DIR || 'rust/simulation_core/target', 'wasm32-unknown-unknown/release/simulation_core.wasm');
  const bytes = fs.readFileSync(source);
  const description = describeBinary(bytes);
  const sources = sourceHashes(root);
  const manifest = {
    format: 1, abiVersion: description.abi_version, schema: description.schema, hz: description.hz,
    capabilities: description.capabilities,
    content: { version: description.content_version, sha256: sha256(JSON.stringify(sources)) },
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    extractedSliceCommit: '9c142b5f73294bd5a783e79d3840d0c3386c90a1',
    sources, binary: wasmFile, binarySha256: sha256(bytes),
    source: 'rust/simulation_core/src/lib.rs', sourceSha256: sources['rust/simulation_core/src/lib.rs'], combatAbiVersion: '1.0',
    toolchain: {
      rustc: execFileSync(env.RUSTC || 'rustc', ['--version'], { env, encoding: 'utf8' }).trim(),
      cargo: execFileSync(command, [...prefix, '--version'], { env, encoding: 'utf8' }).trim(),
    },
    build: { target: 'wasm32-unknown-unknown', profile: 'release', features: 'Cargo.toml defaults', rustflags: env.RUSTFLAGS || '', encodedRustflags: env.CARGO_ENCODED_RUSTFLAGS || '', args: args.slice(prefix.length + 1).map(arg => arg === path.join(root, 'rust/simulation_core/Cargo.toml') ? 'rust/simulation_core/Cargo.toml' : arg) },
  };
  const candidate = fs.mkdtempSync(path.join(root, 'web-runner/assets/.simulation-core-next-'));
  const files = [wasmFile, wasmManifestFile];
  const previous = files.map(file => fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file)) : null);
  try {
    // Validate the complete candidate against current sources before replacing either shipped file.
    fs.mkdirSync(path.join(candidate, 'web-runner/assets'), { recursive: true });
    fs.writeFileSync(path.join(candidate, wasmFile), bytes);
    fs.writeFileSync(path.join(candidate, wasmManifestFile), JSON.stringify(manifest, null, 2) + '\n');
    const { validateSimulationCore } = await import('../web-runner/systems/simulationCoreLoader.mjs');
    validateSimulationCore(new WebAssembly.Instance(new WebAssembly.Module(bytes)), manifest);
    try {
      for (const file of files) fs.renameSync(path.join(candidate, file), path.join(root, file));
      readWasmRelease(root);
    } catch (error) {
      files.forEach((file, i) => previous[i] === null ? fs.rmSync(path.join(root, file), { force: true }) : fs.writeFileSync(path.join(root, file), previous[i]));
      throw error;
    }
  } finally { fs.rmSync(candidate, { recursive: true, force: true }); }
  fs.mkdirSync(path.join(root, 'output/balance'), { recursive: true });
  fs.writeFileSync(path.join(root, 'output/balance/simulation-core-wasm-provenance.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote matched ${wasmFile} and ${wasmManifestFile}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
