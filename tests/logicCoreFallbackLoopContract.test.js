const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const src = fs.readFileSync(path.join(__dirname, '..', 'Scripts', 'logicCore.js'), 'utf8');

test('logicCore fallback loop tracks interval ownership and exports deterministic teardown', () => {
  assert.match(src, /let fallbackIntervalId = null;/);
  assert.match(src, /if \(fallbackIntervalId != null\) return;/);
  assert.match(src, /fallbackIntervalId = setInterval\(updateAllEntities, 1000 \/ 60\);/);
  assert.match(src, /export function stopGameLoop\(\) \{/);
  assert.match(src, /if \(fallbackIntervalId != null\) \{[\s\S]*clearInterval\(fallbackIntervalId\);[\s\S]*fallbackIntervalId = null;[\s\S]*\}/);
  assert.match(src, /registered = false;/);
  assert.match(src, /export default \{ startGameLoop, stopGameLoop \};/);
});

test('logicCore tick-listener path also tracks owner references for restart-safe teardown', () => {
  assert.match(src, /let tickRuntime = null;/);
  assert.match(src, /let tickHandler = null;/);
  assert.match(src, /tickRuntime = runtime;/);
  assert.match(src, /tickHandler = \(\) => \{[\s\S]*updateAllEntities\(\);[\s\S]*\};/);
  assert.match(src, /if \(tickRuntime && tickHandler && typeof tickRuntime\.removeEventListener === 'function'\) \{[\s\S]*tickRuntime\.removeEventListener\('tick', tickHandler\);[\s\S]*\}/);
});
