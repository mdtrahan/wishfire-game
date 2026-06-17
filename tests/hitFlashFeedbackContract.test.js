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
  const renderRuntimeSrc = read('web-runner/systems/renderRuntime.js');
  assert.match(src, /function isHitFlashActive\(uid\) \{/);
  assert.match(src, /function getHitFlashTone\(uid\) \{/);
  assert.match(src, /function isActiveTaintedGroundZone\(zone\) \{/);
  assert.match(src, /function enemyOccupiesTaintedGroundZone\(enemy, zone\) \{/);
  assert.match(src, /function hasPersistentEnemyBlightOverlay\(uid\) \{/);
  assert.match(src, /if \(Number\(dot\.targetUID \|\| 0\) !== Number\(uid \|\| 0\)\) continue;/);
  assert.match(src, /if \(!String\(dot\.effectName \|\| 'Blight'\)\.startsWith\('Blight'\)\) continue;/);
  assert.match(src, /if \(hasPersistentEnemyTaintedGroundOverlay\(uid\)\) return true;/);
  assert.match(src, /if \(!isActiveTaintedGroundZone\(zone\)\) continue;/);
  assert.match(src, /if \(!enemyOccupiesTaintedGroundZone\(enemy, zone\)\) continue;/);
  assert.match(src, /const anchorX = Number\(zone\.anchorWorldX\);/);
  assert.match(renderRuntimeSrc, /if \(!String\(dot\.effectName \|\| 'Blight'\)\.startsWith\('Blight'\)\) continue;/);
  assert.match(src, /hasPersistentEnemyBlightOverlay,\s+hasPersistentHeroRegenOverlay,\s+isHitFlashActive,\s+getHitFlashTone,/s);
  assert.doesNotMatch(src, /hasPersistentEnemyBlightOverlay:\s*\(\) => false/);
  assert.doesNotMatch(src, /hasPersistentHeroRegenOverlay:\s*\(\) => false/);
  assert.doesNotMatch(src, /isHitFlashActive:\s*\(\) => false/);
  assert.doesNotMatch(src, /getHitFlashTone:\s*\(\) => 'black'/);
  assert.match(renderRuntimeSrc, /const renderEnemyBlightShimmer = \(drawX, drawY, enemyW, enemyH, seed = 0\) => \{/);
  assert.match(renderRuntimeSrc, /const taintedGroundFieldOverlays = typeof getPersistentTaintedGroundOverlays === 'function' \? getPersistentTaintedGroundOverlays\(\) : \[\];/);
  assert.match(renderRuntimeSrc, /const enemyStandsInRenderedTaintedGround = \(enemy\) => enemyStandsInFieldOverlay\(enemy, taintedGroundFieldOverlays\);/);
  assert.match(renderRuntimeSrc, /hasPersistentEnemyBlightOverlay\(enemy\.uid\) \|\| enemyStandsInRenderedTaintedGround\(enemy\)/);
  assert.match(renderRuntimeSrc, /const dotCount = 4;/);
  assert.match(renderRuntimeSrc, /ctx\.fillStyle = '#8D37FF';/);
  assert.match(renderRuntimeSrc, /ctx\.strokeStyle = '#4B176F';/);
  assert.match(renderRuntimeSrc, /ctx\.lineWidth = Math\.max\(1, enemyW \* 0\.018\);/);
  assert.match(renderRuntimeSrc, /ctx\.shadowColor = '#5E1C91';/);
  assert.match(renderRuntimeSrc, /ctx\.globalAlpha = Math\.max\(0, Math\.min\(0\.9, alpha\)\);/);
  assert.match(renderRuntimeSrc, /ctx\.arc\(0, 0, dotSize, 0, Math\.PI \* 2\);/);
  assert.match(renderRuntimeSrc, /ctx\.stroke\(\);/);
  assert.doesNotMatch(renderRuntimeSrc, /renderEnemyBlightShimmer[\s\S]*ctx\.clip\(\);/);
  assert.match(renderRuntimeSrc, /ctx\.globalAlpha = tone === 'purple' \? 0\.5 : \(tone === 'blue' \? 0\.42 : 0\.3\);/);
  assert.match(renderRuntimeSrc, /tone === 'purple'/);
  assert.match(src, /return 'black';/);
  assert.match(renderRuntimeSrc, /const renderHitFlashOverlay = \(drawSprite, tone = 'black'\) => \{/);
  assert.match(renderRuntimeSrc, /: 'brightness\(0\)'/);
  assert.match(renderRuntimeSrc, /hasPersistentEnemyBlightOverlay\(enemy\.uid\)[\s\S]*renderHitFlashOverlay\(\(\) => ctx\.drawImage\(sprite, drawX, drawY, enemyW, enemyH\), 'purple'\);[\s\S]*renderEnemyBlightShimmer\(drawX, drawY, enemyW, enemyH, enemy\.uid\);/);
  assert.match(renderRuntimeSrc, /renderHitFlashOverlay\(\(\) => ctx\.drawImage\(sprite, drawX, drawY, enemyW, enemyH\), getHitFlashTone\(enemy\.uid\)\);/);
  assert.match(renderRuntimeSrc, /renderHitFlashOverlay\(\(\) => ctx\.drawImage\(img, drawX, drawY, scaledW, scaledH\), getHitFlashTone\(hero\.uid\)\);/);
  const idleWhiteFlashes = renderRuntimeSrc.match(/ctx\.filter = 'brightness\(0\) invert\(1\)';/g) || [];
  assert.equal(idleWhiteFlashes.length, 0, 'expected legacy white hit-flash filters to be removed from runtime render paths');
});

test('Kojonn blight paths arm purple hit-flash tone for immediate and queued ticks', () => {
  const src = read('web-runner/systems/renderRuntime.js');
  const purpleHooks = src.match(/visualControlPatches\.NextHitFlashTone = 'purple';/g) || [];
  assert.ok(purpleHooks.length >= 2, 'expected purple hit-flash tone to be armed for both immediate blight impact and queued DoT ticks');
  assert.match(src, /callFunctionWithContext\(fnContext, 'ApplyDamageToTarget', dot\.targetUID, dmg, \{/);
  assert.match(src, /isCrit: !!dot\.isCrit \|\| Number\(dot\.powerAmpMultiplier \|\| 0\) > 0,/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'ApplyDamageToTarget', hit\.targetUID, initialDotDamage, \{/);
  assert.match(src, /isCrit: overTimeCrit,/);
});
