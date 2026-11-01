// Pure report logic. Findings are review prompts, never automatic edits.
export function parseFailures(text, suite = 'npm') {
  const failures = new Set();
  if (suite !== 'npm') {
    for (const m of text.matchAll(/^test (.+?) \.\.\. FAILED\s*$/gm)) failures.add(`${suite}::${m[1]}`);
  } else {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = /^\s*not ok \d+ - (.+?)(?: # .*)?$/.exec(lines[i]);
      if (!m) continue;
      const diagnostic = lines.slice(i + 1, i + 28).join('\n');
      const file = /location: ['"]?[^\n]*?[/\\](tests[/\\][^'"\n:]+)(?::\d+)?/.exec(diagnostic)?.[1];
      failures.add(`${file || suite}::${m[1].replace(/[^\s]*[/\\](tests[/\\])/g, '$1')}`);
    }
  }
  return [...failures].sort();
}
export function failureDiff(base, head) {
  const b = new Set(base), h = new Set(head);
  return { new: [...h].filter(x => !b.has(x)), fixed: [...b].filter(x => !h.has(x)), stillFailing: [...h].filter(x => b.has(x)) };
}
export function diffLines(diff) {
  let file = '', line = 0;
  const rows = [];
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ b/')) file = text.slice(6);
    else if (text.startsWith('@@')) line = Number(/\+(\d+)/.exec(text)?.[1] || 0);
    else if (text.startsWith('+') && !text.startsWith('+++')) rows.push({ file, line: line++, text: text.slice(1) });
    else if (!text.startsWith('-') && !text.startsWith('\\')) line++;
  }
  return rows;
}
export function scanDiff(diff, statuses = '') {
  const added = diffLines(diff), findings = [], testChanges = [];
  const rules = [
    ['URL/dev flag or fallback', /URLSearchParams|[?&][\w-]+=|\b(?:dev|debug|fallback)\w*\b|\?\?|\|\||^\s*}?\s*else\b/i],
    ['name/ID special case', /(?:\b(?:name|id|uid|kind|hero|actor)\b|\.name|\.id)\s*={2,3}\s*['"\d]/i],
    ['ordering timer', /\b(?:setTimeout|requestAnimationFrame)\s*\(/],
    ['new ORKA global', /\b__ORKA_\w+/], ['TODO/FIXME/HACK', /\b(?:TODO|FIXME|HACK)\b/],
  ];
  for (const row of added) {
    for (const [kind, re] of rules) if (re.test(row.text)) findings.push({ kind, ...row });
    if (row.file === 'web-runner/app.js' && row.text.trim() && !/^\s*(?:\/\/|import )/.test(row.text)) findings.push({ kind: 'app.js added logic (heuristic)', ...row });
    if ((/^tests\//.test(row.file)||/\.rs$/.test(row.file)) && /assert|expect\(|\btest\(|#\[test\]/.test(row.text)) testChanges.push({ kind: 'assertion/test changed', ...row });
  }
  for (const m of statuses.trim().split('\n')) if (/^[DR]/.test(m) && /tests?[/\\]|\.test\.|_tests\.rs/.test(m)) testChanges.push({ kind: 'deleted/renamed test', change: m });
  for (const m of statuses.trim().split('\n')) if (/^M\t/.test(m)&&/\.test\.[cm]?js$|(?:^|\/)\w*tests\.rs$/.test(m)) testChanges.push({kind:'modified test; review multiline assertions',change:m});
  let oldFile='',oldLine=0;
  for(const text of diff.split('\n')) {
    if(text.startsWith('--- a/'))oldFile=text.slice(6);
    else if(text.startsWith('@@'))oldLine=Number(/-(\d+)/.exec(text)?.[1]||0);
    else if(text.startsWith('-')&&!text.startsWith('---')) {
      if((/^tests\//.test(oldFile)||/\.rs$/.test(oldFile))&&/assert|expect\(|\btest\(|#\[test\]/.test(text))testChanges.push({kind:'removed assertion/test (base line)',file:oldFile,line:oldLine,text:text.slice(1)});
      oldLine++;
    } else if(!text.startsWith('+')&&!text.startsWith('\\'))oldLine++;
  }
  const joined = added.map(r => r.text).join('\n');
  for (const m of joined.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g)) {
    const row = added[joined.slice(0, m.index).split('\n').length - 1];
    findings.push({ kind: 'empty catch', ...row });
  }
  const blocks = new Map();
  for (let i = 0; i + 8 <= added.length; i++) {
    const block = added.slice(i, i + 8);
    if (block.some((r, j) => r.file !== block[0].file || r.line !== block[0].line + j)) continue;
    const key = block.map(r => r.text.trim()).join('\n');
    if (key.replace(/\W/g, '').length < 80) continue;
    if (blocks.has(key)) findings.push({ kind: 'duplicated added block (8 lines)', ...block[0], duplicateOf: blocks.get(key) });
    else blocks.set(key, `${block[0].file}:${block[0].line}`);
  }
  return { heuristic: true, findings, testChanges, timerCount: added.filter(r => /setTimeout|requestAnimationFrame/.test(r.text)).length };
}
export function quantiles(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  return a.length ? { count: a.length, p50: a[Math.floor((a.length - 1) * .5)], p95: a[Math.floor((a.length - 1) * .95)], max: a.at(-1) } : null;
}
export const PERF_THRESHOLDS = Object.freeze({
  pageLoadMs: { relativePct: 10, absolute: 50, repeated: true },
  frameP95: { relativePct: 10, absolute: 2, repeated: true },
  stepP95: { relativePct: 10, absolute: .2 },
  heapGrowthBytes: { relativePct: 10, absolute: 5 * 1024 * 1024 },
  wasmBytes: { relativePct: 10, absolute: 64 * 1024 },
});

export function medianSpread(values) {
  if (values.length !== 3 || !values.every(Number.isFinite)) return null;
  const samples = [...values].sort((a, b) => a - b);
  return { median: samples[1], min: samples[0], max: samples[2], samples };
}

export function summarizeMetrics(runs) {
  const keys = new Set([...Object.keys(PERF_THRESHOLDS), ...runs.flatMap(r => Object.keys(r.metrics))]);
  const spreads = Object.fromEntries([...keys].map(key => [key, medianSpread(runs.map(r => r.metrics[key]))]));
  return { metrics: Object.fromEntries([...keys].map(key => [key, spreads[key]?.median ?? null])), spreads };
}

export function perfDiff(base, head, baseSpreads = {}, headSpreads = {}) {
  return Object.fromEntries(Object.entries(PERF_THRESHOLDS).map(([key, threshold]) => {
    const b = base[key], h = head[key], delta = Number.isFinite(b) && Number.isFinite(h) ? h - b : null;
    const deltaPct = delta === null ? null : b === 0 ? (h === 0 ? 0 : Infinity) : delta / Math.abs(b) * 100;
    const bs = baseSpreads[key], hs = headSpreads[key];
    const validSpreads = !threshold.repeated || (bs && hs && bs.median === b && hs.median === h);
    const overlap = threshold.repeated && validSpreads && bs.min <= hs.max && hs.min <= bs.max;
    const status = delta === null || !validSpreads ? 'FAIL' : overlap ? 'INCONCLUSIVE'
      : h > b + Math.abs(b) * threshold.relativePct / 100 && h > b + threshold.absolute ? 'FAIL' : 'PASS';
    return [key, { base: b ?? null, head: h ?? null, delta, deltaPct: deltaPct === Infinity ? 'Infinity' : deltaPct,
      threshold, spread: threshold.repeated ? { base: bs ?? null, head: hs ?? null } : undefined,
      status, regression: status === 'FAIL' }];
  }));
}

export function selectBaseCache(cache, sha, scenario, crates) {
  if (cache?.schema !== 1 || cache.sha !== sha || !Array.isArray(cache.npm?.failures)
      || !cache.npm.failures.every(f => typeof f === 'string' && !f.endsWith('UNPARSED_SUITE_FAILURE'))
      || !Number.isInteger(cache.npm.step?.status) || (cache.npm.step.status !== 0 && !cache.npm.failures.length)) return null;
  const result = cache.result;
  const reusable = result && JSON.stringify(result.scenario) === JSON.stringify(scenario)
    && JSON.stringify(result.crates) === JSON.stringify(crates) && result.probes?.runs?.length === 3
    && result.probes.coverage.complete && !result.probes.errors.length
    && result.suites.steps.every(s => s.status === 0 || /^(npm-test|cargo-)/.test(s.name));
  return { ...cache, result: reusable ? result : null };
}
