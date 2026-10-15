import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storageViolations } from '../tools/enforce_storage_budget.mjs';

const MiB = 1024 * 1024;
test('storage budgets accept game-sized assets and reject archive-sized payloads', () => {
  assert.deepEqual(storageViolations([{ path: 'web-runner/atlas.png', bytes: 12 * MiB }]), []);
  assert.match(storageViolations([{ path: 'recovery.part-aa', bytes: 2000 * MiB }]).join('\n'), /20 MiB file limit/);
  assert.match(storageViolations(Array.from({ length: 21 }, (_, i) => ({ path: `web-runner/${i}.png`, bytes: 10 * MiB }))).join('\n'), /200 MiB/);
  assert.match(storageViolations(Array.from({ length: 40 }, (_, i) => ({ path: `inputs/${i}.png`, bytes: 10 * MiB }))).join('\n'), /384 MiB/);
});

test('commit guard rejects generated output even when force-staged and small', () => {
  const root = mkdtempSync(join(tmpdir(), 'orka-storage-budget-'));
  const guard = new URL('../tools/enforce_storage_budget.mjs', import.meta.url).pathname;
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git('init', '--initial-branch=main');
    mkdirSync(join(root, 'output', 'checkpoints'), { recursive: true });
    writeFileSync(join(root, 'output', 'checkpoints', 'recovery.txt'), 'recovery');
    git('add', 'output/checkpoints/recovery.txt');
    assert.throws(() => execFileSync(process.execPath, [guard], { cwd: root, stdio: 'pipe' }), /generated evidence\/recovery/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
