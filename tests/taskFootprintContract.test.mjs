import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { footprintCommand, footprintIndex, footprintMeasure, footprintReachability } from '../tools/storage_hygiene.mjs';

const tool = new URL('../tools/storage_hygiene.mjs', import.meta.url).pathname;
const linker = new URL('../tools/link_beads_worktree.mjs', import.meta.url).pathname;
const prepare = new URL('../tools/prepare_commit_check.sh', import.meta.url).pathname;

function fixture(t) {
  const base = path.join(os.homedir(), '.cache/task-footprint/test-fixtures');
  fs.mkdirSync(base, { recursive: true });
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(base, 'repo-')));
  const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', ...options });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
  };
  const git = (...args) => run('git', args);
  git('init', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  fs.writeFileSync(path.join(cwd, '.gitignore'), 'target/\n.beads/\n');
  fs.writeFileSync(path.join(cwd, 'source'), 'original');
  git('add', '.');
  git('commit', '-m', 'fixture');
  const records = new Set();
  const task = 'ORKA-test';
  const call = (mode, args = [], location = cwd) => {
    const result = footprintCommand(mode, ['--task', task, ...args], location);
    records.add(path.dirname(path.dirname(result.filename)));
    return result;
  };
  t.after(() => {
    for (const directory of records) fs.rmSync(directory, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  });
  return { cwd, run, git, call, task };
}

test('start before allocation survives automatic lane linking, resume and finalization', t => {
  const { cwd, run, git, call, task } = fixture(t);
  const lane = path.join(cwd, 'lane');
  const start = call('start', ['--worktree', lane]);
  assert.equal(start.record.baseline.label, 'baseline before creation');
  assert.equal(start.record.status, 'incomplete');
  fs.mkdirSync(path.join(cwd, '.beads/dolt'), { recursive: true });
  // The linker requires the tracked Beads directory in an allocated checkout.
  fs.writeFileSync(path.join(cwd, '.beads/config.yaml'), 'test: true\n');
  git('add', '-f', '.beads/config.yaml');
  git('commit', '-m', 'beads fixture');
  git('worktree', 'add', '-b', `bead/${task}-lane`, lane);
  const output = run(process.execPath, [linker], { cwd: lane });
  assert.match(output, /baseline before creation/);
  const resumed = call('start', [], lane);
  assert.equal(resumed.filename, start.filename);
  assert.deepEqual(resumed.record.baseline, JSON.parse(JSON.stringify(start.record.baseline)));
  assert.equal(call('close', [], lane).record.status, 'complete');
  assert.equal(call('start', [], lane).record.status, 'incomplete');
  assert.equal(fs.readdirSync(path.dirname(start.filename)).filter(name => name.endsWith('.json')).length, 1);
  assert.equal(fs.readdirSync(path.dirname(start.filename)).some(name => name.endsWith('.tmp')), false);
});

test('check reports unknown baselines without inventing them and uses indexed blob sizes', t => {
  const { cwd, git, call } = fixture(t);
  assert.equal(call('check').record, null);
  const unknown = call('close').record;
  assert.equal(unknown.baseline, null);
  assert.equal(unknown.status, 'incomplete');
  assert.match(unknown.final.line, /delivered unknown, rollback unknown/);
  assert.throws(() => call('start', ['--task', '../escape']), /valid --task/);
  fs.writeFileSync(path.join(cwd, 'source'), 'new staged bytes');
  git('add', 'source');
  fs.writeFileSync(path.join(cwd, 'source'), 'unstaged content has a different length');
  const index = footprintIndex(cwd);
  assert.equal(index.stagedBytes, Buffer.byteLength('new staged bytes'));
  assert.equal(index.headroomBytes, 384 * 1024 * 1024 - index.trackedBytes);
});

test('discovery records owned builds, observes peaks and keeps dirty close provisional', t => {
  const { cwd, git, call } = fixture(t);
  const start = call('start');
  assert.equal(start.record.baseline.label, 'baseline after creation');
  const target = path.join(cwd, 'target');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'binary'), Buffer.alloc(1234));
  const checked = call('check').record;
  assert.ok(checked.resources.some(item => item.path === target && item.rebuildable && item.source === 'discovered'));
  assert.equal(checked.lastMeasurement, undefined);
  const peak = call('peak').record.peakBytes;
  fs.writeFileSync(path.join(target, 'binary'), 'small');
  fs.writeFileSync(path.join(cwd, 'source'), 'pending');
  const pending = call('close').record;
  assert.equal(pending.status, 'incomplete');
  assert.equal(pending.final.provisional, true);
  assert.equal(pending.final.rebuildableBytes, 5);
  assert.equal(pending.peakBytes, peak);
  git('add', 'source');
  git('commit', '-m', 'delivered');
  const final = call('close').record;
  assert.equal(final.status, 'complete');
  assert.ok(final.final.delivered.bytes > 0);
  assert.match(final.final.line, /footprint: delivered .* rollback .* rebuildable .* peak .* leftovers: .*target/);
  assert.match(final.final.unknown.join(' '), /APFS.*concurrent.*TM/);
  assert.equal(fs.readFileSync(path.join(target, 'binary'), 'utf8'), 'small');
});

test('measurement deduplicates overlapping paths and hardlinks, excludes history, symlinks and foreign checkouts', t => {
  const { cwd } = fixture(t);
  const a = path.join(cwd, 'owned');
  const b = path.join(cwd, 'build');
  const foreign = path.join(a, 'foreign');
  for (const directory of [a, b, foreign, path.join(a, 'history'), path.join(a, '.beads')]) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(a, 'file'), '12345');
  fs.linkSync(path.join(a, 'file'), path.join(b, 'hardlink'));
  for (const directory of [foreign, path.join(a, 'history'), path.join(a, '.beads')]) fs.writeFileSync(path.join(directory, 'secret'), 'excluded');
  fs.symlinkSync(foreign, path.join(b, 'linked'));
  const measured = footprintMeasure([{ kind: 'directory', path: a }, { kind: 'directory', path: b, rebuildable: true },
    { kind: 'directory', path: foreign }], [foreign]);
  assert.deepEqual(measured, { bytes: 5, rebuildableBytes: 5, errors: [] });
});

test('commit-prep metadata permits finalization while untracked source keeps the run incomplete', t => {
  const { cwd, git, call } = fixture(t);
  fs.writeFileSync(path.join(cwd, '.gitignore'), 'target/\n');
  git('add', '.gitignore');
  git('commit', '-m', 'visible metadata fixture');
  call('start');
  fs.mkdirSync(path.join(cwd, '.beads/commit-check'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.beads/commit-check/ORKA-test.json'), '{}');
  assert.equal(call('close').record.status, 'complete');
  fs.writeFileSync(path.join(cwd, 'pending-source'), 'uncommitted');
  assert.equal(call('close').record.status, 'incomplete');
});

test('resources removed by the existing lifecycle are resolved while their peak evidence remains', t => {
  const { cwd, call } = fixture(t);
  call('start');
  const target = path.join(cwd, 'target');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'binary'), Buffer.alloc(16384));
  call('register', ['--directory', target]);
  const peak = call('peak').record.peakBytes;
  fs.rmSync(target, { recursive: true }); // Only this test's owned fixture.
  const final = call('close').record;
  assert.equal(final.status, 'complete');
  assert.equal(final.final.rebuildableBytes, 0);
  assert.equal(final.resources.find(item => item.path === target).present, false);
  assert.equal(final.final.line.includes(target), false);
  assert.equal(final.peakBytes, peak);
  assert.deepEqual(final.lastMeasurement.errors, []);
});

test('nested lane discovery excludes another registered checkout without excluding its own builds', t => {
  const { cwd, git, call } = fixture(t);
  const lane = path.join(cwd, 'lane');
  const foreign = path.join(lane, 'foreign');
  git('worktree', 'add', '--detach', lane);
  git('worktree', 'add', '--detach', foreign);
  for (const root of [lane, foreign]) fs.mkdirSync(path.join(root, 'target'));
  fs.writeFileSync(path.join(lane, 'target/binary'), '12345');
  fs.writeFileSync(path.join(foreign, 'target/binary'), Buffer.alloc(100000));
  const { record } = call('start', [], lane);
  assert.ok(record.resources.some(item => item.path === path.join(lane, 'target')));
  assert.equal(record.resources.some(item => item.path.startsWith(foreign)), false);
  assert.equal(record.baseline.paths.rebuildableBytes, 5);
});

test('rollback estimates deduplicate new/moved refs and exclude baseline and delivered objects', t => {
  const { cwd, git } = fixture(t);
  const head = git('rev-parse', 'HEAD');
  git('branch', 'rollback', head);
  const baseline = { head, refs: { 'refs/heads/main': head, 'refs/heads/rollback': head } };
  fs.writeFileSync(path.join(cwd, 'source'), 'rollback unique');
  git('add', '.');
  git('commit', '-m', 'rollback');
  const retained = git('rev-parse', 'HEAD');
  git('branch', '-f', 'rollback', retained);
  git('checkout', '--detach', head);
  const first = footprintReachability(cwd, baseline);
  assert.ok(first.rollback.bytes > 0);
  assert.equal(first.delivered.bytes, 0);
  git('branch', 'duplicate', retained);
  assert.deepEqual(footprintReachability(cwd, baseline).rollback, first.rollback);
  git('tag', '-a', 'checkpoint', '-m', 'retained', retained);
  assert.ok(footprintReachability(cwd, baseline).rollback.bytes >= first.rollback.bytes);
  git('checkout', '-b', 'delivered', head);
  fs.writeFileSync(path.join(cwd, 'source'), 'delivered unique');
  git('add', '.');
  git('commit', '-m', 'delivered');
  const both = footprintReachability(cwd, baseline);
  assert.ok(both.delivered.bytes > 0);
  assert.ok(both.rollback.bytes > 0);
  assert.deepEqual(footprintReachability(cwd, null), { delivered: null, rollback: null, changedRefs: [] });
});

test('server discovery uses owned cwd, port and start time, and handles PID reuse without stopping anything', t => {
  const { cwd, call } = fixture(t);
  const bin = path.join(cwd, 'bin');
  fs.mkdirSync(bin);
  const listing = path.join(bin, 'listeners');
  const started = path.join(bin, 'started');
  fs.writeFileSync(listing, '');
  fs.writeFileSync(started, '123 Wed Oct 28 06:44:20 2026\n456 Wed Oct 28 05:00:00 2026\n');
  fs.writeFileSync(path.join(bin, 'lsof'), `#!/bin/sh\ncase " $* " in\n*" -iTCP "*) cat '${listing}';;\n*) printf 'p123\\nfcwd\\nn${cwd}\\np456\\nfcwd\\nn/unrelated\\n';;\nesac\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'ps'), `#!/bin/sh\ncat '${started}'\n`, { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
  t.after(() => { process.env.PATH = originalPath; });
  call('start');
  fs.writeFileSync(listing, 'p123\nf3\nn127.0.0.1:8790\np456\nf4\nn127.0.0.1:8772\n');
  const first = call('check').record.resources.filter(item => item.kind === 'server');
  assert.equal(first.length, 1);
  assert.equal(first[0].port, 8790);
  assert.equal(first[0].startTime, 'Wed Oct 28 06:44:20 2026');
  assert.equal(first[0].present, true);
  fs.writeFileSync(started, '123 Thu Oct 29 06:44:20 2026\n456 Wed Oct 28 05:00:00 2026\n');
  const reused = call('check').record.resources.filter(item => item.kind === 'server');
  assert.equal(reused.length, 2);
  assert.equal(reused[0].present, false);
  assert.equal(reused[1].present, true);
  fs.writeFileSync(path.join(bin, 'lsof'), '#!/bin/sh\nexit 2\n', { mode: 0o755 });
  const unavailable = call('check').record;
  assert.match(unavailable.inventoryUnknown, /unavailable/);
  assert.equal(unavailable.resources.find(item => item.kind === 'server').present, null);
});

test('prepare keeps compliance preparation working when footprint fails', t => {
  const { cwd, run, git } = fixture(t);
  const bin = path.join(cwd, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\nexit 7\n', { mode: 0o755 });
  fs.writeFileSync(path.join(cwd, 'source'), 'staged');
  git('add', 'source');
  const result = spawnSync('bash', [prepare, 'ORKA-test'], { cwd, encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOT_FILE_SCOPE_REPO_ROOT: cwd } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Footprint warning: check unavailable/);
  assert.ok(fs.existsSync(path.join(cwd, '.beads/commit-check/ORKA-test.json')));
  const missing = spawnSync('bash', [prepare], { cwd, encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /usage:/);
  assert.match(run(process.execPath, [tool, 'footprint:check', '--task', 'missing']), /baseline unknown/);
});
