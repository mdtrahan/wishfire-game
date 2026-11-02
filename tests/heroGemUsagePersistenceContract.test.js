const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('canonical hero progress is persisted by the browser storage owner', () => {
 const app=read('web-runner/app.js'),storage=read('web-runner/systems/heroProgressStorage.js');
 assert.match(app,/heroProgressStorage.restoreHeroProgressFromStorage/);
 assert.match(app,/heroProgressStorage.persistHeroProgressIfDirty/);
 assert.match(storage,/orka.hero_progress.v2/);
 assert.match(storage,/createHeroProgressStore/);
 assert.doesNotMatch(storage,/LoadHeroGemProgressSnapshot/);
});
