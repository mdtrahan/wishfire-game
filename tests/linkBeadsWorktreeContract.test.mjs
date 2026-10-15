import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const helper = new URL('../tools/link_beads_worktree.mjs', import.meta.url).pathname;

test('new worktree redirects to the root Beads database and refuses lane-local Dolt', () => {
  const root = mkdtempSync(join(tmpdir(), 'orka-beads-link-'));
  const lane = join(root, 'lane');
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.invalid');
    mkdirSync(join(root, '.beads', 'dolt'), { recursive: true });
    writeFileSync(join(root, '.beads', 'config.yaml'), 'test: true\n');
    mkdirSync(join(root, '.beads', 'backup'));
    writeFileSync(join(root, '.beads', 'backup', 'native-data'), 'backup');
    mkdirSync(join(root, 'output'));
    writeFileSync(join(root, 'output', 'large-recording'), 'evidence');
    git('add', '.beads', 'output');
    git('commit', '-m', 'fixture');
    git('worktree', 'add', '--detach', lane);

    const run = () => execFileSync(process.execPath, [helper], { cwd: lane, encoding: 'utf8' });
    run();
    assert.equal(readFileSync(join(lane, '.beads', 'redirect'), 'utf8').trim(), join(realpathSync(root), '.beads'));
    assert.equal(existsSync(join(lane, '.beads', 'backup')), false);
    assert.equal(existsSync(join(lane, 'output')), false);
    assert.equal(existsSync(join(root, 'output', 'large-recording')), true);
    assert.equal(existsSync(join(lane, '.beads', 'config.yaml')), true);
    run();
    git('-C', lane, 'sparse-checkout', 'disable');
    writeFileSync(join(lane, 'output', 'large-recording'), 'uncommitted evidence');
    assert.throws(run, /Refusing sparse exclusions/);
    git('-C', lane, 'restore', '--', 'output/large-recording');
    run();
    mkdirSync(join(lane, '.beads', 'dolt'));
    assert.throws(run, /lane-local Dolt state/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
