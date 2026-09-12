const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
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
  const app = read('web-runner/app.js');
  assert.match(app, /state\.globals\.DeferAdvance[\s\S]*callFunctionWithContext\(fnContext, 'AdvanceTurn'\)[\s\S]*createDeferredAdvanceResolved[\s\S]*runCombatStep\(fnContext, 'ProcessTurn'\)/);
});

test('normal enemy-action completion uses the shared deferred finalizer rather than an isolated release state', () => {
  const source = read('web-runner/systems/renderRuntime.js').replace(/\\n/g, '\n');
  const actionStart = source.indexOf('// Enemy action state machine');
  const actionEnd = source.indexOf('// Hero action lunge', actionStart);
  const action = source.slice(actionStart, actionEnd);
  assert.match(action, /if \(!enemy \|\| \(enemy\.hp \?\? 0\) <= 0\)[\s\S]*applyTurnGateIntent\(createEnemyTurnIdleRecovery/);
  assert.match(action, /if \(enemyAction\.state === 'DONE'\)[\s\S]*applyTurnGateIntent\(createEnemyTurnIdleRecovery, \{[\s\S]*currentTurnUID:[\s\S]*releaseDelay: 0\.35/);
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

test('app enemy-action abort routes through recovery while leaked live enemy-idle re-enters ProcessTurn', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /createEnemyTurnIdleRecovery/);
  assert.match(
    src,
    /currentTurnType === 1[\s\S]*state\.globals\.TurnPhase === 2[\s\S]*!state\.globals\.ActionInProgress[\s\S]*!state\.globals\.IsPlayerBusy[\s\S]*\(isCanPickGemsReady\(state\.globals\.CanPickGems\) \|\| !state\.globals\.DeferAdvance\)[\s\S]*const currentEnemy = currentTurnUID[\s\S]*const liveCurrentEnemy = currentEnemy && currentEnemy\.kind === 'enemy'[\s\S]*if \(liveCurrentEnemy && !hasEmpty && !refillActive && actionClaimBarrier\.canClaimCombatAction\)[\s\S]*applyTurnGateIntent\(createEnemyTurnGateBaseline\);[\s\S]*combatRuntimeGateway\.runCombatStep\(fnContext, 'ProcessTurn'\);[\s\S]*else if \(liveCurrentEnemy\)[\s\S]*applyTurnGateIntent\(createEnemyTurnRetryHold, \{[\s\S]*currentTurnUID,[\s\S]*\}\);[\s\S]*else if \(actionClaimBarrier\.canClaimCombatAction\) \{[\s\S]*applyTurnGateIntent\(createEnemyTurnIdleRecovery, \{[\s\S]*currentTurnUID,[\s\S]*\}\);[\s\S]*combatRuntimeGateway\.runCombatStep\(fnContext, 'ProcessTurn'\);/,
  );
});

test('battle start owns the first turn claim before enemy idle recovery can run', () => {
  const src = read('web-runner/app.js');
  assert.match(
    src,
    /state\.globals\.GamePhase === 'RUNTIME' &&\s+!state\.globals\.BattleStartActive &&\s+currentTurnType === 1/,
  );
});
