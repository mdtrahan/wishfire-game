const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function sliceBetween(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return src.slice(start, end);
}

test('heal bloom module uses a staggered upward GSAP fountain instead of a radial burst', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'healBloomAnimation.mjs'), 'utf8');
  assert.match(src, /import\s+\{\s*gsap\s*\}\s+from\s+'\.\/gsapShim\.mjs';/);
  assert.match(src, /glyph: '➕',/);
  assert.match(src, /fontWeight: 800,/);
  assert.match(src, /color: '#A0FE0B',/);
  assert.match(src, /const total = Math\.max\(8, Math\.min\(14, Math\.floor\(Number\(count \|\| 12\)\)\)\);/);
  assert.match(src, /const HEAL_BLOOM_WIDTH_SCALE = 0\.8;/);
  assert.match(src, /targetUID: Number\(targetUID \|\| 0\),/);
  assert.match(src, /ownerUID: Number\(ownerUID \|\| targetUID \|\| 0\),/);
  assert.match(src, /presentation: presentation === 'major' \? 'major' : 'minor',/);
  assert.match(src, /const tl = gsap\.timeline\(\);/);
  assert.match(src, /const dx = random\(-24, 24\) \* HEAL_BLOOM_WIDTH_SCALE;/);
  assert.match(src, /const dy = -random\(44, 78\);/);
  assert.match(src, /const delay = \(i \/ total\) \* 0\.22;/);
  assert.match(src, /const riseDuration = 1\.05 - delay;/);
  assert.doesNotMatch(src, /tl\.delay\(delay\)/);
  assert.match(src, /ease: 'sine\.out',\n\s*\}, delay\);/);
  assert.match(src, /duration: riseDuration,/);
  assert.match(src, /ease: 'sine\.out'/);
  assert.match(src, /ease: 'sine\.inOut'/);
  assert.doesNotMatch(src, /back\.out|power2\.out/);
  assert.match(src, /const rotation = random\(-12, 12\);/);
});

test('heal bloom marks its owner and clears after the final particle completes', async () => {
  const { createHealBloom } = await import('../web-runner/src/core/healBloomAnimation.mjs');
  const animation = createHealBloom({ x: 88, y: 144, targetUID: 17, ownerUID: 3, count: 8, presentation: 'major' });
  assert.equal(animation.targetUID, 17);
  assert.equal(animation.ownerUID, 3);
  assert.equal(animation.complete, false);
  await new Promise(resolve => setTimeout(resolve, 1600));
  assert.equal(animation.complete, true);
});
