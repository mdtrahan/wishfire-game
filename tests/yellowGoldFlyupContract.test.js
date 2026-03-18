const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('yellow match reuses merge fly-up targeting Gold UI with no scale effect', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /casino\.goldMergeTarget =[\s\S]*?: getGoldLabelTargetWorld\(\);/);
  assert.match(src, /startGemMergeFx\(\{\s*target: casino\.goldMergeTarget \|\| getGoldLabelTargetWorld\(\),\s*scaleOut: false,/s);
});

test('gem merge renderer supports optional target and scaleOut toggle', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /if \(merge\.target && Number\.isFinite\(merge\.target\.x\) && Number\.isFinite\(merge\.target\.y\)\)/);
  assert.match(src, /const scaleOut = merge\.scaleOut !== false;/);
});
