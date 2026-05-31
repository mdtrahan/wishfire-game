const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'enemy_target_selection_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'enemyTargetingRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'enemyTargetingRules.mjs'),
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

function heroFromRow(row, index) {
  const roleCode = toNumber(row, `hero${index}Role`);
  return {
    uid: toNumber(row, `hero${index}Uid`),
    hp: toNumber(row, `hero${index}Hp`),
    maxHP: toNumber(row, `hero${index}MaxHp`),
    stats: { ATK: toNumber(row, `hero${index}Atk`) },
    slotIndex: toNumber(row, `hero${index}Slot`),
    role: roleCode === 1 ? 'support' : '',
  };
}

function heroesFromRow(row) {
  return [0, 1, 2, 3].map((index) => heroFromRow(row, index));
}

function wasmArgsFromRow(row, rules) {
  const heroes = [0, 1, 2, 3].flatMap((index) => [
    toNumber(row, `hero${index}Uid`),
    toNumber(row, `hero${index}Hp`),
    toNumber(row, `hero${index}MaxHp`),
    toNumber(row, `hero${index}Atk`),
    toNumber(row, `hero${index}Slot`),
    toNumber(row, `hero${index}Role`),
  ]);
  return [
    rules.enemyTargetPreferenceCodeFromId(row.preference),
    toNumber(row, 'roll'),
    ...heroes,
  ];
}

for (const rulesPath of rulesPaths) {
  test(`enemy target fixtures encode current JS target selection in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { enemyTargetSelectionFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 8);
    for (const row of rows) {
      const decision = enemyTargetSelectionFromJs({
        enemy: { uid: 900, targetPreference: row.preference === 'none' ? '' : row.preference },
        heroes: heroesFromRow(row),
        rng: () => toNumber(row, 'roll'),
      });

      assert.equal(decision.targetUID, toNumber(row, 'expectedTargetUid'), `${row.name} target`);
      assert.equal(decision.mode, row.expectedMode, `${row.name} mode`);
      assert.equal(decision.rollIndex, toNumber(row, 'expectedRollIndex'), `${row.name} roll index`);
    }
  });
}

test('Rust simulation core declares enemy target selection shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn enemy_target_selected_uid/);
  assert.match(rustSrc, /extern "C" fn enemy_target_selected_uid_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_target_mode_code_shadow/);
  assert.match(rustSrc, /extern "C" fn enemy_target_roll_index_shadow/);
});

test('static simulation core wasm matches enemy target fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  const rules = await import(pathToFileURL(rulesPaths[0]));

  assert.equal(typeof exports.enemy_target_selected_uid_shadow, 'function');
  assert.equal(typeof exports.enemy_target_mode_code_shadow, 'function');
  assert.equal(typeof exports.enemy_target_roll_index_shadow, 'function');
  for (const row of rows) {
    const args = wasmArgsFromRow(row, rules);
    const targetUID = Number(exports.enemy_target_selected_uid_shadow(...args));
    const modeCode = Number(exports.enemy_target_mode_code_shadow(...args));
    const rollIndex = Number(exports.enemy_target_roll_index_shadow(...args));

    assert.equal(targetUID, toNumber(row, 'expectedTargetUid'), `wasm ${row.name} target`);
    assert.equal(rules.enemyTargetModeFromCode(modeCode), row.expectedMode, `wasm ${row.name} mode`);
    assert.equal(rollIndex, toNumber(row, 'expectedRollIndex'), `wasm ${row.name} roll index`);
  }
});
