const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'start_enemy_action_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'startEnemyActionRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'startEnemyActionRules.mjs'),
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
    enemyExists: toNumber(row, 'enemyExists'),
    enemyUID: toNumber(row, 'enemyUID'),
    targetUID: toNumber(row, 'targetUID'),
    skillId: row.skillId,
    originX: toNumber(row, 'originX'),
  };
}

function assertDecision(decision, row, prefix = '') {
  assert.equal(decision.active, toNumber(row, 'expectedActive'), `${prefix}${row.name} active`);
  assert.equal(decision.stateCode, toNumber(row, 'expectedStateCode'), `${prefix}${row.name} state`);
  assert.equal(decision.uid, toNumber(row, 'expectedUid'), `${prefix}${row.name} uid`);
  assert.equal(decision.targetUID, toNumber(row, 'expectedTargetUID'), `${prefix}${row.name} target`);
  assert.equal(decision.skillCode, toNumber(row, 'expectedSkillCode'), `${prefix}${row.name} skill`);
  assert.equal(decision.forwardX, toNumber(row, 'expectedForwardX'), `${prefix}${row.name} forward`);
}

for (const rulesPath of rulesPaths) {
  test(`start enemy action fixtures encode current JS StartEnemyAction packet in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { startEnemyActionFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 5);
    for (const row of rows) {
      assertDecision(startEnemyActionFromJs(payloadFromRow(row)), row);
    }
  });
}

test('Rust simulation core declares StartEnemyAction shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn start_enemy_action_active/);
  assert.match(rustSrc, /extern "C" fn start_enemy_action_active_shadow/);
  assert.match(rustSrc, /extern "C" fn start_enemy_action_skill_code_shadow/);
  assert.match(rustSrc, /extern "C" fn start_enemy_action_forward_x_shadow/);
});

test('static simulation core wasm matches start enemy action fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  const rules = await import(pathToFileURL(rulesPaths[0]));

  assert.equal(typeof exports.start_enemy_action_active_shadow, 'function');
  assert.equal(typeof exports.start_enemy_action_state_code_shadow, 'function');
  assert.equal(typeof exports.start_enemy_action_uid_shadow, 'function');
  assert.equal(typeof exports.start_enemy_action_target_uid_shadow, 'function');
  assert.equal(typeof exports.start_enemy_action_skill_code_shadow, 'function');
  assert.equal(typeof exports.start_enemy_action_forward_x_shadow, 'function');

  for (const row of rows) {
    const enemyExists = toNumber(row, 'enemyExists');
    const skillCode = rules.startEnemyActionFromJs(payloadFromRow(row)).skillCode;
    assertDecision({
      active: Number(exports.start_enemy_action_active_shadow(enemyExists)),
      stateCode: Number(exports.start_enemy_action_state_code_shadow(enemyExists)),
      uid: Number(exports.start_enemy_action_uid_shadow(enemyExists, toNumber(row, 'enemyUID'))),
      targetUID: Number(exports.start_enemy_action_target_uid_shadow(enemyExists, toNumber(row, 'targetUID'))),
      skillCode: Number(exports.start_enemy_action_skill_code_shadow(enemyExists, skillCode)),
      forwardX: Number(exports.start_enemy_action_forward_x_shadow(enemyExists, toNumber(row, 'originX'))),
    }, row, 'wasm ');
  }
});
