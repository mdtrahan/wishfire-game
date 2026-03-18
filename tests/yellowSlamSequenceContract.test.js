const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('yellow sequence uses regular fill cadence with no extra telegraph or spin delay', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /const YELLOW_CASINO_TELEGRAPH_SEC = 0;/);
  assert.match(src, /const yellowMatchAnimationDuration = 0;/);
  assert.match(src, /const YELLOW_CASINO_SPIN_SEC = yellowMatchAnimationDuration;/);
  assert.match(src, /const YELLOW_CASINO_SETTLE_SEC = 0\.16;/);
  assert.match(src, /const YELLOW_CASINO_SETTLE_BOUNCE_AMP = 0\.2;/);
  assert.match(src, /casino\.phase = hasWork \? \(YELLOW_CASINO_TELEGRAPH_SEC > 0 \? 'telegraph' : 'spin'\) : 'idle';/);
  assert.match(src, /newGem\.bounceAmp = YELLOW_CASINO_SETTLE_BOUNCE_AMP;/);
});

test('yellow sequence advances only after settle phase per item', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /item\.settleStarted = true;/);
  assert.match(src, /item\.settleUntil = nowTime \+ YELLOW_CASINO_SETTLE_SEC;/);
  assert.match(src, /if \(item\.settleStarted && nowTime >= item\.settleUntil\)/);
  assert.match(src, /traceTask015YellowAnimation\('yellow-sequence-item-settle'/);
});

test('yellow sequence no longer renders empty-slot preview circles during telegraph', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.doesNotMatch(src, /casino\.emptyTelegraph/);
  assert.doesNotMatch(src, /strokeStyle = '#ffffff';/);
});

test('yellow sequence no longer frame-walks through multiple colors before bounce settle', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.doesNotMatch(src, /function buildYellowCasinoSequence/);
  assert.doesNotMatch(src, /const seq = item\.sequence \|\| \[YELLOW_COLOR\];/);
  assert.doesNotMatch(src, /const frameIdx = item\.frameDuration > 0/);
  assert.match(src, /gem\.color = item\.target;/);
  assert.match(src, /casino\.ghost = \{ x: pos\.x, y: pos\.y, w: pos\.w, h: pos\.h, frame: item\.target \};/);
});
