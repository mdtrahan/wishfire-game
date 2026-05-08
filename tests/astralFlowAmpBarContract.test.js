const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

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
    assert.match(src, /const consumedBlue = Math\.max\(0, Number\(consumedCount\) \|\| 0\);/);
    assert.match(src, /if \(consumedBlue >= 3 && !g\.AstralFlowAmpReady\) \{/);
    assert.match(src, /const currentAmp = Math\.max\(0, Number\(g\.AstralFlowAmpPoints \|\| 0\)\);/);
    assert.match(src, /const ampMax = Math\.max\(1, Number\(g\.AstralFlowAmpMax \|\| 18\)\);/);
    assert.match(src, /const nextAmp = Math\.min\(ampMax, currentAmp \+ consumedBlue\);/);
    assert.match(src, /g\.AstralFlowAmpPoints = nextAmp;/);
    assert.match(src, /if \(nextAmp >= ampMax\) \{/);
    assert.match(src, /g\.AstralFlowAmpReady = 1;/);
    assert.match(src, /LogCombat\(ctx, `\$\{getActorNameByUID\(ctx, actorUID\)\} gained Astral Flow!`\);/);
    assert.match(src, /g\.ActionLockUntil = Math\.max\(g\.ActionLockUntil \|\| 0, \(g\.time \|\| 0\) \+ 4\);/);
  });

  test(`hero turn start only clears a full Astral Flow amp after the pinned read window expires in ${relPath}`, () => {
    const src = read(relPath);
    assert.match(src, /function shouldResetAstralFlowAmpOnHeroTurn\(g\) \{/);
    assert.match(src, /if \(!Number\(g\.AstralFlowAmpReady \|\| 0\)\) return false;/);
    assert.match(src, /if \(Math\.max\(0, Number\(g\.AstralFlowAmpPoints \|\| 0\)\) < ampMax\) return false;/);
    assert.match(src, /return Number\(g\.time \|\| 0\) >= Number\(g\.CombatActionPinnedUntil \|\| 0\);/);
    assert.match(src, /export function HeroTurn\(ctx, heroUID\) \{[\s\S]*if \(shouldResetAstralFlowAmpOnHeroTurn\(g\)\) \{[\s\S]*g\.AstralFlowAmpPoints = 0;[\s\S]*g\.AstralFlowAmpReady = 0;[\s\S]*g\.CombatActionPinnedLine = '';[\s\S]*g\.CombatActionPinnedUntil = 0;[\s\S]*\}[\s\S]*UpdateAstralFlowAmpBar\(ctx\);/s);
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
    assert.match(src, /export function ProcessTurn\(ctx\) \{[\s\S]*recoverStaleActionInProgress\(g, uid\);[\s\S]*if \(g\.ActionInProgress && g\.ActionActorUID && g\.ActionActorUID !== uid\) return;/s);
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

test('battle-start ordering merges both teams by initiative instead of front-loading all heroes', async () => {
  const scheduler = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'core', 'schedulerRules.mjs')).href);
  const order = scheduler.deriveBattleStartRoundPartition([
    { uid: 1, type: 0, spd: 10, init: 12 },
    { uid: 2, type: 0, spd: 8, init: 9 },
    { uid: 3, type: 1, spd: 7, init: 11 },
    { uid: 4, type: 1, spd: 6, init: 8 },
  ], '').map(actor => Number(actor.uid || 0));
  assert.deepEqual(order, [1, 3, 2, 4]);
});
