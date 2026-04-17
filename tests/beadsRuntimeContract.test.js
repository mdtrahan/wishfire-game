const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadLocalIssues, mergeIssueDetail, parseIssueFile } = require('../tools/beads_runtime');
const { formatStandupSummary } = require('../tools/beads_board_data');

test('parseIssueFile extracts description and acceptance criteria from bead markdown', () => {
  const parsed = parseIssueFile(
    `id: ORKA-test\n` +
      `title: [BUG] Example\n` +
      `priority: P1\n` +
      `status: blocked\n` +
      `description: Example description.\n\n` +
      `acceptance_criteria:\n` +
      `1. first line\n` +
      `2. second line\n\n` +
      `notes: Example notes.\n`,
    'blocked'
  );

  assert.equal(parsed.id, 'ORKA-test');
  assert.equal(parsed.priority, 1);
  assert.equal(parsed.status, 'blocked');
  assert.equal(parsed.description, 'Example description.');
  assert.match(parsed.acceptance_criteria, /1\. first line/);
  assert.match(parsed.notes, /Example notes/);
});

test('loadLocalIssues reads repo-local bead files when live bd is unavailable', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orka-beads-local-'));
  fs.mkdirSync(path.join(tmp, '.beads', 'open'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '.beads', 'in_progress'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, '.beads', 'open', 'ORKA-a.md'),
    `id: ORKA-a\ntitle: [TASK] Backlog item\npriority: P2\nstatus: open\ndescription: Backlog text.\n`
  );
  fs.writeFileSync(
    path.join(tmp, '.beads', 'in_progress', 'ORKA-b.md'),
    `id: ORKA-b\ntitle: [BUG] Active item\npriority: P1\nstatus: in_progress\ndescription: Active text.\n`
  );

  const issues = loadLocalIssues(tmp);
  assert.equal(issues.length, 2);
  assert.deepEqual(
    issues.map((issue) => issue.id).sort(),
    ['ORKA-a', 'ORKA-b']
  );
  assert.equal(issues.find((issue) => issue.id === 'ORKA-a').priority, 2);
  assert.equal(issues.find((issue) => issue.id === 'ORKA-b').priority, 1);
  assert.equal(issues.find((issue) => issue.id === 'ORKA-b').status, 'in_progress');
});

test('formatStandupSummary flags local mirror fallback explicitly', () => {
  const summary = formatStandupSummary({
    mode: 'local',
    summary: { inProgress: 1, blocked: 2, readyNext: 0, done: 0 },
    columns: [],
  });

  assert.match(summary, /Beads Backend: local mirror fallback/);
});

test('mergeIssueDetail preserves local description fields when live bd detail is sparse', () => {
  const merged = mergeIssueDetail(
    { id: 'ORKA-bse', title: '[FEAT] Hero selector bounce-in effect', status: 'in_progress' },
    {
      id: 'ORKA-bse',
      title: '[FEAT] Hero selector bounce-in effect',
      status: 'in_progress',
      description: 'Add a bounce-in appearance to the hero/character selector.',
      acceptance_criteria: '1. Animate selector on appearance.',
      notes: 'pmcycled',
    }
  );

  assert.equal(merged.description, 'Add a bounce-in appearance to the hero/character selector.');
  assert.match(merged.acceptance_criteria, /Animate selector/);
  assert.equal(merged.notes, 'pmcycled');
});
