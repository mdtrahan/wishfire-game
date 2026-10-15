const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('production shell has no Flow-orb currency or navigation entry point', () => {
  const app = read('web-runner/app.js');
  const html = read('web-runner/index.html');
  const navigation = read('web-runner/systems/renderExistingNavigation.mjs');
  assert.doesNotMatch(app, /advanceFlowOrbs|dropEnemyFlowOrbs|FlowOrbs/);
  assert.doesNotMatch(html, /Astral Flow|\bFLOW\b|100-AF/);
  assert.doesNotMatch(navigation, /Astral Flow|\bFLOW\b/);
});
