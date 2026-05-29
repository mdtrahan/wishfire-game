const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(relPath, 'utf8');
}

test('Kojonn Faze queues a recovered 3-turn Blight package from the extracted runtime', () => {
  const renderRuntimeSrc = read('web-runner/systems/renderRuntime.js');

  assert.match(renderRuntimeSrc, /const totalTicks = 3;/);
  assert.match(renderRuntimeSrc, /cadence: 'turn',/);
  assert.match(renderRuntimeSrc, /firesEveryTurns: 1,/);
  assert.match(renderRuntimeSrc, /startAfterTurns: 1,/);
  assert.match(renderRuntimeSrc, /if \(String\(dot\.cadence \|\| 'tick'\) === 'turn'\) continue;/);
});

test('Kojonn Blight queue payload supports turn cadence and source-target reset in both mirrors', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    assert.match(src, /const nowTurnSerial = Number\(g\.TurnSerial \|\| 0\);/);
    assert.match(src, /const cadence = String\(options\?\.cadence \|\| 'tick'\);/);
    assert.match(src, /Reapplying same DoT source\/effect on same target resets the package\./);
    assert.match(src, /g\.EnemyDamageOverTime\.splice\(i, 1\);/);
    assert.match(src, /cadence,/);
    assert.match(src, /firesEveryTurns: Math\.max\(1, Math\.floor\(Number\(options\?\.firesEveryTurns \|\| 1\) \|\| 1\)\),/);
    assert.match(src, /nextFireTurnSerial: nowTurnSerial \+ Math\.max\(1, Math\.floor\(Number\(options\?\.startAfterTurns \|\| 1\) \|\| 1\)\),/);
    assert.match(src, /lastProcessedTurnSerial: nowTurnSerial,/);
    assert.match(src, /const taintedGroundZoneId = String\(options\?\.taintedGroundZoneId \|\| ''\);/);
    assert.match(src, /taintedGroundZoneId,/);
    assert.match(src, /if \(String\(existing\.taintedGroundZoneId \|\| ''\) !== taintedGroundZoneId\) continue;/);
    assert.doesNotMatch(src, /findRenewableTaintedGroundZone/);
    assert.doesNotMatch(src, /taintedGroundRenewalZone/);
    assert.match(src, /function recordHeroTeamTurnProgress\(ctx, currentUID, currentType\) \{/);
    assert.match(src, /g\.HeroTeamTurnSerial = Number\(g\.HeroTeamTurnSerial \|\| 0\) \+ 1;/);
    assert.match(src, /recordHeroTeamTurnProgress\(ctx, currentUID, currentType\);/);
  }
});

test('turn-cadence Blight only fires on the afflicted enemy turn in both mirrors', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    assert.match(src, /export function ProcessEnemyTurnDamageOverTime\(ctx, enemyUID\) \{/);
    assert.match(src, /const targetUID = Number\(enemyUID \|\| 0\);/);
    assert.match(src, /dotTargetUID: Number\(dot\.targetUID \|\| 0\),/);
    assert.match(src, /targetUID,/);
    assert.match(src, /const jsLifecycleAction = computeEnemyDotLifecycleAction\(lifecyclePayload\);/);
    assert.match(src, /const ownedLifecycle = maybeResolveEnemyDotLifecycleOwner\(ctx, \{/);
    assert.match(src, /g\.NextDamageTextKind = 'dot';/);
    assert.match(src, /g\.NextHitFlashTone = 'purple';/);
    assert.match(src, /const activeEnemyUID = Number\(enemyUID \|\| GetCurrentTurn\(ctx\) \|\| 0\);/);
    assert.match(src, /ProcessEnemyTurnDamageOverTime\(ctx, activeEnemyUID\);[\s\S]*?const enemy = GetActorByUID\(ctx, activeEnemyUID\);[\s\S]*?StartEnemyAction\(ctx, activeEnemyUID\);/);
  }

  const appSrc = read('web-runner/app.js');
  assert.doesNotMatch(appSrc, /function processTurnCadenceEnemyDots\(\) \{/);
  assert.doesNotMatch(appSrc, /processTurnCadenceEnemyDots\(\);/);
});

test('app phase handoff can call EnemyTurn without skipping the active enemy', () => {
  const appSrc = read('web-runner/app.js');
  assert.match(appSrc, /if \(state\.globals\.TurnPhase === 2\) \{\s*callFunctionWithContext\(fnContext, 'EnemyTurn'\);\s*\}/);
  assert.match(appSrc, /currentTurnType === 1[\s\S]*?const currentEnemy = currentTurnUID[\s\S]*?callFunctionWithContext\(fnContext, 'EnemyTurn', currentTurnUID\);/);

  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    assert.match(src, /const activeEnemyUID = Number\(enemyUID \|\| GetCurrentTurn\(ctx\) \|\| 0\);/);
    assert.doesNotMatch(src, /if \(!enemyUID\) \{\s*AdvanceTurn\(ctx\);/);
    assert.match(src, /StartEnemyAction\(ctx, activeEnemyUID\);/);
  }
});
