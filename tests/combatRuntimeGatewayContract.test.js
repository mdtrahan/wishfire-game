const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('web-runner CombatRuntimeGateway exposes suspend/resume lifecycle API', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'combatRuntimeGateway.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /class CombatRuntimeGateway/);
  assert.match(src, /\bsuspend\(\)\s*\{/);
  assert.match(src, /\bresume\(snapshot\)\s*\{/);
  assert.match(src, /\bcanAcceptEvents\(\)\s*\{/);
  assert.match(src, /\bhandleEvent\(eventName, payload = \{\}\)\s*\{/);
  assert.match(src, /export \{ CombatRuntimeGateway \};/);
});

