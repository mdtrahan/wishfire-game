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

test('merge routes UI-owner changes through the full UI lock', async () => {
  const {runMerge} = await import('./preCommitRouting.mjs');
  for (const owner of [
    'package.json', 'web-runner/index.html', 'web-runner/src/core/damageNumberAnimation.mjs', 'tools/ui_presentation_lock_gate.mjs', 'tests/uiPresentationLockGateContract.test.js',
    'web-runner/systems/renderBossBattleHud.mjs', 'web-runner/assets/images/boss-hud/clock.png',
    'tests/bossBattleHud.test.mjs', 'tests/devBossLaunch.test.mjs', 'web-runner/systems/devToolingControls.js',
    'web-runner/systems/renderCombatBossControl.mjs', 'web-runner/systems/renderRuntime.js',
    'web-runner/systems/devToolingRuntime.js', 'web-runner/systems/combatPresentationScale.mjs',
    'web-runner/systems/appShellViewport.js', 'web-runner/app.js', 'web-runner/systems/surfaceRenderRouter.js',
    'web-runner/systems/pointerRoutingShell.js',
  ]) {
    const result = runMerge([owner]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.commands.includes('npm run test:ui-lock'), `${owner} must run the rendered lock`);
  }
  assert.deepEqual(runMerge(['README.md']).commands, []);
  assert.notEqual(runMerge(['tests/bossBattleHud.test.mjs'], 'npm run test:ui-lock').status, 0,
    'failed UI lock blocks merge');
});
