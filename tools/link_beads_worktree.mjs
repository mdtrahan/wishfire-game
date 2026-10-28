import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { beadId, footprintCommand } from './storage_hygiene.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const checkout = realpathSync(git('rev-parse', '--show-toplevel'));
const commonGit = realpathSync(git('rev-parse', '--path-format=absolute', '--git-common-dir'));
const authoritative = dirname(commonGit);
const beads = join(checkout, '.beads');
const redirect = join(beads, 'redirect');
const branch = git('rev-parse', '--symbolic-full-name', 'HEAD');
const task = beadId(branch) || /^refs\/heads\/experiment\/(ORKA-[a-z0-9]+(?:\.\d+)?)(?:-|$)/.exec(branch)?.[1];
if (task) {
  try { footprintCommand('start', ['--task', task]); }
  catch (error) { console.warn(`Footprint warning: ${error.message}`); }
}

if (checkout === authoritative) {
  console.log('Authoritative Beads checkout; no redirect needed.');
} else if (!existsSync(join(authoritative, '.beads', 'dolt'))) {
  throw new Error(`Authoritative Beads database missing: ${authoritative}`);
} else if (!existsSync(beads) || existsSync(join(beads, 'dolt'))) {
  throw new Error(`Worktree has no .beads directory or has lane-local Dolt state: ${checkout}`);
} else if (existsSync(redirect)) {
  if (readFileSync(redirect, 'utf8').trim() !== join(authoritative, '.beads')) {
    throw new Error(`Conflicting Beads redirect: ${redirect}`);
  }
  console.log(`Beads already redirects to ${authoritative}/.beads`);
} else {
  writeFileSync(redirect, `${join(authoritative, '.beads')}\n`, { flag: 'wx' });
  console.log(`Beads redirects to ${authoritative}/.beads`);
}

if (checkout !== authoritative) {
  const excluded = ['.beads/backup', 'output'];
  const dirty = git('status', '--porcelain=v1', '--untracked-files=no', '--', ...excluded);
  if (dirty) throw new Error('Refusing sparse exclusions over modified tracked output/backup files; preserve them first.');
  const sparseFile = git('rev-parse', '--git-path', 'info/sparse-checkout');
  const previous = existsSync(sparseFile) ? readFileSync(sparseFile, 'utf8') : '/*\n';
  const patterns = [...new Set([...previous.trim().split('\n'), ...excluded.map(path => `!/${path}/`)])];
  execFileSync('git', ['sparse-checkout', 'set', '--no-cone', '--stdin'], {
    input: patterns.join('\n') + '\n', stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log('Worktree excludes tracked output and authoritative Beads backup copies.');
}
