const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvRows } = require('./helpers/fixtureCsv');

const fixturePath = path.join(__dirname, 'fixtures', 'enemy_debuff_slot_transition_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');

function toNumber(row, key) {
  return Number(row[key] || 0);
}

function normalizeStatIndex(value) {
  const index = Math.floor(Number(value));
  return Number.isFinite(index) && index >= 0 && index <= 4 ? index : -1;
}

function normalizeSlotCount(value) {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(3, count));
}

function slotIndices(row) {
  const raw = [
    normalizeStatIndex(toNumber(row, 'slot0Index')),
    normalizeStatIndex(toNumber(row, 'slot1Index')),
    normalizeStatIndex(toNumber(row, 'slot2Index')),
  ];
  return raw.slice(0, normalizeSlotCount(toNumber(row, 'slotCount'))).filter((index) => index !== -1);
}

function jsSlotTransition(row) {
  const slots = slotIndices(row);
  const appliedStatIndex = normalizeStatIndex(toNumber(row, 'appliedStatIndex'));
  const active = toNumber(row, 'active') > 0;
  if (appliedStatIndex === -1) {
    return { action: 0, dropSlotIndex: -1, appendSlotIndex: -1 };
  }
  if (!active) {
    return slots.includes(appliedStatIndex)
      ? { action: 3, dropSlotIndex: appliedStatIndex, appendSlotIndex: -1 }
      : { action: 0, dropSlotIndex: -1, appendSlotIndex: -1 };
  }
  if (slots.includes(appliedStatIndex)) {
    return { action: 0, dropSlotIndex: -1, appendSlotIndex: -1 };
  }
  if (slots.length >= 3) {
    return { action: 2, dropSlotIndex: slots[0], appendSlotIndex: appliedStatIndex };
  }
  return { action: 1, dropSlotIndex: -1, appendSlotIndex: appliedStatIndex };
}

test('enemy debuff slot transition fixtures encode current JS slot semantics', () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(rows.length >= 6);
  for (const row of rows) {
    const actual = jsSlotTransition(row);
    assert.equal(actual.action, toNumber(row, 'expectedAction'), `${row.name} action`);
    assert.equal(actual.dropSlotIndex, toNumber(row, 'expectedDropSlotIndex'), `${row.name} drop`);
    assert.equal(actual.appendSlotIndex, toNumber(row, 'expectedAppendSlotIndex'), `${row.name} append`);
  }
});

test('Rust simulation core declares enemy debuff slot transition shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn enemy_debuff_slot_transition_action/);
  assert.match(rustSrc, /pub fn enemy_debuff_slot_transition_drop_slot_index/);
  assert.match(rustSrc, /pub fn enemy_debuff_slot_transition_append_slot_index/);
  assert.match(rustSrc, /extern "C" fn enemy_debuff_slot_transition_action_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_debuff_slot_transition_drop_slot_index_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_debuff_slot_transition_append_slot_index_shadow/);
});

test('static simulation core wasm matches enemy debuff slot transition fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.enemy_debuff_slot_transition_action_shadow, 'function');
  assert.equal(typeof exports.enemy_debuff_slot_transition_drop_slot_index_shadow, 'function');
  assert.equal(typeof exports.enemy_debuff_slot_transition_append_slot_index_shadow, 'function');

  for (const row of rows) {
    const args = [
      toNumber(row, 'slotCount'),
      toNumber(row, 'slot0Index'),
      toNumber(row, 'slot1Index'),
      toNumber(row, 'slot2Index'),
      toNumber(row, 'appliedStatIndex'),
      toNumber(row, 'active'),
    ];
    assert.equal(
      exports.enemy_debuff_slot_transition_action_shadow(...args),
      toNumber(row, 'expectedAction'),
      `${row.name} wasm action`,
    );
    assert.equal(
      exports.enemy_debuff_slot_transition_drop_slot_index_shadow(...args),
      toNumber(row, 'expectedDropSlotIndex'),
      `${row.name} wasm drop`,
    );
    assert.equal(
      exports.enemy_debuff_slot_transition_append_slot_index_shadow(...args),
      toNumber(row, 'expectedAppendSlotIndex'),
      `${row.name} wasm append`,
    );
  }
});
