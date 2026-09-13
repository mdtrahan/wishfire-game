const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('UI lock command covers the approved DOM and Canvas presentation seams', () => {
  const packageJson = JSON.parse(read('package.json'));
  const gatePath = path.join(repoRoot, 'tools', 'ui_presentation_lock_gate.mjs');

  assert.equal(packageJson.scripts['test:ui-lock'], 'node tools/ui_presentation_lock_gate.mjs');
  assert.ok(fs.existsSync(gatePath), 'missing real-browser UI presentation lock gate');

  const gate = fs.readFileSync(gatePath, 'utf8');
  for (const requiredEvidence of [
    'quests-banner-text-scale',
    'combat-entry-landmark',
    'actual-viewport-metrics',
    'page-horizontal-overflow',
    'canvas-contained-reference-aspect',
    'dev-launcher-scale',
    'dev-panel-1-containment',
    'dev-panel-1-title-single-line',
    'dev-panel-1-action-scale',
    'dev-panel-2-containment',
    'dev-panel-1-action-order',
    'hero-selector-scale',
    'target-selector-scale',
    'global-attack-absent',
    'hero-command-containment',
    'hero-command-column-order',
    'hero-command-scale',
    'hero-command-two-row-layout',
    'hero-command-hp-af-readouts',
    'hero-command-active-highlight',
    'gem-board-backdrop-absent',
    'hero-command-native-input',
    'hero-editor-containment',
    'damage-text-scale',
    'damage-text-density',
    'pooled-health-bar-absent',
    'shared-astral-bar-absent',
    'personal-af-meters',
    'party-card-draw-controls-absent',
    'hero-command-personal-af',
    'hero-command-paid-sequence',
    'legacy-backdrop-absent',
  ]) {
    assert.match(gate, new RegExp(requiredEvidence), `missing ${requiredEvidence} invariant`);
  }
  assert.match(gate, /\.readout\.hp/);
  assert.match(gate, /\.readout\.af/);
  assert.match(gate, /data-hp-bar/);
  assert.match(gate, /data-af-bar/);

  assert.match(gate, /\{ name: 'compact', width: 216, height: 384, dpr: 1 \}/);
  assert.match(gate, /\{ name: 'reference', width: 360, height: 640, dpr: 1 \}/);
  assert.match(gate, /\{ name: 'natural-preview', width: 316, height: 452, dpr: 1 \}/);
  assert.match(gate, /\{ name: 'live-narrow', width: 233, height: 452, dpr: 1 \}/);
  assert.match(gate, /\{ name: 'compact-retina', width: 216, height: 384, dpr: 2 \}/);
  assert.match(gate, /CanvasRenderingContext2D\.prototype\.drawImage/);
  assert.match(gate, /CanvasRenderingContext2D\.prototype\.fillText/);
  assert.match(gate, /CanvasRenderingContext2D\.prototype\.fillRect/);
  assert.match(gate, /setupDynamicInitiativeAuthorityScenario/);
  assert.match(gate, /ui-lock-report\.json/);
  assert.match(gate, /page\.screenshot/);
  assert.match(gate, /--prove-rejection/);
  assert.match(gate, /UI_LOCK_REJECTION_PROOF_PASS/);
  assert.match(gate, /process\.exitCode = 1/);
});

test('pre-commit routes staged UI-owner changes through the full UI lock', () => {
  const hook = read('.beads/hooks/pre-commit');

  assert.match(hook, /UI_LOCK_OWNER_PATTERN=/);
  assert.match(hook, /git diff --cached --name-only --diff-filter=ACMRD/);
  assert.match(hook, /npm run test:ui-lock/);
  assert.match(hook, /web-runner\/systems\/renderRuntime\.js/);
  assert.ok(hook.includes('web-runner/systems/heroCommandUI\\.mjs'));
  assert.match(hook, /web-runner\/systems\/devToolingRuntime\.js/);
  assert.match(hook, /web-runner\/systems\/combatPresentationScale\.mjs/);
  assert.match(hook, /web-runner\/systems\/appShellViewport\.js/);
  assert.match(hook, /web-runner\/systems\/renderSkillDraughtOverlay\.js/);
  assert.match(hook, /web-runner\/app\.js/);
  assert.match(hook, /web-runner\/systems\/surfaceRenderRouter\.js/);
  assert.match(hook, /web-runner\/systems\/pointerRoutingShell\.js/);
});
