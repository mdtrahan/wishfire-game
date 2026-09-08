const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

for (const modulePath of [
  path.join('file://', __dirname, '..', 'src', 'core', 'turnGateController.mjs'),
  path.join('file://', __dirname, '..', 'web-runner', 'src', 'core', 'turnGateController.mjs'),
]) {
  test(`refresh baseline clears transient combat turn state in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    assert.equal(mod.isCanPickGemsReady(1), true);
    assert.equal(mod.isCanPickGemsReady(true), true);
    assert.equal(mod.isCanPickGemsReady(0), false);
    assert.equal(mod.isCanPickGemsReady(false), false);

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
      PendingSuperGemAction: { kind: 'super_gem_attack', color: 1, actorUID: 77 },
      EnemyLineClearPressureActive: '1',
    });

    assert.equal(normalized.CanPickGems, 1);
    assert.equal(normalized.ActionInProgress, 1);
    assert.equal(normalized.ActionActorUID, 77);
    assert.equal(normalized.PendingSkillID, 'HERO_SINGLE');
    assert.equal(normalized.PendingActor, 77);
    assert.deepEqual(normalized.PendingSuperGemAction, { kind: 'super_gem_attack', color: 1, actorUID: 77 });
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
    assert.equal(heroReady.PendingSuperGemAction, null);
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
      PendingSuperGemAction: { kind: 'super_gem_attack', color: 0, actorUID: 55 },
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
    assert.equal(hero.PendingSuperGemAction, null);
    assert.equal(hero.EnemyLineClearPressureActive, 1);

    const enemy = mod.createEnemyTurnGateBaseline(dirty);
    assert.equal(enemy.CanPickGems, 0);
    assert.equal(enemy.IsPlayerBusy, 1);
    assert.equal(enemy.ActionOwnerUID, 0);
    assert.equal(enemy.ActionInProgress, 0);
    assert.equal(enemy.ActionActorUID, 0);
    assert.equal(enemy.PendingSkillID, '');
    assert.equal(enemy.PendingActor, 0);
    assert.equal(enemy.PendingSuperGemAction, null);
    assert.equal(enemy.EnemyLineClearPressureActive, 1);
  });

  test(`refill completion restores input only for idle hero phase in ${modulePath}`, async () => {
    const mod = await import(modulePath);
    const idleHero = mod.createRefillCompleteGate({
      CanPickGems: 0,
      IsPlayerBusy: 1,
      TurnPhase: 0,
    });
    assert.equal(idleHero.CanPickGems, 1);
    assert.equal(idleHero.IsPlayerBusy, 0);

    const deferredHero = mod.createRefillCompleteGate({
      CanPickGems: 0,
      IsPlayerBusy: 1,
      TurnPhase: 0,
      DeferAdvance: 1,
      AdvanceAfterAction: 1,
    });
    assert.equal(deferredHero.CanPickGems, 0);
    assert.equal(deferredHero.IsPlayerBusy, 0);
    assert.equal(deferredHero.DeferAdvance, 1);

    const actionPhase = mod.createRefillCompleteGate({
      CanPickGems: 0,
      IsPlayerBusy: 1,
      TurnPhase: 1,
    });
    assert.equal(actionPhase.CanPickGems, 0);
    assert.equal(actionPhase.IsPlayerBusy, 0);
  });

  test(`presentation barrier serializes refill, turn advance, action claim, and input restore in ${modulePath}`, async () => {
    const mod = await import(modulePath);

    const retiredBoard = mod.derivePresentationTurnBarrier({
      globals: {time:10,TurnPhase:0,BoardFillActive:1},boardHasEmptySlots:true,
      refillBounce:{active:true},gemMergeFx:{active:true},yellowCasino:{active:true},
    });
    assert.equal(retiredBoard.canClaimCombatAction,true);
    assert.equal(retiredBoard.canAdvanceTurn,true);
    assert.equal(retiredBoard.blockingLane,null);

    const textEndHold = mod.derivePresentationTurnBarrier({
      globals: { time: 10, TurnPhase: 0, TextAnimEndAt: 11.5 },
    });
    assert.equal(textEndHold.canStartRefill, false);
    assert.equal(textEndHold.canAdvanceTurn, false);
    assert.equal(textEndHold.canClaimCombatAction, false);
    assert.equal(textEndHold.firstBlockingLane, 'text-animation');

    // Paused card state cannot block native combat; existing presentation gates still apply.
    const withoutCardFlags = mod.derivePresentationTurnBarrier({
      globals: { time: 10, TurnPhase: 0 }, boardHasEmptySlots: true,
    });
    for (const staleFlags of [{ SkillDraughtOpen: 1 }, { SkillDraughtPendingOpen: 1 }]) {
      assert.deepEqual(mod.derivePresentationTurnBarrier({
        globals: { time: 10, TurnPhase: 0, ...staleFlags }, boardHasEmptySlots: true,
      }), withoutCardFlags);
      const duringAnimation = mod.derivePresentationTurnBarrier({
        globals: { time: 10, TurnPhase: 0, ...staleFlags, TextAnimEndAt: 11 },
        boardHasEmptySlots: true,
      });
      assert.equal(duringAnimation.canClaimSkillDraught, false);
      assert.equal(duringAnimation.firstBlockingLane, 'text-animation');
    }

    const actionHold = mod.derivePresentationTurnBarrier({
      globals: {
        time: 10,
        TurnPhase: 1,
        ActionInProgress: 1,
        ActionLockUntil: 11,
        HeroAction: { active: true, uid: 7 },
        PendingHeroHits: [{ uid: 101, amount: 8 }],
      },
    });
    assert.equal(actionHold.canStartRefill, false);
    assert.equal(actionHold.canAdvanceTurn, false);
    assert.equal(actionHold.canClaimCombatAction, false);
    assert.equal(actionHold.firstBlockingLane, 'hero-action');
    assert.equal(actionHold.lanes.pendingHeroHits, true);

    const idleHero = mod.derivePresentationTurnBarrier({
      globals: { time: 10, TurnPhase: 0 },
    });
    assert.equal(idleHero.canStartRefill, true);
    assert.equal(idleHero.canAdvanceTurn, true);
    assert.equal(idleHero.canClaimCombatAction, true);
    assert.equal(idleHero.canRestoreHeroInput, true);
    assert.equal(idleHero.firstBlockingLane, null);

    const staleBusyIdleHero = mod.derivePresentationTurnBarrier({
      globals: { time: 10, TurnPhase: 0, IsPlayerBusy: 1 },
    });
    assert.equal(staleBusyIdleHero.canRestoreHeroInput, true);
    assert.equal(staleBusyIdleHero.canAdvanceTurn, true);

    const activeBusyHeroAction = mod.derivePresentationTurnBarrier({
      globals: {
        time: 10,
        TurnPhase: 0,
        IsPlayerBusy: 1,
        ActionInProgress: 1,
      },
    });
    assert.equal(activeBusyHeroAction.canRestoreHeroInput, false);
  });
}
