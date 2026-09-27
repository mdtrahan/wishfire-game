import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const checkout = realpathSync(git('rev-parse', '--show-toplevel'));
const commonGit = realpathSync(git('rev-parse', '--path-format=absolute', '--git-common-dir'));
const authoritative = dirname(commonGit);
const beads = join(checkout, '.beads');
const redirect = join(beads, 'redirect');

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
