export function normalizeCombatTurnTransientState(current = {}) {
  return {
    CanPickGems: Number(current.CanPickGems || 0),
    IsPlayerBusy: Number(current.IsPlayerBusy || 0),
    DeferAdvance: Number(current.DeferAdvance || 0),
    AdvanceAfterAction: Number(current.AdvanceAfterAction || 0),
    ActionLockUntil: Number(current.ActionLockUntil || 0),
    ActionOwnerUID: Number(current.ActionOwnerUID || 0),
    ActionInProgress: Number(current.ActionInProgress || 0),
    ActionActorUID: Number(current.ActionActorUID || 0),
    PendingSkillID: String(current.PendingSkillID || ''),
    PendingActor: Number(current.PendingActor || 0),
    PendingSuperGemAction: current.PendingSuperGemAction || null,
    EnemyLineClearPressureActive: Number(current.EnemyLineClearPressureActive || 0),
  };
}

export function normalizeTurnGateState(current = {}) {
  return normalizeCombatTurnTransientState(current);
}

export function isCanPickGemsReady(value) {
  return Number(value) === 1;
}

export const COMBAT_CHOICE_MODE = Object.freeze({
  AUTOCOMBAT: 'AUTOCOMBAT',
  OFFER: 'OFFER',
  TARGETING: 'TARGETING',
  PAUSED_NAV: 'PAUSED_NAV',
  END: 'END',
});

export function deriveCombatChoiceMode(globals = {}) {
  if (globals.NativeBattleEnded || ['victory', 'defeat'].includes(String(globals.ProgressionBattle?.outcome || ''))) return COMBAT_CHOICE_MODE.END;
  if (globals.PausedCombatSnapshot) return COMBAT_CHOICE_MODE.PAUSED_NAV;
  if (hasSessionLevelUpPresentationBarrier(globals)) return COMBAT_CHOICE_MODE.OFFER;
  if (globals.PendingSkillID && (Number(globals.TurnPhase || 0) === 1 || globals.PendingSuperGemAction)) return COMBAT_CHOICE_MODE.TARGETING;
  return COMBAT_CHOICE_MODE.AUTOCOMBAT;
}

export function deriveCombatChoiceInput(globals = {}) {
  const mode = deriveCombatChoiceMode(globals);
  return {
    mode,
    acceptsSettlement: mode === COMBAT_CHOICE_MODE.OFFER,
    acceptsBattlefieldTarget: mode === COMBAT_CHOICE_MODE.TARGETING,
    canResumeCTB: mode === COMBAT_CHOICE_MODE.AUTOCOMBAT,
  };
}

// EXP settlement, the queued dance, and the player choice are one presentation
// boundary. The scheduler must not resolve another actor until it has faded out.
export function hasSessionLevelUpPresentationBarrier(globals = {}) {
  // XP settlement remains a visible presentation boundary. Combat card offers
  // and threshold pauses have been retired from the runtime.
  return !!globals?.SessionLevelUpSettlement;
}

export function hasActiveCombatEffects(globals = {}) {
  return [
    globals.CombatImpactRequests,
    globals.CombatImpactVisuals,
    globals.ChainStrikeVisuals,
    globals.ArcanePulseVisuals,
    globals.DamageTexts,
  ].some(entries => Array.isArray(entries) && entries.length > 0);
}

export function hasActiveAttackPresentation(globals = {}) {
  const now = Number(globals.time || 0);
  return hasActiveCombatEffects(globals)
    || (Array.isArray(globals.PendingHeroHits) && globals.PendingHeroHits.length > 0)
    || !!globals.HeroAction?.active
    || !!globals.EnemyAction?.active
    || !!globals.TextAnimating
    || Number(globals.TextAnimEndAt || 0) > now;
}

export function derivePresentationTurnBarrier({
  globals = {},
  refillBounce = null,
  yellowCasino = null,
  gemMergeFx = null,
  boardHasEmptySlots = false,
  enemyLineClearPressureActive = false,
} = {}) {
  const now = Number(globals.time || 0);
  const pendingHeroHits = Array.isArray(globals.PendingHeroHits)
    ? globals.PendingHeroHits.length > 0
    : !!globals.PendingHeroHits;
  const lanes = {
    levelUpSettlement: hasSessionLevelUpPresentationBarrier(globals),
    boardFill: false,
    refillBounce: false,
    yellowCasino: false,
    gemMerge: false,
    textAnimating: !!globals.TextAnimating || Number(globals.TextAnimEndAt || 0) > now,
    heroAction: !!(globals.HeroAction && globals.HeroAction.active),
    enemyAction: !!(globals.EnemyAction && globals.EnemyAction.active),
    pendingHeroHits,
    combatEffects: hasActiveCombatEffects(globals),
    flowOrbs: Array.isArray(globals.FlowOrbs) && globals.FlowOrbs.length > 0,
    pendingEnemyDeaths: Object.keys(globals.EnemyDeathVisualHoldByUID || {}).length > 0,
    actionLock: Number(globals.ActionLockUntil || 0) > now,
    actionInProgress: !!globals.ActionInProgress,
  };
  const orderedLaneNames = [
    ['level-up-settlement', lanes.levelUpSettlement],
    ['board-fill', lanes.boardFill],
    ['refill-bounce', lanes.refillBounce],
    ['yellow-casino', lanes.yellowCasino],
    ['gem-merge', lanes.gemMerge],
    ['text-animation', lanes.textAnimating],
    ['hero-action', lanes.heroAction],
    ['enemy-action', lanes.enemyAction],
    ['pending-hero-hits', lanes.pendingHeroHits],
    ['combat-effects', lanes.combatEffects],
    ['flow-orbs', lanes.flowOrbs],
    ['pending-enemy-deaths', lanes.pendingEnemyDeaths],
    ['action-lock', lanes.actionLock],
    ['action-in-progress', lanes.actionInProgress],
  ];
  const activePresentationLane = orderedLaneNames.find(([, active]) => active)?.[0] || null;
  const refillPending = false;
  const firstBlockingLane = activePresentationLane || (refillPending ? 'refill-pending' : null);
  const presentationBlocked = !!activePresentationLane;
  const pendingTargetAction = !!globals.PendingSkillID && (
    Number(globals.TurnPhase || 0) === 1 ||
    !!globals.PendingSuperGemAction
  );
  return {
    lanes,
    refillPending,
    blockingLane: firstBlockingLane,
    firstBlockingLane,
    canStartRefill: !presentationBlocked,
    canAdvanceTurn: !presentationBlocked && !refillPending,
    canClaimCombatAction: !presentationBlocked && !refillPending && !globals.DeferAdvance,
    canResolvePendingTargetAction: pendingTargetAction && !presentationBlocked && !globals.DeferAdvance,
    canRestoreHeroInput: (
      !presentationBlocked &&
      !refillPending &&
      !globals.DeferAdvance &&
      !globals.PendingSkillID &&
      !globals.PendingSuperGemAction &&
      !globals.ActionInProgress &&
      Number(globals.TurnPhase || 0) === 0
    ),
  };
}

export function createEnemyTurnGateBaseline(current = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    CanPickGems: 0,
    IsPlayerBusy: 1,
    DeferAdvance: 0,
    AdvanceAfterAction: 0,
    ActionLockUntil: 0,
    ActionOwnerUID: 0,
    ActionInProgress: 0,
    ActionActorUID: 0,
    PendingSkillID: '',
    PendingActor: 0,
    PendingSuperGemAction: null,
  };
}

export function createEnemyTurnRetryHold(current = {}, { currentTurnUID = 0 } = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    CanPickGems: 0,
    IsPlayerBusy: 0,
    DeferAdvance: 0,
    AdvanceAfterAction: 0,
    ActionLockUntil: 0,
    ActionOwnerUID: Number(currentTurnUID || 0),
    ActionInProgress: 0,
    ActionActorUID: 0,
    PendingSkillID: '',
    PendingActor: 0,
    PendingSuperGemAction: null,
  };
}

export function createEnemyRosterRefillHold(current = {}, {
  now = 0,
  currentTurnUID = 0,
  preservePendingSkill = false,
} = {}) {
  const base = normalizeTurnGateState(current);
  const safeNow = Number(now || 0);
  const hasOwnedDeferred = Boolean(base.DeferAdvance && base.AdvanceAfterAction && base.ActionOwnerUID);
  const keepPendingSkill = Boolean(preservePendingSkill && !hasOwnedDeferred);
  return {
    ...base,
    CanPickGems: 0,
    IsPlayerBusy: keepPendingSkill ? base.IsPlayerBusy : 0,
    DeferAdvance: hasOwnedDeferred ? 1 : 0,
    AdvanceAfterAction: hasOwnedDeferred ? 1 : 0,
    ActionLockUntil: Math.max(Number(base.ActionLockUntil || 0), safeNow + 0.05),
    ActionOwnerUID: hasOwnedDeferred ? Number(base.ActionOwnerUID || currentTurnUID || 0) : 0,
    ActionInProgress: keepPendingSkill ? Number(base.ActionInProgress || 0) : 0,
    ActionActorUID: keepPendingSkill ? Number(base.ActionActorUID || 0) : 0,
    PendingSkillID: keepPendingSkill ? String(base.PendingSkillID || '') : '',
    PendingActor: keepPendingSkill ? Number(base.PendingActor || 0) : 0,
    PendingSuperGemAction: keepPendingSkill ? base.PendingSuperGemAction || null : null,
  };
}

export function createHeroTurnGateBaseline(current = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    CanPickGems: 1,
    IsPlayerBusy: 0,
    DeferAdvance: 0,
    AdvanceAfterAction: 0,
    ActionLockUntil: 0,
    ActionOwnerUID: 0,
    ActionInProgress: 0,
    ActionActorUID: 0,
    PendingSkillID: '',
    PendingActor: 0,
    PendingSuperGemAction: null,
  };
}

export function createCombatTurnRefreshBaseline(current = {}, {
  currentTurnType = 0,
  boardFillActive = 0,
  boardHasEmptySlots = false,
} = {}) {
  const base = normalizeCombatTurnTransientState(current);
  const heroTurnReady =
    Number(currentTurnType || 0) === 0 &&
    Number(boardFillActive || 0) === 0 &&
    !boardHasEmptySlots;
  return {
    ...base,
    CanPickGems: heroTurnReady ? 1 : 0,
    IsPlayerBusy: 0,
    DeferAdvance: 0,
    AdvanceAfterAction: 0,
    ActionLockUntil: 0,
    ActionOwnerUID: 0,
    ActionInProgress: 0,
    ActionActorUID: 0,
    PendingSkillID: '',
    PendingActor: 0,
    PendingSuperGemAction: null,
    EnemyLineClearPressureActive: 0,
  };
}

export function createYellowSafetyNet(current = {}, { now = 0, currentTurnUID = 0 } = {}) {
  const base = normalizeTurnGateState(current);
  const safeNow = Number(now || 0);
  const owner = Number(base.ActionOwnerUID || currentTurnUID || 0);
  return {
    ...base,
    DeferAdvance: 1,
    AdvanceAfterAction: 1,
    ActionOwnerUID: owner,
    ActionLockUntil: Number(base.ActionLockUntil || 0) <= safeNow
      ? safeNow + 0.05
      : Number(base.ActionLockUntil || 0),
  };
}

export function createYellowSequenceGate(current = {}, { now = 0, totalDuration = 0, actorUID = 0 } = {}) {
  const base = normalizeTurnGateState(current);
  const safeNow = Number(now || 0);
  const safeDuration = Math.max(0.1, Number(totalDuration || 0));
  return {
    ...base,
    ActionLockUntil: safeNow + safeDuration,
    DeferAdvance: 1,
    AdvanceAfterAction: 1,
    ActionOwnerUID: Number(actorUID || 0),
    CanPickGems: 0,
    IsPlayerBusy: 1,
  };
}

export function createYellowSequenceSkip(current = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    IsPlayerBusy: 0,
  };
}

export function createYellowSequenceCompletion(current = {}, { handoffPending = false, canRestorePickability = false } = {}) {
  const base = normalizeTurnGateState(current);
  const next = {
    ...base,
    IsPlayerBusy: 0,
  };
  if (canRestorePickability) {
    next.CanPickGems = 1;
    next.DeferAdvance = 0;
  } else if (handoffPending) {
    next.CanPickGems = 0;
  }
  return next;
}

export function createRefillStartGate(current = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    CanPickGems: 0,
    IsPlayerBusy: 1,
  };
}

export function createRefillCompleteGate(current = {}) {
  const base = normalizeTurnGateState(current);
  const canRestorePickability = Number(current.TurnPhase || 0) === 0 && !Number(current.DeferAdvance || 0);
  return {
    ...base,
    CanPickGems: canRestorePickability ? 1 : 0,
    IsPlayerBusy: 0,
  };
}

export function createDeferredRefillHold(current = {}, { now = 0 } = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    ActionLockUntil: Math.max(Number(base.ActionLockUntil || 0), Number(now || 0) + 0.05),
  };
}

export function createDeferredTextHold(current = {}, { now = 0 } = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    ActionLockUntil: Number(now || 0) + 0.1,
  };
}

export function createDeferredStaleBusyRecovery(current = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    IsPlayerBusy: 0,
  };
}

export function createDeferredStaleActionRecovery(current = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    IsPlayerBusy: 0,
    ActionInProgress: 0,
    ActionActorUID: 0,
  };
}

export function createEnemyTurnIdleRecovery(current = {}, { now = 0, currentTurnUID = 0, releaseDelay = 0.05 } = {}) {
  const base = normalizeTurnGateState(current);
  const safeNow = Number(now || 0);
  const owner = Number(base.ActionOwnerUID || currentTurnUID || 0);
  return {
    ...base,
    CanPickGems: 0,
    IsPlayerBusy: 0,
    DeferAdvance: 1,
    AdvanceAfterAction: 1,
    ActionOwnerUID: owner,
    ActionLockUntil: Math.max(Number(base.ActionLockUntil || 0), safeNow + Math.max(0.05, Number(releaseDelay || 0))),
    ActionInProgress: 0,
    ActionActorUID: 0,
    PendingSkillID: '',
    PendingActor: 0,
    PendingSuperGemAction: null,
  };
}

export function createDeferredAdvanceResolved(current = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    DeferAdvance: 0,
    AdvanceAfterAction: 0,
    ActionOwnerUID: 0,
  };
}
