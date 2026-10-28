#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const generated = [
  '.beads/backup', 'web-runner/assets', 'test-results', 'output',
  'dist', 'dist-offline', 'rust/simulation_core/target', 'node_modules', '.serena/cache', 'tools/__pycache__',
];
const regeneratableDirs = [
  'dist', 'dist-offline', 'rust/simulation_core/target', 'node_modules', '.serena/cache', 'tools/__pycache__',
];
const regeneratableFiles = ['.beads/.local_version', '.beads/last-touched', '.beads/redirect', 'web-runner/runtime-fingerprint.js'];
const regeneratable = new Set([...regeneratableDirs, ...regeneratableFiles]);

function protectedIgnored(paths = []) {
  return paths.filter(target => !regeneratableFiles.includes(target) &&
    !regeneratableDirs.some(name => target === name || target.startsWith(`${name}/`)));
}

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    ...(process.env.TASK_FOOTPRINT_HOOK === '1' ? { timeout: 200, killSignal: 'SIGKILL' } : {}),
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

export function retirementReason(state, { historicalDetached = false, supersededAncestor = false, historical = false } = {}) {
  if (state.prunable || !state.exists || state.error) return 'missing or unreadable worktree';
  if (state.path === state.root || state.branch === 'refs/heads/main') return 'main worktree';
  if (historical ? !state.branch && !state.detached : historicalDetached ? !state.detached || state.branch : !state.branch || state.detached)
    return historicalDetached ? 'not a detached worktree' : 'detached worktree';
  if (state.dirty) return 'dirty worktree';
  if (!state.merged && !supersededAncestor && !historical) return 'unmerged commit';
  if (supersededAncestor && !state.successorContains) return 'target HEAD is not an ancestor of successor HEAD';
  if (historical && !state.durableRef) return 'HEAD lacks a durable local branch or tag';
  if (historicalDetached || supersededAncestor || historical) {
    if (state.dolt) return 'lane-local Dolt state';
  }
  if (!historicalDetached && !historical) {
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
  if (options.historical) {
    if (state.branch) {
      const ref = git(root, 'rev-parse', '--verify', state.branch);
      state.durableRef = ref.status === 0 && ref.stdout.trim() === head.stdout.trim();
    } else if (state.detached) {
      const refs = git(root, 'for-each-ref', '--contains', head.stdout.trim(), '--format=%(refname)', 'refs/heads', 'refs/tags');
      state.durableRef = refs.status === 0 && Boolean(refs.stdout.trim());
    }
  }
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
  const ids = options.historical ? [] : [...new Set(states.filter(state => state.beadId && !state.dirty && (state.merged || options.supersededAncestor)).map(state => state.beadId))];
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
  const historical = flags.includes('--historical');
  const successorFlag = flags.indexOf('--superseded-by');
  const supersededAncestor = successorFlag >= 0;
  const successorPath = supersededAncestor ? flags[successorFlag + 1] : null;
  if (args[0] !== '--worktree' || !args[1] || !path.isAbsolute(args[1]) ||
      (historical && (historicalDetached || supersededAncestor)) ||
      (supersededAncestor && (!successorPath || !path.isAbsolute(successorPath) || historicalDetached)) ||
      flags.length !== Number(apply) + Number(historicalDetached) + Number(historical) + (supersededAncestor ? 2 : 0) ||
      flags.some((flag, index) => flag !== '--apply' && flag !== '--historical-detached' &&
        flag !== '--historical' && flag !== '--superseded-by' && index !== successorFlag + 1))
    throw new Error('REFUSED: specify one exact registered absolute path with --worktree [--historical | --historical-detached | --superseded-by <registered-successor-path>] [--apply]');
  const target = path.resolve(args[1]);
  const entry = entries.find(item => item.worktree === target);
  if (!entry) throw new Error(`REFUSED: unregistered worktree ${target}`);
  const successor = supersededAncestor && entries.find(item => item.worktree === path.resolve(successorPath));
  if (supersededAncestor && (!successor || successor.worktree === target || successor.worktree === root || successor.prunable || !fs.existsSync(successor.worktree)))
    throw new Error('REFUSED: successor must be a separate registered present worktree');
  const successorHead = supersededAncestor && required(git(successor.worktree, 'rev-parse', 'HEAD'), 'successor HEAD');
  if (supersededAncestor && successorHead !== successor.HEAD)
    throw new Error('REFUSED: successor HEAD changed or could not be verified');
  const options = { historicalDetached, supersededAncestor, successorHead, historical };
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
    console.log(`REMOVED: ${target} (${size(before)} measured before removal).${historicalDetached ? ' Detached commit remains on main.' : historical && state.detached ? ' Detached commit remains reachable through a local branch or tag.' : ` Branch ${state.branch} remains.`}`);
    return;
  }
  console.log(`DRY RUN: ${target} is ${historical ? 'historical with HEAD held by a local ref' : historicalDetached ? 'detached with HEAD on main' : supersededAncestor ? 'CLOSED with HEAD on registered successor' : 'CLOSED and merged'}, and clean (${size(sizeKiB(target))}).`);
  console.log(`Regeneratable ignored paths to discard: ${disposable.length} (${disposable.slice(0, 5).join(', ')}${disposable.length > 5 ? ', ...' : ''}).`);
  console.log(historicalDetached ? 'Detached commit is retained on main.' : historical && state.detached ? 'Detached commit remains reachable through a local branch or tag.' : `Branch ${state.branch} would remain.`);
  console.log('No worktree, file, branch, backup, or Git history was changed.');
}

const MiB = 1024 * 1024;
const inside = (parent, child) => child === parent || child.startsWith(`${parent}${path.sep}`);
const forbidden = target => target.split(path.sep).some(part => ['history', '.git', '.beads'].includes(part));
const bytesLabel = bytes => bytes == null ? 'unknown' : Math.abs(bytes) < 1024 ? `${bytes} B`
  : Math.abs(bytes) < MiB ? `${(bytes / 1024).toFixed(1)} KiB` : size(bytes / 1024);
const isRebuildable = target => /(?:^|\/)(?:target|node_modules|dist(?:-offline)?|__pycache__)$/.test(target) || target.endsWith('/.serena/cache');

// Bound the entire optional hook, including synchronous filesystem work. Only its
// measurement child is subject to the deadline; application servers are untouched.
export function footprintHook(mode, args = [], cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `footprint:${mode}`, ...args], {
    cwd, encoding: 'utf8', timeout: 1000, killSignal: 'SIGKILL', maxBuffer: MiB,
    env: { ...process.env, TASK_FOOTPRINT_HOOK: '1' },
  });
  if (result.status !== 0) console.warn('Footprint warning: check unavailable or timed out; workflow continues.');
  else process.stdout.write(result.stdout);
}

function refs(cwd) {
  return Object.fromEntries(required(git(cwd, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/tags'), 'ref map')
    .split('\n').filter(Boolean).map(line => line.split(' ')));
}

// No directory traversal at commit time: sizes come from the index's existing objects.
export function footprintIndex(cwd) {
  const entries = required(git(cwd, 'ls-files', '--stage', '-z'), 'index').split('\0').filter(Boolean).map(line => {
    const [mode, oid, stage] = line.slice(0, line.indexOf('\t')).split(' ');
    if (stage !== '0') throw new Error('unmerged index; tracked-tree size unknown');
    return { mode, oid, name: line.slice(line.indexOf('\t') + 1) };
  });
  const staged = new Set(required(git(cwd, 'diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'), 'staged paths').split('\0'));
  const result = spawnSync('git', ['cat-file', '--batch-check=%(objectsize)'], {
    cwd, input: entries.map(entry => entry.oid).join('\n') + '\n', encoding: 'utf8', maxBuffer: 16 * MiB,
    ...(process.env.TASK_FOOTPRINT_HOOK === '1' ? { timeout: 200, killSignal: 'SIGKILL' } : {}),
  });
  const sizes = required(result, 'index object sizes').split('\n');
  let tracked = 0, stagedBytes = 0;
  entries.forEach((entry, index) => {
    const bytes = entry.mode === '160000' ? 0 : Number(sizes[index]);
    if (!Number.isFinite(bytes)) throw new Error('index object size unknown');
    tracked += bytes;
    if (staged.has(entry.name)) stagedBytes += bytes;
  });
  return { stagedBytes, trackedBytes: tracked, headroomBytes: 384 * MiB - tracked };
}

export function footprintListeners() {
  const listing = run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn']);
  if (listing.status !== 0 && (listing.status !== 1 || listing.stdout || listing.stderr))
    return { servers: [], unknown: 'listener inventory unavailable' };
  const servers = [];
  let pid;
  for (const line of listing.stdout.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    if (line.startsWith('n') && /:\d+$/.test(line)) servers.push({ pid, address: line.slice(1), port: Number(line.match(/:(\d+)$/)[1]) });
  }
  const pids = [...new Set(servers.map(server => server.pid))];
  if (!pids.length) return { servers };
  const starts = run('ps', ['-p', pids.join(','), '-o', 'pid=,lstart=']);
  const times = new Map(starts.stdout.trim().split('\n').map(line => {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line);
    return match ? [Number(match[1]), match[2].trim()] : [];
  }));
  const dirs = run('lsof', ['-a', '-p', pids.join(','), '-d', 'cwd', '-Fpn']);
  const cwds = new Map();
  for (const line of dirs.stdout.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    if (line.startsWith('n')) cwds.set(pid, line.slice(1));
  }
  for (const server of servers) Object.assign(server, { startTime: times.get(server.pid), cwd: cwds.get(server.pid) });
  return { servers, unknown: starts.status !== 0 || dirs.status !== 0 || servers.some(server => !server.startTime || !server.cwd)
    ? 'some server identities or working directories unavailable' : undefined };
}

function footprintSystem(cwd) {
  const volume = fs.statfsSync(cwd);
  const swap = run('sysctl', ['-n', 'vm.swapusage']);
  const counts = Object.fromEntries(required(git(cwd, 'count-objects', '-v'), 'common Git object size').split('\n').map(line => line.split(': ')));
  return { freeBytes: volume.bavail * volume.bsize, swap: swap.status === 0 ? swap.stdout.trim() : 'unknown',
    commonGit: { looseBytes: Number(counts.size) * 1024, packBytes: Number(counts['size-pack']) * 1024 },
    ...footprintListeners() };
}

function resourceKey(resource) {
  return resource.kind === 'server' ? `server:${resource.pid}:${resource.startTime}:${resource.port}` : `${resource.kind}:${resource.path}`;
}

function registerResource(record, resource) {
  const key = resourceKey(resource);
  const existing = record.resources.find(item => resourceKey(item) === key);
  if (!existing) record.resources.push(resource);
  else if (resource.source === 'registered') existing.reason = resource.reason;
}

function ownedPaths(record) {
  return record.resources.filter(item => item.kind !== 'server' && !item.excluded).map(item => item.path);
}

function checkoutIdentity(target) {
  if (!fs.existsSync(target)) return null;
  const directory = required(git(target, 'rev-parse', '--absolute-git-dir'), 'checkout identity');
  const stamp = name => {
    const stat = fs.statSync(name);
    return [stat.dev, stat.ino, stat.birthtimeMs];
  };
  return { gitDir: fs.realpathSync(directory), directory: stamp(target), git: stamp(directory) };
}

function reconcile(record, cwd) {
  const inventory = footprintListeners();
  record.inventoryUnknown = inventory.unknown;
  const registered = linkedWorktrees(cwd);
  const checkouts = record.resources.filter(item => item.kind === 'worktree');
  for (const item of checkouts) {
    const exists = fs.existsSync(item.path);
    const entry = registered.find(entry => entry.worktree === item.path);
    let identity = null;
    if (exists && entry) {
      try { identity = checkoutIdentity(item.path); }
      catch { /* Unreadable/replaced checkouts cannot establish ownership. */ }
    }
    if (item.pendingCreation && identity) {
      item.identity = identity;
      item.pendingCreation = false;
    }
    item.excluded = Boolean(exists && (!identity || !item.identity || JSON.stringify(identity) !== JSON.stringify(item.identity)));
    if (identity && !item.excluded && beadId(entry.branch) === record.task)
      (record.ownedRefs ||= {})[entry.branch] ||= entry.HEAD;
  }
  for (const item of record.resources.filter(item => item.kind !== 'worktree')) {
    item.excluded = checkouts.some(checkout => checkout.excluded && inside(checkout.path, item.path || item.cwd || ''));
  }
  const paths = ownedPaths(record);
  const foreign = registered.map(entry => entry.worktree).filter(target => !paths.includes(target) && paths.some(parent => inside(parent, target)));
  for (const server of inventory.servers) {
    if (server.startTime && server.cwd && paths.some(target => inside(target, server.cwd)) &&
        !foreign.some(target => inside(target, server.cwd)) && !forbidden(server.cwd))
      registerResource(record, { kind: 'server', ...server, source: 'discovered', reason: 'listening under owned path' });
  }
  for (const item of checkouts.filter(item => !item.excluded && fs.existsSync(item.path))) {
    if (!registered.some(entry => entry.worktree === item.path)) continue;
    for (const flags of [['--others', '--ignored', '--exclude-standard'], ['--others', '--exclude-standard']]) {
      const result = git(item.path, 'ls-files', ...flags, '--directory', '-z');
      if (result.status !== 0) { record.inventoryUnknown = 'directory discovery unavailable'; continue; }
      for (const name of result.stdout.split('\0').filter(name => name.endsWith('/'))) {
        const target = path.resolve(item.path, name);
        if (forbidden(target) || name.split('/').includes('.worktrees') || foreign.some(other => inside(other, target))) continue;
        registerResource(record, { kind: 'directory', path: target, source: 'discovered',
          rebuildable: isRebuildable(target),
          reason: 'untracked or ignored directory under owned checkout' });
      }
    }
  }
  for (const resource of record.resources) resource.present = resource.excluded ? false : resource.kind === 'server'
    ? inventory.servers.some(server => resourceKey({ kind: 'server', ...server }) === resourceKey(resource)) || (inventory.unknown ? null : false)
    : fs.existsSync(resource.path);
  if (checkouts.some(item => item.excluded)) record.inventoryUnknown = 'replacement checkout or unknown checkout identity excluded';
  if (process.env.TASK_FOOTPRINT_HOOK === '1' && record.inventoryUnknown) throw new Error(record.inventoryUnknown);
}

// Count each inode once across disjoint owned paths. Never follow symlinks or enter another checkout.
export function footprintMeasure(resources, excluded = [], { onBuild, maxEntries = 100000 } = {}) {
  const seen = new Map();
  const errors = [];
  let bytes = 0, rebuildableBytes = 0;
  const paths = resources.filter(item => item.kind !== 'server').map(item => item.path).sort((a, b) => a.length - b.length);
  const roots = paths.filter((target, index) => !paths.slice(0, index).some(parent => inside(parent, target)));
  const builds = resources.filter(item => item.rebuildable).map(item => item.path);
  let entries = 0;
  function visit(target, build = false, depth = 0) {
    if (++entries > maxEntries || depth > 128) throw new Error('owned-path scan limit exceeded');
    if (forbidden(target) || excluded.some(other => inside(other, target))) return;
    try {
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) return;
      if (stat.isDirectory()) {
        if (path.basename(target) === '.worktrees') return;
        build ||= isRebuildable(target);
        if (build && isRebuildable(target)) onBuild?.(target);
        const directory = fs.opendirSync(target);
        try {
          let entry;
          while ((entry = directory.readSync())) visit(path.join(target, entry.name), build, depth + 1);
        } finally { directory.closeSync(); }
      } else if (stat.isFile()) {
        const key = `${stat.dev}:${stat.ino}`;
        const rebuildable = build || builds.some(build => inside(build, target));
        if (!seen.has(key)) bytes += stat.size;
        if (rebuildable && !seen.get(key)) rebuildableBytes += stat.size;
        seen.set(key, rebuildable || seen.get(key) || false);
      }
    } catch (error) {
      if (!error.code) throw error;
      errors.push(`${target}: ${error.code}`);
    }
  }
  try { for (const root of roots) visit(root); }
  catch (error) { errors.push(error.message); }
  return { bytes, rebuildableBytes, errors };
}

function measureRun(record, cwd) {
  const owned = new Set(ownedPaths(record));
  const excluded = linkedWorktrees(cwd).map(entry => entry.worktree)
    .filter(target => !owned.has(target) && [...owned].some(parent => inside(parent, target)));
  const measurement = footprintMeasure(record.resources.filter(resource => resource.present !== false), excluded, {
    onBuild: target => registerResource(record, { kind: 'directory', path: target, source: 'discovered',
      rebuildable: true, present: true, reason: 'build directory under owned path' }),
  });
  if (!measurement.errors.length) record.peakBytes = Math.max(record.peakBytes || 0, measurement.bytes);
  return measurement;
}

function objectEstimate(cwd, tips, excluded) {
  if (!tips.length) return { bytes: 0, objects: 0 };
  const revisions = [...new Set(tips), '--not', ...new Set(excluded)];
  const objects = required(git(cwd, 'rev-list', '--objects', '--no-object-names', ...revisions), 'reachability');
  if (!objects) return { bytes: 0, objects: 0 };
  const result = spawnSync('git', ['cat-file', '--batch-check=%(objectsize:disk)'], {
    cwd, input: objects + '\n', encoding: 'utf8', maxBuffer: 32 * MiB,
  });
  const sizes = required(result, 'reachable object sizes').split('\n').map(Number);
  if (sizes.some(bytes => !Number.isFinite(bytes))) throw new Error('reachable object sizes unknown');
  return { bytes: sizes.reduce((sum, bytes) => sum + bytes, 0), objects: sizes.length };
}

export function footprintReachability(cwd, baseline, ownedRefs = {}) {
  if (!baseline?.refs || !baseline.head) return { delivered: null, rollback: null, changedRefs: [], sharedRefs: [] };
  const head = required(git(cwd, 'rev-parse', 'HEAD'), 'HEAD');
  const current = refs(cwd);
  const changed = Object.keys(current).filter(ref => baseline.refs[ref] !== current[ref]);
  const changedRefs = changed.filter(ref => ownedRefs[ref] === current[ref]);
  const sharedRefs = changed.filter(ref => !changedRefs.includes(ref));
  const before = [...Object.values(baseline.refs), baseline.head];
  return { delivered: objectEstimate(cwd, [head], before),
    rollback: objectEstimate(cwd, changedRefs.map(ref => current[ref]), [...before, head]), changedRefs, sharedRefs };
}

function footprintOptions(args, cwd, mode) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!['--task', '--run', '--worktree', '--directory', '--ref', '--reason'].includes(args[index]) || !args[index + 1])
      throw new Error('footprint: use --task <name> [--run <id>] [--worktree <path> | --directory <path> | --ref <full-ref>] [--reason <text>]');
    options[args[index].slice(2)] = args[index + 1];
  }
  options.task ||= beadId(required(git(cwd, 'symbolic-ref', '--quiet', 'HEAD'), 'task branch'));
  if (!options.task || !/^[\w.-]+$/.test(options.task) || ['.', '..'].includes(options.task)) throw new Error('footprint: valid --task required');
  options.run ||= createHash('sha256').update(mode === 'start' ? path.resolve(options.worktree || cwd) : cwd).digest('hex').slice(0, 12);
  if (!/^[\w-]+$/.test(options.run)) throw new Error('footprint: invalid run id');
  return options;
}

function writeRun(filename, record) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(record) + '\n', { mode: 0o600, flag: 'wx' });
  fs.renameSync(temporary, filename);
}

export function footprintCommand(mode, args = [], cwd = process.cwd()) {
  cwd = fs.realpathSync(cwd);
  const options = footprintOptions(args, cwd, mode);
  const common = required(git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'common Git directory');
  const repoId = createHash('sha256').update(fs.realpathSync(common)).digest('hex').slice(0, 16);
  const filename = path.join(os.homedir(), '.cache/task-footprint', repoId, options.task, `${options.run}.json`);
  let record = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : null;
  if (mode === 'start') {
    if (!record) {
      const target = path.resolve(options.worktree || cwd);
      if (forbidden(target)) throw new Error('footprint: protected owned path');
      record = { version: 1, task: options.task, run: options.run, cwd, startedAt: new Date().toISOString(),
        status: 'incomplete', baseline: { label: fs.existsSync(target) ? 'baseline after creation' : 'baseline before creation',
          head: required(git(cwd, 'rev-parse', 'HEAD'), 'baseline HEAD'), refs: refs(cwd), system: footprintSystem(cwd) },
        resources: [{ kind: 'worktree', path: target, source: 'registered', reason: 'task checkout',
          identity: checkoutIdentity(target), pendingCreation: !fs.existsSync(target) }] };
      reconcile(record, cwd);
      record.baseline.paths = process.env.TASK_FOOTPRINT_HOOK === '1' ? null : measureRun(record, cwd);
      record.baseline.resourceKeys = record.resources.map(resourceKey);
    }
    record.status = 'incomplete';
    console.log(`footprint: ${record.baseline?.label || 'baseline unknown'}; run ${options.run}`);
  } else if (mode === 'check') {
    const index = footprintIndex(cwd);
    if (record) {
      reconcile(record, cwd);
      const current = refs(cwd);
      record.lastCheck = { at: new Date().toISOString(), ...index,
        changedRefs: Object.keys(current).filter(ref => record.baseline?.refs?.[ref] !== current[ref]) };
    }
    const added = record?.resources.filter(resource => resource.present && !record.baseline?.resourceKeys?.includes(resourceKey(resource))).length || 0;
    console.log(`footprint: staged ${bytesLabel(index.stagedBytes)}, tracked-tree headroom ${bytesLabel(index.headroomBytes)} / 384 MiB; ${record?.baseline?.label || 'baseline unknown'}; new leftovers ${added}, changed refs ${record?.lastCheck.changedRefs.length ?? 'unknown'}; directory growth requires peak/close${record?.inventoryUnknown ? `; ${record.inventoryUnknown}` : ''}`);
  } else {
    if (!record && mode === 'close') record = { version: 1, task: options.task, run: options.run, cwd,
      status: 'incomplete', baseline: null, resources: [{ kind: 'worktree', path: cwd, source: 'discovered',
        identity: checkoutIdentity(cwd), reason: 'baseline unknown' }] };
    if (!record) throw new Error('footprint: baseline unknown; run footprint:start before allocation');
    if (mode === 'register') {
      if (options.ref) {
        if (!/^refs\/(heads|tags)\/.+/.test(options.ref)) throw new Error('footprint: full branch or tag ref required');
        const checkout = record.resources.find(item => item.kind === 'worktree' && item.path === cwd);
        if (!checkout?.identity || JSON.stringify(checkout.identity) !== JSON.stringify(checkoutIdentity(cwd)))
          throw new Error('footprint: register refs from the owned checkout');
        (record.ownedRefs ||= {})[options.ref] = required(git(cwd, 'rev-parse', '--verify', options.ref), 'registered ref');
      } else {
        const target = path.resolve(options.directory || options.worktree || '');
        if ((!options.directory && !options.worktree) || forbidden(target)) throw new Error('footprint: explicit unprotected resource path required');
        registerResource(record, { kind: options.directory ? 'directory' : 'worktree', path: target, source: 'registered',
          ...(options.worktree ? { identity: checkoutIdentity(target), pendingCreation: !fs.existsSync(target) } : {}),
          rebuildable: Boolean(options.directory && isRebuildable(target)), reason: options.reason || 'task resource' });
      }
    } else if (!['peak', 'close'].includes(mode)) throw new Error(`footprint: unknown mode ${mode}`);
    reconcile(record, cwd);
    if (mode === 'peak' || mode === 'close') {
      const measured = measureRun(record, cwd);
      record.lastMeasurement = measured;
      if (mode === 'peak') console.log(`footprint: peak observed ${bytesLabel(record.peakBytes)}`);
      else {
        const reachability = footprintReachability(cwd, record.baseline, record.ownedRefs);
        const provisional = required(git(cwd, 'status', '--porcelain', '-z', '--untracked-files=all'), 'final worktree status')
          .split('\0').filter(Boolean).some(line => !/^\?\? \.beads\/commit-check\/[\w.-]+\.json$/.test(line));
        record.final = { at: new Date().toISOString(), head: required(git(cwd, 'rev-parse', 'HEAD'), 'final HEAD'),
          ...reachability, provisional, system: footprintSystem(cwd), rebuildableBytes: measured.errors.length ? null : measured.rebuildableBytes,
          ownedGrowthBytes: record.baseline?.paths ? measured.bytes - record.baseline.paths.bytes : null,
          rebuildableGrowthBytes: record.baseline?.paths ? measured.rebuildableBytes - record.baseline.paths.rebuildableBytes : null,
          unknown: ['APFS clone sharing, hardlinks outside owned paths, concurrent changes and TM snapshots unknown',
            'owned-path sizes are apparent bytes, deduplicated by device/inode; exclusive allocation unknown',
            `reachability/disk representations are estimates; unowned changed refs: ${reachability.sharedRefs.join(', ') || 'none'}`,
            'peak is max observed, not an unsampled high-water mark', record.inventoryUnknown, ...measured.errors].filter(Boolean) };
        record.status = provisional || !record.baseline || measured.errors.length ? 'incomplete' : 'complete';
        const leftovers = record.resources.filter(resource => resource.present !== false).map(resource => resource.kind === 'server'
          ? `${resource.address} pid ${resource.pid} (${resource.reason})` : `${resource.path} (${resource.reason})`);
        record.final.line = `footprint: delivered ${bytesLabel(reachability.delivered?.bytes)}, rollback ${bytesLabel(reachability.rollback?.bytes)}, rebuildable ${bytesLabel(record.final.rebuildableBytes)}, peak ${bytesLabel(record.peakBytes)}, leftovers: ${leftovers.join('; ') || 'none'}`;
        console.log(record.final.line);
        console.log(`Shared/unknown: ${record.final.unknown.join('; ')}. Baseline: ${record.baseline?.label || 'unknown'}; pre-existing resources included, growth ${bytesLabel(record.final.ownedGrowthBytes)}. ${provisional ? 'Provisional: finalize after commit. ' : ''}Rollback refs: ${reachability.changedRefs.join(', ') || 'none'}`);
      }
    }
  }
  if (record) writeRun(filename, record);
  return { filename, record };
}

function main() {
  if (['footprint:hook-check', 'footprint:hook-start'].includes(process.argv[2]))
    return footprintHook(process.argv[2].slice(15), process.argv.slice(3));
  if (process.argv[2]?.startsWith('footprint:')) return footprintCommand(process.argv[2].slice(10), process.argv.slice(3));
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
