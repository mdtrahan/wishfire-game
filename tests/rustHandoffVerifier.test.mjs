import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { failureNames, failureTexts, testCheck, validateReplays, compareReplays, parseArgs, command, cacheValid } from '../tools/verify_rust_handoff.mjs';
const temp = mkdtempSync(join(tmpdir(), 'rust-handoff-test-'));
test.after(() => rmSync(temp, { recursive: true, force: true }));
const receipt = () => ({ schema: 1, scenarios: ['chapter-1', 'chapter-1-boss', 'pause-resume'].map(name => ({
  name, status: 'PASS', expected: name === 'chapter-1-boss' ? 'chapter_2' : 'wave_2',
  outcome: name === 'chapter-1-boss' ? 'chapter_2' : 'wave_2', ticks: 100,
  event_digest: 'fnv1a64:0123456789abcdef', step_us: { p50: 10, p95: 20 }, script: [] })) });
test('identical test names in different Rust binaries remain distinct', () => {
  assert.deepEqual(failureNames('Running unittests src/lib.rs (/tmp/debug/deps/wf_host-abcdef123456)\ntest tests::broken ... FAILED\nRunning tests/trace.rs (/tmp/debug/deps/trace-123456abcdef)\ntest tests::broken ... FAILED\nnot ok 4 - Node contract'),
    ['node::Node contract', 'trace::tests::broken', 'wf_host::tests::broken']);
});
test('new failure names fail; inherited failures and fixed failures are reported', () => {
  const base = { exit_code: 1, failures: ['old', 'fixed'], failure_texts: { old: 'old error', fixed: 'fixed error' } };
  assert.equal(testCheck(base, { exit_code: 1, failures: ['old'], failure_texts: { old: 'old error' } }).status, 'PASS');
  const result = testCheck(base, { exit_code: 1, failures: ['old', 'new'], failure_texts: { old: 'old error', new: 'new error' } });
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.new_failures, ['new']);
  assert.deepEqual(result.fixed_failures, ['fixed']);
});
test('crashes, timeouts and command failures without test names fail closed', async () => {
  const run = await command(process.execPath, ['-e', 'process.exit(7)'], { cwd: temp, env: process.env, log: join(temp, 'exit.log'), timeout: 2 });
  assert.equal(testCheck({ exit_code: 0, failures: [] }, run).status, 'FAIL');
  const timeout = await command(process.execPath, ['-e', 'setInterval(()=>{}, 1000)'], { cwd: temp, env: process.env, log: join(temp, 'timeout.log'), timeout: 0.1 });
  assert.match(timeout.infrastructure_error, /Timeout/);
  assert.equal(testCheck(timeout, timeout).status, 'FAIL');
});
const cargoOutput = (binary, tests, passed, failed = 0, ignored = 0) =>
  `Running unittests src/lib.rs (/tmp/debug/deps/${binary}-abcdef123456)\nrunning ${passed + failed + ignored} tests\n${tests}\ntest result: ${failed ? 'FAILED' : 'ok'}. ${passed} passed; ${failed} failed; ${ignored} ignored; 0 measured; 0 filtered out; finished in 0.01s\n`;
const fakeCargo = (name, output, exit = 0) => command(process.execPath,
  ['-e', 'process.stdout.write(process.argv[1]); process.exitCode = +process.argv[2]', output, String(exit)],
  { cwd: temp, env: process.env, log: join(temp, `${name}.log`), timeout: 2 });
test('a crashed test binary after an inherited failure fails even when Cargo only exits 101', async () => {
  const inherited = cargoOutput('wf_host', "test tests::old ... FAILED\n---- tests::old stdout ----\nthread 'tests::old' (123) panicked at src/lib.rs:12:3:\nold panic", 0, 1);
  const base = await fakeCargo('crash-base', inherited + cargoOutput('wf_meta', 'test tests::later ... ok', 1), 101);
  const head = await fakeCargo('crash-head', inherited +
    "Running unittests src/lib.rs (/tmp/debug/deps/wf_meta-abcdef123456)\nrunning 1 test\nerror: test failed\nprocess didn't exit successfully: `/tmp/debug/deps/wf_meta-abcdef123456` (signal: 6, SIGABRT: process abort signal)\n", 101);
  const result = testCheck(base, head);
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.new_failures, []);
  assert.match(result.infrastructure_errors.join('\n'), /SIGABRT/);
  assert.match(result.infrastructure_errors.join('\n'), /wf_meta: missing test result/);
  const unfinished = await fakeCargo('unfinished-head', inherited +
    'Running unittests src/lib.rs (/tmp/debug/deps/wf_meta-abcdef123456)\nrunning 1 test\n', 101);
  assert.match(testCheck(base, unfinished).infrastructure_errors.join('\n'), /missing test result/);
});
test('zero tests in a previously populated binary fails even if another binary keeps the total', async () => {
  const base = await fakeCargo('zero-base', cargoOutput('wf_host', 'test tests::one ... ok', 1));
  const head = await fakeCargo('zero-head', cargoOutput('wf_host', '', 0) + cargoOutput('wf_meta', 'test tests::other ... ok', 1));
  const result = testCheck(base, head);
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.count_regressions, ['wf_host: head ran zero tests']);
  assert.deepEqual(result.missing_tests, ['wf_host::tests::one']);
});
test('a lower run count fails and reports deleted or newly ignored tests', async () => {
  const base = await fakeCargo('count-base', cargoOutput('wf_host', 'test tests::one ... ok\ntest tests::two ... ok', 2));
  const head = await fakeCargo('count-head', cargoOutput('wf_host', 'test tests::one ... ok', 1));
  const result = testCheck(base, head);
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.count_regressions, ['run count dropped: 2 -> 1']);
  assert.deepEqual(result.missing_tests, ['wf_host::tests::two']);
  const ignored = await fakeCargo('ignored-head', cargoOutput('wf_host', 'test tests::one ... ok\ntest tests::two ... ignored, disabled', 1, 0, 1));
  const ignoredResult = testCheck(base, ignored);
  assert.equal(ignoredResult.status, 'FAIL');
  assert.deepEqual(ignoredResult.test_counts.head, { passed: 1, failed: 0, ignored: 1 });
  assert.deepEqual(ignoredResult.newly_ignored_tests, ['wf_host::tests::two']);
  assert.equal(testCheck(base, base).status, 'PASS');
});
test('ignored-on-head fails when a replacement test keeps the executed count', async () => {
  const base = await fakeCargo('ignore-plant-base', cargoOutput('wf_host', 'test original ... ok', 1));
  const head = await fakeCargo('ignore-plant-head', cargoOutput('wf_host', 'test original ... ignored\ntest replacement ... ok', 1, 0, 1));
  const result = testCheck(base, head);
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.count_regressions, []);
  assert.deepEqual(result.newly_ignored_tests, ['wf_host::original']);
});
test('missing-on-head fails when a replacement test keeps the executed count', async () => {
  const base = await fakeCargo('missing-plant-base', cargoOutput('wf_host', 'test original ... ok', 1));
  const head = await fakeCargo('missing-plant-head', cargoOutput('wf_host', 'test replacement ... ok', 1));
  const result = testCheck(base, head);
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.count_regressions, []);
  assert.deepEqual(result.missing_tests, ['wf_host::original']);
});
test('same name and ERR_ASSERTION with changed expected/actual values fails', async () => {
  const file = join(temp, 'assertion.test.mjs');
  const env = { ...process.env, NODE_OPTIONS: '--test-reporter=tap' }; delete env.NODE_TEST_CONTEXT;
  const run = async (actual, expected) => {
    writeFileSync(file, `import test from 'node:test'; import assert from 'node:assert/strict';
      test('same name', () => assert.equal(${actual}, ${expected}));`);
    return command(process.execPath, ['--test', file],
      { cwd: temp, env, log: join(temp, `assertion-${actual}.log`), timeout: 2 });
  };
  const base = await run(1, 2), head = await run(3, 4);
  for (const row of [base, head]) assert.match(row.failure_texts['node::same name'], /ERR_ASSERTION/);
  assert.equal(testCheck(base, base).status, 'PASS');
  const result = testCheck(base, head);
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.new_failures, ['node::same name']);
  assert.deepEqual(result.inherited_failures, []);
  assert.equal(result.changed_failures.length, 1);
});
test('full failure text inherits across paths, timings, ANSI colors, pointers and thread ids', async () => {
  const tap = (root, time, color) => `not ok 1 - same name
  ---
  duration_ms: ${time}
  location: '${root}/tests/fixture.test.mjs:12:3'
  error: '${color}same failure\x1b[0m'
  code: 'ERR_ASSERTION'
  expected: 2
  actual: 1
  stack: |-
    TestContext.<anonymous> (${root}/tests/fixture.test.mjs:12:3)
    external (/different/${time}/helper.mjs:7:2)
  ...
`;
  const base = await fakeCargo('text-base', tap(temp, 1.25, '\x1b[31m'), 1);
  const head = await fakeCargo('text-head', tap(temp, 9.75, ''), 1);
  assert.equal(testCheck(base, head).status, 'PASS');
  assert.deepEqual(testCheck(base, head).inherited_failures, ['node::same name']);
  const moved = failureTexts(tap('/another/worktree', 9.75, ''), '/another/worktree');
  assert.equal(moved['node::same name'], base.failure_texts['node::same name']);
  assert.match(moved['node::same name'], /<repo>\/tests\/fixture.test.mjs:12:3/);
  const rust = (root, id, pointer) => cargoOutput('wf_host', `test original ... FAILED
---- original stdout ----
thread 'original' (${id}) panicked at ${root}/src/lib.rs:12:3:
same panic
stack backtrace:
   0: ${pointer} - wf_host::original
             at ${root}/src/lib.rs:12:3
pointer: ${pointer}`, 0, 1);
  assert.deepEqual(failureTexts(rust('/base', 123, '0xabcdef'), '/base'),
    failureTexts(rust('/head', 456, '0x123456'), '/head'));
});
test('changed Rust panic text fails including differences past the old prefix limit', async () => {
  const output = message => cargoOutput('wf_host', `test original ... FAILED\n---- original stdout ----\nthread 'original' (123) panicked at src/lib.rs:12:3:\n${message}`, 0, 1);
  const prefix = 'same panic prefix '.repeat(20);
  const base = await fakeCargo('panic-base', output(prefix + 'original panic'), 101);
  const head = await fakeCargo('panic-head', output(prefix + 'changed panic'), 101);
  assert.equal(testCheck(base, base).status, 'PASS');
  assert.equal(testCheck(base, head).status, 'FAIL');
  assert.deepEqual(testCheck(base, head).new_failures, ['wf_host::original']);
});
test('missing failure text cannot establish inheritance', () => {
  const run = { exit_code: 1, failures: ['same'] };
  assert.equal(testCheck(run, run).status, 'FAIL');
  assert.deepEqual(testCheck(run, run).inherited_failures, []);
});
test('repository stack frames and hexadecimal assertion values remain significant', () => {
  const output = (frame, value) => `not ok 1 - same name\n  ---\n  error: failure\n  actual: ${value}\n  stack: |-\n    at ${temp}/tests/${frame}:12:3\n  ...\n`;
  const run = text => ({ exit_code: 1, failures: ['node::same name'], failure_texts: failureTexts(text, temp) });
  const base = run(output('first.mjs', '0xabcdef'));
  for (const text of [output('other.mjs', '0xabcdef'), output('first.mjs', '0x123456')]) {
    assert.equal(testCheck(base, run(text)).status, 'FAIL');
  }
});
test('environment errors on either revision are INCONCLUSIVE and reported', async () => {
  const clean = { exit_code: 0, failures: [] };
  for (const code of ['EPERM', 'EACCES', 'ENOSPC', 'ENOENT']) {
    const run = await fakeCargo(code, `not ok 1 - fixture\n  ---\n  error: '${code}: blocked'\n  code: '${code}'\n  ...\n`, 1);
    for (const [base, head] of [[run, clean], [clean, run], [run, run]]) {
      const result = testCheck(base, head);
      assert.equal(result.status, 'INCONCLUSIVE');
      assert.match(result.infrastructure_errors.join('\n'), new RegExp(code));
      assert.deepEqual(result.inherited_failures, []);
    }
  }
  const missing = await command(join(temp, 'missing-binary'), [], { cwd: temp, env: process.env, log: join(temp, 'missing.log'), timeout: 2 });
  assert.equal(testCheck(clean, missing).status, 'INCONCLUSIVE');
});
test('assertion expected/actual error-code strings retain ordinary failure classification', async () => {
  const tap = value => `not ok 1 - assertion with code values\n  ---\n  error: 'values differ'\n  code: 'ERR_ASSERTION'\n  expected: 'ENOENT'\n  actual: '${value}'\n  ...\n`;
  const base = await fakeCargo('code-values-base', tap('EPERM'), 1);
  const head = await fakeCargo('code-values-head', tap('EACCES'), 1);
  assert.equal(testCheck(base, base).status, 'PASS');
  assert.equal(testCheck(base, head).status, 'FAIL');
  assert.deepEqual(testCheck(base, head).infrastructure_errors, []);
});
test('digest/timing changes are observations; soft locks and missed outcomes fail', () => {
  const head = receipt(); head.scenarios[0].event_digest = 'fnv1a64:0000000000000000'; head.scenarios[0].step_us.p95 = 1000;
  let result = compareReplays(receipt(), head);
  assert.equal(result[0].status, 'PASS'); assert.equal(result[0].digest_changed, true);
  head.scenarios[0].status = 'FAIL'; head.scenarios[0].outcome = 'soft_lock';
  assert.equal(compareReplays(receipt(), head)[0].status, 'FAIL');
  head.scenarios[0].outcome = 'deadline';
  assert.equal(compareReplays(receipt(), head)[0].status, 'FAIL');
  head.scenarios[0].status = 'PASS';
  assert.throws(() => validateReplays(head), /Invalid replay/);
});
test('missing/duplicate scenarios and malformed timings never produce PASS', () => {
  const data = receipt(); data.scenarios.pop(); assert.throws(() => validateReplays(data));
  const dup = receipt(); dup.scenarios[1] = dup.scenarios[0]; assert.throws(() => validateReplays(dup));
  const timing = receipt(); timing.scenarios[0].step_us.p95 = null; assert.throws(() => validateReplays(timing));
});
test('cached base requires matching identity, every check and unchanged evidence logs', () => {
  const log = join(temp, 'cached.log'); writeFileSync(log, 'original');
  const check = { log, log_sha256: createHash('sha256').update(readFileSync(log)).digest('hex') };
  const result = { identity: 'sha+protocol', result: { replays: receipt(), checks: Object.fromEntries(
    ['pack', 'build', 'workspace-tests', 'slice-tests', 'replays'].map(name => [name, check])) } };
  assert.equal(cacheValid(result, 'sha+protocol'), true);
  assert.equal(cacheValid(result, 'other'), false);
  writeFileSync(log, 'changed'); assert.equal(cacheValid(result, 'sha+protocol'), false);
});
test('CLI requires explicit refs and validates timeout and switches', () => {
  assert.throws(() => parseArgs(['--base', 'main'])); assert.throws(() => parseArgs(['--base', 'main', '--head', 'HEAD', '--timeout', 'NaN']));
  assert.throws(() => parseArgs(['--base', 'main', '--head', 'HEAD', '--skip-tests']));
  assert.equal(parseArgs(['--base', 'main', '--head', 'HEAD', '--quick']).quick, true);
});
