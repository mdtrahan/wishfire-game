const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'enemy_job_skill_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'enemyJobSkillRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'enemyJobSkillRules.mjs'),
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
    skillId: row.skillId,
    enemyName: row.enemyName,
    boardReady: toNumber(row, 'boardReady'),
    targetUID: toNumber(row, 'targetUID'),
    fallbackTargetUID: toNumber(row, 'fallbackTargetUID'),
  };
}

function assertDecision(decision, row, prefix = '') {
  assert.equal(decision.skillCode, toNumber(row, 'expectedSkillCode'), `${prefix}${row.name} skill`);
  assert.equal(decision.enemyKindCode, toNumber(row, 'expectedKindCode'), `${prefix}${row.name} kind`);
  assert.equal(decision.normalizedSkillCode, toNumber(row, 'expectedNormalizedSkillCode'), `${prefix}${row.name} normalized`);
  assert.equal(decision.actionCode, toNumber(row, 'expectedActionCode'), `${prefix}${row.name} action`);
  assert.equal(decision.resolvedTargetUID, toNumber(row, 'expectedResolvedTargetUID'), `${prefix}${row.name} target`);
  assert.equal(decision.allyTargetUID, toNumber(row, 'expectedAllyTargetUID'), `${prefix}${row.name} ally target`);
  assert.equal(decision.returnValue, toNumber(row, 'expectedReturnValue'), `${prefix}${row.name} return`);
}

for (const rulesPath of rulesPaths) {
  test(`enemy job skill fixtures encode current JS ExecuteEnemyJobSkill packet in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { enemyJobSkillFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 10);
    for (const row of rows) {
      assertDecision(enemyJobSkillFromJs(payloadFromRow(row)), row);
    }
  });
}

test('Rust simulation core declares enemy job skill shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn enemy_job_skill_normalized_code/);
  assert.match(rustSrc, /extern "C" fn enemy_job_skill_normalized_code_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_job_skill_action_code_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_job_skill_return_value_shadow/);
});

test('static simulation core wasm matches enemy job skill fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.enemy_job_skill_normalized_code_shadow, 'function');
  assert.equal(typeof exports.enemy_job_skill_resolved_target_uid_shadow, 'function');
  assert.equal(typeof exports.enemy_job_skill_ally_target_uid_shadow, 'function');
  assert.equal(typeof exports.enemy_job_skill_action_code_shadow, 'function');
  assert.equal(typeof exports.enemy_job_skill_return_value_shadow, 'function');

  for (const row of rows) {
    const skillCode = toNumber(row, 'expectedSkillCode');
    const normalizedSkillCode = Number(exports.enemy_job_skill_normalized_code_shadow(
      skillCode,
      toNumber(row, 'expectedKindCode'),
      toNumber(row, 'boardReady'),
    ));
    const resolvedTargetUID = Number(exports.enemy_job_skill_resolved_target_uid_shadow(
      toNumber(row, 'targetUID'),
      toNumber(row, 'fallbackTargetUID'),
    ));
    const actionCode = Number(exports.enemy_job_skill_action_code_shadow(
      normalizedSkillCode,
      resolvedTargetUID,
    ));
    assertDecision({
      skillCode,
      enemyKindCode: toNumber(row, 'expectedKindCode'),
      normalizedSkillCode,
      actionCode,
      resolvedTargetUID,
      allyTargetUID: Number(exports.enemy_job_skill_ally_target_uid_shadow(toNumber(row, 'targetUID'))),
      returnValue: Number(exports.enemy_job_skill_return_value_shadow(actionCode)),
    }, row, 'wasm ');
  }
});
