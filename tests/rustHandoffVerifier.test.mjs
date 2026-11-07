import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { failureNames, testCheck, validateReplays, compareReplays, parseArgs, command, cacheValid } from '../tools/verify_rust_handoff.mjs';
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
  const base = { exit_code: 1, failures: ['old', 'fixed'] };
  assert.equal(testCheck(base, { exit_code: 1, failures: ['old'] }).status, 'PASS');
  const result = testCheck(base, { exit_code: 1, failures: ['old', 'new'] });
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
