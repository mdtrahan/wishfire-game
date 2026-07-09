const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvRows } = require('./helpers/fixtureCsv');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'round_pointer_advance_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'roundPointerAdvanceRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'roundPointerAdvanceRules.mjs'),
];

function toNumber(row, key) {
  return Number(row[key] || 0);
}

function payloadFromRow(row) {
  return {
    roundMemberIndex: toNumber(row, 'roundMemberIndex'),
    groupMemberCount: toNumber(row, 'groupMemberCount'),
    roundGroupIndex: toNumber(row, 'roundGroupIndex'),
    groupCount: toNumber(row, 'groupCount'),
    teamPhaseType: toNumber(row, 'teamPhaseType'),
  };
}

function assertDecision(decision, row, prefix = '') {
  assert.equal(decision.code, toNumber(row, 'expectedCode'), `${prefix}${row.name} code`);
  assert.equal(decision.nextMemberIndex, toNumber(row, 'expectedNextMemberIndex'), `${prefix}${row.name} member`);
  assert.equal(decision.groupComplete, toNumber(row, 'expectedGroupComplete'), `${prefix}${row.name} group complete`);
  assert.equal(decision.nextGroupIndex, toNumber(row, 'expectedNextGroupIndex'), `${prefix}${row.name} group index`);
  assert.equal(decision.roundComplete, toNumber(row, 'expectedRoundComplete'), `${prefix}${row.name} round complete`);
  assert.equal(decision.nextTeamPhaseType, toNumber(row, 'expectedNextTeamPhaseType'), `${prefix}${row.name} phase`);
}

for (const rulesPath of rulesPaths) {
  test(`round pointer fixtures encode current JS round advance projection in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { roundPointerAdvanceFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 5);
    for (const row of rows) {
      assertDecision(roundPointerAdvanceFromJs(payloadFromRow(row)), row);
    }
  });
}

test('Rust simulation core declares round pointer advance shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn round_pointer_next_member_index/);
  assert.match(rustSrc, /extern "C" fn round_pointer_next_member_index_shadow/);
  assert.match(rustSrc, /extern "C" fn round_pointer_advance_code_shadow/);
});

test('static simulation core wasm matches round pointer fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.round_pointer_next_member_index_shadow, 'function');
  assert.equal(typeof exports.round_pointer_group_complete_shadow, 'function');
  assert.equal(typeof exports.round_pointer_next_group_index_shadow, 'function');
  assert.equal(typeof exports.round_pointer_round_complete_shadow, 'function');
  assert.equal(typeof exports.round_pointer_next_team_phase_type_shadow, 'function');
  assert.equal(typeof exports.round_pointer_advance_code_shadow, 'function');

  for (const row of rows) {
    const payload = payloadFromRow(row);
    const nextMemberIndex = Number(exports.round_pointer_next_member_index_shadow(payload.roundMemberIndex));
    const groupComplete = Number(exports.round_pointer_group_complete_shadow(nextMemberIndex, payload.groupMemberCount));
    const nextGroupIndex = Number(exports.round_pointer_next_group_index_shadow(payload.roundGroupIndex));
    const roundComplete = Number(exports.round_pointer_round_complete_shadow(nextGroupIndex, payload.groupCount, groupComplete));
    const nextTeamPhaseType = Number(exports.round_pointer_next_team_phase_type_shadow(payload.teamPhaseType));
    const code = Number(exports.round_pointer_advance_code_shadow(groupComplete, roundComplete));
    assertDecision({
      code,
      nextMemberIndex,
      groupComplete,
      nextGroupIndex,
      roundComplete,
      nextTeamPhaseType,
    }, row, 'wasm ');
  }
});
