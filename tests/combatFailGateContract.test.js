const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('combat fail gate derives defeat from live hero entities instead of cached PartyHP alone', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /const livingHeroes = state\.entities\.filter\(\(entity\) => entity && entity\.kind === 'hero' && \(entity\.hp \?\? 0\) > 0\);/);
  assert.match(src, /const livePartyHp = livingHeroes\.reduce\(\(sum, entity\) => sum \+ Number\(entity\.hp \|\| 0\), 0\);/);
  assert.match(src, /if \(!noLivingHeroes && Number\(state\.globals\.PartyHP \|\| 0\) !== livePartyHp\) \{\s*callFunctionWithContext\(fnContext, 'UpdateHeroHPUI'\);\s*\}/s);
  assert.match(src, /if \(energy < 0 \|\| livePartyHp <= 0 \|\| noLivingHeroes\) \{/);
});

test('mirrored function banks gate party life from live hero entities', () => {
  for (const file of [
    path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'),
    path.join(__dirname, '..', 'Scripts', 'functionBank.js'),
  ]) {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, /function getLivingHeroCount\(ctx\) \{\s*return getEntities\(ctx\)\.filter\(e => e && e\.kind === 'hero' && \(e\.hp \?\? 0\) > 0\)\.length;\s*\}/s);
    assert.match(src, /const heroes = getEntities\(ctx\)\.filter\(e => e && e\.kind === 'hero'\);/);
    assert.match(src, /const livingHeroes = heroes\.filter\(e => \(e\.hp \?\? 0\) > 0\);/);
    assert.match(src, /return livingHeroes\.length \? heroes : livingHeroes;/);
    assert.match(src, /const partyAlive = getLivingHeroCount\(ctx\) > 0;/);
    assert.doesNotMatch(src, /const partyAlive = \(g\.PartyHP(?:\s*\?\?|\s*\|\|)\s*0\) > 0;/);
  }
});
