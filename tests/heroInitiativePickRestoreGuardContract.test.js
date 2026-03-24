const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('hero pick restore only runs during a truly idle hero window', () => {
  const src = read('web-runner/app.js');
  assert.match(
    src,
    /state\.globals\.GamePhase === 'RUNTIME'[\s\S]*currentTurnType === 0[\s\S]*state\.globals\.TurnPhase === 0[\s\S]*noRefillActive[\s\S]*!state\.globals\.IsPlayerBusy[\s\S]*!state\.globals\.PendingSkillID[\s\S]*!state\.globals\.ActionInProgress[\s\S]*!state\.globals\.DeferAdvance[\s\S]*\(state\.globals\.CanPickGems !== true \|\| state\.globals\.BoardFillActive !== 0\)[\s\S]*state\.globals\.CanPickGems = true;/,
  );
});
