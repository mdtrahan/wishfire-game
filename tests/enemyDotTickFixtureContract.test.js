const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixturePath = path.join(__dirname, 'fixtures', 'enemy_dot_tick_cases.csv');
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

function jsDotTick(row) {
  const hasTotal = toNumber(row, 'hasTotalDamageRemaining') === 1;
  const remainingFires = Math.max(1, Math.floor(toNumber(row, 'remainingFires')));
  let damage = 1;
  let nextTotalDamageRemaining = hasTotal ? Math.max(0, Math.floor(toNumber(row, 'totalDamageRemaining'))) : 0;
  if (hasTotal) {
    const base = Math.floor(nextTotalDamageRemaining / remainingFires);
    const extra = (nextTotalDamageRemaining % remainingFires) > 0 ? 1 : 0;
    damage = Math.max(1, base + extra);
    nextTotalDamageRemaining = Math.max(0, nextTotalDamageRemaining - damage);
  } else {
    damage = Math.max(1, Math.round(toNumber(row, 'damagePerFire') || 1));
  }
  return {
    damage,
    totalDamageRemaining: nextTotalDamageRemaining,
    remainingFires: Math.max(0, Math.floor(toNumber(row, 'remainingFires')) - 1),
    nextFireTurnSerial: toNumber(row, 'nextFireTurnSerial')
      + Math.max(1, Math.floor(toNumber(row, 'firesEveryTurns') || 1)),
  };
}

test('enemy DoT tick fixtures encode current JS turn-cadence damage semantics', () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(rows.length >= 5);
  for (const row of rows) {
    const actual = jsDotTick(row);
    assert.equal(actual.damage, toNumber(row, 'expectedDamage'), `${row.name} damage`);
    assert.equal(
      actual.totalDamageRemaining,
      toNumber(row, 'expectedTotalDamageRemaining'),
      `${row.name} totalDamageRemaining`,
    );
    assert.equal(actual.remainingFires, toNumber(row, 'expectedRemainingFires'), `${row.name} remainingFires`);
    assert.equal(
      actual.nextFireTurnSerial,
      toNumber(row, 'expectedNextFireTurnSerial'),
      `${row.name} nextFireTurnSerial`,
    );
  }
});

test('Rust simulation core declares enemy DoT tick shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  assert.match(rustSrc, /pub fn enemy_dot_tick_damage/);
  assert.match(rustSrc, /extern "C" fn enemy_dot_tick_damage_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_dot_tick_total_remaining_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_dot_tick_remaining_fires_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_dot_tick_next_turn_shadow/);
});

test('static simulation core wasm matches enemy DoT tick fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  assert.equal(typeof exports.enemy_dot_tick_damage_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_tick_total_remaining_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_tick_remaining_fires_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_tick_next_turn_shadow, 'function');

  for (const row of rows) {
    const rustDamage = exports.enemy_dot_tick_damage_shadow(
      toNumber(row, 'totalDamageRemaining'),
      toNumber(row, 'remainingFires'),
      toNumber(row, 'damagePerFire'),
      toNumber(row, 'hasTotalDamageRemaining'),
    );
    const rustTotalRemaining = exports.enemy_dot_tick_total_remaining_shadow(
      toNumber(row, 'totalDamageRemaining'),
      toNumber(row, 'remainingFires'),
      toNumber(row, 'damagePerFire'),
      toNumber(row, 'hasTotalDamageRemaining'),
    );
    const rustRemainingFires = exports.enemy_dot_tick_remaining_fires_shadow(
      toNumber(row, 'remainingFires'),
    );
    const rustNextTurn = exports.enemy_dot_tick_next_turn_shadow(
      toNumber(row, 'nextFireTurnSerial'),
      toNumber(row, 'firesEveryTurns'),
    );

    assert.equal(rustDamage, toNumber(row, 'expectedDamage'), `${row.name} wasm damage`);
    assert.equal(
      rustTotalRemaining,
      toNumber(row, 'expectedTotalDamageRemaining'),
      `${row.name} wasm totalDamageRemaining`,
    );
    assert.equal(rustRemainingFires, toNumber(row, 'expectedRemainingFires'), `${row.name} wasm remainingFires`);
    assert.equal(rustNextTurn, toNumber(row, 'expectedNextFireTurnSerial'), `${row.name} wasm nextFireTurnSerial`);
  }
});
