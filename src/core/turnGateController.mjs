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
