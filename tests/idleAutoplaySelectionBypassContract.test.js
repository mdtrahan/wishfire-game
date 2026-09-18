const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('dev autoplay uses native commands and leaves Astral Flow choices to the player', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const start = src.indexOf('async function runDevAutoplayUntilDepleted()');
  const end = src.indexOf('async function runGemInteractivityDiagnostic()', start);
  const loop = src.slice(start, end);
  assert.match(loop, /heroCommandUI\.playCurrent\(\)/);
  assert.doesNotMatch(loop, /autoResolveSkillDraught|autoResolvePendingSelection|pickIdleAutoplayTriplet|pickIdleAutoplaySuperGem/);
});
