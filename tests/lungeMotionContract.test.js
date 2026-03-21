const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('combat lunge motion uses a later impact handoff instead of overlapping lunge and flinch beats', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');

  assert.match(src, /const LUNGE_FORWARD_SEC = 0\.75;/);
  assert.match(src, /const LUNGE_FORWARD_DIST_PX = 200;/);
  assert.match(src, /const HERO_LUNGE_FORWARD_DIST_PX = LUNGE_FORWARD_DIST_PX \* 0\.85;/);
  assert.match(src, /const LUNGE_IMPACT_HANDOFF_SEC = 0\.08;/);
  assert.match(src, /function easeLungeForward\(t\) \{\s+return evaluateCubicBezier\(t, 1, 0, 0, 1\);\s+\}/s);
  assert.match(src, /const battleMidpointX = battleFrame\.x \+ battleFrame\.w \* 0\.5;/);
  assert.match(src, /const heroMaxLungeDist = Math\.max\(0, Math\.min\(HERO_LUNGE_FORWARD_DIST_PX, battleMidpointX - slot\.x\)\);/);
  assert.match(src, /const offsetX = isStriking \? computeLungeOffset\(actionT, 1, heroMaxLungeDist\) : 0;/);
  assert.match(src, /const enemyMaxLungeDist = Math\.max\(0, Math\.min\(LUNGE_FORWARD_DIST_PX, anchor\.x - battleMidpointX\)\);/);
  assert.match(src, /const shiftX = isAttacking \? computeLungeOffset\(actionT, -1, enemyMaxLungeDist\) : 0;/);
  assert.match(src, /enemyAction\.forwardX = Math\.max\(layoutW \/ 2, enemy\.originX - lungeDist\);/);
  assert.match(src, /heroAction\.forwardX = Math\.min\(targetX, baseX \+ HERO_LUNGE_FORWARD_DIST_PX\);/);
  assert.match(src, /const lungeDur = LUNGE_FORWARD_SEC;/);
  assert.match(src, /const e = easeLungeForward\(t\);/);
  assert.match(src, /const followUpLead = LUNGE_ANTICIPATION_SEC \+ LUNGE_FORWARD_SEC \+ LUNGE_IMPACT_HANDOFF_SEC;/);
  assert.match(src, /actionT >= \(\(LUNGE_ANTICIPATION_SEC \+ LUNGE_FORWARD_SEC \+ LUNGE_IMPACT_HANDOFF_SEC\) \/ LUNGE_TOTAL_SEC\)/);
});

test('green AOE hero lunge profile gets extra hold and retreat breathing room', () => {
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const runtimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'), 'utf8');
  const scriptsSrc = fs.readFileSync(path.join(__dirname, '..', 'Scripts', 'functionBank.js'), 'utf8');

  assert.match(appSrc, /const isAoeProfile = String\(heroAction\.profile \|\| 'single'\) === 'aoe';/);
  assert.match(appSrc, /const holdDur = isAoeProfile \? 0\.24 : LUNGE_HOLD_SEC;/);
  assert.match(appSrc, /const retreatDur = isAoeProfile \? 0\.42 : LUNGE_RETREAT_SEC;/);

  for (const src of [runtimeSrc, scriptsSrc]) {
    assert.match(src, /g\.NextHeroActionProfile = skillId === 'HERO_AOE' \? 'aoe' : 'single';/);
    assert.match(src, /const profile = String\(g\.NextHeroActionProfile \|\| 'single'\);/);
    assert.match(src, /const totalDur = profile === 'aoe'\s+\? 0\.14 \+ 0\.75 \+ 0\.24 \+ 0\.42\s+: 0\.14 \+ 0\.75 \+ 0\.16 \+ 0\.26;/s);
    assert.match(src, /const hitDelay = Math\.max\(0\.14 \+ 0\.75 \+ 0\.18, 1\.07\);/);
  }
});
