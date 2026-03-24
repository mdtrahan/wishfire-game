const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('mirrored function banks mark dying enemies for one actor-owned fade instead of splicing them immediately', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /function isEnemySlotVisuallyOccupied\(ctx, slotIndex = 0\)/);
    assert.match(src, /function queueEnemyDeathFade\(ctx, enemy, slotIndex = 0\)/);
    assert.match(src, /export function CompleteEnemyFadeExit\(ctx, enemyUID, fallbackSlotIndex = 0\)/);
    assert.match(src, /if \(idx !== -1 && Number\(entities\[idx\]\.deathFadeCleanupPending \|\| 0\) === 1\) return;/);
    assert.match(src, /if \(Number\(enemy\.deathFadeCleanupPending \|\| 0\) === 1\) return;/);
    assert.match(src, /if \(Number\(enemy\.deathFadeUntil \|\| 0\) > Number\(g\.time \|\| 0\)\) return;/);
    assert.match(src, /enemy\.deathFadeStartedAt = startedAt;/);
    assert.match(src, /enemy\.deathFadeDuration = duration;/);
    assert.match(src, /enemy\.deathFadeUntil = startedAt \+ duration;/);
    assert.match(src, /enemy\.deathFadeCleanupPending = 1;/);
    assert.match(src, /enemy\.isDying = 1;/);
    assert.match(src, /if \(t\.kind === 'enemy'\) \{\s*queueEnemyDeathFade\(ctx, t, t\.slotIndex \?\? 0\);\s*\}/s);
    assert.match(src, /if \(isEnemySlotVisuallyOccupied\(ctx, slotIndex\)\) \{/);
    assert.match(src, /if \(Number\(g\.EnemySlots\[slotIndex\] \|\| 0\) > 0 \|\| isEnemySlotVisuallyOccupied\(ctx, slotIndex\)\) continue;/);
    assert.match(src, /if \(!enemyData\) return null;\s+if \(isEnemySlotVisuallyOccupied\(ctx, slotIndex\)\) return null;/);
    assert.match(src, /if \(idx !== -1\) queueEnemyDeathFade\(ctx, entities\[idx\], slotIndex\);/);
    assert.match(src, /if \(idx === -1\) \{\s*CompleteEnemyFadeExit\(ctx, .*?, slotIndex\);\s*\}/s);
    assert.doesNotMatch(src, /if \(idx !== -1\) entities\.splice\(idx, 1\);/);
    assert.doesNotMatch(src, /g\.EnemySlots\[slotIndex\] = 0;\s*if \(Array\.isArray\(g\.EnemyIDs\)\) g\.EnemyIDs\[slotIndex\] = 0;\s*g\.IsPlayerBusy = 1;\s*.*scheduleEnemyRespawnWindow\(ctx, slotIndex, respawnDelay\);/s);
  }
});

test('app render loop fades the original enemy actor and cleans it up after fade completion', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /state\.entities = state\.entities\.filter\(\(entity\) => \{/);
  assert.match(src, /if \(fadeNow >= fadeUntil\) \{/);
  assert.match(src, /callFunctionWithContext\(fnContext, 'CompleteEnemyFadeExit', entity\.uid, entity\.slotIndex \?\? 0\);/);
  assert.match(src, /const rawEnemiesToDraw = state\.entities\.filter\(\(e\) =>/);
  assert.match(src, /const enemiesBySlot = new Map\(\);/);
  assert.match(src, /if \(enemyIsDying && !incumbentIsDying\) \{/);
  assert.match(src, /const enemiesToDraw = Array\.from\(enemiesBySlot\.values\(\)\);/);
  assert.match(src, /const isDying = fadeUntil > fadeNow && Number\(enemy\.hp \|\| 0\) <= 0;/);
  assert.match(src, /const fadeAlpha = isDying/);
  assert.match(src, /ctx\.globalAlpha = fadeAlpha;/);
  assert.match(src, /if \(!isDying && Number\(enemy\.hp \|\| 0\) > 0\) \{/);
});
