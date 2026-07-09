const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvRows } = require('./helpers/fixtureCsv');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'runa_magic_resist_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'runaMagicResistRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'runaMagicResistRules.mjs'),
];

function toNumber(row, key) {
  return Number(row[key] || 0);
}

for (const rulesPath of rulesPaths) {
  test(`Runa magic-resist fixtures encode current JS mitigation in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { runaMagicResistFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 7);
    for (const row of rows) {
      const decision = runaMagicResistFromJs({
        targetIsRuna: toNumber(row, 'targetIsRuna'),
        incomingDamage: toNumber(row, 'incomingDamage'),
        triggerRoll: toNumber(row, 'triggerRoll'),
        nullifyRoll: toNumber(row, 'nullifyRoll'),
      });

      assert.equal(decision.finalDamage, toNumber(row, 'expectedFinalDamage'), `${row.name} damage`);
      assert.equal(decision.mode, row.expectedMode, `${row.name} mode`);
    }
  });
}

test('Rust simulation core declares Runa magic-resist shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn runa_magic_resist_final_damage/);
  assert.match(rustSrc, /extern "C" fn runa_magic_resist_final_damage_shadow/);
  assert.match(rustSrc, /extern "C" fn runa_magic_resist_mode_code_shadow/);
});

test('static simulation core wasm matches Runa magic-resist fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  const rules = await import(pathToFileURL(rulesPaths[0]));

  assert.equal(typeof exports.runa_magic_resist_final_damage_shadow, 'function');
  assert.equal(typeof exports.runa_magic_resist_mode_code_shadow, 'function');
  for (const row of rows) {
    const args = [
      toNumber(row, 'targetIsRuna'),
      toNumber(row, 'incomingDamage'),
      toNumber(row, 'triggerRoll'),
      toNumber(row, 'nullifyRoll'),
    ];
    const finalDamage = Number(exports.runa_magic_resist_final_damage_shadow(...args));
    const modeCode = Number(exports.runa_magic_resist_mode_code_shadow(...args));

    assert.equal(finalDamage, toNumber(row, 'expectedFinalDamage'), `wasm ${row.name} damage`);
    assert.equal(rules.runaMagicResistModeFromCode(modeCode), row.expectedMode, `wasm ${row.name} mode`);
  }
});
