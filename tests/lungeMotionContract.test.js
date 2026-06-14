const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('combat lunge motion uses a later impact handoff instead of overlapping lunge and flinch beats', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const animationSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'animationMath.js'), 'utf8');
  const renderRuntimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  const idleFarmSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderIdleFarm.js'), 'utf8');

  assert.match(animationSrc, /export const LUNGE_FORWARD_SEC = 0\.75;/);
  assert.match(animationSrc, /export const LUNGE_FORWARD_DIST_PX = 200;/);
  assert.match(animationSrc, /export const HERO_LUNGE_FORWARD_DIST_PX = LUNGE_FORWARD_DIST_PX \* 0\.85;/);
  assert.match(animationSrc, /export const LUNGE_IMPACT_HANDOFF_SEC = 0\.08;/);
  assert.match(animationSrc, /export function easeLungeForward\(t\) \{\s+return evaluateCubicBezier\(t, 1, 0, 0, 1\);\s+\}/s);
  assert.match(src, /import \* as animationMath from '\.\/systems\/animationMath\.js';/);
  assert.match(idleFarmSrc, /const offsetX = isStriking \? computeLungeOffset\(actionT, 1, heroMaxLungeDist\) : 0;/);
  assert.match(idleFarmSrc, /const enemyMaxLungeDist = Math\.max\(0, Math\.min\(animationMath\.LUNGE_FORWARD_DIST_PX, anchor\.x - battleMidpointX\)\);/);
  assert.match(idleFarmSrc, /const shiftX = isAttacking \? computeLungeOffset\(actionT, -1, enemyMaxLungeDist\) : 0;/);
  assert.match(renderRuntimeSrc, /heroAction\.forwardX = Math\.min\(targetX, baseX \+ animationMath\.HERO_LUNGE_FORWARD_DIST_PX\);/);
  assert.match(renderRuntimeSrc, /const lungeDur = animationMath\.LUNGE_FORWARD_SEC;/);
  assert.match(renderRuntimeSrc, /const e = animationMath\.easeLungeForward\(t\);/);
  assert.match(renderRuntimeSrc, /const followUpLead = animationMath\.LUNGE_ANTICIPATION_SEC \+ animationMath\.LUNGE_FORWARD_SEC \+ animationMath\.LUNGE_IMPACT_HANDOFF_SEC;/);
  assert.match(idleFarmSrc, /actionT >= \(\(animationMath\.LUNGE_ANTICIPATION_SEC \+ animationMath\.LUNGE_FORWARD_SEC \+ animationMath\.LUNGE_IMPACT_HANDOFF_SEC\) \/ animationMath\.LUNGE_TOTAL_SEC\)/);
});

test('direct AOE hero lunge profile gets extra hold and retreat breathing room', () => {
  const renderRuntimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8');
  const runtimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'), 'utf8');
  const scriptsSrc = fs.readFileSync(path.join(__dirname, '..', 'Scripts', 'functionBank.js'), 'utf8');

  assert.match(renderRuntimeSrc, /const isAoeProfile = String\(heroAction\.profile \|\| 'single'\) === 'aoe';/);
  assert.match(renderRuntimeSrc, /const holdDur = isAoeProfile \? 0\.24 : animationMath\.LUNGE_HOLD_SEC;/);
  assert.match(renderRuntimeSrc, /const retreatDur = isAoeProfile \? 0\.42 : animationMath\.LUNGE_RETREAT_SEC;/);

  for (const src of [runtimeSrc, scriptsSrc]) {
<<<<<<< HEAD
    assert.match(src, /g\.NextHeroActionProfile = skillId === 'HERO_AOE' \? 'aoe' : 'single';/);
=======
    assert.match(src, /g\.NextHeroActionProfile = skillId === 'HERO_AOE'\s+\? 'aoe'\s+: 'single';/s);
>>>>>>> bead/ORKA-c6zn-park-main-dirt
    assert.match(src, /const profile = String\(g\.NextHeroActionProfile \|\| 'single'\);/);
    assert.match(src, /const totalDur = profile === 'aoe'\s+\? 0\.14 \+ 0\.75 \+ 0\.24 \+ 0\.42\s+: 0\.14 \+ 0\.75 \+ 0\.16 \+ 0\.26;/s);
    assert.match(src, /const hitDelay = Math\.max\(0\.14 \+ 0\.75 \+ 0\.18, 1\.07\);/);
  }
});
