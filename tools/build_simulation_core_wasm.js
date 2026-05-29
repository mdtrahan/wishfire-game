#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'rust', 'simulation_core', 'Cargo.toml');
const rustupPath = '/opt/homebrew/opt/rustup/bin/rustup';
const rustupRustc = path.join(
  process.env.HOME || '',
  '.rustup',
  'toolchains',
  'stable-aarch64-apple-darwin',
  'bin',
  'rustc',
);

const env = { ...process.env };
let command = 'cargo';
let args = [
  'build',
  '--manifest-path',
  manifestPath,
  '--target',
  'wasm32-unknown-unknown',
  '--release',
];

if (fs.existsSync(rustupPath) && fs.existsSync(rustupRustc)) {
  command = rustupPath;
  args = ['run', 'stable', 'cargo', ...args];
  env.RUSTC = rustupRustc;
}

const build = spawnSync(command, args, {
  cwd: root,
  env,
  stdio: 'inherit',
});
if (build.status !== 0) {
  process.exit(build.status || 1);
}

const source = path.join(
  root,
  'rust',
  'simulation_core',
  'target',
  'wasm32-unknown-unknown',
  'release',
  'simulation_core.wasm',
);
const destination = path.join(root, 'web-runner', 'assets', 'simulation_core.wasm');
fs.copyFileSync(source, destination);
console.log(`Wrote ${path.relative(root, destination)}`);
