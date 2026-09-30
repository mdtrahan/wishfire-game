const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('player runtime and browser hooks expose no manual turn-target selector path', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const hooks = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'devBrowserTestHooks.js'), 'utf8');
  assert.doesNotMatch(app, /ensurePendingSingleTarget/);
  assert.doesNotMatch(hooks, /getTargetDebugGeometry|SelectedEnemyUIDOwner|selectGemByRC/);
});
