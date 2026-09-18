const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('combat lunge motion uses a later impact handoff instead of overlapping lunge and flinch beats', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const animationSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'animationMath.js'), 'utf8');
  const renderRuntimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');

  assert.match(animationSrc, /export const LUNGE_FORWARD_SEC = 0\.75;/);
  assert.match(animationSrc, /export const LUNGE_FORWARD_DIST_PX = 200;/);
  assert.match(animationSrc, /export const HERO_LUNGE_FORWARD_DIST_PX = LUNGE_FORWARD_DIST_PX \* 0\.85;/);
  assert.match(animationSrc, /export const LUNGE_IMPACT_HANDOFF_SEC = 0\.08;/);
  assert.match(animationSrc, /export function easeLungeForward\(t\) \{\s+return evaluateCubicBezier\(t, 1, 0, 0, 1\);\s+\}/s);
  assert.match(src, /import \* as animationMath from '\.\/systems\/animationMath\.js';/);
  assert.match(renderRuntimeSrc, /const isRangedProfile = actionProfile === 'ranged' \|\| heroAction\.stationary === true;/);
  assert.match(renderRuntimeSrc, /if \(heroAction\.stationary\) x = baseX;/);
  assert.match(renderRuntimeSrc, /const enemyUsesRangedMagic = !!enemyAction\.stationary \|\| String\(enemyAction\.skillId \|\| ''\)\.startsWith\('Enemy_Heal_'\)/);
  assert.match(renderRuntimeSrc, /const enemyPresentationComplete = \(\) =>/);
  assert.equal(
    [...renderRuntimeSrc.matchAll(/const pendingBloom = \(gameState\.healBlooms \|\| \[\]\)\.some\(bloom => Number\(bloom\?\.ownerUID \|\| bloom\?\.targetUID \|\| 0\) === ownerUID && !bloom\.complete\);/g)].length,
    2,
    'both hero and enemy action owners wait for their last heal bloom',
  );
  assert.match(renderRuntimeSrc, /enemyAction\.timer >= impactHold && enemyPresentationComplete\(\)/);
  assert.match(renderRuntimeSrc, /const lungeDur = animationMath\.LUNGE_FORWARD_SEC;/);
  assert.match(renderRuntimeSrc, /const e = animationMath\.easeLungeForward\(t\);/);
  assert.match(renderRuntimeSrc, /const followUpLead = animationMath\.LUNGE_ANTICIPATION_SEC \+ animationMath\.LUNGE_FORWARD_SEC \+ animationMath\.LUNGE_IMPACT_HANDOFF_SEC;/);
});

test('direct AOE hero lunge profile gets extra hold and retreat breathing room', () => {
  const renderRuntimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  const runtimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'), 'utf8');
  const scriptsSrc = fs.readFileSync(path.join(__dirname, '..', 'Scripts', 'functionBank.js'), 'utf8');

  assert.match(renderRuntimeSrc, /const isAoeProfile = actionProfile === 'aoe';/);
  assert.match(renderRuntimeSrc, /const heroPresentationComplete = \(\) =>/);
  assert.match(renderRuntimeSrc, /const presentationHeld = Number\(state\.globals\.time \|\| 0\) < Number\(heroAction\.presentationStartAfter \|\| 0\);/);
  assert.match(renderRuntimeSrc, /if \(!presentationHeld\) heroAction\.timer = \(heroAction\.timer \|\| 0\) \+ dt;/);
  assert.match(renderRuntimeSrc, /heroAction\.timer >= holdDur && heroPresentationComplete\(\)/);
  assert.match(renderRuntimeSrc, /const holdDur = isAoeProfile \? 0\.24 : animationMath\.LUNGE_HOLD_SEC;/);
  assert.match(renderRuntimeSrc, /const retreatDur = isAoeProfile \? 0\.42 : animationMath\.LUNGE_RETREAT_SEC;/);

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /g\.NextHeroActionProfile = skillId === 'HERO_AOE'\s+\? 'aoe'\s+: 'single';/s);
    assert.match(src, /const requestedProfile = String\(g\.NextHeroActionProfile \|\| 'single'\);/);
    assert.match(src, /const profile = actor\?\.attackType === 'magic' \? 'ranged' : requestedProfile;/);
    assert.match(src, /const totalDur = profile === 'aoe'\s+\? 0\.14 \+ 0\.75 \+ 0\.24 \+ 0\.42\s+: 0\.14 \+ 0\.75 \+ 0\.16 \+ 0\.26;/s);
    assert.match(src, /const hitDelay = Math\.max\(0\.14 \+ 0\.75 \+ 0\.18, 1\.07\);/);
  }
  assert.match(runtimeSrc, /const healingPresentation = Array\.isArray\(skill\.effects\)/);
  assert.match(runtimeSrc, /g\.NextHeroActionProfile = healingPresentation \|\| skill\.tags\?\.includes\('magic'\)/);
});
