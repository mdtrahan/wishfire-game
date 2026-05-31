const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');
const appPath = path.join(repoRoot, 'web-runner', 'app.js');
const runtimePath = path.join(repoRoot, 'web-runner', 'systems', 'superGemRuntime.js');

test('red supergem tap auto-resolves the standard attack package after presentation lanes clear', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');

  assert.match(runtimeSrc, /autoResolve:\s*color === 1 \? 1 : 0/);
  assert.match(appSrc, /function autoResolvePendingSuperGemAction\(\)/);
  assert.match(appSrc, /Number\(pending\.color\) !== 1/);
  assert.match(appSrc, /Number\(pending\.autoResolve \|\| 0\) !== 1/);
  assert.match(appSrc, /superGemRuntime\.executePendingSuperGemAction\(\{/);
  assert.match(appSrc, /source: 'auto-supergem'/);
  assert.match(appSrc, /autoResolvePendingSuperGemAction\(\);/);
});
