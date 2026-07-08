const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'enemy_skill_choice_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'enemySkillChoiceRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'enemySkillChoiceRules.mjs'),
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
    enemyName: row.enemyName,
    hp: toNumber(row, 'hp'),
    maxHP: toNumber(row, 'maxHP'),
    damagedAlliesCount: toNumber(row, 'damagedAlliesCount'),
    criticalAlliesCount: toNumber(row, 'criticalAlliesCount'),
    boardReady: toNumber(row, 'boardReady'),
    behaviorTurn: toNumber(row, 'behaviorTurn'),
    lastBehaviorSkillCode: toNumber(row, 'lastBehaviorSkillCode'),
    roll: toNumber(row, 'roll'),
    healRoll: toNumber(row, 'healRoll'),
  };
}

for (const rulesPath of rulesPaths) {
  test(`enemy skill fixtures encode current JS skill choice in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { enemySkillChoiceFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 8);
    for (const row of rows) {
      const decision = enemySkillChoiceFromJs(payloadFromRow(row));
      assert.equal(decision.selected, row.expectedSelected, `${row.name} selected`);
      assert.equal(decision.branch, row.expectedBranch, `${row.name} branch`);
    }
  });
}

test('Rust simulation core declares enemy skill choice shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn enemy_skill_choice_selected_code/);
  assert.match(rustSrc, /extern "C" fn enemy_skill_choice_selected_code_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_skill_choice_branch_code_shadow/);
});

test('static simulation core wasm matches enemy skill choice fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  const rules = await import(pathToFileURL(rulesPaths[0]));

  assert.equal(typeof exports.enemy_skill_choice_selected_code_shadow, 'function');
  assert.equal(typeof exports.enemy_skill_choice_branch_code_shadow, 'function');
  for (const row of rows) {
    const payload = payloadFromRow(row);
    const kindCode = rules.enemyKindCodeFromName(payload.enemyName);
    const selectedCode = Number(exports.enemy_skill_choice_selected_code_shadow(
      kindCode,
      payload.hp,
      payload.maxHP,
      payload.damagedAlliesCount,
      payload.criticalAlliesCount,
      payload.boardReady,
      payload.behaviorTurn,
      payload.lastBehaviorSkillCode,
      payload.roll,
      payload.healRoll,
    ));
    const branchCode = Number(exports.enemy_skill_choice_branch_code_shadow(
      kindCode,
      payload.hp,
      payload.maxHP,
      payload.damagedAlliesCount,
      payload.criticalAlliesCount,
      payload.boardReady,
      payload.behaviorTurn,
      payload.lastBehaviorSkillCode,
      payload.roll,
      payload.healRoll,
    ));

    assert.equal(rules.enemySkillIdFromCode(selectedCode), row.expectedSelected, `wasm ${row.name} selected`);
    assert.equal(rules.enemySkillBranchFromCode(branchCode), row.expectedBranch, `wasm ${row.name} branch`);
  }
});
