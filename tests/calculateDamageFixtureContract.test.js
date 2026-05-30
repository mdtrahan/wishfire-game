const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'calculate_damage_cases.csv');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'calculateDamageRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'calculateDamageRules.mjs'),
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

function rowArgs(row) {
  return {
    power: toNumber(row, 'power'),
    resist: toNumber(row, 'resist'),
    roll01: toNumber(row, 'roll01'),
    critRoll01: toNumber(row, 'critRoll01'),
    sourceIsHero: toNumber(row, 'sourceIsHero'),
    heroAoe: toNumber(row, 'heroAoe'),
    chainActive: toNumber(row, 'chainActive'),
    chainMultiplier: toNumber(row, 'chainMultiplier'),
  };
}

for (const rulesPath of rulesPaths) {
  test(`CalculateDamage fixtures encode current JS final damage in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { calculateDamageFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 7);
    for (const row of rows) {
      const decision = calculateDamageFromJs(rowArgs(row));
      assert.equal(decision.damage, toNumber(row, 'expectedDamage'), `${row.name} damage`);
      assert.equal(decision.baseDamage, toNumber(row, 'expectedBaseDamage'), `${row.name} base`);
    }
  });
}

test('static simulation core wasm matches CalculateDamage fixtures through single-hit export', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.single_hit_damage_shadow, 'function');
  for (const row of rows) {
    const args = [
      toNumber(row, 'power'),
      toNumber(row, 'resist'),
      toNumber(row, 'roll01'),
      toNumber(row, 'critRoll01'),
      toNumber(row, 'sourceIsHero'),
      toNumber(row, 'heroAoe'),
      toNumber(row, 'chainActive'),
      toNumber(row, 'chainMultiplier'),
    ];
    const damage = Number(exports.single_hit_damage_shadow(...args));

    assert.equal(damage, toNumber(row, 'expectedDamage'), `wasm ${row.name} damage`);
  }
});
