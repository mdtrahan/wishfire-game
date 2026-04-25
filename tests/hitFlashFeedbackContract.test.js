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
  assert.match(src, /const hasPersistentEnemyBlightOverlay = \(uid\) => \{/);
  assert.match(src, /if \(Number\(dot\.targetUID \|\| 0\) !== Number\(uid \|\| 0\)\) continue;/);
  assert.match(src, /if \(String\(dot\.effectName \|\| 'Blight'\) !== 'Blight'\) continue;/);
  assert.match(src, /const renderEnemyBlightShimmer = \(drawX, drawY, enemyW, enemyH, seed = 0\) => \{/);
  assert.match(src, /const dotCount = 4;/);
  assert.match(src, /ctx\.fillStyle = '#8D37FF';/);
  assert.match(src, /ctx\.strokeStyle = '#4B176F';/);
  assert.match(src, /ctx\.lineWidth = Math\.max\(1, enemyW \* 0\.018\);/);
  assert.match(src, /ctx\.shadowColor = '#5E1C91';/);
  assert.match(src, /ctx\.globalAlpha = Math\.max\(0, Math\.min\(0\.9, alpha\)\);/);
  assert.match(src, /ctx\.arc\(0, 0, dotSize, 0, Math\.PI \* 2\);/);
  assert.match(src, /ctx\.stroke\(\);/);
  assert.doesNotMatch(src, /renderEnemyBlightShimmer[\s\S]*ctx\.clip\(\);/);
  assert.match(src, /ctx\.globalAlpha = tone === 'purple' \? 0\.5 : 0\.3;/);
  assert.match(src, /tone === 'purple'/);
  assert.match(src, /return 'black';/);
  assert.match(src, /const renderHitFlashOverlay = \(drawSprite, tone = 'black'\) => \{/);
  assert.match(src, /: 'brightness\(0\)'/);
  assert.match(src, /hasPersistentEnemyBlightOverlay\(enemy\.uid\)[\s\S]*renderHitFlashOverlay\(\(\) => ctx\.drawImage\(sprite, drawX, drawY, enemyW, enemyH\), 'purple'\);[\s\S]*renderEnemyBlightShimmer\(drawX, drawY, enemyW, enemyH, enemy\.uid\);/);
  assert.match(src, /renderHitFlashOverlay\(\(\) => ctx\.drawImage\(sprite, drawX, drawY, enemyW, enemyH\), getHitFlashTone\(enemy\.uid\)\);/);
  assert.match(src, /renderHitFlashOverlay\(\(\) => ctx\.drawImage\(img, drawX, drawY, scaledW, scaledH\), getHitFlashTone\(hero\.uid\)\);/);
  assert.match(src, /ctx\.globalAlpha = 0\.3;\s+ctx\.filter = 'brightness\(0\)';\s+ctx\.drawImage\(portrait, drawX, drawY, heroW, heroH\);/);
  assert.match(src, /ctx\.globalAlpha = 0\.3;\s+ctx\.filter = 'brightness\(0\)';\s+ctx\.drawImage\(enemySprite, drawX, drawY, enemyW, enemyH\);/);
  const idleWhiteFlashes = src.match(/ctx\.filter = 'brightness\(0\) invert\(1\)';/g) || [];
  assert.equal(idleWhiteFlashes.length, 0, 'expected legacy white hit-flash filters to be removed from runtime render paths');
});

test('Kojonn blight paths arm purple hit-flash tone for immediate and queued ticks', () => {
  const src = read('web-runner/app.js');
  const purpleHooks = src.match(/state\.globals\.NextHitFlashTone = 'purple';/g) || [];
  assert.ok(purpleHooks.length >= 2, 'expected purple hit-flash tone to be armed for both immediate blight impact and queued DoT ticks');
  assert.match(src, /callFunctionWithContext\(fnContext, 'ApplyDamageToTarget', dot\.targetUID, dmg, \{\s+isCrit: !!dot\.isCrit \|\| Number\(dot\.powerAmpMultiplier \|\| 0\) > 0,/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'ApplyDamageToTarget', hit\.targetUID, initialDotDamage, \{\s+isCrit: overTimeCrit,/);
});
