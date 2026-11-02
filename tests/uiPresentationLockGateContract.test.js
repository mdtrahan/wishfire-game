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
    'boss-summon-clears-resources',
    'boss-summon-combat-y',
    'boss-summon-contained',
    'boss-summon-hidden-in-modal',
    'boss-summon-combat-only',
    'actual-viewport-metrics',
    'page-horizontal-overflow',
    'canvas-contained-reference-aspect',
    'dev-launcher-scale',
    'dev-panel-1-containment',
    'dev-panel-1-title-single-line',
    'dev-panel-1-action-scale',
    'dev-panel-2-containment',
    'dev-panel-1-action-order',
    'battlefield-selectors-absent',
    'rust-actor-projection',
    'rust-steps-present',
    'hero-combat-card-ui-absent',
    'actor-health-bars-present',
    'gem-board-backdrop-absent',
    'damage-text-scale',
    'damage-text-density',
    'pooled-health-bar-absent',
    'shared-astral-bar-absent',
    'personal-af-ui-absent',
    'legacy-backdrop-absent',
  ]) {
    assert.match(gate, new RegExp(requiredEvidence), `missing ${requiredEvidence} invariant`);
  }
  assert.match(gate, /heroCardHostPresent/);
  assert.match(gate, /actorHealthBars/);
  assert.match(gate, /fillStyle\.toLowerCase\(\) === '#292e34'/);

  assert.match(gate, /\{ name: 'compact', width: 216, height: 384, dpr: 1 \}/);
  assert.match(gate, /\{ name: 'reference', width: 360, height: 640, dpr: 1 \}/);
  assert.match(gate, /\{ name: 'natural-preview', width: 316, height: 452, dpr: 1 \}/);
  assert.match(gate, /\{ name: 'live-narrow', width: 233, height: 452, dpr: 1 \}/);
  assert.match(gate, /\{ name: 'compact-retina', width: 216, height: 384, dpr: 2 \}/);
  assert.match(gate, /CanvasRenderingContext2D\.prototype\.drawImage/);
  assert.match(gate, /CanvasRenderingContext2D\.prototype\.fillText/);
  assert.match(gate, /CanvasRenderingContext2D\.prototype\.fillRect/);
  assert.match(gate, /evaluateCombatTargetInvariant/);
  assert.match(gate, /RustCombatPresentation/);
  assert.match(gate, /rustActorId/);
  assert.match(gate, /--test-concurrency=1/);
  assert.doesNotMatch(gate, /DynamicInitiativeAuthority|setupDynamicInitiative/);
  assert.doesNotMatch(gate, /AstralFlow|\bFLOW\b/);
  assert.match(gate, /ui-lock-report\.json/);
  assert.match(gate, /page\.screenshot/);
  assert.match(gate, /--prove-rejection/);
  assert.match(gate, /UI_LOCK_REJECTION_PROOF_PASS/);
  assert.match(gate, /process\.exitCode = 1/);
});

test('UI lock compares immutable hero projections with Rust snapshots', async () => {
 const {evaluateCombatTargetInvariant:check}=await import('../tools/ui_presentation_lock_gate.mjs');
 const hero={uid:1,rustActorId:3,hp:20,footX:10,footY:30};
 const view={actor_id:3,team:'hero',hp:20,pos:{x:10,y:30}};
 assert.equal(check({heroes:[hero],actors:[view]}).pass,true);
 for(const changed of [{...hero,hp:19},{...hero,footX:11},{...hero,rustActorId:4}])assert.equal(check({heroes:[changed],actors:[view]}).pass,false);
 assert.equal(check({heroes:[hero],actors:[]}).pass,false);
});

test('UI lock waits for authoritative Rust steps before capturing combat', () => {
 const gate=read('tools/ui_presentation_lock_gate.mjs');
 assert.match(gate,/Number\(snapshot\?\.step\) > 0/);
 assert.doesNotMatch(gate,/callFunction\('TickRealtime/);
});

test('pre-commit routes staged UI-owner changes through the full UI lock', () => {
  const hook = read('.beads/hooks/pre-commit');

  assert.match(hook, /UI_LOCK_OWNER_PATTERN=/);
  assert.match(hook, /git diff --cached --name-only --diff-filter=ACMRD/);
  assert.match(hook, /npm run test:ui-lock/);
  const ownerPattern = new RegExp(hook.match(/UI_LOCK_OWNER_PATTERN='([^']+)'/)[1]);
  assert.ok(ownerPattern.test('web-runner/systems/renderBossBattleHud.mjs'));
  assert.ok(ownerPattern.test('web-runner/assets/images/boss-hud/clock.png'));
  assert.ok(ownerPattern.test('tests/bossBattleHud.test.mjs'));
  assert.ok(ownerPattern.test('tests/devBossLaunch.test.mjs'));
  assert.ok(ownerPattern.test('web-runner/systems/devToolingControls.js'));
  assert.ok(ownerPattern.test('web-runner/systems/renderCombatBossControl.mjs'), 'boss renderer changes must run the rendered lock');
  assert.match(hook, /web-runner\/systems\/renderRuntime\.js/);
  assert.match(hook, /web-runner\/systems\/devToolingRuntime\.js/);
  assert.match(hook, /web-runner\/systems\/combatPresentationScale\.mjs/);
  assert.match(hook, /web-runner\/systems\/appShellViewport\.js/);
  assert.match(hook, /web-runner\/app\.js/);
  assert.match(hook, /web-runner\/systems\/surfaceRenderRouter\.js/);
  assert.match(hook, /web-runner\/systems\/pointerRoutingShell\.js/);
});
