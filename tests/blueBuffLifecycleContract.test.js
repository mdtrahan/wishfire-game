const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('blue path does not use buff duration timers anymore', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.doesNotMatch(src, /const buffTurns = Math\.max\(1, Math\.min\(5, Number\(g\.BuffDurationDefault \|\| 5\)\)\);/);
  assert.match(src, /ctx\.callFunction\('Party_DEF_UP', 0, actorUID, 0, 2\);/);
  assert.match(src, /ctx\.callFunction\('Party_ATK_UP', 0, actorUID, 0, 2\);/);
});

test('AdvanceTurn no longer runs party buff turn decay', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.doesNotMatch(src, /const decayPartyBuffsOnHeroAction = \(\) => \{/);
  assert.doesNotMatch(src, /decayPartyBuffsOnHeroAction\(\);/);
});

test('skill sheet clamps buff turns to zero in both runtime mirrors', () => {
  const runtimeFile = path.join(__dirname, '..', 'web-runner', 'modules', 'skillSheet.js');
  const scriptsFile = path.join(__dirname, '..', 'Scripts', 'skillSheet.js');
  const runtimeSrc = fs.readFileSync(runtimeFile, 'utf8');
  const scriptsSrc = fs.readFileSync(scriptsFile, 'utf8');
  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /g\.BuffTurns_DEF = 0;/);
    assert.match(src, /g\.BuffTurns_ATK = 0;/);
    assert.match(src, /g\.BuffTurns_MAG = 0;/);
    assert.match(src, /g\.BuffTurns_RES = 0;/);
  }
});
