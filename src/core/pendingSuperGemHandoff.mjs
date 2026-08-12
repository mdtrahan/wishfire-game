function clearPendingTargetState(globals) {
  globals.PendingSkillID = '';
  globals.PendingActor = 0;
  globals.SelectedEnemyUID = 0;
  globals.SelectedEnemyUIDOwner = 0;
  globals.PendingManualTargetIntent = null;
  globals.ActiveManualTargetTraceSequence = 0;
}

function getLivingHeroUID(uid, getActorByUID) {
  const candidateUID = Number(uid || 0);
  if (!(candidateUID > 0)) return 0;
  const actor = getActorByUID(candidateUID);
  if (!actor || actor.kind !== 'hero' || Number(actor.hp ?? 1) <= 0) return 0;
  return candidateUID;
}

export function recoverPendingTargetActor({
  globals,
  currentTurnUID = 0,
  selectedHeroUID = 0,
  getActorByUID,
} = {}) {
  if (!globals || typeof getActorByUID !== 'function') return 0;
  const candidates = [globals.PendingActor, currentTurnUID, selectedHeroUID];
  for (const uid of candidates) {
    const heroUID = getLivingHeroUID(uid, getActorByUID);
    if (!(heroUID > 0)) continue;
    globals.PendingActor = heroUID;
    return heroUID;
  }
  return 0;
}

export function capturePendingEnemyTargetIntent({
  globals,
  actorUID = 0,
  target = null,
  now = 0,
} = {}) {
  const ownerUID = Number(actorUID || 0);
  const targetUID = Number(target?.uid || 0);
  const slotIndex = Number(target?.slotIndex);
  if (!globals || !(ownerUID > 0) || !(targetUID > 0) || target?.kind !== 'enemy' || Number(target?.hp ?? 0) <= 0) {
    return null;
  }
  const sequence = Math.max(1, Number(globals.ManualTargetTraceSequence || 0) + 1);
  const intent = {
    sequence,
    actorUID: ownerUID,
    targetUID,
    slotIndex: Number.isFinite(slotIndex) ? slotIndex : -1,
    selectedAt: Number(now || 0),
  };
  globals.ManualTargetTraceSequence = sequence;
  globals.PendingActor = ownerUID;
  globals.SelectedEnemyUID = targetUID;
  globals.SelectedEnemyUIDOwner = ownerUID;
  globals.PendingManualTargetIntent = intent;
  return { ...intent };
}

export function validatePendingEnemyTargetIntent({
  globals,
  actorUID = 0,
  getActorByUID,
} = {}) {
  const reject = (reason, intent = null) => ({ ok: false, reason, intent, targetUID: 0 });
  if (!globals || typeof getActorByUID !== 'function') return reject('invalid_context');
  if (String(globals.PendingSkillID || '') !== 'HERO_SINGLE') return reject('not_single_target');
  const ownerUID = Number(actorUID || 0);
  const intent = globals.PendingManualTargetIntent;
  if (!intent || typeof intent !== 'object') return reject('missing_intent');
  if (!(ownerUID > 0) || Number(intent.actorUID || 0) !== ownerUID) return reject('actor_changed', intent);
  if (Number(globals.PendingActor || 0) !== ownerUID) return reject('pending_actor_changed', intent);
  if (Number(globals.SelectedEnemyUIDOwner || 0) !== ownerUID) return reject('selection_owner_changed', intent);
  const targetUID = Number(intent.targetUID || 0);
  if (!(targetUID > 0) || Number(globals.SelectedEnemyUID || 0) !== targetUID) return reject('selection_changed', intent);
  const target = getActorByUID(targetUID);
  if (!target || target.kind !== 'enemy' || Number(target.hp ?? 0) <= 0) return reject('target_unavailable', intent);
  const slotIndex = Number(intent.slotIndex);
  if (Number.isFinite(slotIndex) && slotIndex >= 0) {
    if (Number(target.slotIndex ?? -1) !== slotIndex) return reject('target_slot_changed', intent);
    const slotCell = Number(globals.EnemySlots?.[slotIndex] || 0);
    const slotUID = Number(globals.EnemyIDs?.[slotIndex] || 0);
    if (slotCell > 0 && slotCell !== targetUID + 1) return reject('enemy_slot_map_changed', intent);
    if (slotUID > 0 && slotUID !== targetUID) return reject('enemy_id_map_changed', intent);
  }
  return { ok: true, reason: 'ok', intent: { ...intent }, targetUID, target };
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
