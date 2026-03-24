const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('gold collect animation module uses a single continuous GSAP timeline with curved pull-in', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'goldCollectAnimation.mjs'), 'utf8');
  assert.match(src, /import\s+\{\s*gsap\s*\}\s+from\s+'..\/..\/..\/node_modules\/gsap\/index\.js';/);
  assert.match(src, /const distance = random\(36, 72\);/);
  assert.match(src, /const delay = random\(0, 0\.12\);/);
  assert.match(src, /function cubicBezierPoint\(start, controlA, controlB, end, t\)/);
  assert.match(src, /duration: 0\.3,/);
  assert.match(src, /ease: 'power2\.out'/);
  assert.match(src, /const hoverDelay = random\(0\.05, 0\.12\);/);
  assert.match(src, /ease: 'sine\.out'/);
  assert.match(src, /const travel = \{ t: 0 \};/);
  assert.match(src, /travel\.startX = Number\(state\.x \|\| 0\);/);
  assert.match(src, /travel\.startY = Number\(state\.y \|\| 0\);/);
  assert.match(src, /const easeBlend = gsap\.parseEase\('sine\.inOut'\);/);
  assert.match(src, /const easeFinish = gsap\.parseEase\('expo\.in'\);/);
  assert.match(src, /state\.x = cubicBezierPoint\(/);
  assert.match(src, /state\.y = cubicBezierPoint\(/);
  assert.doesNotMatch(src, /const midX =/);
  assert.doesNotMatch(src, /ease: 'power2\.in'/);
});

test('app gold collection path uses dedicated gold_collect mode instead of the default merge path', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /import\s+\{\s*createGoldCollectAnimation\s*\}\s+from\s+'\.\/src\/core\/goldCollectAnimation\.mjs';/);
  assert.match(src, /function startGemMergeFx\(\{ target = null, scaleOut = true, startScale = 1, sourceItems = null, mode = 'default', projectToCanvas = null \} = \{\}\)/);
  assert.match(src, /const targetPos = projectToCanvas\(target\.x, target\.y\);/);
  assert.match(src, /const pos = projectToCanvas\(item\.x, item\.y\);/);
  assert.match(src, /mode: 'gold_collect',/);
  assert.match(src, /projectToCanvas: worldToCanvas,/);
  assert.match(src, /if \(merge\.mode === 'gold_collect' && merge\.animation\) \{/);
});
