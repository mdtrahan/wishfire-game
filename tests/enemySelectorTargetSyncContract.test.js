const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('pending enemy selector renders only an actor-owned explicit selection', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');

  assert.match(src, /const selectedOwnerUID = Number\(state\.globals\.SelectedEnemyUIDOwner \|\| 0\);/);
  assert.match(src, /const pendingActorUID = Number\(state\.globals\.PendingActor \|\| 0\);/);
  assert.match(src, /const ownerMatchedSelectedUid = selectedOwnerUID === pendingActorUID \? selectedUid : 0;/);
  assert.match(src, /const resolvedSelectedUid = ownerMatchedSelectedUid;/);
  assert.match(src, /resolvedSelectedUid \? aliveEnemies\.filter\(e => Number\(e\.uid \|\| 0\) === resolvedSelectedUid\) : \[\]/);
});
