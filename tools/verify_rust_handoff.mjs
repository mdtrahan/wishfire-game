#!/usr/bin/env node
// Compare immutable Git snapshots. No game flags, network services or model calls.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir, platform, arch } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { captureReplays } from './capture_rust_replays.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const replayPath = 'rust/wf_host/examples/handoff_replay.rs';
const names = ['chapter-1', 'chapter-1-boss', 'pause-resume'];
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

export function failureNames(log) {
  let suite = 'node';
  const failures = new Set();
  for (const line of log.split('\n')) {
    const running = line.match(/Running .*\((?:.*\/)?([^/()\s]+)-[a-f0-9]{8,}\)/);
    if (running) suite = running[1];
    const rust = line.match(/^test (.+?) \.\.\. FAILED$/);
    const node = line.match(/^\s*not ok \d+ - (.+)$/) || line.match(/^\s*✖ (.+?) \([\d.]+m?s\)$/);
    if (rust) failures.add(`${suite}::${rust[1]}`);
    if (node) failures.add(`node::${node[1]}`);
  }
  return [...failures].sort();
}
export function failureSignatures(log) {
  const signatures = {};
  let suite = 'node', name, code, errorClass, error;
  const save = () => { if (name) signatures[name] = code || errorClass || error || 'unknown'; };
  for (const line of log.split('\n')) {
    const running = line.match(/Running .*\((?:.*\/)?([^/()\s]+)-[a-f0-9]{8,}\)/);
    if (running) { save(); name = undefined; suite = running[1]; }
    const node = line.match(/^\s*not ok \d+ - (.+)$/);
    const panic = line.match(/^thread '(.+?)'(?: \(\d+\))? panicked at (.*)$/);
    if (node || panic) {
      save(); code = undefined; errorClass = undefined; error = undefined;
      name = node ? `node::${node[1]}` : `${suite}::${panic[1]}`;
      // Rust usually prints a source location here, then the panic message on the next line.
      if (panic && !/:\d+:\d+:$/.test(panic[2])) error = panic[2].slice(0, 160);
      continue;
    }
    if (!name) continue;
    const field = line.match(/^\s+(code|name|error):\s*['"]?(.+?)['"]?\s*$/);
    if (field?.[1] === 'code') code = field[2];
    else if (field?.[1] === 'name') errorClass = field[2];
    else if (!error && field) error = field[2].slice(0, 160);
    else if (!error && !name.startsWith('node::') && line.trim()) error = line.trim().slice(0, 160);
  }
  save();
  return signatures;
}
function environmentErrors(log) {
  return [...new Set(log.split('\n').filter(line =>
    /(?:code:|error:|Error:|error\[).*\b(?:EPERM|EACCES|ENOSPC)\b|spawn .*\bENOENT\b|(?:command|executable|binary).*not found|could not execute process.*No such file/i.test(line)
  ).map(line => line.trim().slice(0, 240)))];
}
export function cargoEvidence(log) {
  const test_suites = [], abnormal_exits = [];
  let suite;
  for (const line of log.split('\n')) {
    const running = line.match(/Running .*\((?:.*\/)?([^/()\s]+)-[a-f0-9]{8,}\)/);
    const docs = line.match(/^\s*Doc-tests (\S+)/);
    if (running || docs) {
      suite = { name: running ? running[1] : `doc::${docs[1]}`, completed: false, tests: {} };
      test_suites.push(suite);
    }
    const result = line.match(/^test result: \w+\. (\d+) passed; (\d+) failed; (\d+) ignored;/);
    if (result && suite) {
      Object.assign(suite, { completed: true, passed: +result[1], failed: +result[2], ignored: +result[3] });
      suite = undefined;
    }
    const named = line.match(/^test (.+?) \.\.\. (ok|FAILED|ignored)(?:,.*)?$/);
    if (named && suite) suite.tests[named[1]] = named[2];
    // Cargo itself exits 101 when a test child dies, so the parent's signal is insufficient.
    if (/process didn't exit successfully:.*\(signal:/.test(line)) abnormal_exits.push(line.trim());
  }
  for (const row of test_suites) if (!row.completed) abnormal_exits.push(`${row.name}: missing test result`);
  return { test_suites, abnormal_exits };
}
export function testCheck(base, head) {
  const baseline = new Set(base.failures);
  const changed_failures = head.failures.filter(name => baseline.has(name) &&
    (base.failure_signatures?.[name] || 'unknown') !== (head.failure_signatures?.[name] || 'unknown'));
  const introduced = head.failures.filter(name => !baseline.has(name) || changed_failures.includes(name));
  const environment = [base, head].flatMap((run, index) => [...new Set([
    ...(run.environment_errors || []),
    ...Object.entries(run.failure_signatures || {}).filter(([, signature]) => /\b(?:EPERM|EACCES|ENOSPC|ENOENT)\b/.test(signature)).map(([name, signature]) => `${name}: ${signature}`)
  ])].map(error => `${index ? 'head' : 'base'}: ${error}`));
  const fatal = [base, head].flatMap(run => [
    ...(run.abnormal_exits || []),
    ...(run.infrastructure_error || run.signal || run.exit_code === null || (run.exit_code !== 0 && !run.failures.length)
      ? [run.infrastructure_error || (run.signal ? `signal ${run.signal}` : `exit ${run.exit_code} without named failures`)] : [])
  ]);
  const counts = run => (run.test_suites || []).reduce((total, suite) => ({
    passed: total.passed + (suite.passed || 0), failed: total.failed + (suite.failed || 0), ignored: total.ignored + (suite.ignored || 0)
  }), { passed: 0, failed: 0, ignored: 0 });
  const a = counts(base), b = counts(head), count_regressions = [];
  for (const suite of base.test_suites || []) {
    const matching = (head.test_suites || []).filter(row => row.name === suite.name);
    if (suite.passed + suite.failed > 0 && !matching.some(row => row.passed + row.failed > 0)) count_regressions.push(`${suite.name}: head ran zero tests`);
  }
  if (b.passed + b.failed < a.passed + a.failed) count_regressions.push(`run count dropped: ${a.passed + a.failed} -> ${b.passed + b.failed}`);
  const missing_tests = [], newly_ignored_tests = [];
  for (const suite of base.test_suites || []) for (const [name, state] of Object.entries(suite.tests)) {
    if (state === 'ignored') continue;
    const states = (head.test_suites || []).filter(row => row.name === suite.name).map(row => row.tests[name]).filter(Boolean);
    if (!states.length) missing_tests.push(`${suite.name}::${name}`);
    else if (states.every(state => state === 'ignored')) newly_ignored_tests.push(`${suite.name}::${name}`);
  }
  return { status: environment.length ? 'INCONCLUSIVE' : introduced.length || fatal.length || count_regressions.length || missing_tests.length || newly_ignored_tests.length ? 'FAIL' : 'PASS', new_failures: introduced,
    changed_failures: changed_failures.map(name => ({ name, base: base.failure_signatures?.[name] || 'unknown', head: head.failure_signatures?.[name] || 'unknown' })),
    inherited_failures: head.failures.filter(name => baseline.has(name) && !changed_failures.includes(name) &&
      !/\b(?:EPERM|EACCES|ENOSPC|ENOENT)\b/.test(head.failure_signatures?.[name] || '')),
    fixed_failures: base.failures.filter(name => !head.failures.includes(name)),
    infrastructure_errors: [...environment, ...fatal], test_counts: { base: a, head: b }, count_regressions, missing_tests, newly_ignored_tests };
}
export function validateReplays(data) {
  if (data?.schema !== 1 || !Array.isArray(data.scenarios) || data.scenarios.length !== names.length) throw Error('Incomplete replay receipt');
  for (const name of names) {
    const rows = data.scenarios.filter(row => row.name === name);
    if (rows.length !== 1) throw Error(`Missing/duplicate scenario: ${name}`);
    const row = rows[0];
    if (!['PASS', 'FAIL'].includes(row.status) || typeof row.outcome !== 'string' ||
        row.expected !== (name === 'chapter-1-boss' ? 'chapter_2' : 'wave_2') ||
        (row.status === 'PASS' && row.outcome !== row.expected) ||
        !/^fnv1a64:[a-f0-9]{16}$/.test(row.event_digest) || !Number.isFinite(row.ticks) || row.ticks < 1 ||
        !Number.isFinite(row.step_us?.p50) || !Number.isFinite(row.step_us?.p95) || !Array.isArray(row.script)) throw Error(`Invalid replay: ${name}`);
  }
  return data;
}
export function compareReplays(base, head) {
  validateReplays(base); validateReplays(head);
  return names.map(name => {
    const a = base.scenarios.find(row => row.name === name), b = head.scenarios.find(row => row.name === name);
    return { name, status: a.status === 'PASS' && b.status === 'PASS' ? 'PASS' : 'FAIL',
      base_outcome: a.outcome, head_outcome: b.outcome, digest_changed: a.event_digest !== b.event_digest,
      base_digest: a.event_digest, head_digest: b.event_digest,
      base_step_us: a.step_us, head_step_us: b.step_us,
      p50_ratio: a.step_us.p50 ? b.step_us.p50 / a.step_us.p50 : null,
      p95_ratio: a.step_us.p95 ? b.step_us.p95 / a.step_us.p95 : null };
  });
}
export function parseArgs(args) {
  const options = { quick: false, gif: false, worktree: false, timeout: 240 };
  for (let n = 0; n < args.length; n++) {
    const flag = args[n];
    if (['--quick', '--gif', '--worktree'].includes(flag)) options[flag.slice(2)] = true;
    else if (['--base', '--head', '--out', '--cache', '--timeout'].includes(flag) && args[n + 1] && !args[n + 1].startsWith('--')) options[flag.slice(2)] = args[++n];
    else throw Error(`Unknown/incomplete argument: ${flag}`);
  }
  if (!options.base || !options.head) throw Error('Usage: node tools/verify_rust_handoff.mjs --base <sha> --head <sha> [--quick] [--gif] [--out <dir>] [--cache <dir>] [--worktree] [--timeout <seconds>]');
  options.timeout = Number(options.timeout);
  if (!Number.isFinite(options.timeout) || options.timeout <= 0) throw Error('timeout must be positive');
  return options;
}
// A timeout kills the entire command group, including cargo/test grandchildren.
export async function command(executable, args, { cwd, env, log, timeout }) {
  const started = performance.now();
  const stream = (await import('node:fs')).createWriteStream(log);
  return await new Promise(resolveResult => {
    const child = spawn(executable, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let infrastructure_error, timedOut = false;
    child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* command already exited */ }
    }, timeout * 1000);
    child.on('error', error => { infrastructure_error = error.message; });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      stream.end(() => {
        const output = readFileSync(log, 'utf8');
        resolveResult({ command: [executable, ...args], exit_code: code, signal,
          duration_seconds: (performance.now() - started) / 1000, log,
          failures: failureNames(output),
          failure_signatures: failureSignatures(output),
          environment_errors: [...environmentErrors(output), ...(infrastructure_error ? [infrastructure_error] : [])],
          ...cargoEvidence(output),
          ...(/error: could not compile|error\[E\d+\]/.test(output) ? { infrastructure_error: 'Rust compilation failed' } : {}),
          ...(timedOut ? { infrastructure_error: `Timeout after ${timeout}s` } : infrastructure_error ? { infrastructure_error } : {}) });
      });
    });
  });
}
function checkedGit(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
async function evaluate(label, sha, options, scratch, out, harness, base) {
  const cwd = join(scratch, label);
  console.log(`${label}: ${sha}`);
  // A local shared clone keeps Git tests/range routing real without modifying the caller's index.
  checkedGit(root, 'clone', '--shared', '--no-checkout', '--quiet', root, cwd);
  checkedGit(cwd, '-c', 'core.hooksPath=/dev/null', 'checkout', '--quiet', '--detach', sha);
  checkedGit(cwd, 'update-ref', 'refs/remotes/origin/main', base);
  mkdirSync(join(cwd, dirname(replayPath)), { recursive: true });
  writeFileSync(join(cwd, replayPath), harness);
  if (label === 'head' && options.worktree) {
    const patch = options.patch;
    if (patch.length) execFileSync('git', ['apply', '--binary'], { cwd, input: patch });
  }
  const env = { ...process.env, CARGO_TARGET_DIR: join(scratch, `${label}-target`), CARGO_TERM_COLOR: 'never', CARGO_NET_OFFLINE: 'true', NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --test-reporter=tap`.trim() };
  // Hooks pass index variables; cloned tests must never see the caller's repository state.
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'WF_RECORD_STAGE_TRACE']) delete env[key];
  const checks = {};
  const run = async (name, cmd, args) => checks[name] = await command(cmd, args, {
    cwd, env, log: join(out, `${label}-${name}.log`), timeout: options.timeout });
  await run('pack', 'cargo', ['run', '--locked', '--offline', '-q', '-p', 'wf_pack', '--manifest-path', 'rust/Cargo.toml', '--release', '--', '--src', 'web-runner/assets', '--out', 'rust/wf_app/gen']);
  await run('build', 'cargo', ['build', '--locked', '--offline', '--workspace', '--manifest-path', 'rust/Cargo.toml']);
  // Always finish both native test groups even if npm's merge route stops on a Node failure.
  await run('workspace-tests', 'cargo', ['test', '--locked', '--offline', '--workspace', '--no-fail-fast', '--manifest-path', 'rust/Cargo.toml']);
  await run('slice-tests', 'cargo', ['test', '--locked', '--offline', '--no-fail-fast', '--manifest-path', 'rust/wf_slice_harness/Cargo.toml']);
  if (JSON.parse(readFileSync(join(cwd, 'package.json'))).scripts?.['test:merge']) {
    await run('merge-tests', 'npm', ['run', 'test:merge', '--', '--base', base]);
  }
  await run('replays', 'cargo', ['run', '--locked', '--offline', '-q', '-p', 'wf_host', '--manifest-path', 'rust/Cargo.toml', '--example', 'handoff_replay']);
  let replays;
  try {
    // cargo diagnostics use stderr; JSON is the one complete stdout line.
    const lines = readFileSync(checks.replays.log, 'utf8').split('\n');
    replays = validateReplays(JSON.parse(lines.find(line => line.startsWith('{"scenarios"') || line.startsWith('{"schema"'))));
  } catch (error) { checks.replays.infrastructure_error = error.message; }
  return { sha, checks, replays, cwd };
}
export function cacheValid(receipt, identity) {
  try {
    if (receipt?.identity !== identity || !receipt.result?.checks) return false;
    validateReplays(receipt.result.replays);
    return Object.values(receipt.result.checks).every(check => existsSync(check.log) && hash(readFileSync(check.log)) === check.log_sha256) &&
      ['pack', 'build', 'workspace-tests', 'slice-tests', 'replays'].every(name => receipt.result.checks[name]);
  } catch { return false; }
}
export async function verify(options) {
  const started = performance.now();
  const base = git('rev-parse', '--verify', `${options.base}^{commit}`), head = git('rev-parse', '--verify', `${options.head}^{commit}`);
  if (options.worktree && head !== git('rev-parse', 'HEAD')) throw Error('--worktree requires --head HEAD');
  if (options.worktree) options.patch = execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd: root });
  options.cache = resolve(options.cache || join(tmpdir(), 'wishfire-rust-verifier-cache'));
  const out = resolve(options.out || join(tmpdir(), `wishfire-handoff-${head.slice(0, 12)}-${Date.now()}`));
  mkdirSync(out, { recursive: true }); mkdirSync(options.cache, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'wishfire-verify-'));
  let report = { schema: 1, status: 'FAIL', base, head, output: out, started_at: new Date().toISOString(), checks: {} };
  const harness = options.worktree ? execFileSync('git', ['show', `${head}:${replayPath}`], { cwd: root }) : readFileSync(join(root, replayPath));
  // Cache identity pins harness/protocol/toolchain as well as SHA; cached logs are content checked.
  report.replay_driver_sha256 = hash(harness);
  report.verifier_sha256 = hash(readFileSync(fileURLToPath(import.meta.url)));
  const identity = hash(JSON.stringify([base, hash(harness), hash(readFileSync(fileURLToPath(import.meta.url))),
    execFileSync('rustc', ['-Vv'], { encoding: 'utf8' }), process.version, platform(), arch(), Object.fromEntries(['RUSTFLAGS', 'CARGO_ENCODED_RUSTFLAGS', 'RUSTC', 'CARGO_BUILD_TARGET', 'NODE_OPTIONS'].map(key => [key, process.env[key]]))]));
  const cacheDir = join(options.cache, base, identity);
  try {
    let a;
    const cacheFile = join(cacheDir, 'receipt.json');
    if (options.quick && existsSync(cacheFile)) {
      let receipt;
      try { receipt = JSON.parse(readFileSync(cacheFile, 'utf8')); } catch { /* invalidate damaged cache */ }
      if (cacheValid(receipt, identity)) { a = receipt.result; report.base_cache_hit = true; console.log('base: verified cache'); }
    }
    if (!a) {
      a = await evaluate('base', base, options, scratch, out, harness, base);
      if (a.replays && Object.values(a.checks).every(c => !c.infrastructure_error) && a.checks.pack.exit_code === 0 && a.checks.build.exit_code === 0) {
        mkdirSync(cacheDir, { recursive: true });
        for (const [name, check] of Object.entries(a.checks)) {
          const path = join(cacheDir, `${name}-${hash(readFileSync(check.log))}.log`); copyFileSync(check.log, path);
          check.log = path; check.log_sha256 = hash(readFileSync(path));
        }
        writeFileSync(cacheFile, JSON.stringify({ identity, result: a }));
      }
    }
    const b = await evaluate('head', head, options, scratch, out, harness, base);
    report.base_result = a; report.head_result = b;
    delete a.cwd; delete b.cwd;
    for (const name of new Set([...Object.keys(a.checks), ...Object.keys(b.checks)])) {
      const x = a.checks[name], y = b.checks[name];
      if (!x || !y) { report.checks[name] = { status: 'FAIL', reason: 'Test route missing from one revision' }; continue; }
      report.checks[name] = ['pack', 'build', 'replays'].includes(name)
        ? { status: [x, y].some(c => c.environment_errors?.length) ? 'INCONCLUSIVE' : [x, y].every(c => c.exit_code === 0 && !c.infrastructure_error) ? 'PASS' : 'FAIL',
          infrastructure_errors: [x, y].flatMap(c => c.environment_errors || []) }
        : testCheck(x, y);
    }
    report.replay_comparison = compareReplays(a.replays, b.replays);
    for (const row of report.replay_comparison) report.checks[`replay:${row.name}`] = row;
    if (options.worktree) report.worktree_patch_sha256 = hash(options.patch);
    if (options.gif) {
      const capture = await captureReplays({ cwd: join(scratch, 'head'), out, scenarios: b.replays.scenarios,
        env: { ...process.env, CARGO_TARGET_DIR: join(scratch, 'head-target') }, timeout: options.timeout });
      report.checks.gif = capture;
    }
  } catch (error) { report.checks.verifier = { status: 'FAIL', reason: error.stack }; }
  finally {
    report.status = Object.values(report.checks).some(c => c.status === 'INCONCLUSIVE') ? 'INCONCLUSIVE' : Object.values(report.checks).every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
    rmSync(scratch, { recursive: true, force: true });
    report.duration_seconds = (performance.now() - started) / 1000;
    writeFileSync(join(out, 'verdict.json'), JSON.stringify(report, null, 2) + '\n');
    const summary = `${report.status} base=${base} head=${head}\n` +
      Object.entries(report.checks).map(([name, c]) => `${c.status} ${name}${c.new_failures?.length ? ': ' + c.new_failures.join(', ') : ''}${c.inherited_failures?.length ? ` (${c.inherited_failures.length} inherited failures)` : ''}${c.newly_ignored_tests?.length ? ': newly ignored ' + c.newly_ignored_tests.join(', ') : ''}${c.missing_tests?.length ? ': missing ' + c.missing_tests.join(', ') : ''}${c.changed_failures?.length ? ': changed signatures ' + JSON.stringify(c.changed_failures) : ''}${c.infrastructure_errors?.length ? ': infrastructure errors ' + c.infrastructure_errors.join('; ') : ''}${c.digest_changed ? ' (event digest changed)' : ''}${c.reason ? ': ' + c.reason.split('\n')[0] : ''}`).join('\n') +
      `\nTime: ${report.duration_seconds.toFixed(2)}s; base cache: ${report.base_cache_hit ? 'hit' : 'miss'}\n${join(out, 'verdict.json')}\n`;
    writeFileSync(join(out, 'summary.txt'), summary); console.log(summary);
  }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const report = await verify(parseArgs(process.argv.slice(2))); process.exitCode = report.status === 'PASS' ? 0 : 1; }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
