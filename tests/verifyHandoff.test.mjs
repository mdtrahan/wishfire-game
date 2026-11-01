import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFailures, failureDiff, diffLines, scanDiff, quantiles, perfDiff, PERF_THRESHOLDS, medianSpread, summarizeMetrics, selectBaseCache } from '../tools/verify_handoff_logic.mjs';

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
test('three-run median ignores one outlier and reports sorted min/max spread', () => {
  const values = [117, 101, 900];
  assert.deepEqual(medianSpread(values), { median: 117, min: 101, max: 900, samples: [101, 117, 900] });
  assert.deepEqual(values, [117, 101, 900]);
  for (const bad of [[], [1, 2], [1, 2, NaN], [1, 2, null], [1, 2, Infinity], [1, 2, 3, 4]]) assert.equal(medianSpread(bad), null);
  const summary = summarizeMetrics(values.map(n => ({ metrics: { pageLoadMs: n, frameP95: n / 10 } })));
  assert.equal(summary.metrics.pageLoadMs, 117);assert.equal(summary.metrics.frameP95, 11.7);
  assert.equal(summary.metrics.stepP95, null);
  assert.deepEqual(quantiles([5,1,3,2,4]),{count:5,p50:3,p95:4,max:5});assert.equal(quantiles([]),null);
});

function compare(key, base, head, baseSamples = [base, base, base], headSamples = [head, head, head]) {
  return perfDiff({ [key]: base }, { [key]: head },
    { [key]: medianSpread(baseSamples) }, { [key]: medianSpread(headSamples) })[key];
}

test('every gate requires both strict relative and absolute increases', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(PERF_THRESHOLDS).map(([k,v]) => [k,v.absolute])),
    {pageLoadMs:50,frameP95:2,stepP95:.2,heapGrowthBytes:5*1024*1024,wasmBytes:64*1024});
  for (const [key, { absolute, relativePct }] of Object.entries(PERF_THRESHOLDS)) {
    assert.equal(relativePct, 10);
    const b = absolute * 100;
    assert.equal(compare(key, b, b + absolute * 2).status, 'PASS', key + ': absolute alone');
    assert.equal(compare(key, absolute, absolute * 2).status, 'PASS', key + ': exact absolute');
    assert.equal(compare(key, b, b + b / 10).status, 'PASS', key + ': exact relative');
    assert.equal(compare(key, absolute, absolute * 2.01).status, 'FAIL', key + ': both exceeded');
    assert.equal(compare(key, absolute, 0).status, 'PASS', key + ': improvement');
    assert.equal(compare(key, 0, absolute * 2).status, 'FAIL', key + ': zero baseline');
    assert.equal(compare(key, 0, absolute / 2).status, 'PASS', key + ': zero baseline noise');
  }
  assert.equal(compare('pageLoadMs', 101, 117).status, 'PASS');
  assert.equal(compare('stepP95', .6, .8).status, 'PASS', 'decimal absolute boundary');
});

test('overlapping repeated spreads are inconclusive even when both thresholds exceed', () => {
  const d = compare('pageLoadMs', 100, 200, [90, 100, 210], [190, 200, 220]);
  assert.equal(d.status, 'INCONCLUSIVE');assert.equal(d.regression, false);
  assert.equal(compare('frameP95', 10, 20, [9, 10, 20], [20, 20, 30]).status, 'INCONCLUSIVE');
  assert.equal(compare('frameP95', 10, 20, [9, 10, 11], [19, 20, 21]).status, 'FAIL');
  assert.equal(compare('frameP95', 10, 10).status, 'INCONCLUSIVE');
});

test('missing measurements and repeated spreads fail closed', () => {
  assert.equal(compare('stepP95', 10, null).status, 'FAIL');
  assert.equal(compare('wasmBytes', undefined, 100).status, 'FAIL');
  assert.equal(compare('pageLoadMs', 100, 200, [100, null, 100]).status, 'FAIL');
  assert.equal(perfDiff({pageLoadMs:100}, {pageLoadMs:100}).pageLoadMs.status, 'FAIL');
  assert.equal(Object.keys(perfDiff({}, {})).length, 5);
  assert.ok(Object.values(perfDiff({}, {})).every(p => p.regression));
});

test('base cache requires exact SHA and parsed npm failures; probe reuse also pins scenario and crates', () => {
  const scenario = {seed:7,seconds:60},crates = ['wf_combat'];
  const cache = {schema:1,sha:'abc',npm:{step:{status:1},failures:['test::old']},
    result:{scenario,crates,suites:{steps:[{name:'npm-test',status:1}]},
      probes:{runs:[{},{},{}],coverage:{complete:true},errors:[]}}};
  assert.equal(selectBaseCache(cache,'abc',scenario,crates).result,cache.result);
  assert.equal(selectBaseCache(cache,'other',scenario,crates),null);
  assert.equal(selectBaseCache({...cache,npm:{...cache.npm,failures:[]}},'abc',scenario,crates),null);
  assert.equal(selectBaseCache({...cache,npm:{...cache.npm,failures:['npm::UNPARSED_SUITE_FAILURE']}},'abc',scenario,crates),null);
  for (const [s,c] of [[{seed:8,seconds:60},crates],[{seed:7,seconds:30},crates],[scenario,[]]]) {
    const selected = selectBaseCache(cache,'abc',s,c);
    assert.equal(selected.result,null);assert.deepEqual(selected.npm.failures,['test::old']);
  }
  const failed = structuredClone(cache);failed.result.suites.steps.push({name:'wasm-build',status:1});
  assert.equal(selectBaseCache(failed,'abc',scenario,crates).result,null);
  const noSamples = structuredClone(cache);noSamples.result.probes.runs.pop();
  assert.equal(selectBaseCache(noSamples,'abc',scenario,crates).result,null);
});
