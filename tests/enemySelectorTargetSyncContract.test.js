const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('pending enemy selector follows queued hero hit target before selected enemy fallback', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');

  assert.match(src, /const pendingHitTargetUID = Array\.isArray\(state\.globals\.PendingHeroHits\)/);
  assert.match(src, /state\.globals\.PendingHeroHits\.find\(hit => hit && Number\(hit\.targetUID \|\| 0\) > 0\)/);
  assert.match(src, /const resolvedSelectedUid = pendingHitTargetUID \|\| selectedUid;/);
  assert.match(src, /resolvedSelectedUid \? aliveEnemies\.filter\(e => Number\(e\.uid \|\| 0\) === resolvedSelectedUid\) : aliveEnemies\.slice\(0, 1\)/);
});
