const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'combat_outcome_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'combatOutcomeRules.mjs');

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

test('combat outcome fixtures encode current JS stop-code order', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const { combatOutcomeCodeFromJs } = await import(pathToFileURL(rulesPath));

  assert.ok(rows.length >= 8);
  for (const row of rows) {
    assert.equal(
      combatOutcomeCodeFromJs({
        energy: toNumber(row, 'energy'),
        partyHp: toNumber(row, 'partyHp'),
        livingHeroes: toNumber(row, 'livingHeroes'),
      }),
      toNumber(row, 'expectedCode'),
      row.name,
    );
  }
});

test('Rust simulation core declares combat outcome shadow export', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn combat_outcome_code/);
  assert.match(rustSrc, /extern "C" fn combat_outcome_code_shadow/);
});

test('static simulation core wasm matches combat outcome fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.combat_outcome_code_shadow, 'function');

  for (const row of rows) {
    assert.equal(
      exports.combat_outcome_code_shadow(
        toNumber(row, 'energy'),
        toNumber(row, 'partyHp'),
        toNumber(row, 'livingHeroes'),
      ),
      toNumber(row, 'expectedCode'),
      `${row.name} wasm code`,
    );
  }
});
