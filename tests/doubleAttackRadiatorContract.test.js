const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('gem counter radiator exposes double attack holder, chance, and proc count', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderHUD.js'), 'utf8');
  assert.match(src, /Double Attack: \$\{doubleAttackHolderName \|\| 'Off'\}/);
  assert.match(src, /Chance: \$\{Math\.round\(doubleAttackChance \* 100\)\}%/);
  assert.match(src, /Procs: \$\{doubleAttackProcs\}/);
  assert.match(src, /GetActorExtraTurnProcCount/);
});

test('gem counter radiator exposes Destiny proc counters for QA', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderHUD.js'), 'utf8');
  assert.match(src, /PartyDestinyAttempts/);
  assert.match(src, /PartyDestinyProcs/);
  assert.match(src, /PartyDestinyHeals/);
  assert.match(src, /PartyDestinyMisses/);
  assert.match(src, /PartyDestinyLastResult/);
  assert.match(src, /'Destiny'/);
  assert.match(src, /`Checks:\$\{destinyAttempts\}`/);
  assert.match(src, /`Procs:\$\{destinyProcs\}`/);
  assert.match(src, /`Heals:\$\{destinyHeals\}`/);
  assert.match(src, /`Misses:\$\{destinyMisses\}`/);
  assert.match(src, /`Last:\$\{destinyLast\}`/);
});

test('web runner html mounts the gem counter radiator output panel', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'index.html'), 'utf8');
  assert.match(src, /id="gem-counter-output"/);
  assert.match(src, /Gem Counter Radiator: loading\.\.\./);
});
