const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function productionTickSource() {
  const src = read('web-runner/app.js');
  const start = src.indexOf('function tick(){');
  const end = src.indexOf('\n  tick();', start);
  assert.ok(start >= 0 && end > start, 'missing production tick boundary');
  return src.slice(start, end);
}

test('enemy-turn idle recovery gate keeps enemy turns non-pickable while scheduling deferred advance', async () => {
  const runtimeTurnGate = await import(path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'turnGateController.mjs'));
  const sharedTurnGate = await import(path.join('file://', __dirname, '..', 'src', 'core', 'turnGateController.mjs'));

  for (const mod of [runtimeTurnGate, sharedTurnGate]) {
    const next = mod.createEnemyTurnIdleRecovery({
      CanPickGems: 1,
      IsPlayerBusy: 0,
      DeferAdvance: 0,
      AdvanceAfterAction: 0,
      ActionLockUntil: 4.2,
      ActionOwnerUID: 0,
    }, {
      now: 5,
      currentTurnUID: 77,
    });
    assert.equal(next.CanPickGems, 0);
    assert.equal(next.IsPlayerBusy, 0);
    assert.equal(next.DeferAdvance, 1);
    assert.equal(next.AdvanceAfterAction, 1);
    assert.equal(next.ActionOwnerUID, 77);
    assert.equal(next.ActionLockUntil, 5.05);
  }
});

test('enemy-action completion retains its owner through the final visual hold before advancing once', async () => {
  const runtimeTurnGate = await import(path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'turnGateController.mjs'));
  const sharedTurnGate = await import(path.join('file://', __dirname, '..', 'src', 'core', 'turnGateController.mjs'));
  for (const mod of [runtimeTurnGate, sharedTurnGate]) {
    const next = mod.createEnemyTurnIdleRecovery({
      IsPlayerBusy: 1, ActionInProgress: 1, ActionActorUID: 17, ActionOwnerUID: 0,
      PendingSkillID: '', PendingActor: 0, ActionLockUntil: 0,
    }, { now: 12, currentTurnUID: 17, releaseDelay: 0.35 });
    assert.equal(next.IsPlayerBusy, 0);
    assert.equal(next.ActionInProgress, 0);
    assert.equal(next.ActionActorUID, 0);
    assert.equal(next.ActionOwnerUID, 17);
    assert.equal(next.DeferAdvance, 1);
    assert.equal(next.AdvanceAfterAction, 1);
    assert.equal(next.ActionLockUntil, 12.35);
  }
});

test('the same production completion handoff advances Battle A and continuing Battle B once', async () => {
  const runtimeTurnGate = await import(path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'turnGateController.mjs'));
  for (const battle of ['Battle A', 'Battle B']) {
    const afterEnemyAction = runtimeTurnGate.createEnemyTurnIdleRecovery({
      IsPlayerBusy: 1, ActionInProgress: 1, ActionActorUID: 31, ActionOwnerUID: 0,
    }, { now: 4, currentTurnUID: 31, releaseDelay: 0.35 });
    assert.equal(afterEnemyAction.IsPlayerBusy, 0, `${battle} releases its enemy action`);
    assert.equal(afterEnemyAction.DeferAdvance, 1, `${battle} schedules one scheduler advance`);
    const afterAdvance = runtimeTurnGate.createDeferredAdvanceResolved(afterEnemyAction);
    assert.equal(afterAdvance.DeferAdvance, 0, `${battle} cannot schedule a second advance`);
    assert.equal(afterAdvance.AdvanceAfterAction, 0, `${battle} clears its action handoff`);
  }
  const tick = productionTickSource();
  assert.match(tick, /combatSimulationTicker\.tick\(\{/);
  assert.doesNotMatch(tick, /callFunctionWithContext\(fnContext, '(?:AdvanceTurn|ProcessTurn|EnemyTurn)'/);
});

test('normal enemy-action completion uses the shared deferred finalizer rather than an isolated release state', () => {
  const source = read('web-runner/systems/combatSimulationTick.mjs');
  const actionStart = source.indexOf('// Continuous combat owns one independent action state per enemy.');
  const action = source.slice(actionStart);
  assert.match(action, /if \(!enemy \|\| \(enemy\.hp \?\? 0\) <= 0\)[\s\S]*completeEnemyTurn\(enemyAction\)/);
  assert.match(action, /if \(enemyAction\.state === 'DONE'\)[\s\S]*completeEnemyTurn\(enemyAction, 0\.35\)/);
  assert.match(action, /readyAt\[key\] = enemyAction\?\.noTargetAtImpact[\s\S]*enemyAction\?\.nextReadyAt/);
  assert.doesNotMatch(action, /callFunctionWithContext\(fnContext, 'AdvanceTurn'\)/);
  assert.doesNotMatch(action, /const releaseState = \{[\s\S]*ActionLockUntil: \(state\.globals\.time \|\| 0\) \+ 0\.35/);
});

test('enemy-turn retry hold preserves a live enemy turn instead of scheduling advance', async () => {
  const runtimeTurnGate = await import(path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'turnGateController.mjs'));
  const sharedTurnGate = await import(path.join('file://', __dirname, '..', 'src', 'core', 'turnGateController.mjs'));

  for (const mod of [runtimeTurnGate, sharedTurnGate]) {
    const next = mod.createEnemyTurnRetryHold({
      CanPickGems: 1,
      IsPlayerBusy: 0,
      DeferAdvance: 1,
      AdvanceAfterAction: 1,
      ActionLockUntil: 9,
      ActionOwnerUID: 12,
      ActionInProgress: 1,
      ActionActorUID: 12,
      PendingSkillID: 'HERO_SINGLE',
      PendingActor: 44,
    }, {
      currentTurnUID: 77,
    });
    assert.equal(next.CanPickGems, 0);
    assert.equal(next.IsPlayerBusy, 0);
    assert.equal(next.DeferAdvance, 0);
    assert.equal(next.AdvanceAfterAction, 0);
    assert.equal(next.ActionOwnerUID, 77);
    assert.equal(next.ActionLockUntil, 0);
    assert.equal(next.ActionInProgress, 0);
    assert.equal(next.ActionActorUID, 0);
    assert.equal(next.PendingSkillID, '');
    assert.equal(next.PendingActor, 0);
  }
});

test('production app no longer recovers or re-enters turn-based enemy actions', () => {
  const tick = productionTickSource();
  assert.doesNotMatch(tick, /currentTurnType/);
  assert.doesNotMatch(tick, /callFunctionWithContext\(fnContext, '(?:AdvanceTurn|ProcessTurn|EnemyTurn)'/);
  assert.match(tick, /combatSimulationTicker\.tick\(\{/);
});

test('production battle start uses the realtime scheduler without a first-turn claim', () => {
  const tick = productionTickSource();
  assert.match(tick, /combatSimulationTicker\.tick\(\{/);
  assert.doesNotMatch(tick, /QaFixtureHoldTurn|currentTurnType/);
});
