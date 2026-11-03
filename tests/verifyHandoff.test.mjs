import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFailures, failureDiff, diffLines, scanDiff, quantiles, frameMetrics, perfDiff, PERF_THRESHOLDS, medianSpread, summarizeMetrics, selectBaseCache } from '../tools/verify_handoff_logic.mjs';
import { combatProbes } from '../tools/verify_handoff_probe.mjs';
import { sampleSteps } from '../tools/verify_handoff_step.mjs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    {pageLoadMs:50,frameP95:2,frameMean:2,frameDroppedRate:.05,stepP95:.2,heapGrowthBytes:5*1024*1024,wasmBytes:64*1024});
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
  assert.equal(compare('frameP95', 10, 10).status, 'PASS');
});

test('missing measurements and repeated spreads fail closed', () => {
  assert.equal(compare('stepP95', 10, null).status, 'FAIL');
  assert.equal(compare('wasmBytes', undefined, 100).status, 'FAIL');
  assert.equal(compare('pageLoadMs', 100, 200, [100, null, 100]).status, 'FAIL');
  assert.equal(perfDiff({pageLoadMs:100}, {pageLoadMs:100}).pageLoadMs.status, 'FAIL');
  assert.equal(Object.keys(perfDiff({}, {})).length, 7);
  assert.ok(Object.values(perfDiff({}, {})).every(p => p.regression));
});

test('every metric needs separated run ranges before declaring a regression', () => {
  for (const [key, {absolute}] of Object.entries(PERF_THRESHOLDS)) {
    assert.equal(compare(key, absolute, absolute * 3, [absolute, absolute, absolute * 4], [absolute * 2, absolute * 3, absolute * 4]).status, 'INCONCLUSIVE', key);
  }
});

test('frame mean and over-budget share accompany quantized one-bucket uncertainty', () => {
  assert.deepEqual(frameMetrics([16.6, 16.7, 33.3]), {frameMean: 22.2, frameDroppedRate: 1/3, frameQuantized: 1});
  assert.equal(frameMetrics([11, 12, 13]).frameQuantized, 0);
  const base = {...frameMetrics([16.7, 16.7, 16.8]), frameP95:16.8};
  const head = {...frameMetrics([33.3, 33.4, 33.4]), frameP95:33.4};
  const summarize = m => summarizeMetrics([m,m,m].map(metrics => ({metrics})));
  const b = summarize(base), h = summarize(head);
  const result = perfDiff(b.metrics, h.metrics, b.spreads, h.spreads);
  for(const key of ['frameP95','frameMean','frameDroppedRate']) assert.equal(result[key].status, 'INCONCLUSIVE', key);
  assert.equal(compare('frameP95',16.8,33.4).status,'FAIL','nonquantized clear slowdown still fails');
});

test('binary timestamp residue cannot count as a dropped frame', () => {
  const frames = [33.4-16.7,50.1-33.4,66.8-50.1,16.700000000003,16.8,33.3];
  assert.equal(frameMetrics(frames).frameDroppedRate,2/6);
});

test('same-SHA mocked sampler runs ABABAB freshly and never reports a perf regression', async () => {
  const out = await mkdtemp(join(tmpdir(), 'handoff-control-test-'));
  let index = 0;
  const seen = [];
  const sampler = async root => {
    seen.push(root);const n = index++ % 2 ? 400 : 100;
    return {metrics:Object.fromEntries(Object.keys(PERF_THRESHOLDS).map(k=>[k,n * (k === 'heapGrowthBytes' ? 1024*1024 : 1)])),
      coverage:{complete:true},claims:{noConsoleErrors:{status:'PASS',measured:0}},errors:[]};
  };
  try {
    const result = await combatProbes({base:'same-sha',head:'same-sha'}, {base:join(out,'base'),head:join(out,'head')},1,7,sampler,async()=>({metrics:{}}));
    assert.deepEqual(result.order,['base','head','base','head','base','head']);
    assert.deepEqual(seen,Array(6).fill('same-sha'));
    assert.equal(result.base.runs.length,3);assert.equal(result.head.runs.length,3);
    const {base:b,head:h} = result;
    const perf = perfDiff(b.metrics,h.metrics,b.spreads,h.spreads,{sameRef:true});
    assert.ok(Object.values(perf).every(p=>['PASS','INCONCLUSIVE'].includes(p.status)));
    assert.equal(perfDiff(b.metrics,h.metrics,b.spreads,h.spreads).stepP95.status,'FAIL','distinct refs retain the regression gate');
  } finally { await rm(out,{recursive:true,force:true}); }
});

test('base cache reuses SHA-matched npm failures and always discards old performance evidence', () => {
  const cache = {schema:1,sha:'abc',npm:{step:{status:1},failures:['test::old']},
    result:{suites:{steps:[{name:'npm-test',status:1}]},
      probes:{runs:[{},{},{}],coverage:{complete:true},errors:[]}}};
  const selected = selectBaseCache(cache,'abc');
  assert.equal(selected.result,null);assert.deepEqual(selected.npm.failures,['test::old']);
  assert.equal(selectBaseCache(cache,'other'),null);
  assert.equal(selectBaseCache({...cache,schema:0},'abc'),null);
  assert.equal(selectBaseCache({...cache,npm:{...cache.npm,failures:[]}},'abc'),null);
  assert.equal(selectBaseCache({...cache,npm:{...cache.npm,failures:['npm::UNPARSED_SUITE_FAILURE']}},'abc'),null);
});

test('Rust batch samples divide high-resolution totals by 300 steps', async () => {
  const stats = {hp:1000,atk:0,def:5,speed:100,reach:80,interval:.5,evade:0,special:10};
  const config = {encounter_id:'perf-batch-test',seed:'7',
    geometry:{floor:{min:{x:96,y:40},max:{x:864,y:1592}},viewport_world:{x:720,y:1280},formation_origin:{x:480,y:800},screen_bound:false},
    heroes:[{instance_id:'fara-1',definition_id:'slice.hero.fara',slot:0,formation_offset:{x:0,y:0},stats,hp:1000}],
    enemies:[{spawn_key:'orc-1',definition_id:'slice.enemy.orc',position:{x:480,y:700},stats,hp:1000}]};
  const result = await sampleSteps(new URL('..',import.meta.url).pathname,config,{batches:3});
  assert.equal(result.timing.clock,'process.hrtime.bigint');
  assert.equal(result.timing.totals.length,3);
  for (const [i,total] of result.timing.totals.entries()) {
    assert.equal(total.steps,300);assert.ok(total.elapsedNs>0);
    assert.equal(result.timing.perStepMs[i],total.elapsedNs/1e6/300);
  }
  assert.equal(result.metrics.stepP95,quantiles(result.timing.perStepMs).p95);
  assert.equal(result.metrics.stepMean,result.timing.perStepMs.reduce((a,b)=>a+b,0)/3);
});

// A baseline can own a different provenance schema from the sampler's checkout.
test('Rust batch samples validate provenance with the sampled revision before loading the ABI', async () => {
  const root = await mkdtemp(join(tmpdir(), 'handoff-provenance-test-'));
  try {
    await mkdir(join(root, 'tools'));
    await writeFile(join(root, 'source.txt'), 'matched');
    await writeFile(join(root, 'tools/build_wasm_support.mjs'), `
      import { readFileSync } from 'node:fs';
      import { join } from 'node:path';
      export function readWasmRelease(root) {
        if (readFileSync(join(root, 'source.txt'), 'utf8') !== 'matched')
          throw Error('revision-local source provenance mismatch');
      }
    `);
    await assert.rejects(sampleSteps(root, null), /Missing observed Rust encounter config/);
    await writeFile(join(root, 'source.txt'), 'stale');
    await assert.rejects(sampleSteps(root, null), /revision-local source provenance mismatch/);
  } finally { await rm(root, {recursive:true,force:true}); }
});
