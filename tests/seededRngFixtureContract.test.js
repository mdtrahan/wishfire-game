const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const fixturePath = path.join(__dirname, 'fixtures', 'seeded_rng_cases.csv');
const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');

function parseCsvRows(src) {
  const [headerLine, ...lines] = src.trim().split(/\r?\n/);
  const headers = headerLine.split(',');
  return lines.map((line) => {
    const cols = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, cols[index]]));
  });
}

function toNumber(row, key) {
  return Number(row[key] || 0);
}

function extractFunction(src, name) {
  const match = src.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `missing ${name}`);
  return match[0];
}

function loadCreateSeededRng() {
  const src = fs.readFileSync(appPath, 'utf8');
  const script = `${extractFunction(src, 'createSeededRng')}
module.exports = { createSeededRng };`;
  const context = {
    module: { exports: {} },
    exports: {},
    Number,
    Math,
  };
  vm.runInNewContext(script, context, { filename: 'seededRngHelpers.js' });
  return context.module.exports.createSeededRng;
}

test('seeded RNG fixtures encode current JS LCG output semantics', () => {
  const createSeededRng = loadCreateSeededRng();
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(rows.length >= 7);
  for (const row of rows) {
    const rng = createSeededRng(toNumber(row, 'seed'));
    let value = 0;
    for (let i = 0; i < toNumber(row, 'draws'); i += 1) value = rng();
    const state = Math.round(value * 4294967296);
    const index = Math.floor(value * toNumber(row, 'size'));
    assert.equal(state, toNumber(row, 'expectedState'), `${row.name} state`);
    assert.ok(
      Math.abs(value - toNumber(row, 'expectedValue')) < 0.000000000001,
      `${row.name} value ${value}`,
    );
    assert.equal(index, toNumber(row, 'expectedIndex'), `${row.name} index`);
  }
});

test('Rust simulation core declares seeded RNG shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  assert.match(rustSrc, /pub fn seeded_rng_next_state/);
  assert.match(rustSrc, /extern "C" fn seeded_rng_next_state_shadow/);
  assert.match(rustSrc, /extern "C" fn seeded_rng_next_value_shadow/);
  assert.match(rustSrc, /extern "C" fn seeded_rng_index_shadow/);
});

test('static simulation core wasm matches seeded RNG fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  assert.equal(typeof exports.seeded_rng_next_state_shadow, 'function');
  assert.equal(typeof exports.seeded_rng_next_value_shadow, 'function');
  assert.equal(typeof exports.seeded_rng_index_shadow, 'function');

  for (const row of rows) {
    const seed = toNumber(row, 'seed');
    const draws = toNumber(row, 'draws');
    const size = toNumber(row, 'size');
    assert.equal(
      exports.seeded_rng_next_state_shadow(seed, draws),
      toNumber(row, 'expectedState'),
      `${row.name} wasm state`,
    );
    assert.ok(
      Math.abs(exports.seeded_rng_next_value_shadow(seed, draws) - toNumber(row, 'expectedValue')) < 0.000000000001,
      `${row.name} wasm value`,
    );
    assert.equal(
      exports.seeded_rng_index_shadow(seed, draws, size),
      toNumber(row, 'expectedIndex'),
      `${row.name} wasm index`,
    );
  }
});
