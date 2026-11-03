#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

async function main() {
  const { sha256, sourceHashes, describeBinary, readWasmRelease, wasmFile, wasmManifestFile, specialClocksFile, specialClockContent, provenanceFile, generatedRuntimeFiles } = await import('./build_wasm_support.mjs');
  const root = path.resolve(__dirname, '..');
  if (process.argv.includes('--ensure')) {
    try { readWasmRelease(root); return; } catch {}
  }
  const rustup = '/opt/homebrew/opt/rustup/bin/rustup';
  const rustc = path.join(process.env.HOME || '', '.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc');
  const env = { ...process.env };
  const useRustup = !env.CARGO && fs.existsSync(rustup) && fs.existsSync(rustc);
  const command = env.CARGO || (useRustup ? rustup : 'cargo');
  const prefix = useRustup ? ['run', 'stable', 'cargo'] : [];
  if (useRustup) env.RUSTC = rustc;
  // Encoded flags take precedence over RUSTFLAGS in Cargo. Remap checkout and
  // registry paths, including panic-location strings retained in release WASM.
  const flags = env.CARGO_ENCODED_RUSTFLAGS !== undefined
    ? env.CARGO_ENCODED_RUSTFLAGS.split('\x1f').filter(Boolean)
    : (env.RUSTFLAGS || '').split(/\s+/).filter(Boolean);
  const cargoHome = env.CARGO_HOME || path.join(process.env.HOME || '', '.cargo');
  flags.push(`--remap-path-prefix=${cargoHome}=/cargo`, `--remap-path-prefix=${root}=/source`);
  env.CARGO_ENCODED_RUSTFLAGS = flags.join('\x1f');
  delete env.RUSTFLAGS;
  env.CARGO_TARGET_DIR = path.resolve(root, env.CARGO_TARGET_DIR || 'rust/simulation_core/target');
  const args = [...prefix, 'build', '--manifest-path', path.join(root, 'rust/simulation_core/Cargo.toml'), '--locked', '--target', 'wasm32-unknown-unknown', '--release'];
  const sources = sourceHashes(root);
  const build = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (build.status !== 0) throw new Error(`SimulationCore wasm build failed (${build.error?.message || build.status}); previous artifacts preserved`);
  const source = path.resolve(root, env.CARGO_TARGET_DIR || 'rust/simulation_core/target', 'wasm32-unknown-unknown/release/simulation_core.wasm');
  const bytes = fs.readFileSync(source);
  const description = describeBinary(bytes);
  if (JSON.stringify(sourceHashes(root)) !== JSON.stringify(sources)) {
    throw new Error('SimulationCore inputs changed during compilation; retry build; previous artifacts preserved');
  }
  const manifest = {
    format: 1, abiVersion: description.abi_version, schema: description.schema, hz: description.hz,
    capabilities: description.capabilities,
    content: { version: description.content_version, sha256: sha256(JSON.stringify(sources)) },
    extractedSliceCommit: '9c142b5f73294bd5a783e79d3840d0c3386c90a1',
    sources, binary: wasmFile, binarySha256: sha256(bytes),
    source: 'rust/simulation_core/src/lib.rs', sourceSha256: sources['rust/simulation_core/src/lib.rs'], combatAbiVersion: '1.0',
    toolchain: {
      rustc: execFileSync(env.RUSTC || 'rustc', ['--version'], { env, encoding: 'utf8' }).trim(),
      cargo: execFileSync(command, [...prefix, '--version'], { env, encoding: 'utf8' }).trim(),
    },
    build: { target: 'wasm32-unknown-unknown', profile: 'release', features: 'Cargo.toml defaults', rustflags: env.RUSTFLAGS || '', encodedRustflags: flags.map(flag => flag.replaceAll(root, '<checkout>').replaceAll(cargoHome, '<cargo-home>')).join('\x1f'), args: args.slice(prefix.length + 1).map(arg => arg === path.join(root, 'rust/simulation_core/Cargo.toml') ? 'rust/simulation_core/Cargo.toml' : arg) },
  };
  const candidate = fs.mkdtempSync(path.join(root, 'web-runner/assets/.simulation-core-next-'));
  const files = [...generatedRuntimeFiles, provenanceFile];
  const previous = files.map(file => fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file)) : null);
  try {
    // Validate the complete candidate against current sources before replacing the matched shipped files.
    fs.mkdirSync(path.join(candidate, 'web-runner/assets'), { recursive: true });
    fs.writeFileSync(path.join(candidate, wasmFile), bytes);
    fs.writeFileSync(path.join(candidate, wasmManifestFile), JSON.stringify(manifest, null, 2) + '\n');
    fs.mkdirSync(path.dirname(path.join(candidate, specialClocksFile)), { recursive: true });
    fs.writeFileSync(path.join(candidate, specialClocksFile), specialClockContent(description));
    fs.mkdirSync(path.dirname(path.join(candidate, provenanceFile)), { recursive: true });
    fs.writeFileSync(path.join(candidate, provenanceFile), JSON.stringify(manifest, null, 2) + '\n');
    const { validateSimulationCore } = await import('../web-runner/systems/simulationCoreLoader.mjs');
    validateSimulationCore(new WebAssembly.Instance(new WebAssembly.Module(bytes)), manifest);
    try {
      for (const file of files) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.renameSync(path.join(candidate, file), path.join(root, file));
      }
      readWasmRelease(root);
    } catch (error) {
      files.forEach((file, i) => previous[i] === null ? fs.rmSync(path.join(root, file), { force: true }) : fs.writeFileSync(path.join(root, file), previous[i]));
      throw error;
    }
  } finally { fs.rmSync(candidate, { recursive: true, force: true }); }
  console.log(`Wrote matched ${wasmFile} and ${wasmManifestFile}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
