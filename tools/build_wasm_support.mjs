import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateSimulationCore } from '../web-runner/systems/simulationCoreLoader.mjs';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const wasmFile = 'web-runner/assets/simulation_core.wasm';
export const wasmManifestFile = 'web-runner/assets/simulation_core.manifest.json';
export function sourceHashes(root) {
  const walk = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(file) : [file];
  });
  const files = ['simulation_core', 'wf_combat'].flatMap(crate => [
    ...walk(`rust/${crate}/src`), `rust/${crate}/Cargo.toml`, `rust/${crate}/Cargo.lock`,
    ...['build.rs', 'rust-toolchain.toml', '.cargo/config.toml'].map(file => `rust/${crate}/${file}`).filter(file => fs.existsSync(path.join(root, file))),
  ]);
  for (const file of ['rust-toolchain.toml', '.cargo/config.toml', 'rust/.cargo/config.toml']) if (fs.existsSync(path.join(root, file))) files.push(file);
  return Object.fromEntries(files.sort().map(file => [file, sha256(fs.readFileSync(path.join(root, file)))]));
}
export function describeBinary(bytes) {
  return createCombatBridge(new WebAssembly.Instance(new WebAssembly.Module(bytes))).describe();
}
export function readWasmRelease(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, wasmManifestFile), 'utf8'));
  const sources = sourceHashes(root);
  if (JSON.stringify(manifest.sources) !== JSON.stringify(sources) || manifest.content.sha256 !== sha256(JSON.stringify(sources))) {
    throw new Error('SimulationCore source provenance mismatch; run npm run rust:build-wasm');
  }
  const bytes = fs.readFileSync(path.join(root, wasmFile));
  if (sha256(bytes) !== manifest.binarySha256) throw new Error('SimulationCore binary hash mismatch; run npm run rust:build-wasm');
  validateSimulationCore(new WebAssembly.Instance(new WebAssembly.Module(bytes)), manifest);
  return manifest;
}

// Candidates live beside the destination so rename stays on the same filesystem.
export function publishRelease(candidate, output) {
  const previous = `${candidate}.previous`;
  if (fs.existsSync(output)) fs.renameSync(output, previous);
  try { fs.renameSync(candidate, output); }
  catch (error) {
    if (fs.existsSync(previous)) fs.renameSync(previous, output);
    throw error;
  }
  fs.rmSync(previous, { recursive: true, force: true });
}
