const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('runtime function bank defines Huun execution bonus constants and resolver', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /const HUUN_EXECUTION_NAME = 'Huun';/);
  assert.match(src, /const HUUN_EXECUTION_TH_BONUS = 2;/);
  assert.match(src, /function resolveHuunExecutionDropBonusLevel\(ctx, killerUID\)/);
  assert.match(src, /const thLevel = baseThLevel \+ huunBonusLevel;/);
});

test('enemy death pipeline carries killer credit into AwardMonsterDrop', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /g\.PendingDeaths\[t\.uid\] = \{\s*group: Number\(g\.RoundGroupIndex \|\| 0\),\s*killerUID: Number\(g\.LastDamageSourceUID \|\| 0\),\s*\};/);
  assert.match(src, /AwardMonsterDrop\(ctx, t\.name \|\| t\.key \|\| t\.type \|\| '', null, Number\(g\.LastDamageSourceUID \|\| 0\)\);/);
  assert.match(src, /AwardMonsterDrop\(ctx, actor\.name \|\| actor\.key \|\| actor\.type \|\| '', null, killerUID\);/);
});

test('Scripts mirror includes Huun execution drop bonus behavior', () => {
  const src = read('Scripts/functionBank.js');
  assert.match(src, /const HUUN_EXECUTION_NAME = 'Huun';/);
  assert.match(src, /const HUUN_EXECUTION_TH_BONUS = 2;/);
  assert.match(src, /function resolveHuunExecutionDropBonusLevel\(ctx, killerUID\)/);
  assert.match(src, /const thLevel = baseThLevel \+ huunBonusLevel;/);
});
