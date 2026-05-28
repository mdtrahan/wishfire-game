const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

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

function normalizeFunctionSource(src) {
  return src
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

test('mirrored functionBank high-risk functions remain in parity across runtime paths', () => {
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsPath, 'utf8');
  const mirroredFunctions = [
    'activatePowerAmp',
    'computeCombatPowerFromStats',
    'ApplyScaledCrit',
    'CalculateDamage',
    'ResolveGemAction',
    'ExecuteEnemyJobSkill',
    'StartEnemyAction',
    'EnemyTurn',
    'HeroTurn',
    'PickEnemySkill',
  ];

  for (const name of mirroredFunctions) {
    const runtimeFn = normalizeFunctionSource(extractFunctionSource(runtimeSrc, name));
    const scriptsFn = normalizeFunctionSource(extractFunctionSource(scriptsSrc, name));
    assert.equal(scriptsFn, runtimeFn, `${name} drifted between runtime mirrors`);
  }
});
