const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('damage application can route a dedicated floating-text kind through both function-bank mirrors', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');
  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /const damageTextKind = String\(g\.NextDamageTextKind \|\| 'damage'\);/);
    assert.match(src, /SpawnDamageText\(ctx, appliedDamage, dx, dy, damageTextKind, t\.kind \|\| null\);/);
    assert.match(src, /delete g\.NextDamageTextKind;/);
  }
});

test('renderer uses fixed approved flat colors for heal, hero damage, enemy damage, and dot floating text', () => {
  const src = read('web-runner/app.js');
  assert.doesNotMatch(src, /const lerpColor =/);
  assert.doesNotMatch(src, /const heatColor =/);
  assert.match(src, /ctx\.fillStyle = d\.kind === 'heal'/);
  assert.match(src, /\? '#66CCFF'/);
  assert.match(src, /: d\.kind === 'dot'/);
  assert.match(src, /\? '#AA66FF'/);
  assert.match(src, /: d\.targetKind === 'hero'/);
  assert.match(src, /\? '#FF4040'/);
  assert.match(src, /: '#FFFFFF';/);
});

test('Kojonn dot paths explicitly arm dot floating-text kind before damage application', () => {
  const src = read('web-runner/app.js');
  const dotKindHooks = src.match(/state\.globals\.NextDamageTextKind = 'dot';/g) || [];
  assert.ok(dotKindHooks.length >= 2, 'expected dot text kind to be armed for immediate and queued Kojonn dot damage');
});
