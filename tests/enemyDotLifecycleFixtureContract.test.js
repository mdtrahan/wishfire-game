const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvRows } = require('./helpers/fixtureCsv');

const fixturePath = path.join(__dirname, 'fixtures', 'enemy_dot_lifecycle_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');

function toNumber(row, key) {
  return Number(row[key] || 0);
}

function jsLifecycleAction(row) {
  if (toNumber(row, 'remainingFires') <= 0) return 1;
  if (toNumber(row, 'cadenceIsTurn') !== 1) return 0;
  if (toNumber(row, 'dotTargetUID') !== toNumber(row, 'targetUID')) return 0;
  if (toNumber(row, 'hasTotalDamageRemaining') === 1 && toNumber(row, 'totalDamageRemaining') <= 0) return 1;
  if (toNumber(row, 'targetAlive') !== 1) return 1;
  if (toNumber(row, 'currentTurnSerial') < toNumber(row, 'nextFireTurnSerial')) return 0;
  if (toNumber(row, 'lastProcessedTurnSerial') >= toNumber(row, 'currentTurnSerial')) return 0;
  return 2;
}

test('enemy DoT lifecycle fixtures encode current JS keep/remove/process semantics', () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(rows.length >= 8);
  for (const row of rows) {
    assert.equal(jsLifecycleAction(row), toNumber(row, 'expectedAction'), row.name);
  }
});

test('Rust simulation core declares enemy DoT lifecycle gate shadow export', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  assert.match(rustSrc, /pub fn enemy_dot_lifecycle_action/);
  assert.match(rustSrc, /extern "C" fn enemy_dot_lifecycle_action_shadow/);
});

test('static simulation core wasm matches enemy DoT lifecycle fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  assert.equal(typeof exports.enemy_dot_lifecycle_action_shadow, 'function');

  for (const row of rows) {
    const rustAction = exports.enemy_dot_lifecycle_action_shadow(
      toNumber(row, 'cadenceIsTurn'),
      toNumber(row, 'dotTargetUID'),
      toNumber(row, 'targetUID'),
      toNumber(row, 'remainingFires'),
      toNumber(row, 'hasTotalDamageRemaining'),
      toNumber(row, 'totalDamageRemaining'),
      toNumber(row, 'targetAlive'),
      toNumber(row, 'currentTurnSerial'),
      toNumber(row, 'nextFireTurnSerial'),
      toNumber(row, 'lastProcessedTurnSerial'),
    );
    assert.equal(rustAction, toNumber(row, 'expectedAction'), row.name);
  }
});
