const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('yellow sequence defines per-gem settle constants and bounce amp', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /const YELLOW_CASINO_SETTLE_SEC = 0\.14;/);
  assert.match(src, /const YELLOW_CASINO_SETTLE_BOUNCE_AMP = 0\.22;/);
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
