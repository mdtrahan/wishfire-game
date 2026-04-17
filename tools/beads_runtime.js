#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { execFileSync } = require('node:child_process');

const DEFAULT_PORTS = [3326, 3336, 3346, 3356, 3366, 3376, 3386, 3396];

function safeExecFile(cmd, args, options = {}) {
  try {
    return {
      ok: true,
      stdout: execFileSync(cmd, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 4000,
        ...options,
      }),
      stderr: '',
    };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || error.message || error),
      error,
    };
  }
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(String(text || ''));
  } catch {
    return fallback;
  }
}

function normalizePriority(priority) {
  const raw = String(priority ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/^p?\s*(\d+)$/i);
  if (match) return Number.parseInt(match[1], 10);
  return null;
}

function metadataPaths(cwd) {
  return {
    metadata: path.join(cwd, '.beads', 'metadata.json'),
    portFile: path.join(cwd, '.beads', 'dolt-server.port'),
    lockFile: path.join(cwd, '.beads', 'dolt-server.lock'),
  };
}

function readMetadata(cwd) {
  const { metadata, portFile } = metadataPaths(cwd);
  const data = fs.existsSync(metadata) ? parseJson(fs.readFileSync(metadata, 'utf8'), {}) : {};
  const portText = fs.existsSync(portFile) ? String(fs.readFileSync(portFile, 'utf8')).trim() : '';
  const port = Number(data.dolt_server_port || portText || 0) || null;
  return { data, port };
}

function syncDoltPort(cwd, port) {
  const { metadata, portFile } = metadataPaths(cwd);
  const current = fs.existsSync(metadata) ? parseJson(fs.readFileSync(metadata, 'utf8'), {}) : {};
  current.dolt_server_port = port;
  fs.writeFileSync(metadata, JSON.stringify(current, null, 2) + '\n');
  fs.writeFileSync(portFile, `${port}\n`);
  safeExecFile('bd', ['dolt', 'set', 'port', String(port)], { cwd });
}

function clearStaleLock(cwd) {
  const { lockFile } = metadataPaths(cwd);
  if (!fs.existsSync(lockFile)) return;
  try {
    fs.unlinkSync(lockFile);
  } catch {}
}

function isPortBound(port, host = '127.0.0.1', timeoutMs = 200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function pickCandidatePorts(preferredPort) {
  const ordered = [preferredPort, ...DEFAULT_PORTS].filter(Boolean);
  const seen = new Set();
  const candidates = [];
  for (const port of ordered) {
    if (seen.has(port)) continue;
    seen.add(port);
    candidates.push(port);
  }
  const available = [];
  for (const port of candidates) {
    const bound = await isPortBound(port);
    if (!bound) available.push(port);
  }
  return available.length ? available : candidates;
}

function runBdJson(cwd, args, fallback) {
  const result = safeExecFile('bd', args, { cwd });
  if (!result.ok) return { ok: false, data: fallback, error: result.stderr || result.stdout };
  return { ok: true, data: parseJson(result.stdout, fallback) };
}

async function ensureBeadsReady(cwd) {
  const initial = runBdJson(cwd, ['list', '--json'], []);
  if (initial.ok) return { ok: true, mode: 'live', repaired: false };
  return { ok: false, mode: 'local', repaired: false, error: initial.error || 'bd list failed' };
}

async function repairBeadsBackend(cwd) {
  const initial = runBdJson(cwd, ['list', '--json'], []);
  if (initial.ok) return { ok: true, mode: 'live', repaired: false };

  const { port } = readMetadata(cwd);
  const candidates = await pickCandidatePorts(port);
  let lastError = initial.error || 'bd list failed';

  for (const candidate of candidates) {
    syncDoltPort(cwd, candidate);
    clearStaleLock(cwd);
    const started = safeExecFile('bd', ['dolt', 'start'], { cwd });
    if (!started.ok) {
      lastError = started.stderr || started.stdout || lastError;
      continue;
    }
    const probe = runBdJson(cwd, ['list', '--json'], []);
    if (probe.ok) {
      return { ok: true, mode: 'live', repaired: true, port: candidate };
    }
    lastError = probe.error || lastError;
  }

  return { ok: false, mode: 'local', repaired: false, error: lastError };
}

function mergeIssueDetail(liveDetail, localDetail) {
  const live = liveDetail && typeof liveDetail === 'object' ? liveDetail : {};
  const local = localDetail && typeof localDetail === 'object' ? localDetail : {};
  const merged = { ...local, ...live };
  for (const key of ['description', 'acceptance_criteria', 'notes', 'title', 'status', 'priority']) {
    const value = live[key];
    if (value == null || String(value).trim() === '') {
      if (local[key] != null && String(local[key]).trim() !== '') merged[key] = local[key];
    }
  }
  if (!Array.isArray(merged.labels)) merged.labels = Array.isArray(local.labels) ? local.labels : [];
  return merged;
}

function parseIssueFile(contents, fallbackStatus) {
  const issue = {
    id: '',
    title: '',
    priority: null,
    status: fallbackStatus,
    description: '',
    acceptance_criteria: '',
    notes: '',
    updated_at: '',
    created_at: '',
    labels: [],
  };
  const lines = String(contents || '').split(/\r?\n/);
  let currentKey = null;
  const appendBlock = (key, line) => {
    if (!key) return;
    issue[key] = issue[key] ? `${issue[key]}\n${line}` : line;
  };

  for (const line of lines) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (match) {
      const key = match[1].toLowerCase();
      const value = match[2] || '';
      currentKey = null;
      if (key === 'id' || key === 'title' || key === 'status' || key === 'description' || key === 'notes') {
        issue[key] = value.trim();
        if (key === 'description' || key === 'notes') currentKey = key;
        continue;
      }
      if (key === 'priority') {
        issue.priority = normalizePriority(value);
        continue;
      }
      if (key === 'acceptance_criteria') {
        issue.acceptance_criteria = value.trim();
        currentKey = 'acceptance_criteria';
        continue;
      }
    }
    if (/^\s/.test(line) || /^\d+\./.test(line) || /^-\s/.test(line)) {
      appendBlock(currentKey, line.trimEnd());
    } else if (!line.trim()) {
      if (currentKey && (currentKey === 'description' || currentKey === 'notes' || currentKey === 'acceptance_criteria')) {
        appendBlock(currentKey, '');
      }
    }
  }

  issue.description = String(issue.description || '').trim();
  issue.notes = String(issue.notes || '').trim();
  issue.acceptance_criteria = String(issue.acceptance_criteria || '').trim();
  return issue;
}

function localStatusDirs(cwd) {
  return [
    ['open', path.join(cwd, '.beads', 'open')],
    ['in_progress', path.join(cwd, '.beads', 'in_progress')],
    ['review', path.join(cwd, '.beads', 'review')],
    ['blocked', path.join(cwd, '.beads', 'blocked')],
    ['done', path.join(cwd, '.beads', 'done')],
  ];
}

function loadLocalIssues(cwd) {
  const issues = [];
  for (const [fallbackStatus, dir] of localStatusDirs(cwd)) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((entry) => entry.endsWith('.md')).sort()) {
      const filePath = path.join(dir, name);
      const stat = fs.statSync(filePath);
      const issue = parseIssueFile(fs.readFileSync(filePath, 'utf8'), fallbackStatus);
      if (!issue.id) continue;
      issue.updated_at = stat.mtime.toISOString();
      issue.created_at = stat.birthtime.toISOString();
      issue.__localFile = filePath;
      issues.push(issue);
    }
  }
  return issues;
}

async function loadIssuesSnapshot(cwd) {
  let readiness = await ensureBeadsReady(cwd);
  if (!readiness.ok) {
    const repaired = await repairBeadsBackend(cwd);
    if (repaired.ok) readiness = repaired;
  }
  if (readiness.ok) {
    const issues = runBdJson(cwd, ['list', '--json'], []).data;
    const ready = runBdJson(cwd, ['ready', '--json'], []).data;
    return {
      mode: 'live',
      issues: Array.isArray(issues) ? issues : [],
      readyIds: Array.isArray(ready) ? ready.map((item) => item && item.id).filter(Boolean) : [],
      diagnostics: readiness,
    };
  }
  return {
    mode: 'local',
    issues: loadLocalIssues(cwd),
    readyIds: null,
    diagnostics: readiness,
  };
}

async function loadIssueDetail(cwd, id) {
  const localIssue = loadLocalIssues(cwd).find((issue) => issue.id === id) || {};
  let readiness = await ensureBeadsReady(cwd);
  if (!readiness.ok) {
    const repaired = await repairBeadsBackend(cwd);
    if (repaired.ok) readiness = repaired;
  }
  if (readiness.ok) {
    const detail = runBdJson(cwd, ['show', id, '--json'], {});
    if (detail.ok) {
      const data = Array.isArray(detail.data) ? (detail.data[0] || {}) : detail.data;
      return mergeIssueDetail(data, localIssue);
    }
  }
  return localIssue;
}

module.exports = {
  DEFAULT_PORTS,
  ensureBeadsReady,
  repairBeadsBackend,
  isPortBound,
  loadIssueDetail,
  loadIssuesSnapshot,
  loadLocalIssues,
  mergeIssueDetail,
  parseIssueFile,
  pickCandidatePorts,
  readMetadata,
  syncDoltPort,
};
