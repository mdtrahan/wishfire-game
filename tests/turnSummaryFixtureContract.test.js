const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixturePath = path.join(__dirname, 'fixtures', 'turn_summary_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');

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

function aliveCount(count, hpValues) {
  return hpValues.slice(0, Math.max(0, Math.min(4, Math.floor(count))))
    .filter((hp) => Number(hp || 0) > 0)
    .length;
}

function jsTurnSummaryCode(row) {
  const heroCount = toNumber(row, 'heroCount');
  const enemyCount = toNumber(row, 'enemyCount');
  const heroHp = [0, 1, 2, 3].map((index) => toNumber(row, `hero${index}Hp`));
  const enemyHp = [0, 1, 2, 3].map((index) => toNumber(row, `enemy${index}Hp`));
  const heroAlive = aliveCount(heroCount, heroHp);
  const enemyAlive = aliveCount(enemyCount, enemyHp);
  const heroDefeated = Math.max(0, Math.min(4, Math.floor(heroCount)) - heroAlive);
  const enemyDefeated = Math.max(0, Math.min(4, Math.floor(enemyCount)) - enemyAlive);
  const partyDefeated = heroCount > 0 && heroAlive === 0 ? 1 : 0;
  const enemiesDefeated = enemyAlive === 0 ? 1 : 0;
  return (heroAlive * 100000)
    + (heroDefeated * 10000)
    + (enemyAlive * 1000)
    + (enemyDefeated * 100)
    + (partyDefeated * 10)
    + enemiesDefeated;
}

test('turn summary fixtures encode current JS alive and defeated semantics', () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(rows.length >= 5);
  for (const row of rows) {
    assert.equal(jsTurnSummaryCode(row), toNumber(row, 'expectedCode'), row.name);
  }
});

test('Rust simulation core declares turn summary shadow export', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  assert.match(rustSrc, /pub fn turn_summary_code/);
  assert.match(rustSrc, /extern "C" fn turn_summary_code_shadow/);
});

test('static simulation core wasm matches turn summary fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;
  assert.equal(typeof exports.turn_summary_code_shadow, 'function');

  for (const row of rows) {
    const rustCode = exports.turn_summary_code_shadow(
      toNumber(row, 'heroCount'),
      toNumber(row, 'hero0Hp'),
      toNumber(row, 'hero1Hp'),
      toNumber(row, 'hero2Hp'),
      toNumber(row, 'hero3Hp'),
      toNumber(row, 'enemyCount'),
      toNumber(row, 'enemy0Hp'),
      toNumber(row, 'enemy1Hp'),
      toNumber(row, 'enemy2Hp'),
      toNumber(row, 'enemy3Hp'),
    );
    assert.equal(rustCode, jsTurnSummaryCode(row), row.name);
  }
});
