# Handoff performance evidence

`tools/verify_handoff.mjs` retains its CLI, JSON/Markdown reports and exit codes
(PASS 0, FAIL 1, INCONCLUSIVE 2). Both revisions are built before measurement.
Three fresh trials per revision run in **ABABAB** order, including quick mode.
Quick mode may reuse the exact base SHA's parsed npm failure set. Performance
samples always run again. Trials use fresh Chromium contexts and seed 7 by default.

## Measurements

- Frames: report mean, p95 and fraction of RAF intervals over **16.7 ms**,
  allowing1 ns for floating-point subtraction residue.
  This is an observed over-budget fraction. Timestamp jitter near the boundary
  can count a nominal 60 Hz frame. Keep it alongside the mean and quantization flag.
- Rust steps: replay the observed boss config in the revision's rebuilt WASM and
  its own `combatBridge.mjs`. After three warmup batches, time 30 batches of
  300 steps using `process.hrtime.bigint()`. Each sample is batch milliseconds
  divided by 300. Mean and p95 summarize those per-step samples. This measures
  the complete bridge step, including JSON ABI transport. It is a repeatable
  seeded CPU measurement separate from live rendering; it does not isolate
  internal Rust functions. Batch totals and exact step counts remain in JSON.
- Heap: CDP `HeapProfiler.collectGarbage` precedes both
  `Runtime.getHeapUsage` readings. End growth excludes the released observer
  arrays, which are copied into the trace first. This reports retained JS heap
  growth; WASM linear memory and GPU memory remain outside this metric.

## Verdict rule

Each metric uses the median of three trial values and their full min/max range.
A regression requires an increase **strictly above both 10% and its absolute
threshold**, with disjoint base/head trial ranges. A threshold breach with
overlapping ranges is INCONCLUSIVE. Increases within either threshold pass.

Absolute thresholds: page load 50 ms, frame p95/mean 2 ms, frame over-budget
fraction 0.05 (five percentage points), step p95 0.2 ms, retained heap 5 MiB,
WASM size 64 KiB. Step mean is also reported for interpretation.

A trial is vsync-quantized when at least 90% of frame intervals lie within
0.5 ms of positive multiples of 1000/60 ms. When both revisions' median flags
are quantized and their median p95 values differ by one bucket (within 1 ms),
all frame comparisons are INCONCLUSIVE. This avoids turning a bucket shift
into a confident failure; a repeat on a quiet host can resolve the uncertainty.

Same-SHA comparisons are controls: an apparent threshold breach is
INCONCLUSIVE, even if ranges separate, because host drift cannot demonstrate a
code regression against identical code. Missing samples, failed batch replay
and incomplete coverage still fail closed. Suite/claim failures retain their
independent verdicts. This range rule is a conservative heuristic rather than
a confidence interval or proof of equivalence. Three trials cannot establish
device-wide performance or detect every regression.

`node --test tests/verifyHandoff.test.mjs` exercises threshold boundaries,
range overlap for every metric, one-bucket ambiguity, fresh ABABAB ordering,
an adversarial mocked same-SHA control and actual 300-step batch arithmetic.

## ORKA-grbr real proof

The quick comparison of `fbaab92fa70b06944772d80bac9e88ae84cfb827` against
`35bc788ee11cb77ceb3cc2484f3ce183525f3ce6` ran fresh ABABAB,60 seconds per
trial,seed7. Every trial has complete coverage and all five observation claims
pass. Each step trial contains30 measured batches of300 steps. All seven
performance gates **PASS**; elapsed time **2086.826 seconds** includes builds
and functional suites. Evidence: `/tmp/verify-ORKA-grbr-comparison/report.json`
and `report.md`, with traces in each revision's `run-1` through `run-3`.

- Frame mean:18.824875 →19.556863 ms; p95:33.3 →33.4 ms.
- Frames over16.7 ms:16.802253% →21.160743%.
- Step mean:0.199514 →0.209586 ms; batch-derived p95:0.274122 →0.339791 ms.
- Retained heap growth:2,382,628 →3,831,684 bytes (2.272 →3.654 MiB).
  Trial ranges overlap:1,678,148–4,650,604 versus1,894,828–8,373,976 bytes.
- Page load:94.4 →95.6 ms; WASM:611,157 →661,104 bytes.

Full handoff verdict remains **FAIL** because two suite failure identities are
new relative to the cached base: the lab oracle-import contract and the renamed
party-target-bias contract. The report retains their full names and19 inherited
failures. Their attribution is outside this harness-performance task. Passing
these performance gates establishes no source-wide functional acceptance.

The real `35bc788e` →`35bc788e` control **PASS** took **1516.131 seconds**,
using the same sampler and verdict functions with six fresh60-second trials.
It reuses the comparison's exact rebuilt head WASM and pinned dependencies in
an owned detached checkout; functional suites were not rerun. All coverage is
complete, with zero probe errors. Every metric also passes with the same-SHA
guard disabled. Frame mean:21.125428 →20.779449 ms; p95:33.4 →33.4 ms;
over-budget share:28.016789% →25.989673%. Step mean:0.366180 →0.319176 ms;
p95:0.524116 →0.432772 ms. Retained heap growth:4,709,104 →4,363,696 bytes.
Evidence: `/tmp/verify-ORKA-grbr-control/report.json` and `report.md`.

Both reports' frame counts were recalculated from their unchanged raw traces
after a boundary check found861 nominal16.7-ms frames classified over budget
through binary subtraction residue in the first base trial. The final helper's
1-ns tolerance removes that artifact. Original reports remain as
`report-before-frame-epsilon.json`/`.md`; `analysis` records this derivation.
Every frame statistic and gate was recomputed with the final harness functions.
Fourteen focused tests pass, including the new floating-point boundary case.
