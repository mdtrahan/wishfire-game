const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const load = (relPath) => import(pathToFileURL(path.join(repoRoot, relPath)).href);

test('gsap shim interpolates tween values over time instead of snapping immediately', async () => {
  const { gsap } = await load('web-runner/src/core/gsapShim.mjs');
  const target = { x: 0 };
  let completed = false;

  gsap.timeline({
    onComplete() {
      completed = true;
    },
  }).to(target, {
    x: 100,
    duration: 0.06,
    ease: 'linear',
  });

  assert.equal(completed, false);
  await delay(50);
  assert.ok(target.x > 0 && target.x < 100);
  assert.equal(completed, false);
  await delay(120);
  assert.equal(Math.round(target.x), 100);
  assert.equal(completed, true);
});

test('enemy HP tween state advances smoothly across front and lag bars', async () => {
  const { updateHP } = await load('web-runner/src/core/hpBarAnimation.mjs');
  const frontBar = { percent: 100, scaleY: 1 };
  const lagBar = { percent: 100 };

  const result = updateHP({
    current: 40,
    max: 100,
    frontBar,
    lagBar,
  });

  assert.equal(result.targetPercent, 40);
  await delay(80);
  assert.ok(frontBar.percent < 100 && frontBar.percent > 40);
  assert.equal(lagBar.percent, 100);
  await delay(220);
  assert.ok(lagBar.percent < 100 && lagBar.percent > 40);
  await delay(500);
  assert.equal(Math.round(frontBar.percent), 40);
  assert.equal(Math.round(lagBar.percent), 40);
});


test('gsap shim preserves pre-existing DOM transforms while composing animated offsets', async () => {
  const { gsap } = await load('web-runner/src/core/gsapShim.mjs');
  const target = { style: { transform: 'translate(-50%, -50%)', opacity: '0' } };

  gsap.set(target, { x: 0, y: -10, opacity: 1 });
  assert.match(target.style.transform, /translate\(-50%, -50%\)/);
  assert.match(target.style.transform, /translateY\(-10px\)/);
  assert.equal(target.style.opacity, '1');
});
