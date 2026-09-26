#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const generated = [
  '.beads/backup', 'web-runner/assets', 'test-results', 'output',
  'dist', 'dist-offline', 'rust/simulation_core/target', 'node_modules', '.serena/cache', 'tools/__pycache__',
];
const regeneratableDirs = [
  'dist', 'dist-offline', 'rust/simulation_core/target', 'node_modules', '.serena/cache', 'tools/__pycache__',
];
const regeneratableFiles = ['.beads/.local_version', '.beads/last-touched', 'web-runner/runtime-fingerprint.js'];
const regeneratable = new Set([...regeneratableDirs, ...regeneratableFiles]);

function protectedIgnored(paths = []) {
  return paths.filter(target => !regeneratableFiles.includes(target) &&
    !regeneratableDirs.some(name => target === name || target.startsWith(`${name}/`)));
}

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  });
}

function git(cwd, ...args) {
  return run('git', ['-C', cwd, ...args], cwd);
}

function required(result, label) {
  if (result.status !== 0) throw new Error(`${label}: ${result.stderr.trim() || result.error?.message || 'command failed'}`);
  return result.stdout.trim();
}

export function parseWorktrees(raw) {
  return raw.trim().split(/\n\n+/).filter(Boolean).map(block => {
    const entry = {};
    for (const line of block.split('\n')) {
      const space = line.indexOf(' ');
      entry[space < 0 ? line : line.slice(0, space)] = space < 0 ? true : line.slice(space + 1);
    }
    return entry;
  });
}

export function beadId(branch) {
  return /^refs\/heads\/(?:bead|codex)\/(ORKA-[a-z0-9]+(?:\.\d+)?)(?:-|$)/.exec(branch || '')?.[1];
}

export function retirementReason(state, { historicalDetached = false, supersededAncestor = false } = {}) {
  if (state.prunable || !state.exists || state.error) return 'missing or unreadable worktree';
  if (state.path === state.root || state.branch === 'refs/heads/main') return 'main worktree';
  if (historicalDetached ? !state.detached || state.branch : !state.branch || state.detached)
    return historicalDetached ? 'not a detached worktree' : 'detached worktree';
  if (state.dirty) return 'dirty worktree';
  if (!state.merged && !supersededAncestor) return 'unmerged commit';
  if (supersededAncestor && !state.successorContains) return 'target HEAD is not an ancestor of successor HEAD';
  if (historicalDetached || supersededAncestor) {
    if (state.dolt) return 'lane-local Dolt state';
  }
  if (!historicalDetached) {
    if (!state.beadId) return 'unknown Bead identity';
    if (state.beadStatus !== 'closed') return `${state.beadStatus || 'unknown'} Bead status`;
  }
  const protectedPaths = protectedIgnored(state.ignored);
  if (protectedPaths.length) return `protected ignored files present (${protectedPaths.slice(0, 3).join(', ')})`;
  return null;
}

function sizeKiB(target) {
  if (!fs.existsSync(target)) return 0;
  const result = run('du', ['-sk', target]);
  if (result.status !== 0) throw new Error(`du ${target}: ${result.stderr.trim()}`);
  return Number(result.stdout.split(/\s+/)[0]);
}

function size(kib) {
  return kib >= 1024 * 1024 ? `${(kib / 1024 / 1024).toFixed(2)} GiB` : `${(kib / 1024).toFixed(1)} MiB`;
}

function commonRoot() {
  const common = required(git(process.cwd(), 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'Git common directory');
  return path.dirname(common);
}

function linkedWorktrees(root) {
  return parseWorktrees(required(git(root, 'worktree', 'list', '--porcelain'), 'worktree list'));
}

function inspect(entry, root, main, options = {}) {
  const target = entry.worktree;
  const state = { path: target, root, branch: entry.branch, detached: entry.detached, prunable: entry.prunable,
    exists: fs.existsSync(target), beadId: beadId(entry.branch) };
  if (!state.exists || state.prunable) return state;
  const status = git(target, 'status', '--porcelain=v1', '-z', '--untracked-files=normal');
  if (status.status !== 0) { state.error = status.stderr.trim(); return state; }
  const head = git(target, 'rev-parse', 'HEAD');
  if (head.status !== 0 || head.stdout.trim() !== entry.HEAD) {
    state.error = 'HEAD changed or could not be verified';
    return state;
  }
  state.dirty = status.stdout.length > 0;
  state.dolt = Boolean(fs.lstatSync(path.join(target, '.beads/dolt'), { throwIfNoEntry: false }));
  state.merged = git(root, 'merge-base', '--is-ancestor', head.stdout.trim(), main).status === 0;
  if (options.supersededAncestor)
    state.successorContains = git(root, 'merge-base', '--is-ancestor', head.stdout.trim(), options.successorHead).status === 0;
  return state;
}

function beadStatuses(ids, root) {
  if (!ids.length) return new Map();
  const bin = process.env.BD_BIN || (fs.existsSync('/opt/homebrew/bin/bd') ? '/opt/homebrew/bin/bd' : 'bd');
  const result = run(bin, ['--readonly', '--sandbox', 'show', ...ids, '--json'], root);
  if (result.status !== 0) return new Map();
  try {
    return new Map(JSON.parse(result.stdout).map(issue => [issue.id, issue.status]));
  } catch {
    return new Map(); // A failed Beads read can never authorize retirement.
  }
}

function classify(entries, root, main, options = {}) {
  const states = entries.map(entry => inspect(entry, root, main, options));
  const ids = [...new Set(states.filter(state => state.beadId && !state.dirty && (state.merged || options.supersededAncestor)).map(state => state.beadId))];
  const statuses = beadStatuses(ids, root);
  for (const state of states) {
    state.beadStatus = statuses.get(state.beadId);
    if (retirementReason(state, options)) continue;
    const ignored = git(state.path, 'status', '--porcelain=v1', '-z', '--ignored', '--untracked-files=all');
    if (ignored.status !== 0) state.error = ignored.stderr.trim() || 'ignored-file scan failed';
    else state.ignored = ignored.stdout.split('\0').filter(line => line.startsWith('!! ')).map(line => line.slice(3));
  }
  return states;
}

function relatedRoots(root) {
  const home = os.homedir();
  const sibling = path.dirname(root);
  const result = [root, ...['Codex-Orka-backups', 'Codex-Orka-safe-checkpoints', 'Codex-Orka-legacy-archive', 'Wishfire'].map(name => path.join(sibling, name))];
  const addMatches = (directory, match, child) => {
    if (!fs.existsSync(directory)) return;
    for (const name of fs.readdirSync(directory).filter(match)) result.push(child ? path.join(directory, name, child) : path.join(directory, name));
  };
  addMatches(path.join(home, '.codex', 'worktrees'), () => true, 'Codex-Orka');
  addMatches(path.join(home, '.codex', 'archives'), name => name.startsWith('Codex-Orka-'));
  addMatches(path.join(home, '.code-index'), name => name.startsWith('local-Codex-Orka'));
  addMatches(path.join(home, '.doc-index', 'local'), name => name.startsWith('Codex-Orka'));
  addMatches(path.join(home, '.cache', 'codebase-memory-mcp'), name => name.includes('Codex-Orka'));
  return [...new Set(result.filter(fs.existsSync))];
}

function audit(root, entries, states) {
  const roots = relatedRoots(root);
  const ecosystem = roots.reduce((total, target) => total + sizeKiB(target), 0);
  const paths = [...new Set([...entries.map(entry => entry.worktree), ...roots.filter(target => target.endsWith('/Codex-Orka'))])];
  const totals = generated.map(name => ({ name, kib: paths.reduce((total, target) => total + sizeKiB(path.join(target, name)), 0) }))
    .sort((a, b) => b.kib - a.kib);
  const ready = states.filter(state => !retirementReason(state));
  console.log(`Ecosystem: ${size(ecosystem)} across ${roots.length} measured roots`);
  console.log(`Worktrees: ${states.length} registered; ${states.filter(state => state.dirty).length} dirty; ${states.filter(state => state.merged === false).length} unmerged`);
  console.log(`Removable (CLOSED + merged + clean + no protected ignored files): ${ready.length} worktrees (${size(ready.reduce((total, state) => total + sizeKiB(state.path), 0))})`);
  for (const state of ready) console.log(`  ${state.path}`);
  console.log(`Regeneratable directories: ${size(totals.filter(row => regeneratable.has(row.name)).reduce((total, row) => total + row.kib, 0))} gross; may overlap removable worktrees`);
  console.log('Largest duplicated/generated directories (gross, no deletion authorized):');
  for (const row of totals) if (row.kib) console.log(`  ${size(row.kib).padStart(10)}  ${row.name}`);
  console.log('Protected: backups, checkpoints, archives, output, test evidence, VFX, Git history, dirty and unmerged worktrees.');
}

function clean(root, entries, main, args) {
  const flags = args.slice(2);
  const apply = flags.includes('--apply');
  const historicalDetached = flags.includes('--historical-detached');
  const successorFlag = flags.indexOf('--superseded-by');
  const supersededAncestor = successorFlag >= 0;
  const successorPath = supersededAncestor ? flags[successorFlag + 1] : null;
  if (args[0] !== '--worktree' || !args[1] || !path.isAbsolute(args[1]) ||
      (supersededAncestor && (!successorPath || !path.isAbsolute(successorPath) || historicalDetached)) ||
      flags.length !== Number(apply) + Number(historicalDetached) + (supersededAncestor ? 2 : 0) ||
      flags.some((flag, index) => flag !== '--apply' && flag !== '--historical-detached' &&
        flag !== '--superseded-by' && index !== successorFlag + 1))
    throw new Error('REFUSED: specify one exact registered absolute path with --worktree [--historical-detached | --superseded-by <registered-successor-path>] [--apply]');
  const target = path.resolve(args[1]);
  const entry = entries.find(item => item.worktree === target);
  if (!entry) throw new Error(`REFUSED: unregistered worktree ${target}`);
  const successor = supersededAncestor && entries.find(item => item.worktree === path.resolve(successorPath));
  if (supersededAncestor && (!successor || successor.worktree === target || successor.worktree === root || successor.prunable || !fs.existsSync(successor.worktree)))
    throw new Error('REFUSED: successor must be a separate registered present worktree');
  const successorHead = supersededAncestor && required(git(successor.worktree, 'rev-parse', 'HEAD'), 'successor HEAD');
  if (supersededAncestor && successorHead !== successor.HEAD)
    throw new Error('REFUSED: successor HEAD changed or could not be verified');
  const options = { historicalDetached, supersededAncestor, successorHead };
  const state = classify([entry], root, main, options)[0];
  const reason = retirementReason(state, options);
  if (reason) throw new Error(`REFUSED: ${target}: ${reason}; no data was removed`);
  const disposable = state.ignored;
  const tracked = required(git(target, 'ls-files', '-z'), 'tracked-file scan').split('\0').filter(Boolean);
  const realTarget = fs.realpathSync(target);
  for (const name of disposable) {
    const parent = path.dirname(name);
    if (fs.realpathSync(path.join(target, parent)) !== path.join(realTarget, parent))
      throw new Error(`REFUSED: ${target}: symlinked parent of ${name}; no data was removed`);
    if (tracked.some(file => file === name || file.startsWith(`${name.replace(/\/$/, '')}/`)))
      throw new Error(`REFUSED: ${target}: tracked files under ${name}; no data was removed`);
    if (!fs.lstatSync(path.join(target, name), { throwIfNoEntry: false }))
      throw new Error(`REFUSED: ${target}: ignored path disappeared (${name}); no data was removed`);
  }
  if (apply) {
    const before = sizeKiB(target);
    for (const name of disposable) fs.rmSync(path.join(target, name), { recursive: true });
    if (supersededAncestor) {
      const currentSuccessor = linkedWorktrees(root).find(item => item.worktree === successor.worktree);
      const currentHead = currentSuccessor && git(successor.worktree, 'rev-parse', 'HEAD');
      if (!currentSuccessor || currentSuccessor.prunable || !currentHead || currentHead.status !== 0 ||
          currentHead.stdout.trim() !== currentSuccessor.HEAD || currentHead.stdout.trim() !== successorHead)
        throw new Error('REFUSED: successor changed or is no longer registered; worktree was preserved');
    }
    const remaining = classify([entry], root, main, options)[0];
    const remainingReason = retirementReason(remaining, options);
    if (remainingReason || remaining.ignored.length)
      throw new Error(`REFUSED: ${target}: ${remainingReason || 'ignored files remain'}; worktree was preserved`);
    required(git(root, 'worktree', 'remove', target), `remove ${target}`);
    console.log(`REMOVED: ${target} (${size(before)} measured before removal).${historicalDetached ? ' Detached commit remains on main.' : ` Branch ${state.branch} remains.`}`);
    return;
  }
  console.log(`DRY RUN: ${target} is ${historicalDetached ? 'detached with HEAD on main' : supersededAncestor ? 'CLOSED with HEAD on registered successor' : 'CLOSED and merged'}, and clean (${size(sizeKiB(target))}).`);
  console.log(`Regeneratable ignored paths to discard: ${disposable.length} (${disposable.slice(0, 5).join(', ')}${disposable.length > 5 ? ', ...' : ''}).`);
  console.log(historicalDetached ? 'Detached commit is retained on main.' : `Branch ${state.branch} would remain.`);
  console.log('No worktree, file, branch, backup, or Git history was changed.');
}

function main() {
  const root = commonRoot();
  const entries = linkedWorktrees(root);
  const main = required(git(root, 'rev-parse', 'main'), 'main commit');
  const command = process.argv[2];
  if (command === 'audit') audit(root, entries, classify(entries, root, main));
  else if (command === 'clean') clean(root, entries, main, process.argv.slice(3));
  else throw new Error('Usage: storage_hygiene.mjs audit | clean --worktree <registered-path>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
