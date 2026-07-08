function clearPendingTargetState(globals) {
  globals.PendingSkillID = '';
  globals.PendingActor = 0;
  globals.SelectedEnemyUID = 0;
  globals.SelectedEnemyUIDOwner = 0;
}

export function resolvePendingSuperGemHandoff({
  globals,
  actorUID = 0,
  source = 'pending-supergem-handoff',
  executePendingSuperGemAction,
  executeSkill,
  hideAttackUI,
} = {}) {
  if (!globals) {
    return {
      resolvedPendingSuperGem: false,
      executeSkillResult: null,
      recoveredRejectedPendingSuperGem: false,
    };
  }
  const hadPendingSuperGemAction = !!globals.PendingSuperGemAction;
  const pendingSkillID = String(globals.PendingSkillID || '');
  const resolvedActorUID = Number(globals.PendingActor || 0) > 0
    ? Number(globals.PendingActor || 0)
    : Number(actorUID || 0);
  let resolvedPendingSuperGem = false;
  let executeSkillResult = null;

  if (hadPendingSuperGemAction && typeof executePendingSuperGemAction === 'function') {
    resolvedPendingSuperGem = !!executePendingSuperGemAction();
  }

  if (hadPendingSuperGemAction && !resolvedPendingSuperGem) {
    const pending = globals.PendingSuperGemAction || {};
    globals.LastPendingSuperGemReject = {
      source: String(source || 'pending-supergem-handoff'),
      actorUID: resolvedActorUID,
      pendingSkillID,
      color: Number(pending.color ?? -1),
      reason: 'execute-rejected',
    };
    globals.PendingSuperGemAction = null;
    clearPendingTargetState(globals);
    if (typeof hideAttackUI === 'function') hideAttackUI();
    globals.CanPickGems = false;
    globals.IsPlayerBusy = 0;
    globals.DeferAdvance = 0;
    globals.AdvanceAfterAction = 0;
    globals.ActionOwnerUID = 0;
    return {
      resolvedPendingSuperGem: false,
      executeSkillResult: null,
      recoveredRejectedPendingSuperGem: true,
    };
  }

  if (!resolvedPendingSuperGem && typeof executeSkill === 'function') {
    executeSkillResult = executeSkill(pendingSkillID, resolvedActorUID);
  }

  clearPendingTargetState(globals);
  if (typeof hideAttackUI === 'function') hideAttackUI();
  globals.CanPickGems = false;
  globals.IsPlayerBusy = 1;
  return {
    resolvedPendingSuperGem,
    executeSkillResult,
    recoveredRejectedPendingSuperGem: false,
  };
}
