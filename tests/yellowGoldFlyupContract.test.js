const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function readRuntimeSources() {
  return [
    fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'systems', 'renderRuntime.js'), 'utf8').replace(/\\n/g, '\n'),
  ].join('\n');
}

test('yellow match reuses merge fly-up targeting Gold UI with no scale effect', () => {
  const src = readRuntimeSources();
  assert.match(src, /casino\.goldMergeTarget =[\s\S]*?: getGoldLabelTargetWorld\(\);/);
  assert.match(src, /startGemMergeFx\(\{\s*target: casino\.goldMergeTarget \|\| getGoldLabelTargetWorld\(\),\s*scaleOut: false,/s);
});

test('gem merge renderer supports optional target and scaleOut toggle', () => {
  const src = readRuntimeSources();
  assert.match(src, /if \(merge\.target && Number\.isFinite\(merge\.target\.x\) && Number\.isFinite\(merge\.target\.y\)\)/);
  assert.match(src, /const scaleOut = merge\.scaleOut !== false;/);
});
