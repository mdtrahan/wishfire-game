const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

for (const modulePath of [
  path.join('file://', __dirname, '..', 'src', 'core', 'turnGateController.mjs'),
  path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'turnGateController.mjs'),
]) {
  test(`refresh baseline clears transient combat turn state in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    const normalized = mod.normalizeCombatTurnTransientState({
      CanPickGems: '1',
      IsPlayerBusy: 1,
      DeferAdvance: '1',
      AdvanceAfterAction: '1',
      ActionLockUntil: '3.4',
      ActionOwnerUID: '77',
      ActionInProgress: '1',
      ActionActorUID: '77',
      PendingSkillID: 'HERO_SINGLE',
      PendingActor: '77',
      EnemyLineClearPressureActive: '1',
    });

    assert.equal(normalized.CanPickGems, 1);
    assert.equal(normalized.ActionInProgress, 1);
    assert.equal(normalized.ActionActorUID, 77);
    assert.equal(normalized.PendingSkillID, 'HERO_SINGLE');
    assert.equal(normalized.PendingActor, 77);
    assert.equal(normalized.EnemyLineClearPressureActive, 1);

    const heroReady = mod.createCombatTurnRefreshBaseline(normalized, {
      currentTurnType: 0,
      boardFillActive: 0,
      boardHasEmptySlots: false,
    });
    assert.equal(heroReady.CanPickGems, 1);
    assert.equal(heroReady.IsPlayerBusy, 0);
    assert.equal(heroReady.DeferAdvance, 0);
    assert.equal(heroReady.AdvanceAfterAction, 0);
    assert.equal(heroReady.ActionLockUntil, 0);
    assert.equal(heroReady.ActionOwnerUID, 0);
    assert.equal(heroReady.ActionInProgress, 0);
    assert.equal(heroReady.ActionActorUID, 0);
    assert.equal(heroReady.PendingSkillID, '');
    assert.equal(heroReady.PendingActor, 0);
    assert.equal(heroReady.EnemyLineClearPressureActive, 0);

    const enemyReady = mod.createCombatTurnRefreshBaseline(normalized, {
      currentTurnType: 1,
      boardFillActive: 0,
      boardHasEmptySlots: false,
    });
    assert.equal(enemyReady.CanPickGems, 0);

    const boardBlocked = mod.createCombatTurnRefreshBaseline(normalized, {
      currentTurnType: 0,
      boardFillActive: 1,
      boardHasEmptySlots: true,
    });
    assert.equal(boardBlocked.CanPickGems, 0);
  });

  test(`turn-entry baselines clear action carryover but preserve board pressure in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    const dirty = {
      CanPickGems: 0,
      IsPlayerBusy: 1,
      DeferAdvance: 1,
      AdvanceAfterAction: 1,
      ActionLockUntil: 9,
      ActionOwnerUID: 55,
      ActionInProgress: 1,
      ActionActorUID: 55,
      PendingSkillID: 'HERO_AOE',
      PendingActor: 55,
      EnemyLineClearPressureActive: 1,
    };

    const hero = mod.createHeroTurnGateBaseline(dirty);
    assert.equal(hero.CanPickGems, 1);
    assert.equal(hero.IsPlayerBusy, 0);
    assert.equal(hero.ActionOwnerUID, 0);
    assert.equal(hero.ActionInProgress, 0);
    assert.equal(hero.ActionActorUID, 0);
    assert.equal(hero.PendingSkillID, '');
    assert.equal(hero.PendingActor, 0);
    assert.equal(hero.EnemyLineClearPressureActive, 1);

    const enemy = mod.createEnemyTurnGateBaseline(dirty);
    assert.equal(enemy.CanPickGems, 0);
    assert.equal(enemy.IsPlayerBusy, 1);
    assert.equal(enemy.ActionOwnerUID, 0);
    assert.equal(enemy.ActionInProgress, 0);
    assert.equal(enemy.ActionActorUID, 0);
    assert.equal(enemy.PendingSkillID, '');
    assert.equal(enemy.PendingActor, 0);
    assert.equal(enemy.EnemyLineClearPressureActive, 1);
  });
}
