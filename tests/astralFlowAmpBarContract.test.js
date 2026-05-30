const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('combat state seeds Astral Flow amp progress and combat-log pin fields', () => {
  const stateSrc = read('web-runner/modules/state.js');
  assert.match(stateSrc, /AstralFlowAmpPoints: 0,/);
  assert.match(stateSrc, /AstralFlowAmpMax: 18,/);
  assert.match(stateSrc, /AstralFlowAmpReady: 0,/);
  assert.match(stateSrc, /CombatActionPinnedLine: '',/);
  assert.match(stateSrc, /CombatActionPinnedUntil: 0,/);
});

for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
  test(`blue resolve only fills the Astral Flow amp from matched blue sets of 3+ in ${relPath}`, () => {
    const src = read(relPath);
    assert.match(src, /resolveGemActionCompat/);
    assert.match(src, /__ORKA_GEM_ACTION_OWNER__/);
    assert.match(src, /const shouldChargeAmp = consumed >= 3 && !ampReady;/);
    assert.match(src, /const currentAmp = Math\.max\(0, gemActionNumberOr\(payload\.astralFlowAmpPoints, 0\)\);/);
    assert.match(src, /const ampMax = Math\.max\(1, Math\.floor\(gemActionNumberOr\(payload\.astralFlowAmpMax, 18\) \|\| 18\)\);/);
    assert.match(src, /const blueAmpPointsAfter = shouldChargeAmp \? Math\.min\(ampMax, currentAmp \+ consumed\) : currentAmp;/);
    assert.match(src, /const blueOpenDraught = shouldChargeAmp && blueAmpPointsAfter >= ampMax \? 1 : 0;/);
    assert.match(src, /const consumedBlue = Math\.max\(0, Number\(decision\.consumedCount \|\| 0\)\);/);
    assert.match(src, /g\.AstralFlowAmpPoints = Number\(decision\.blueAmpPointsAfter \|\| 0\);/);
    assert.match(src, /g\.AstralFlowAmpReady = Number\(decision\.blueAmpReadyAfter \|\| 0\) \? 1 : 0;/);
    assert.match(src, /if \(Number\(decision\.blueOpenDraught \|\| 0\) === 1\) \{/);
    assert.match(src, /LogCombat\(ctx, `\$\{getActorNameByUID\(ctx, actorUID\)\} gained Astral Flow!`\);/);
    assert.match(src, /g\.ActionLockUntil = Number\(decision\.actionLockUntil \|\| 0\);/);
  });

  test(`hero turn start only clears a full Astral Flow amp after the pinned read window expires in ${relPath}`, () => {
    const src = read(relPath);
    assert.match(src, /function shouldResetAstralFlowAmpOnHeroTurn\(g\) \{/);
    assert.match(src, /if \(!Number\(g\.AstralFlowAmpReady \|\| 0\)\) return false;/);
    assert.match(src, /if \(Math\.max\(0, Number\(g\.AstralFlowAmpPoints \|\| 0\)\) < ampMax\) return false;/);
    assert.match(src, /return Number\(g\.time \|\| 0\) >= Number\(g\.CombatActionPinnedUntil \|\| 0\);/);
    assert.match(src, /export function HeroTurn\(ctx, heroUID\) \{[\s\S]*resolveHeroTurnEntryCompat\(\{[\s\S]*__ORKA_HERO_TURN_ENTRY_OWNER__[\s\S]*if \(Number\(decision\.shouldResetAstralFlowAmp \|\| 0\) === 1\) \{[\s\S]*g\.AstralFlowAmpPoints = Number\(decision\.astralFlowAmpPointsAfter \|\| 0\);[\s\S]*g\.AstralFlowAmpReady = Number\(decision\.astralFlowAmpReadyAfter \|\| 0\) \? 1 : 0;[\s\S]*if \(Number\(decision\.clearCombatActionPinned \|\| 0\) === 1\) \{[\s\S]*g\.CombatActionPinnedLine = '';[\s\S]*g\.CombatActionPinnedUntil = 0;[\s\S]*\}[\s\S]*\}[\s\S]*UpdateAstralFlowAmpBar\(ctx\);/s);
  });

  test(`combat logging can pin the active line for Astral Flow read time in ${relPath}`, () => {
    const src = read(relPath);
    assert.match(src, /export function LogCombat\(ctx, text\) \{[\s\S]*const pinUntil = Number\(g\.CombatActionPinnedUntil \|\| 0\);/s);
    assert.match(src, /if \(pinUntil > now && pinnedLine && value !== pinnedLine\) \{/);
    assert.match(src, /if \(\/ gained Astral Flow!\$\/\.test\(value\)\) \{/);
    assert.match(src, /g\.CombatActionPinnedLine = String\(value \|\| ''\);/);
    assert.match(src, /g\.CombatActionPinnedUntil = Math\.max\(pinUntil, now \+ 4\);/);
    assert.doesNotMatch(src, /TextAnimEndAt = Math\.max\(Number\(g\.TextAnimEndAt \|\| 0\), now \+ 4\);/);
  });

  test(`process turn recovers stale action ownership before deciding whether enemy handoff is blocked in ${relPath}`, () => {
    const src = read(relPath);
    assert.match(src, /function recoverStaleActionInProgress\(g, currentUID = 0\) \{/);
    assert.match(src, /const heroActive = !!\(g\.HeroAction && g\.HeroAction\.active && Number\(g\.HeroAction\.uid \|\| 0\) === ownerUID\);/);
    assert.match(src, /const enemyActive = !!\(g\.EnemyAction && g\.EnemyAction\.active && Number\(g\.EnemyAction\.uid \|\| 0\) === ownerUID\);/);
    assert.match(src, /g\.ActionInProgress = 0;[\s\S]*g\.ActionActorUID = 0;/s);
    assert.match(src, /export function ProcessTurn\(ctx\) \{[\s\S]*recoverStaleActionInProgress\(g, uid\);[\s\S]*if \(g\.ActionInProgress\) \{[\s\S]*reason: 'action-in-progress'[\s\S]*return;[\s\S]*\}/s);
  });
}

test('combat HUD reads a pinned Astral Flow line until the 4-second lock expires', () => {
  const appSrc = read('web-runner/app.js');
  assert.match(appSrc, /function getLatestCombatActionLine\(\) \{[\s\S]*const pinnedLine = typeof g\.CombatActionPinnedLine === 'string' \? g\.CombatActionPinnedLine\.trim\(\) : '';/s);
  assert.match(appSrc, /const pinnedUntil = Number\(g\.CombatActionPinnedUntil \|\| 0\);/);
  assert.match(appSrc, /if \(pinnedLine && pinnedUntil > Number\(g\.time \|\| 0\)\) return pinnedLine;/);
});

test('combat renderer keeps HP green and draws a blue Astral Flow amp bar beneath it', () => {
  const runtimeSrc = read('web-runner/systems/renderRuntime.js');
  assert.doesNotMatch(runtimeSrc, /PartyHPBarHealFlashUntil/);
  assert.match(runtimeSrc, /ctx\.fillStyle = '#A0FE0B';/);
  assert.match(runtimeSrc, /const partyHpText = rendered\.find\(r => r\.inst\.type === 'PartyHP_text'\);/);
  assert.match(runtimeSrc, /const ampX = partyHpText \? Math\.min\(barX, partyHpText\.dx\) : barX;/);
  assert.match(runtimeSrc, /const ampRight = partyHpText \? Math\.max\(barX \+ barW, partyHpText\.dx \+ partyHpText\.w\) : \(barX \+ barW\);/);
  assert.match(runtimeSrc, /const ampW = Math\.max\(barW, ampRight - ampX\);/);
  assert.match(runtimeSrc, /const ampMax = Math\.max\(1, Number\(state\.globals\.AstralFlowAmpMax \|\| 18\)\);/);
  assert.match(runtimeSrc, /const ampRatio = Math\.max\(0, Math\.min\(1, Number\(state\.globals\.AstralFlowAmpPoints \|\| 0\) \/ ampMax\)\);/);
  assert.match(runtimeSrc, /const ampGap = Math\.max\(4, Math\.round\(barH \* 0\.55\)\);/);
  assert.match(runtimeSrc, /const ampY = barY \+ barH \+ ampGap;/);
  assert.match(runtimeSrc, /ctx\.fillStyle = '#1e7bd6';/);
  assert.match(runtimeSrc, /ctx\.fillRect\(ampX, ampY, ampW \* ampRatio, barH\);/);
});

test('battle start messaging is always hero-first and does not roll enemy-first initiative', () => {
  const appSrc = read('web-runner/app.js');
  assert.doesNotMatch(appSrc, /BattleStartMode = Math\.random\(\) < 0\.5 \? 'ambush' : 'initiative';/);
  assert.match(appSrc, /state\.globals\.BattleStartMode = 'heroes';/);
  assert.match(appSrc, /Heroes take the initiative!/);
});
