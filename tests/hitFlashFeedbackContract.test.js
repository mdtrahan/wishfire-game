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
    assert.match(src, /const hitFlashTone = String\(g\.NextHitFlashTone \|\| 'black'\);/);
    assert.match(src, /g\.HitFlashByUID\[uid\] = \{/);
    assert.match(src, /until: now \+ 0\.14,/);
    assert.match(src, /tone: hitFlashTone,/);
    assert.match(src, /delete g\.NextHitFlashTone;/);
  }
});

test('renderer applies tone-aware hit-flash overlay to attacked combatants', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /const isHitFlashActive = \(uid\) => \{/);
  assert.match(src, /const getHitFlashTone = \(uid\) => \{/);
  assert.match(src, /ctx\.globalAlpha = tone === 'purple' \? 0\.5 : 0\.3;/);
  assert.match(src, /tone === 'purple'/);
  assert.match(src, /return 'black';/);
  assert.match(src, /const renderHitFlashOverlay = \(drawSprite, tone = 'black'\) => \{/);
  assert.match(src, /: 'brightness\(0\)'/);
  assert.match(src, /renderHitFlashOverlay\(\(\) => ctx\.drawImage\(sprite, drawX, drawY, enemyW, enemyH\), getHitFlashTone\(enemy\.uid\)\);/);
  assert.match(src, /renderHitFlashOverlay\(\(\) => ctx\.drawImage\(img, drawX, drawY, scaledW, scaledH\), getHitFlashTone\(hero\.uid\)\);/);
});

test('Kojonn blight paths arm purple hit-flash tone for immediate and queued ticks', () => {
  const src = read('web-runner/app.js');
  const purpleHooks = src.match(/state\.globals\.NextHitFlashTone = 'purple';/g) || [];
  assert.ok(purpleHooks.length >= 2, 'expected purple hit-flash tone to be armed for both immediate blight impact and queued DoT ticks');
  assert.match(src, /callFunctionWithContext\(fnContext, 'ApplyDamageToTarget', dot\.targetUID, dmg\);/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'ApplyDamageToTarget', hit\.targetUID, initialDotDamage\);/);
});
