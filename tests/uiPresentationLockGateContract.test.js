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
    'each-hero-targets-nearest-living-foe',
    'realtime-basic-clocks-present',
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
  assert.match(gate, /TickRealtimeHeroBasics/);
  assert.match(gate, /RealtimeHeroBasicClocks/);
  assert.match(gate, /arenaTargetUID/);
  assert.match(gate, /eligibleInRangeEnemyUIDs/);
  assert.match(gate, /resolveHeroAttackTarget/);
  assert.doesNotMatch(gate, /DynamicInitiativeAuthority|setupDynamicInitiative/);
  assert.doesNotMatch(gate, /AstralFlow|\bFLOW\b/);
  assert.match(gate, /ui-lock-report\.json/);
  assert.match(gate, /page\.screenshot/);
  assert.match(gate, /--prove-rejection/);
  assert.match(gate, /UI_LOCK_REJECTION_PROOF_PASS/);
  assert.match(gate, /process\.exitCode = 1/);
});

test('UI lock checks each hero nearest living target and permits targetless empty fields', async () => {
 const { evaluateCombatTargetInvariant: check }=await import('../tools/ui_presentation_lock_gate.mjs');
 const hero={uid:1,kind:'hero',hp:100,footX:100,footY:200,arenaTargetUID:0};
 assert.equal(check({heroes:[hero],enemies:[]}).pass,true);
 const remote={uid:20,kind:'enemy',hp:50,footX:1200,footY:200,streamState:'roaming'};
 const pursuing=check({heroes:[{...hero,arenaTargetUID:20}],enemies:[remote]});
 assert.equal(pursuing.pass,true);assert.deepEqual(pursuing.actors[0].eligibleInRangeEnemyUIDs,[]);
 const near={...remote,uid:21,footX:140,streamState:'retreating'};
 assert.equal(check({heroes:[hero],enemies:[near,remote]}).pass,false,'a missing target fails with a living foe');
 assert.equal(check({heroes:[{...hero,arenaTargetUID:20}],enemies:[near,remote]}).pass,false,'a stale farther target fails');
 const both=check({heroes:[{...hero,arenaTargetUID:21},{...hero,uid:2,footX:1220,arenaTargetUID:20}],enemies:[near,remote]});
 assert.equal(both.pass,true);assert.deepEqual(both.actors.map(a=>a.expectedTargetUID),[21,20]);
 near.hp=0;assert.equal(check({heroes:[{...hero,arenaTargetUID:21}],enemies:[near,remote]}).pass,false,'KO foes cannot retain a target');
});

test('UI lock startup waits for basic clocks without requiring an attack target', () => {
  const gate = read('tools/ui_presentation_lock_gate.mjs');
  const wait = gate.match(/await page\.waitForFunction\(\(\) => \{\s*const globals = window\.__codexGame\.globals;([\s\S]*?)\}, null, \{ timeout: 5000 \}\);/);
  assert.ok(wait, 'missing realtime combat startup synchronization');
  assert.match(wait[1], /RealtimeHeroBasicClocks/);
  assert.doesNotMatch(wait[1], /RealtimeHeroFocusTargetUID/, 'targetless roaming is valid during startup');
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
