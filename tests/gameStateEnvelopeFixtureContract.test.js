const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixturePath = path.join(__dirname, 'fixtures', 'game_state_envelope_cases.csv');
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

test('GameState envelope fixtures encode Rust-owned shape validation', () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(rows.length >= 5);
  for (const row of rows) {
    const actorCount = Math.max(0, Math.floor(toNumber(row, 'heroCount')))
      + Math.max(0, Math.floor(toNumber(row, 'enemyCount')));
    const queueLen = toNumber(row, 'turnQueueLength');
    const currentIndex = toNumber(row, 'currentActorIndex');
    const expectedValid = toNumber(row, 'schemaVersion') === 1
      && toNumber(row, 'heroCount') >= 0
      && toNumber(row, 'enemyCount') >= 0
      && toNumber(row, 'gemCount') >= 0
      && queueLen >= 0
      && Number.isInteger(queueLen)
      && Number.isInteger(currentIndex)
      && (queueLen === 0 ? currentIndex === 0 : currentIndex >= 0 && currentIndex < queueLen)
      ? 1
      : 0;
    assert.equal(actorCount, toNumber(row, 'expectedActorCount'), `${row.name} actor count`);
    assert.equal(expectedValid, toNumber(row, 'expectedValid'), `${row.name} valid`);
  }
});

test('Rust simulation core declares GameState envelope shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  assert.match(rustSrc, /pub fn game_state_envelope_valid/);
  assert.match(rustSrc, /extern "C" fn game_state_envelope_valid_shadow/);
  assert.match(rustSrc, /extern "C" fn game_state_envelope_actor_count_shadow/);
});

test('static simulation core wasm matches GameState envelope fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  assert.equal(typeof exports.game_state_envelope_actor_count_shadow, 'function');
  assert.equal(typeof exports.game_state_envelope_valid_shadow, 'function');

  for (const row of rows) {
    assert.equal(
      exports.game_state_envelope_actor_count_shadow(
        toNumber(row, 'heroCount'),
        toNumber(row, 'enemyCount'),
      ),
      toNumber(row, 'expectedActorCount'),
      `${row.name} wasm actor count`,
    );
    assert.equal(
      exports.game_state_envelope_valid_shadow(
        toNumber(row, 'schemaVersion'),
        toNumber(row, 'heroCount'),
        toNumber(row, 'enemyCount'),
        toNumber(row, 'gemCount'),
        toNumber(row, 'turnQueueLength'),
        toNumber(row, 'currentActorIndex'),
        toNumber(row, 'energy'),
        toNumber(row, 'partyHp'),
      ),
      toNumber(row, 'expectedValid'),
      `${row.name} wasm valid`,
    );
  }
});
