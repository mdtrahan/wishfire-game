const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('idle loot adapter gives gold a 40 percent share and rescales non-gold tiers proportionally', () => {
  const runtimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'src', 'core', 'idleFarmRuntime.mjs'), 'utf8');
  assert.match(runtimeSrc, /const IDLE_GOLD_SHARE = 40;/);
  assert.match(runtimeSrc, /const IDLE_TIER_WEIGHTS = \[2, 8, 20, 70\];/);
  assert.match(runtimeSrc, /const IDLE_NON_GOLD_SCALE = \(100 - IDLE_GOLD_SHARE\) \/ IDLE_TIER_WEIGHTS\.reduce\(\(a, b\) => a \+ b, 0\);/);
  assert.match(runtimeSrc, /const weights = IDLE_TIER_WEIGHTS\.map\(\(weight\) => weight \* IDLE_NON_GOLD_SCALE\);/);
  assert.match(runtimeSrc, /if \(\(Math\.random\(\) \* 100\) < IDLE_GOLD_SHARE\) return 'ITEM\.GOLD';/);
});
