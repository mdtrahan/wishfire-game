const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'turn_phase_assignment_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'turnPhaseAssignmentRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'turnPhaseAssignmentRules.mjs'),
];

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

for (const rulesPath of rulesPaths) {
  test(`turn phase fixtures encode current JS phase assignment in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { turnPhaseFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 5);
    for (const row of rows) {
      const decision = turnPhaseFromJs({ turnTypeCode: toNumber(row, 'turnTypeCode') });
      assert.equal(decision.turnPhase, toNumber(row, 'expectedTurnPhase'), row.name);
    }
  });
}

test('turn phase JS projection preserves current strict type shape', async () => {
  const { turnPhaseFromJs } = await import(pathToFileURL(rulesPaths[0]));

  assert.equal(turnPhaseFromJs({ turnType: 0 }).turnPhase, 0);
  assert.equal(turnPhaseFromJs({ turnType: 1 }).turnPhase, 2);
  assert.equal(turnPhaseFromJs({ turnType: '0' }).turnPhase, 2);
  assert.equal(turnPhaseFromJs({ turnType: undefined }).turnPhase, 2);
  assert.equal(turnPhaseFromJs({}).turnPhase, 0);
});

test('Rust simulation core declares turn phase assignment shadow export', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn turn_phase_from_type/);
  assert.match(rustSrc, /extern "C" fn turn_phase_from_type_shadow/);
});

test('static simulation core wasm matches turn phase fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.turn_phase_from_type_shadow, 'function');
  for (const row of rows) {
    const turnPhase = Number(exports.turn_phase_from_type_shadow(toNumber(row, 'turnTypeCode')));
    assert.equal(turnPhase, toNumber(row, 'expectedTurnPhase'), `wasm ${row.name}`);
  }
});
