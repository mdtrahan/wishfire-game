const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixturePath = path.join(__dirname, 'fixtures', 'enemy_debuff_apply_cases.csv');
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

function sanitizeDebuffValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function jsDebuffApply(row) {
  const amountAfter = sanitizeDebuffValue(toNumber(row, 'amountBefore'))
    + sanitizeDebuffValue(toNumber(row, 'addAmount'));
  const turnsAfter = sanitizeDebuffValue(toNumber(row, 'durationTurns'));
  return {
    amountAfter,
    turnsAfter,
    active: amountAfter > 0 && turnsAfter > 0 ? 1 : 0,
  };
}

test('enemy debuff apply fixtures encode current JS application packet semantics', () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(rows.length >= 5);
  for (const row of rows) {
    const actual = jsDebuffApply(row);
    assert.equal(actual.amountAfter, toNumber(row, 'expectedAmountAfter'), `${row.name} amountAfter`);
    assert.equal(actual.turnsAfter, toNumber(row, 'expectedTurnsAfter'), `${row.name} turnsAfter`);
    assert.equal(actual.active, toNumber(row, 'expectedActive'), `${row.name} active`);
  }
});

test('Rust simulation core declares enemy debuff apply shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn enemy_debuff_apply_amount_after/);
  assert.match(rustSrc, /pub fn enemy_debuff_apply_turns_after/);
  assert.match(rustSrc, /pub fn enemy_debuff_apply_active/);
  assert.match(rustSrc, /extern "C" fn enemy_debuff_apply_amount_after_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_debuff_apply_turns_after_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_debuff_apply_active_shadow/);
});

test('static simulation core wasm matches enemy debuff apply fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.enemy_debuff_apply_amount_after_shadow, 'function');
  assert.equal(typeof exports.enemy_debuff_apply_turns_after_shadow, 'function');
  assert.equal(typeof exports.enemy_debuff_apply_active_shadow, 'function');

  for (const row of rows) {
    const rustAmountAfter = exports.enemy_debuff_apply_amount_after_shadow(
      toNumber(row, 'amountBefore'),
      toNumber(row, 'addAmount'),
    );
    const rustTurnsAfter = exports.enemy_debuff_apply_turns_after_shadow(
      toNumber(row, 'durationTurns'),
    );
    const rustActive = exports.enemy_debuff_apply_active_shadow(rustAmountAfter, rustTurnsAfter);

    assert.equal(rustAmountAfter, toNumber(row, 'expectedAmountAfter'), `${row.name} wasm amountAfter`);
    assert.equal(rustTurnsAfter, toNumber(row, 'expectedTurnsAfter'), `${row.name} wasm turnsAfter`);
    assert.equal(rustActive, toNumber(row, 'expectedActive'), `${row.name} wasm active`);
  }
});
