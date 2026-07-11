const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvRows } = require('./helpers/fixtureCsv');

const tickFixturePath = path.join(__dirname, 'fixtures', 'party_regen_tick_cases.csv');
const lifecycleFixturePath = path.join(__dirname, 'fixtures', 'party_regen_lifecycle_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');

function toNumber(row, key) {
  return Number(row[key] || 0);
}

function jsPartyRegenTick(row) {
  const hasTotal = toNumber(row, 'hasTotalHealRemaining') === 1;
  const remainingFires = Math.max(1, Math.floor(toNumber(row, 'remainingFires')));
  let heal = 1;
  let nextTotalHealRemaining = hasTotal ? Math.max(0, Math.floor(toNumber(row, 'totalHealRemaining'))) : 0;
  if (hasTotal) {
    const base = Math.floor(nextTotalHealRemaining / remainingFires);
    const remainder = nextTotalHealRemaining % remainingFires;
    const distributionMode = toNumber(row, 'distributionMode');
    const extra = distributionMode === 1
      ? (remainingFires === 1 ? remainder : 0)
      : (remainder > 0 ? 1 : 0);
    heal = Math.max(1, base + extra);
    nextTotalHealRemaining = Math.max(0, nextTotalHealRemaining - heal);
  } else {
    heal = Math.max(1, Math.round(toNumber(row, 'healPerFire') || 1));
  }
  return {
    heal,
    totalHealRemaining: nextTotalHealRemaining,
    remainingFires: Math.max(0, Math.floor(toNumber(row, 'remainingFires')) - 1),
    nextFireSerial: toNumber(row, 'nextFireSerial')
      + Math.max(1, Math.floor(toNumber(row, 'firesEvery') || 1)),
  };
}

function jsPartyRegenLifecycle(row) {
  if (toNumber(row, 'remainingFires') <= 0) return 1;
  if (
    toNumber(row, 'hasTotalHealRemaining') === 1
    && toNumber(row, 'totalHealRemaining') <= 0
  ) {
    return 1;
  }
  if (toNumber(row, 'currentSerial') < toNumber(row, 'nextFireSerial')) return 0;
  if (toNumber(row, 'currentSerial') <= toNumber(row, 'appliedOnSerial')) return 0;
  if (toNumber(row, 'lastProcessedSerial') >= toNumber(row, 'currentSerial')) return 0;
  return 2;
}

test('party regen tick fixtures encode current JS heal distribution semantics', () => {
  const rows = parseCsvRows(fs.readFileSync(tickFixturePath, 'utf8'));
  assert.ok(rows.length >= 5);
  for (const row of rows) {
    const actual = jsPartyRegenTick(row);
    assert.equal(actual.heal, toNumber(row, 'expectedHeal'), `${row.name} heal`);
    assert.equal(
      actual.totalHealRemaining,
      toNumber(row, 'expectedTotalHealRemaining'),
      `${row.name} totalHealRemaining`,
    );
    assert.equal(actual.remainingFires, toNumber(row, 'expectedRemainingFires'), `${row.name} remainingFires`);
    assert.equal(actual.nextFireSerial, toNumber(row, 'expectedNextFireSerial'), `${row.name} nextFireSerial`);
  }
});

test('party regen lifecycle fixtures encode current JS remove/wait/tick semantics', () => {
  const rows = parseCsvRows(fs.readFileSync(lifecycleFixturePath, 'utf8'));
  assert.ok(rows.length >= 6);
  for (const row of rows) {
    assert.equal(jsPartyRegenLifecycle(row), toNumber(row, 'expectedAction'), `${row.name} lifecycle action`);
  }
});

test('Rust simulation core declares party regen tick shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  assert.match(rustSrc, /pub fn party_regen_tick_heal/);
  assert.match(rustSrc, /extern "C" fn party_regen_tick_heal_shadow/);
  assert.match(rustSrc, /extern "C" fn party_regen_tick_total_remaining_shadow/);
  assert.match(rustSrc, /extern "C" fn party_regen_tick_remaining_fires_shadow/);
  assert.match(rustSrc, /extern "C" fn party_regen_tick_next_serial_shadow/);
  assert.match(rustSrc, /extern "C" fn party_regen_lifecycle_action_shadow/);
});

test('static simulation core wasm matches party regen tick fixtures', async () => {
  const tickRows = parseCsvRows(fs.readFileSync(tickFixturePath, 'utf8'));
  const lifecycleRows = parseCsvRows(fs.readFileSync(lifecycleFixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  assert.equal(typeof exports.party_regen_tick_heal_shadow, 'function');
  assert.equal(typeof exports.party_regen_tick_total_remaining_shadow, 'function');
  assert.equal(typeof exports.party_regen_tick_remaining_fires_shadow, 'function');
  assert.equal(typeof exports.party_regen_tick_next_serial_shadow, 'function');
  assert.equal(typeof exports.party_regen_lifecycle_action_shadow, 'function');

  for (const row of tickRows) {
    const args = [
      toNumber(row, 'totalHealRemaining'),
      toNumber(row, 'remainingFires'),
      toNumber(row, 'healPerFire'),
      toNumber(row, 'hasTotalHealRemaining'),
      toNumber(row, 'distributionMode'),
    ];
    assert.equal(exports.party_regen_tick_heal_shadow(...args), toNumber(row, 'expectedHeal'), `${row.name} wasm heal`);
    assert.equal(
      exports.party_regen_tick_total_remaining_shadow(...args),
      toNumber(row, 'expectedTotalHealRemaining'),
      `${row.name} wasm totalHealRemaining`,
    );
    assert.equal(
      exports.party_regen_tick_remaining_fires_shadow(toNumber(row, 'remainingFires')),
      toNumber(row, 'expectedRemainingFires'),
      `${row.name} wasm remainingFires`,
    );
    assert.equal(
      exports.party_regen_tick_next_serial_shadow(toNumber(row, 'nextFireSerial'), toNumber(row, 'firesEvery')),
      toNumber(row, 'expectedNextFireSerial'),
      `${row.name} wasm nextFireSerial`,
    );
  }

  for (const row of lifecycleRows) {
    assert.equal(
      exports.party_regen_lifecycle_action_shadow(
        toNumber(row, 'remainingFires'),
        toNumber(row, 'hasTotalHealRemaining'),
        toNumber(row, 'totalHealRemaining'),
        toNumber(row, 'currentSerial'),
        toNumber(row, 'nextFireSerial'),
        toNumber(row, 'appliedOnSerial'),
        toNumber(row, 'lastProcessedSerial'),
      ),
      toNumber(row, 'expectedAction'),
      `${row.name} wasm lifecycle action`,
    );
  }
});
