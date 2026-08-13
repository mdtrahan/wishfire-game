const path = require('node:path');
const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');

test('presentation gate geometry detects overlap and ratio drift', async () => {
  const gate = await import('../tools/qa_presentation_gate.mjs');
  assert.equal(gate.rectsOverlap(
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 90, y: 20, width: 20, height: 20 },
  ), true);
  assert.equal(gate.rectsOverlap(
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 100, y: 20, width: 20, height: 20 },
  ), false);
  assert.equal(gate.ratioDrift(0.12, 0.1), 0.1999999999999999);
});

test('presentation gate hashes named source entries deterministically', async () => {
  const gate = await import('../tools/qa_presentation_gate.mjs');
  const first = gate.buildSourceHashFromEntries([['a', Buffer.from('1')], ['b', Buffer.from('2')]]);
  const second = gate.buildSourceHashFromEntries([['a', Buffer.from('1')], ['b', Buffer.from('2')]]);
  const changed = gate.buildSourceHashFromEntries([['a', Buffer.from('1')], ['b', Buffer.from('3')]]);
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test('presentation gate exposes run, approval, and verification commands', () => {
  const output = execFileSync(process.execPath, ['tools/qa_presentation_gate.mjs', '--help'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /--bead ORKA-id/);
  assert.match(output, /--approve/);
  assert.match(output, /--verify-only/);
});

test('combat text scale follows the Canvas instead of a desktop minimum', async () => {
  const scale = await import('../web-runner/systems/combatPresentationScale.mjs');
  assert.equal(scale.computeViewportFontSize(12, 1), 12);
  assert.equal(scale.computeViewportFontSize(12, 0.375), 5);
  assert.equal(scale.computeViewportFontSize(10.71, 0.375), 4);
});

test('combat text audit calculates comparable visible intervals', async () => {
  const { createCombatTextAudit } = await import('../web-runner/systems/combatPresentationScale.mjs');
  assert.deepEqual(
    createCombatTextAudit({ key: 'nav', group: 'navigation', text: 'Hero', x: 20, y: 10, width: 12, maximumWidth: 20 }),
    { key: 'nav', group: 'navigation', text: 'Hero', x: 20, y: 10, width: 12, maximumWidth: 20, left: 14, right: 26 },
  );
});

test('commit preparation routes every combat presentation owner through both gates', () => {
  const source = fs.readFileSync(path.join(root, 'tools/prepare_commit_check.sh'), 'utf8');
  assert.match(source, /renderRuntime\\\.js/);
  assert.match(source, /combatPresentationScale/);
  assert.match(source, /m\?js/);
  for (const file of ['tools/commit_compliance.py', 'tools/hot_file_scope.py']) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /web-runner\/systems\/renderRuntime\.js/);
  }
});
