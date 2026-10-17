// Provenance checks for the combat knowledge lab. Everything here reads files and Git objects;
// nothing loads or executes Wishfire runtime code.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// sourceFingerprint() in balance_harness.js hashes `git diff --binary HEAD` followed by the JSON
// list of untracked files. A clean checkout therefore hashes '' + '[]'.
export const EMPTY_PATCH_SHA256 = createHash('sha256').update('').update('[]').digest('hex');
export const GAME_RUNTIME_PATHS = Object.freeze(['web-runner', 'src', 'Scripts', 'rust']);

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function fileEvidence(file) {
  if (!file) return { path: null, status: 'not_declared' };
  if (!fs.existsSync(file)) return { path: file, status: 'missing' };
  const bytes = fs.readFileSync(file);
  return { path: file, status: 'present', bytes: bytes.length, sha256: sha256Bytes(bytes) };
}

function git(repo, args) {
  try {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function gameTreeIds(repo, rev, paths = GAME_RUNTIME_PATHS) {
  return Object.fromEntries(paths.map(entry => [entry, git(repo, ['rev-parse', `${rev}:${entry}`])]));
}

// Compare runtime trees at the run's source head with the declared candidate. A dirty run source
// cannot be compared from the report alone, so the result becomes unknown rather than unchanged.
export function compareGameSource(repo, runSource, candidateSha, paths = GAME_RUNTIME_PATHS) {
  if (!runSource?.head) return { status: 'unknown', reason: 'run source head was not recorded' };
  if (runSource.patchSha256 !== EMPTY_PATCH_SHA256) {
    return { status: 'unknown', reason: `run source had a nonempty patch (${String(runSource.patchSha256).slice(0, 8)}); runtime bytes cannot be proven from the report`, head: runSource.head };
  }
  const candidate = gameTreeIds(repo, candidateSha, paths);
  const run = gameTreeIds(repo, runSource.head, paths);
  if (Object.values(candidate).some(value => value == null)) return { status: 'unknown', reason: `candidate ${candidateSha} is not readable in ${repo}` };
  if (Object.values(run).some(value => value == null)) return { status: 'unknown', reason: `run head ${runSource.head} is not readable in ${repo}` };
  const differing = paths.filter(entry => candidate[entry] !== run[entry]);
  return differing.length
    ? { status: 'mismatch', reason: `runtime tree differs from candidate in ${differing.join(', ')}`, head: runSource.head, differing }
    : { status: 'unchanged', head: runSource.head, candidate: candidateSha, trees: run };
}

// The claim file is declared by committing it. Its committed bytes must equal the bytes evaluated,
// and a prospective run must start after that commit.
export function claimDeclaration(repo, claimsPath) {
  const evidence = fileEvidence(claimsPath);
  if (evidence.status !== 'present') return { status: 'missing', evidence };
  const relative = path.relative(repo, path.resolve(claimsPath));
  const log = git(repo, ['log', '-1', '--format=%H %cI', '--', relative]);
  if (!log) return { status: 'uncommitted', evidence, reason: 'claim file has no commit; expectations cannot be shown to predate runs' };
  const [commit, committedAt] = log.split(' ');
  let committedSha = null;
  try {
    committedSha = sha256Bytes(execFileSync('git', ['show', `${commit}:${relative}`], { cwd: repo, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    committedSha = null;
  }
  if (committedSha !== evidence.sha256) return { status: 'modified_after_commit', evidence, commit, committedAt, reason: 'working claim file differs from its last commit' };
  return { status: 'committed', evidence, commit, committedAt };
}

// Returns an array of mismatch strings; empty means the observed run matches the declaration.
export function checkScenarioProvenance(expect = {}, observed = {}) {
  const problems = [];
  const same = (label, want, got) => {
    if (want === undefined) return;
    if (got === undefined || got === null) problems.push(`${label}: expected ${JSON.stringify(want)}, observed value missing`);
    else if (JSON.stringify(want) !== JSON.stringify(got)) problems.push(`${label}: expected ${JSON.stringify(want)}, observed ${JSON.stringify(got)}`);
  };
  same('lamp fixture SHA-256', expect.lampFixtureSha256, observed.lampFixtureSha256);
  same('hero fixture SHA-256', expect.heroFixtureSha256, observed.heroFixtureSha256);
  same('hero slots', expect.heroSlots, observed.heroSlots);
  same('auto-equip', expect.autoEquip, observed.autoEquip);
  same('boss policy', expect.bossPolicy, observed.bossPolicy);
  same('max waves', expect.maxWaves, observed.maxWaves);
  same('max boss clears', expect.maxBossClears, observed.maxBossClears);
  same('max boss timeouts', expect.maxBossTimeouts, observed.maxBossTimeouts);
  if (expect.levels) {
    const levels = Object.fromEntries((observed.openingHeroes || []).map(hero => [hero.name, hero.level]));
    for (const [name, level] of Object.entries(expect.levels)) same(`${name} opening level`, level, levels[name]);
  }
  if (expect.seeds) {
    const missing = expect.seeds.filter(seed => !(observed.seeds || []).includes(seed));
    if (missing.length) problems.push(`seeds missing from evidence: ${missing.join(', ')}`);
  }
  return problems;
}
