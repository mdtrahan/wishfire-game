import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MiB = 1024 * 1024;
const generated = /^(?:output\/(?:checkpoints|qa|storage-repair)\/|\.beads\/backup\/|work\/|dist(?:-offline)?\/)/;

export function storageViolations(entries) {
  const errors = [];
  let total = 0;
  let runtime = 0;
  for (const { path, bytes } of entries) {
    total += bytes;
    if (/^(?:web-runner|src|Scripts|rust)\//.test(path)) runtime += bytes;
    if (bytes > 20 * MiB) errors.push(`${path}: ${(bytes / MiB).toFixed(1)} MiB exceeds the 20 MiB file limit`);
  }
  if (total > 384 * MiB) errors.push(`Tracked tree: ${(total / MiB).toFixed(1)} MiB exceeds 384 MiB`);
  if (runtime > 200 * MiB) errors.push(`Runtime source/assets: ${(runtime / MiB).toFixed(1)} MiB exceeds 200 MiB`);
  return errors;
}

export function checkStagedStorage() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * MiB });
  const staged = git('diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR').split('\0').filter(Boolean);
  const errors = staged.filter(path => generated.test(path)).map(path => `${path}: generated evidence/recovery belongs outside Git`);
  const entries = git('ls-files', '--stage', '-z').split('\0').filter(Boolean).map(line => {
    const tab = line.indexOf('\t');
    const [mode, oid, stage] = line.slice(0, tab).split(' ');
    if (stage !== '0') throw new Error(`Unmerged index entry: ${line.slice(tab + 1)}`);
    return { path: line.slice(tab + 1), oid, mode };
  });
  const sizes = execFileSync('git', ['cat-file', '--batch-check=%(objectsize)'], {
    input: entries.map(entry => entry.oid).join('\n') + '\n', encoding: 'utf8', maxBuffer: 16 * MiB,
  }).trim().split('\n');
  entries.forEach((entry, index) => {
    entry.bytes = entry.mode === '160000' ? 0 : Number(sizes[index]);
    if (!Number.isFinite(entry.bytes)) throw new Error(`Cannot measure staged object: ${entry.path}`);
  });
  errors.push(...storageViolations(entries));
  if (errors.length) throw new Error(`Storage guard rejected commit:\n${errors.join('\n')}`);
  return entries.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Storage guard passed: ${checkStagedStorage()} indexed files.`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
