const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvRows } = require('./helpers/fixtureCsv');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'turn_order_group_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'turnOrderGroupRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'turnOrderGroupRules.mjs'),
];

function toNumber(row, key) {
  return Number(row[key] || 0);
}

function actorFromRow(row) {
  return {
    uid: toNumber(row, 'uid'),
    type: toNumber(row, 'type'),
    spd: toNumber(row, 'spd'),
    hp: toNumber(row, 'hp'),
    isAlive: toNumber(row, 'isAlive') === 1,
    ableToAct: toNumber(row, 'ableToAct') === 1,
    disabled: toNumber(row, 'disabled') === 1,
    stunned: toNumber(row, 'stunned') === 1,
    stopped: toNumber(row, 'stopped') === 1,
    paralyzed: toNumber(row, 'paralyzed') === 1,
    statusBlocked: toNumber(row, 'statusBlocked'),
  };
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.case)) groups.set(row.case, []);
    groups.get(row.case).push(row);
  }
  return groups;
}

function expectedOrder(row) {
  return String(row.expectedOrder || '')
    .split('|')
    .map(Number)
    .filter(uid => uid > 0);
}

function projectWithWasm(exports, rows) {
  const requestedPhaseType = toNumber(rows[0], 'requestedPhaseType');
  const actors = rows.map(actorFromRow);
  const countForPhase = phaseType => actors.reduce((total, actor) => total + Number(exports.turn_order_actor_in_phase_shadow(
    actor.type,
    phaseType,
    actor.uid,
    actor.hp,
    actor.isAlive ? 1 : 0,
    actor.ableToAct ? 1 : 0,
    actor.disabled ? 1 : 0,
    actor.stunned ? 1 : 0,
    actor.stopped ? 1 : 0,
    actor.paralyzed ? 1 : 0,
    actor.statusBlocked,
  )), 0);
  const requestedCount = countForPhase(requestedPhaseType);
  const alternatePhaseType = requestedPhaseType === 1 ? 0 : 1;
  const phaseType = Number(exports.turn_order_phase_type_shadow(
    requestedPhaseType,
    requestedCount,
    countForPhase(alternatePhaseType),
  ));
  const members = actors
    .filter(actor => Number(exports.turn_order_actor_in_phase_shadow(
      actor.type,
      phaseType,
      actor.uid,
      actor.hp,
      actor.isAlive ? 1 : 0,
      actor.ableToAct ? 1 : 0,
      actor.disabled ? 1 : 0,
      actor.stunned ? 1 : 0,
      actor.stopped ? 1 : 0,
      actor.paralyzed ? 1 : 0,
      actor.statusBlocked,
    )) === 1)
    .sort((a, b) => Number(exports.turn_order_compare_slots_shadow(
      a.uid,
      a.type,
      a.spd,
      b.uid,
      b.type,
      b.spd,
    )));
  return { phaseType, members };
}

for (const rulesPath of rulesPaths) {
  test(`turn order group fixtures encode current JS team-phase projection in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const groups = groupRows(rows);
    const rules = await import(pathToFileURL(rulesPath));

    assert.ok(groups.size >= 4);
    for (const [caseName, caseRows] of groups.entries()) {
      const projection = rules.buildTurnOrderGroupFromJs(
        caseRows.map(actorFromRow),
        toNumber(caseRows[0], 'requestedPhaseType'),
      );
      assert.equal(projection.phaseType, toNumber(caseRows[0], 'expectedPhaseType'), `${caseName} phase`);
      assert.deepEqual(projection.members.map(member => member.uid), expectedOrder(caseRows[0]), `${caseName} order`);
    }
  });
}

test('Rust simulation core declares turn order group shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn turn_order_actor_in_phase/);
  assert.match(rustSrc, /extern "C" fn turn_order_actor_in_phase_shadow/);
  assert.match(rustSrc, /extern "C" fn turn_order_phase_type_shadow/);
  assert.match(rustSrc, /extern "C" fn turn_order_compare_slots_shadow/);
});

test('static simulation core wasm matches turn order group fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const groups = groupRows(rows);
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.turn_order_actor_in_phase_shadow, 'function');
  assert.equal(typeof exports.turn_order_phase_type_shadow, 'function');
  assert.equal(typeof exports.turn_order_compare_slots_shadow, 'function');

  for (const [caseName, caseRows] of groups.entries()) {
    const projection = projectWithWasm(exports, caseRows);
    assert.equal(projection.phaseType, toNumber(caseRows[0], 'expectedPhaseType'), `${caseName} wasm phase`);
    assert.deepEqual(projection.members.map(member => member.uid), expectedOrder(caseRows[0]), `${caseName} wasm order`);
  }
});
