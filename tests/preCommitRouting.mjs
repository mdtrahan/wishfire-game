import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise the real hook's routing without Beads, staged work or heavyweight proofs.
export function runPreCommit(stagedPaths, failCommand = '', mergeSource = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orka-hook-routing-'));
  const bin = path.join(root, 'bin'), log = path.join(root, 'commands');
  const executable = (file, source) => fs.writeFileSync(file, `#!/bin/sh\n${source}\n`, { mode: 0o755 });
  try {
    fs.mkdirSync(bin);
    fs.mkdirSync(path.join(root, 'tools'));
    executable(path.join(bin, 'bd'), 'printf \'[{"id":"ORKA-test"}]\\n\'');
    executable(path.join(bin, 'git'), '[ "$*" = "diff --cached --name-only --diff-filter=ACMRD" ] || exit 1\nprintf "%s\\n" "$ROUTING_PATHS"');
    for (const command of ['node', 'npm']) executable(path.join(bin, command),
      `printf '%s\\n' '${command} '"$*" >> "$ROUTING_LOG"\n[ '${command} '"$*" != "$ROUTING_FAIL" ]`);
    for (const helper of ['enforce_commit_check.sh', 'enforce_hot_file_scope.sh'])
      executable(path.join(root, 'tools', helper), 'exit 0');
    const hook = mergeSource ?? fs.readFileSync(new URL('../.beads/hooks/pre-commit', import.meta.url), 'utf8');
    // The merge runner resolves its repo from its own location.
    const script = path.join(root, 'tools', 'routing.sh');
    fs.writeFileSync(script, hook.replaceAll('/tmp/bd_precommit_', `${root}/bd_precommit_`));
    const result = spawnSync('bash', [script, ...(mergeSource === null ? [] : ['--staged'])], {
      cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`,
        ROUTING_PATHS: stagedPaths.join('\n'), ROUTING_LOG: log, ROUTING_FAIL: failCommand },
    });
    assert.ifError(result.error);
    const commands = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
    return { status: result.status, commands, stderr: result.stderr };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export const mergeSource = () => fs.readFileSync(new URL('../tools/run_merge_tests.sh', import.meta.url), 'utf8');
export const runMerge = (paths, failCommand = '', source = mergeSource()) => runPreCommit(paths, failCommand, source);
