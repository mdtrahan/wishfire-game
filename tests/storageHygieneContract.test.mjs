import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { beadId, parseWorktrees, retirementReason } from '../tools/storage_hygiene.mjs';

test('worktree inventory preserves branch and detached state', () => {
  const entries = parseWorktrees('worktree /repo\nHEAD abc\nbranch refs/heads/bead/ORKA-123-name\n\nworktree /detached\nHEAD def\ndetached\n');
  assert.equal(entries.length, 2);
  assert.equal(beadId(entries[0].branch), 'ORKA-123');
  assert.equal(entries[1].detached, true);
  assert.equal(beadId('refs/heads/bead/ORKA-ymk.2-name'), 'ORKA-ymk.2');
});

test('retirement requires a present, clean, merged, CLOSED Bead worktree', () => {
  const eligible = { path: '/repo/.worktrees/lane', root: '/repo', exists: true,
    branch: 'refs/heads/bead/ORKA-123-name', beadId: 'ORKA-123',
    dirty: false, merged: true, beadStatus: 'closed' };
  assert.equal(retirementReason(eligible), null);
  for (const [change, reason] of [
    [{ dirty: true }, 'dirty worktree'],
    [{ merged: false }, 'unmerged commit'],
    [{ beadStatus: 'open' }, 'open Bead status'],
    [{ beadStatus: undefined }, 'unknown Bead status'],
    [{ beadId: undefined }, 'unknown Bead identity'],
    [{ detached: true, branch: undefined }, 'detached worktree'],
    [{ branch: 'refs/heads/main' }, 'main worktree'],
    [{ path: '/repo' }, 'main worktree'],
    [{ exists: false }, 'missing or unreadable worktree'],
    [{ prunable: true }, 'missing or unreadable worktree'],
    [{ error: 'unreadable' }, 'missing or unreadable worktree'],
    [{ ignored: ['test-results/ui-lock/'] }, 'protected ignored files present (test-results/ui-lock/)'],
    [{ ignored: ['node_modules/'] }, null],
    [{ ignored: ['tools/__pycache__/'] }, null],
    [{ ignored: ['.beads/.local_version', '.beads/last-touched', 'web-runner/runtime-fingerprint.js'] }, null],
    [{ ignored: ['.beads/dolt/.dolt/noms/journal.idx'] }, 'protected ignored files present (.beads/dolt/.dolt/noms/journal.idx)'],
    [{ ignored: ['test-results/ui-lock/run/report.json'] }, 'protected ignored files present (test-results/ui-lock/run/report.json)'],
    [{ ignored: ['node_modules/custom', 'output/unique.png'] }, 'protected ignored files present (output/unique.png)'],
  ]) assert.equal(retirementReason({ ...eligible, ...change }), reason);
});

test('apply requires an exact registered worktree', () => {
  const tool = fileURLToPath(new URL('../tools/storage_hygiene.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [tool, 'clean', '--apply'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /specify one exact registered absolute path/);
});

test('cleanup refuses unknown evidence and dirty files, then removes only allowlisted artifacts', () => {
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'orka-storage-')));
  const lane = path.join(temp, 'lane');
  const tool = fileURLToPath(new URL('../tools/storage_hygiene.mjs', import.meta.url));
  const bd = path.join(temp, 'bd-stub');
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: temp, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  const clean = (status = 'closed', apply = true) => spawnSync(process.execPath,
    [tool, 'clean', '--worktree', lane, ...(apply ? ['--apply'] : [])],
    { cwd: temp, encoding: 'utf8', env: { ...process.env, BD_BIN: bd, BD_STATUS: status } });
  try {
    git('init', '-b', 'main');
    fs.writeFileSync(path.join(temp, '.gitignore'), 'dist/\nnode_modules/\n.beads/.local_version\n.beads/dolt/\ntest-results/\nweb-runner/runtime-fingerprint.js\n');
    fs.mkdirSync(path.join(temp, 'node_modules'));
    fs.writeFileSync(path.join(temp, 'node_modules/.package-lock.json'), '{}');
    git('add', '.gitignore');
    git('add', '-f', 'node_modules/.package-lock.json');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture');
    git('worktree', 'add', '-b', 'bead/ORKA-123-clean', lane, 'main');
    fs.writeFileSync(bd, '#!/bin/sh\nprintf "[{\\"id\\":\\"ORKA-123\\",\\"status\\":\\"%s\\"}]\\n" "$BD_STATUS"\n', { mode: 0o755 });
    for (const file of ['dist/cache.bin', 'node_modules/cache.bin', '.beads/.local_version', 'web-runner/runtime-fingerprint.js', '.beads/dolt/unique']) {
      fs.mkdirSync(path.dirname(path.join(lane, file)), { recursive: true });
      fs.writeFileSync(path.join(lane, file), file);
    }
    assert.match(clean().stderr, /protected ignored files present/);
    assert.equal(fs.existsSync(path.join(lane, '.beads/dolt/unique')), true);
    fs.rmSync(path.join(lane, '.beads/dolt'), { recursive: true });
    fs.mkdirSync(path.join(lane, 'test-results/ui-lock/run'), { recursive: true });
    fs.writeFileSync(path.join(lane, 'test-results/ui-lock/run/report.json'), '{}');
    assert.match(clean().stderr, /protected ignored files present/);
    assert.equal(fs.existsSync(path.join(lane, 'test-results/ui-lock/run/report.json')), true);
    fs.rmSync(path.join(lane, 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(lane, 'unique-source.txt'), 'keep');
    assert.match(clean().stderr, /dirty worktree/);
    fs.rmSync(path.join(lane, 'unique-source.txt'));
    assert.match(clean('open').stderr, /open Bead status/);
    assert.match(clean('unknown').stderr, /unknown Bead status/);
    assert.match(clean('closed', false).stdout, /Regeneratable ignored paths to discard: 4/);
    const result = clean();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(lane), false);
    assert.equal(spawnSync('git', ['show', 'main:node_modules/.package-lock.json'], { cwd: temp, encoding: 'utf8' }).stdout, '{}');
    assert.equal(spawnSync('git', ['branch', '--list', 'bead/ORKA-123-clean'], { cwd: temp, encoding: 'utf8' }).stdout.trim().length > 0, true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
