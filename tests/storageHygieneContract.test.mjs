import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
  ]) assert.equal(retirementReason({ ...eligible, ...change }), reason);
});

test('apply requires an exact registered worktree', () => {
  const tool = fileURLToPath(new URL('../tools/storage_hygiene.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [tool, 'clean', '--apply'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /specify one exact registered absolute path/);
});
