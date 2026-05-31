const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'turn_actor_eligibility_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'turnActorEligibilityRules.mjs');

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

function payloadFromRow(row) {
  return {
    turnType: toNumber(row, 'turnType'),
    actorExists: toNumber(row, 'actorExists'),
    actorHp: toNumber(row, 'actorHp'),
    partyHp: toNumber(row, 'partyHp'),
    roundActive: toNumber(row, 'roundActive'),
    pendingGroupMatches: toNumber(row, 'pendingGroupMatches'),
    blueBuffSequenceActive: toNumber(row, 'blueBuffSequenceActive'),
  };
}

test('turn actor eligibility fixtures encode current JS ProcessTurn gate order', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const { turnActorEligibilityCodeFromJs } = await import(pathToFileURL(rulesPath));

  assert.ok(rows.length >= 10);
  for (const row of rows) {
    assert.equal(turnActorEligibilityCodeFromJs(payloadFromRow(row)), toNumber(row, 'expectedCode'), row.name);
  }
});

test('Rust simulation core declares turn actor eligibility shadow export', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn turn_actor_eligibility_code/);
  assert.match(rustSrc, /extern "C" fn turn_actor_eligibility_code_shadow/);
});

test('static simulation core wasm matches turn actor eligibility fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.turn_actor_eligibility_code_shadow, 'function');

  for (const row of rows) {
    const payload = payloadFromRow(row);
    assert.equal(
      exports.turn_actor_eligibility_code_shadow(
        payload.turnType,
        payload.actorExists,
        payload.actorHp,
        payload.partyHp,
        payload.roundActive,
        payload.pendingGroupMatches,
        payload.blueBuffSequenceActive,
      ),
      toNumber(row, 'expectedCode'),
      `${row.name} wasm code`,
    );
  }
});
