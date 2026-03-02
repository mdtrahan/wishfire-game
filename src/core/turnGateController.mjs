export function normalizeTurnGateState(current = {}) {
  return {
    CanPickGems: Number(current.CanPickGems || 0),
    IsPlayerBusy: Number(current.IsPlayerBusy || 0),
    DeferAdvance: Number(current.DeferAdvance || 0),
    AdvanceAfterAction: Number(current.AdvanceAfterAction || 0),
    ActionLockUntil: Number(current.ActionLockUntil || 0),
    ActionOwnerUID: Number(current.ActionOwnerUID || 0),
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
  return {
    ...base,
    CanPickGems: 1,
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

export function createDeferredAdvanceResolved(current = {}) {
  const base = normalizeTurnGateState(current);
  return {
    ...base,
    DeferAdvance: 0,
    AdvanceAfterAction: 0,
    ActionOwnerUID: 0,
  };
}
