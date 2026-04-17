const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBoardData, formatStandupSummary, inferRole, normalizeIssueDetail } = require('../tools/beads_board_data');

test('open issues split into backlog and ready-open lanes', () => {
  const board = buildBoardData(
    [
      { id: 'ORKA-a', title: 'A', status: 'open', priority: 2, updated_at: '2026-04-11T00:00:00Z' },
      { id: 'ORKA-b', title: 'B', status: 'open', priority: 1, updated_at: '2026-04-12T00:00:00Z' },
    ],
    ['ORKA-b']
  );
  const backlog = board.columns.find((col) => col.key === 'backlog');
  const open = board.columns.find((col) => col.key === 'open');
  assert.deepEqual(backlog.items.map((item) => item.id), ['ORKA-a']);
  assert.deepEqual(open.items.map((item) => item.id), ['ORKA-b']);
});

test('active lanes infer temporary roles rather than named agents', () => {
  assert.equal(inferRole({ status: 'in_progress', title: '[BUG] runtime failure', description: '' }), 'Debug');
  assert.equal(inferRole({ status: 'review', title: 'JavaScript module ordering', description: '' }), 'JS Runtime');
  assert.equal(inferRole({ status: 'blocked', title: 'Combat feature', description: '' }), 'Implement');
  assert.equal(
    inferRole({
      status: 'in_progress',
      title: '[FEAT] Hero selector bounce-in effect',
      description: 'Scope is limited to the hero selector visual treatment in combat.',
      acceptance_criteria: 'Acceptance criteria exist.',
      notes: 'pmcycled 2026-04-12',
    }),
    'Implement'
  );
  assert.equal(inferRole({ status: 'open', title: 'Anything', description: '' }), 'Unassigned');
});

test('issue detail normalization supports bd show json arrays', () => {
  const detail = normalizeIssueDetail([{ id: 'ORKA-test', title: 'Detail' }]);
  assert.equal(detail.id, 'ORKA-test');
  assert.equal(detail.title, 'Detail');
});

test('done issues stay in summary but not as a visible lane', () => {
  const board = buildBoardData(
    [
      { id: 'ORKA-done', title: 'Done', status: 'closed', priority: 1, updated_at: '2026-04-11T00:00:00Z' },
      { id: 'ORKA-stale', title: 'Stale', status: 'stale', priority: 1, updated_at: '2026-04-11T00:00:00Z' },
    ],
    []
  );
  assert.equal(board.summary.done, 1);
  assert.equal(board.columns.find((col) => col.key === 'done'), undefined);
  assert.equal(board.columns.find((col) => col.key === 'deferred').items[0].id, 'ORKA-stale');
});

test('standup summary prints active lane counts and next ready ids', () => {
  const board = buildBoardData(
    [
      { id: 'ORKA-open', title: 'Open', status: 'open', priority: 1, updated_at: '2026-04-11T00:00:00Z' },
      { id: 'ORKA-run', title: 'Run', status: 'in_progress', priority: 2, updated_at: '2026-04-11T00:00:00Z' },
      { id: 'ORKA-block', title: 'Block', status: 'blocked', priority: 3, updated_at: '2026-04-11T00:00:00Z' },
    ],
    ['ORKA-open']
  );
  const summary = formatStandupSummary(board);
  assert.match(summary, /In Progress: 1/);
  assert.match(summary, /Blocked: 1/);
  assert.match(summary, /Ready Next: 1/);
  assert.match(summary, /Next Ready: ORKA-open/);
});

test('local fallback treats open beads as visible open work rather than empty ready-next', () => {
  const board = buildBoardData(
    [
      { id: 'ORKA-open', title: 'Open', status: 'open', priority: 1, updated_at: '2026-04-11T00:00:00Z' },
      { id: 'ORKA-run', title: 'Run', status: 'in_progress', priority: 2, updated_at: '2026-04-11T00:00:00Z' },
    ],
    null
  );
  assert.equal(board.columns.find((col) => col.key === 'backlog'), undefined);
  assert.deepEqual(board.columns.find((col) => col.key === 'open').items.map((item) => item.id), ['ORKA-open']);
  assert.equal(board.summary.readyNext, 1);
});

test('priority strings normalize and sort correctly in board data', () => {
  const board = buildBoardData(
    [
      { id: 'ORKA-p3', title: 'Low', status: 'open', priority: 'P3', updated_at: '2026-04-11T00:00:00Z' },
      { id: 'ORKA-p1', title: 'High', status: 'open', priority: 'P1', updated_at: '2026-04-10T00:00:00Z' },
    ],
    null
  );
  const open = board.columns.find((col) => col.key === 'open');
  assert.deepEqual(open.items.map((item) => item.id), ['ORKA-p1', 'ORKA-p3']);
  assert.deepEqual(open.items.map((item) => item.priority), [1, 3]);
});
