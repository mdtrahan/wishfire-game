const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixturePath = path.join(__dirname, 'fixtures', 'effective_stat_cases.csv');
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

function jsEffectiveStat(row) {
  let value = toNumber(row, 'base');
  if (toNumber(row, 'isHero') === 1) {
    value += toNumber(row, 'partyBuff');
  } else if (toNumber(row, 'isEnemy') === 1) {
    value -= toNumber(row, 'enemyDebuff');
  }
  return Math.max(0, value);
}

test('effective stat fixtures encode current JS projection semantics', () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(rows.length >= 8);
  for (const row of rows) {
    assert.equal(jsEffectiveStat(row), toNumber(row, 'expectedValue'), row.name);
  }
});

test('Rust simulation core declares effective stat projection shadow export', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn effective_stat_value/);
  assert.match(rustSrc, /extern "C" fn effective_stat_value_shadow/);
});

test('static simulation core wasm matches effective stat fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.effective_stat_value_shadow, 'function');

  for (const row of rows) {
    assert.equal(
      exports.effective_stat_value_shadow(
        toNumber(row, 'base'),
        toNumber(row, 'partyBuff'),
        toNumber(row, 'enemyDebuff'),
        toNumber(row, 'isHero'),
        toNumber(row, 'isEnemy'),
      ),
      toNumber(row, 'expectedValue'),
      `${row.name} wasm value`,
    );
  }
});
