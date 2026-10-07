const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('retired gem counter radiator is absent from the player shell and HUD', () => {
  const hud = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderHUD.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /gem-counter-output|Gem Counter Radiator/);
  assert.doesNotMatch(hud, /doubleAttackHolderName|PartyDestinyAttempts|PartyDestinyProcs/);
});
