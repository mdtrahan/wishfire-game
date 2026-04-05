const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('hp bar animation module uses GSAP with front and lag timing split', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'hpBarAnimation.mjs'), 'utf8');
  assert.match(src, /import\s+\{\s*gsap\s*\}\s+from\s+'\.\/gsapShim\.mjs';/);
  assert.match(src, /const targetPercent = clampPercent\(\(Number\(current \|\| 0\) \/ safeMax\) \* 100\);/);
  assert.match(src, /const isDamage = targetPercent < previousLag;/);
  assert.match(src, /const lagDelay = isDamage \? 0\.15 : 0\.05;/);
  assert.match(src, /const lagDuration = isDamage \? 0\.6 : 0\.45;/);
  assert.match(src, /const lagEase = isDamage \? 'power2\.out' : 'sine\.out';/);
  assert.match(src, /gsap\.killTweensOf\(\[frontBar, lagBar\]\);/);
  assert.match(src, /duration: 0\.2,/);
  assert.match(src, /repeat: 1,/);
  assert.doesNotMatch(src, /transformOrigin:/);
});

test('app adapts the party HP bar through immediate front and lag state', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /import\s+\{\s*updateHP as updateAnimatedHP\s*\}\s+from\s+'\.\/src\/core\/hpBarAnimation\.mjs';/);
  assert.match(src, /function getPartyHpFrontColor\(ratio\) \{/);
  assert.match(src, /if \(clamped >= 0\.7\) return '#7BCB47';/);
  assert.match(src, /if \(clamped >= 0\.3\) return '#EBE413';/);
  assert.match(src, /return '#DC3030';/);
  assert.match(src, /const partyHpBarAnim = \{/);
  assert.match(src, /front: \{ percent: 100, scaleY: 1 \},/);
  assert.match(src, /lag: \{ percent: 100 \},/);
  assert.match(src, /hotOverlayUntil: 0,/);
  assert.match(src, /updateAnimatedHP\(\{\s*current: enemy\.hp,/s);
  assert.match(src, /partyHpBarAnim\.lastTargetPercent = syncPartyHpBarImmediate\(\s*state\.globals\.PartyHP \|\| 0,/s);
  assert.match(src, /ctx\.fillStyle = '#b7d14f';/);
  assert.match(src, /const partyFrontColor = getPartyHpFrontColor\(frontRatio\);/);
  assert.match(src, /partyHpBarAnim\.hotOverlayUntil = Math\.max\(/);
  assert.match(src, /const hotOverlayRemaining = Math\.max\(0, Number\(partyHpBarAnim\.hotOverlayUntil \|\| 0\) - Number\(state\.globals\.time \|\| 0\)\);/);
  assert.match(src, /ctx\.fillStyle = partyFrontColor;/);
  assert.match(src, /ctx\.fillStyle = '#6BFFB0';/);
  assert.doesNotMatch(src, /SpawnDamageText', actualHeal, textX, textY, 'heal', 'bar'/);
});
