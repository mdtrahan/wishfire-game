const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'enemy_turn_flow_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'enemyTurnFlowRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'enemyTurnFlowRules.mjs'),
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

function payloadFromRow(row) {
  return {
    activeEnemyUID: toNumber(row, 'activeEnemyUID'),
    enemyExists: toNumber(row, 'enemyExists'),
    enemyHp: toNumber(row, 'enemyHp'),
  };
}

function assertDecision(decision, row, prefix = '') {
  assert.equal(decision.activeEnemyUID, toNumber(row, 'expectedActiveEnemyUID'), `${prefix}${row.name} uid`);
  assert.equal(decision.turnPhase, toNumber(row, 'expectedTurnPhase'), `${prefix}${row.name} phase`);
  assert.equal(decision.actionCode, toNumber(row, 'expectedActionCode'), `${prefix}${row.name} action`);
  assert.equal(decision.shouldAdvance, toNumber(row, 'expectedShouldAdvance'), `${prefix}${row.name} advance`);
  assert.equal(decision.shouldStartAction, toNumber(row, 'expectedShouldStartAction'), `${prefix}${row.name} start`);
}

for (const rulesPath of rulesPaths) {
  test(`enemy turn flow fixtures encode current JS EnemyTurn packet in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { enemyTurnFlowFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 5);
    for (const row of rows) {
      assertDecision(enemyTurnFlowFromJs(payloadFromRow(row)), row);
    }
  });
}

test('Rust simulation core declares EnemyTurn flow shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn enemy_turn_flow_action_code/);
  assert.match(rustSrc, /extern "C" fn enemy_turn_flow_action_code_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_turn_flow_should_start_action_shadow/);
});

test('static simulation core wasm matches enemy turn flow fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.enemy_turn_flow_active_uid_shadow, 'function');
  assert.equal(typeof exports.enemy_turn_flow_turn_phase_shadow, 'function');
  assert.equal(typeof exports.enemy_turn_flow_action_code_shadow, 'function');
  assert.equal(typeof exports.enemy_turn_flow_should_advance_shadow, 'function');
  assert.equal(typeof exports.enemy_turn_flow_should_start_action_shadow, 'function');

  for (const row of rows) {
    const actionCode = Number(exports.enemy_turn_flow_action_code_shadow(
      toNumber(row, 'activeEnemyUID'),
      toNumber(row, 'enemyExists'),
      toNumber(row, 'enemyHp'),
    ));
    assertDecision({
      activeEnemyUID: Number(exports.enemy_turn_flow_active_uid_shadow(toNumber(row, 'activeEnemyUID'))),
      turnPhase: Number(exports.enemy_turn_flow_turn_phase_shadow()),
      actionCode,
      shouldAdvance: Number(exports.enemy_turn_flow_should_advance_shadow(actionCode)),
      shouldStartAction: Number(exports.enemy_turn_flow_should_start_action_shadow(actionCode)),
    }, row, 'wasm ');
  }
});
