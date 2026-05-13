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

test('app enemy-action abort routes through recovery while leaked live enemy-idle restarts the active enemy', () => {
  const src = read('web-runner/app.js');
  assert.match(src, /createEnemyTurnIdleRecovery/);
  assert.match(
    src,
    /currentTurnType === 1[\s\S]*state\.globals\.TurnPhase === 2[\s\S]*!state\.globals\.ActionInProgress[\s\S]*!state\.globals\.IsPlayerBusy[\s\S]*\(state\.globals\.CanPickGems === true \|\| !state\.globals\.DeferAdvance\)[\s\S]*const currentEnemy = currentTurnUID[\s\S]*const liveCurrentEnemy = currentEnemy && currentEnemy\.kind === 'enemy'[\s\S]*if \(liveCurrentEnemy && !hasEmpty && !refillActive\)[\s\S]*applyTurnGateIntent\(createEnemyTurnGateBaseline\);[\s\S]*callFunctionWithContext\(fnContext, 'EnemyTurn', currentTurnUID\);[\s\S]*else if \(liveCurrentEnemy\)[\s\S]*applyTurnGateIntent\(createEnemyTurnRetryHold, \{[\s\S]*currentTurnUID,[\s\S]*\}\);[\s\S]*else \{[\s\S]*applyTurnGateIntent\(createEnemyTurnIdleRecovery, \{[\s\S]*currentTurnUID,[\s\S]*\}\);[\s\S]*combatRuntimeGateway\.runCombatStep\(fnContext, 'ProcessTurn'\);/,
  );
});
