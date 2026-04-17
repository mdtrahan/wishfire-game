#!/usr/bin/env node
const { loadIssuesSnapshot, loadIssueDetail: loadBeadIssueDetail } = require('./beads_runtime');

function normalizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'in_progress') return 'in_progress';
  if (s === 'review') return 'review';
  if (s === 'blocked') return 'blocked';
  if (s === 'done' || s === 'closed') return 'done';
  if (s === 'deferred' || s === 'stale') return 'deferred';
  return 'open';
}

function normalizePriority(priority) {
  if (typeof priority === 'number' && Number.isFinite(priority)) return Math.floor(priority);
  const raw = String(priority ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/^p?\s*(\d+)$/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function inferRole(issue) {
  const status = normalizeStatus(issue.status);
  if (status === 'open') return 'Unassigned';
  const hay = [issue.title, issue.description, issue.acceptance_criteria, issue.notes, ...(issue.labels || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/refactor|modular|cleanup|structural|maintainability|hidden coupling/.test(hay)) return 'Refactor';
  if (/javascript|async|module|node|browser runtime|event order|shared state|esm|commonjs/.test(hay)) return 'JS Runtime';
  if (/bug|regression|isolate|root cause|failure|repro|unexpected|stuck|broken/.test(hay)) return 'Debug';
  if (/pm cycle|prioritization|ready-head|sequencing|ship\/defer|defer this lane|workflow clarification/.test(hay)) return 'PM';
  if (/search|ownership|locate|lookup|find where|entrypoint/.test(hay)) return 'Search';
  return 'Implement';
}

function summarizeCounts(columns, doneCount) {
  const counts = Object.fromEntries(columns.map((col) => [col.key, col.items.length]));
  return {
    inProgress: counts.in_progress || 0,
    blocked: counts.blocked || 0,
    readyNext: counts.open || 0,
    done: doneCount || 0,
  };
}

function buildBoardData(issues, readyIds) {
  const localOpenOnly = readyIds == null;
  const readySet = new Set(Array.isArray(readyIds) ? readyIds : []);
  const columns = [
    { key: 'backlog', title: 'Backlog', items: [] },
    { key: 'open', title: 'Open', items: [] },
    { key: 'in_progress', title: 'In Progress', items: [] },
    { key: 'review', title: 'Review', items: [] },
    { key: 'blocked', title: 'Blocked', items: [] },
  ];
  const deferred = { key: 'deferred', title: 'Stale / Deferred', items: [] };
  let doneCount = 0;

  for (const issue of issues) {
    const normalized = normalizeStatus(issue.status);
    const card = {
      id: issue.id,
      title: issue.title || '(untitled)',
      priority: normalizePriority(issue.priority),
      updatedAt: issue.updated_at || issue.created_at || '',
      status: normalized,
      role: normalized === 'open' && !readySet.has(issue.id) ? 'Unassigned' : inferRole(issue),
      labels: Array.isArray(issue.labels) ? issue.labels : [],
      issueType: issue.issue_type || '',
    };

    if (normalized === 'done') {
      doneCount += 1;
      continue;
    }
    if (normalized === 'open') {
      const key = localOpenOnly ? 'open' : (readySet.has(issue.id) ? 'open' : 'backlog');
      columns.find((col) => col.key === key).items.push(card);
      continue;
    }
    if (normalized === 'deferred') {
      deferred.items.push(card);
      continue;
    }
    const column = columns.find((col) => col.key === normalized);
    if (column) column.items.push(card);
  }

  for (const col of columns) {
    col.items.sort((a, b) => {
      const p = (a.priority ?? 99) - (b.priority ?? 99);
      if (p) return p;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
  }
  deferred.items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const visibleColumns = localOpenOnly ? columns.filter((col) => col.key !== 'backlog') : columns;
  if (deferred.items.length) visibleColumns.push(deferred);

  return {
    generatedAt: new Date().toISOString(),
    columns: visibleColumns,
    summary: summarizeCounts(visibleColumns, doneCount),
  };
}

async function loadBoardData(cwd = process.cwd()) {
  const snapshot = await loadIssuesSnapshot(cwd);
  const board = buildBoardData(snapshot.issues, snapshot.readyIds);
  board.mode = snapshot.mode;
  board.diagnostics = snapshot.diagnostics;
  return board;
}

async function loadIssueDetail(id, cwd = process.cwd()) {
  return normalizeIssueDetail(await loadBeadIssueDetail(cwd, id));
}

function normalizeIssueDetail(detail) {
  const base = Array.isArray(detail) ? (detail[0] || {}) : (detail || {});
  if (!base || typeof base !== 'object') return {};
  return {
    ...base,
    priority: normalizePriority(base.priority),
  };
}

function formatStandupSummary(board) {
  const lines = [];
  lines.push(`In Progress: ${board.summary.inProgress}`);
  lines.push(`Blocked: ${board.summary.blocked}`);
  lines.push(`Ready Next: ${board.summary.readyNext}`);
  if (board.mode === 'local') lines.push('Beads Backend: local mirror fallback');
  const readyCol = board.columns.find((col) => col.key === 'open');
  if (readyCol && readyCol.items.length) {
    lines.push('Next Ready: ' + readyCol.items.slice(0, 5).map((item) => item.id).join(', '));
  }
  return lines.join('\n');
}

module.exports = {
  buildBoardData,
  formatStandupSummary,
  inferRole,
  loadBoardData,
  loadIssueDetail,
  normalizeIssueDetail,
  normalizePriority,
  normalizeStatus,
};
