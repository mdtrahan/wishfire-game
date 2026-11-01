import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFailures, failureDiff, diffLines, scanDiff, quantiles, perfDiff } from '../tools/verify_handoff_logic.mjs';

test('failure identities survive disposable paths and source-line moves', () => {
  const tap=(root,line)=>`TAP version 13\nnot ok 2 - preserves HP\n  ---\n  location: '${root}/tests/combat.test.mjs:${line}:4'\n  ---\nnot ok 3 - ${root}/tests/crash.test.mjs\n`;
  const a=parseFailures(tap('/tmp/base',12)),b=parseFailures(tap('/tmp/head',90));
  assert.deepEqual(a,b);assert.deepEqual(a,['npm::tests/crash.test.mjs','tests/combat.test.mjs::preserves HP']);
  assert.deepEqual(parseFailures('test combat::bounds ... FAILED\ntest combat::hit ... ok\n','cargo:wf_combat'),['cargo:wf_combat::combat::bounds']);
  assert.deepEqual(parseFailures('ok 1 - passing\n# fail 0'),[]);
});
test('failure-set diff never converts inherited failures into regressions', () => {
  assert.deepEqual(failureDiff(['old','same','same'],['same','new']),{new:['new'],fixed:['old'],stillFailing:['same']});
  assert.deepEqual(failureDiff([],[]),{new:[],fixed:[],stillFailing:[]});
});
test('diff scan preserves head line numbers and separates test review findings', () => {
  const diff=`diff --git a/web-runner/app.js b/web-runner/app.js\n--- a/web-runner/app.js\n+++ b/web-runner/app.js\n@@ -8,2 +8,5 @@\n unchanged\n-old\n+setTimeout(next, 0); // HACK\n+try { next(); } catch (error) {\n+}\n+window.__ORKA_NEW = true;\ndiff --git a/tests/a.test.mjs b/tests/a.test.mjs\n--- a/tests/a.test.mjs\n+++ b/tests/a.test.mjs\n@@ -1 +1 @@\n-assert.equal(n, 1);\n+assert.equal(n, 2);`;
  const rows=diffLines(diff);assert.equal(rows[0].line,9);assert.equal(rows.at(-1).line,1);
  const scan=scanDiff(diff,'D\ttests/removed.test.mjs\nR100\ttests/old.test.mjs\ttests/new.test.mjs\nM\ttests/multiline.test.mjs');
  for(const kind of ['empty catch','ordering timer','TODO/FIXME/HACK','new ORKA global'])assert.ok(scan.findings.some(f=>f.kind===kind),kind);
  assert.equal(scan.testChanges.length,5);assert.equal(scan.heuristic,true);
  assert.ok(scan.testChanges.some(c=>c.kind.startsWith('removed assertion')));
});
test('eight-line duplicate detector requires consecutive added source', () => {
  const code=Array.from({length:8},(_,i)=>`+const variable${i} = processValue(${i});`).join('\n');
  const diff=`+++ b/tools/a.mjs\n@@ -0,0 +1,8 @@\n${code}\n+++ b/tools/b.mjs\n@@ -0,0 +1,8 @@\n${code}`;
  assert.equal(scanDiff(diff).findings.filter(f=>f.kind.includes('duplicated')).length,1);
});
test('performance gate catches missing data, zero baselines and strict ten percent boundary', () => {
  const d=perfDiff({a:100,b:0,c:0,d:10,e:100},{a:110,b:0,c:1,d:null,e:111});
  assert.equal(d.a.regression,false);assert.equal(d.b.regression,false);assert.equal(d.c.regression,true);assert.equal(d.c.deltaPct,'Infinity');
  assert.equal(d.d.regression,true);assert.equal(d.e.regression,true);
  assert.deepEqual(quantiles([5,1,3,2,4]),{count:5,p50:3,p95:4,max:5});assert.equal(quantiles([]),null);
});
