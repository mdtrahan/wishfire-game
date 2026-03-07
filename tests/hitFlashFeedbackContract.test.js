const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('damage application sets brief hit-flash window in both function-bank mirrors', () => {
  const runtimeSrc = read('web-runner/modules/functionBank.js');
  const scriptsSrc = read('Scripts/functionBank.js');
  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /g\.HitFlashByUID\[uid\] = now \+ 0\.14;/);
  }
});

test('renderer applies white hit-flash overlay to attacked combatants', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /const isHitFlashActive = \(uid\) => \{/);
  assert.match(src, /ctx\.globalAlpha = 0\.5;/);
  assert.match(src, /ctx\.filter = 'brightness\(0\) invert\(1\)';/);
  assert.match(src, /if \(isHitFlashActive\(enemy\.uid\)\) \{\s*renderHitFlashOverlay/);
  assert.match(src, /if \(hero && isHitFlashActive\(hero\.uid\)\) \{\s*renderHitFlashOverlay/);
});
