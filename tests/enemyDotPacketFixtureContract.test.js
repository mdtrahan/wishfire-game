const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixturePath = path.join(__dirname, 'fixtures', 'enemy_dot_packet_cases.csv');
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

function positiveFloorOrOne(value) {
  return Math.max(1, Math.floor(Number(value || 1) || 1));
}

function jsDotPacket(row) {
  return {
    targetUID: toNumber(row, 'enemyUID'),
    sourceUID: toNumber(row, 'actorUID'),
    remainingFires: positiveFloorOrOne(toNumber(row, 'totalTicks')),
    totalDamageRemaining: positiveFloorOrOne(toNumber(row, 'totalDamage')),
    firesEveryTicks: positiveFloorOrOne(toNumber(row, 'firesEveryTicks')),
    nextFireTick: toNumber(row, 'nowTick') + positiveFloorOrOne(toNumber(row, 'startAfterTicks')),
    firesEveryTurns: positiveFloorOrOne(toNumber(row, 'firesEveryTurns')),
    nextFireTurnSerial: toNumber(row, 'nowTurnSerial') + positiveFloorOrOne(toNumber(row, 'startAfterTurns')),
    lastProcessedTurnSerial: toNumber(row, 'nowTurnSerial'),
  };
}

test('enemy DoT packet fixtures encode current JS queue packet semantics', () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(rows.length >= 5);
  for (const row of rows) {
    const actual = jsDotPacket(row);
    assert.equal(actual.targetUID, toNumber(row, 'expectedTargetUID'), `${row.name} targetUID`);
    assert.equal(actual.sourceUID, toNumber(row, 'expectedSourceUID'), `${row.name} sourceUID`);
    assert.equal(actual.remainingFires, toNumber(row, 'expectedRemainingFires'), `${row.name} remainingFires`);
    assert.equal(
      actual.totalDamageRemaining,
      toNumber(row, 'expectedTotalDamageRemaining'),
      `${row.name} totalDamageRemaining`,
    );
    assert.equal(actual.firesEveryTicks, toNumber(row, 'expectedFiresEveryTicks'), `${row.name} firesEveryTicks`);
    assert.equal(actual.nextFireTick, toNumber(row, 'expectedNextFireTick'), `${row.name} nextFireTick`);
    assert.equal(actual.firesEveryTurns, toNumber(row, 'expectedFiresEveryTurns'), `${row.name} firesEveryTurns`);
    assert.equal(
      actual.nextFireTurnSerial,
      toNumber(row, 'expectedNextFireTurnSerial'),
      `${row.name} nextFireTurnSerial`,
    );
    assert.equal(
      actual.lastProcessedTurnSerial,
      toNumber(row, 'expectedLastProcessedTurnSerial'),
      `${row.name} lastProcessedTurnSerial`,
    );
  }
});

test('Rust simulation core declares enemy DoT packet shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  assert.match(rustSrc, /extern "C" fn enemy_dot_packet_target_uid_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_dot_packet_source_uid_shadow/);
  assert.match(rustSrc, /pub fn enemy_dot_packet_remaining_fires/);
  assert.match(rustSrc, /extern "C" fn enemy_dot_packet_remaining_fires_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_dot_packet_total_damage_remaining_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_dot_packet_next_fire_tick_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_dot_packet_next_fire_turn_serial_shadow/);
});

test('static simulation core wasm matches enemy DoT packet fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  assert.equal(typeof exports.enemy_dot_packet_target_uid_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_packet_source_uid_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_packet_remaining_fires_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_packet_total_damage_remaining_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_packet_fires_every_ticks_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_packet_next_fire_tick_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_packet_fires_every_turns_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_packet_next_fire_turn_serial_shadow, 'function');
  assert.equal(typeof exports.enemy_dot_packet_last_processed_turn_serial_shadow, 'function');

  for (const row of rows) {
    assert.equal(
      exports.enemy_dot_packet_target_uid_shadow(toNumber(row, 'enemyUID')),
      toNumber(row, 'expectedTargetUID'),
      `${row.name} wasm targetUID`,
    );
    assert.equal(
      exports.enemy_dot_packet_source_uid_shadow(toNumber(row, 'actorUID')),
      toNumber(row, 'expectedSourceUID'),
      `${row.name} wasm sourceUID`,
    );
    assert.equal(
      exports.enemy_dot_packet_remaining_fires_shadow(toNumber(row, 'totalTicks')),
      toNumber(row, 'expectedRemainingFires'),
      `${row.name} wasm remainingFires`,
    );
    assert.equal(
      exports.enemy_dot_packet_total_damage_remaining_shadow(toNumber(row, 'totalDamage')),
      toNumber(row, 'expectedTotalDamageRemaining'),
      `${row.name} wasm totalDamageRemaining`,
    );
    assert.equal(
      exports.enemy_dot_packet_fires_every_ticks_shadow(toNumber(row, 'firesEveryTicks')),
      toNumber(row, 'expectedFiresEveryTicks'),
      `${row.name} wasm firesEveryTicks`,
    );
    assert.equal(
      exports.enemy_dot_packet_next_fire_tick_shadow(
        toNumber(row, 'nowTick'),
        toNumber(row, 'startAfterTicks'),
      ),
      toNumber(row, 'expectedNextFireTick'),
      `${row.name} wasm nextFireTick`,
    );
    assert.equal(
      exports.enemy_dot_packet_fires_every_turns_shadow(toNumber(row, 'firesEveryTurns')),
      toNumber(row, 'expectedFiresEveryTurns'),
      `${row.name} wasm firesEveryTurns`,
    );
    assert.equal(
      exports.enemy_dot_packet_next_fire_turn_serial_shadow(
        toNumber(row, 'nowTurnSerial'),
        toNumber(row, 'startAfterTurns'),
      ),
      toNumber(row, 'expectedNextFireTurnSerial'),
      `${row.name} wasm nextFireTurnSerial`,
    );
    assert.equal(
      exports.enemy_dot_packet_last_processed_turn_serial_shadow(toNumber(row, 'nowTurnSerial')),
      toNumber(row, 'expectedLastProcessedTurnSerial'),
      `${row.name} wasm lastProcessedTurnSerial`,
    );
  }
});
