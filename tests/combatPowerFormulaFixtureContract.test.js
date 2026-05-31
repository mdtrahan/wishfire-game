const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixturePath = path.join(__dirname, 'fixtures', 'combat_power_cases.csv');
const runtimePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');

function extractFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = src.indexOf('{', start);
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function loadFunctionFromFile(filePath, name) {
  const src = fs.readFileSync(filePath, 'utf8');
  const fnSource = extractFunctionSource(src, name);
  return vm.runInNewContext(`(${fnSource})`, { Math, Number });
}

function readFixtureCases() {
  const rows = fs.readFileSync(fixturePath, 'utf8').trim().split(/\r?\n/);
  return rows.slice(1).map((row) => {
    const [name, atk, def, hp, expected] = row.split(',');
    return {
      name,
      atk: Number(atk),
      def: Number(def),
      hp: Number(hp),
      expected: Number(expected),
    };
  });
}

test('shared combat power fixtures match both JS runtime mirrors', () => {
  const cases = readFixtureCases();
  const mirrors = [
    ['Scripts/functionBank.js', loadFunctionFromFile(scriptsPath, 'computeCombatPowerFromStats')],
    ['web-runner/modules/functionBank.js', loadFunctionFromFile(runtimePath, 'computeCombatPowerFromStats')],
  ];

  for (const [label, computeCombatPowerFromStats] of mirrors) {
    for (const testCase of cases) {
      assert.equal(
        computeCombatPowerFromStats(testCase.atk, testCase.def, testCase.hp),
        testCase.expected,
        `${label} failed fixture ${testCase.name}`,
      );
    }
  }
});
