export function compareSchedulerSlots(a = {}, b = {}) {
  return (Number(b.spd || 0) - Number(a.spd || 0))
    || (Number(a.type || 0) - Number(b.type || 0))
    || (Number(a.uid || 0) - Number(b.uid || 0));
}

export function createBattleStartResetState() {
  return {
    remaining: {},
    resolved: 1,
    mode: '',
  };
}

export function buildFixedCycleSlots(roster = [], currentUID = 0, selectionPool = null) {
  const cycle = roster.map(r => ({
    uid: Number(r?.uid || 0),
    type: Number(r?.type || 0),
    spd: Number(r?.spd || 0),
    extra: !!r?.extra,
  }));
  const startPool = Array.isArray(selectionPool) && selectionPool.length && selectionPool.length < cycle.length
    ? new Set(selectionPool.map(r => Number(r?.uid || 0)))
    : null;
  cycle.sort((a, b) => {
    const rankA = startPool ? (startPool.has(a.uid) ? 0 : 1) : 0;
    const rankB = startPool ? (startPool.has(b.uid) ? 0 : 1) : 0;
    return rankA - rankB || compareSchedulerSlots(a, b);
  });
  const anchorUID = Number(currentUID || 0);
  if (!anchorUID) return cycle;
  const idx = cycle.findIndex(slot => Number(slot.uid || 0) === anchorUID);
  return idx > 0 ? cycle.slice(idx).concat(cycle.slice(0, idx)) : cycle;
}

export function nextTeamPhaseType(currentType = 0) {
  return Number(currentType || 0) === 0 ? 1 : 0;
}

export function isAbleToActSlot(actor = {}) {
  if (!actor || typeof actor !== 'object') return false;
  if (Number(actor.hp ?? actor.HP ?? 1) <= 0) return false;
  if (actor.isAlive === false) return false;
  if (actor.ableToAct === false) return false;
  if (actor.disabled || actor.stunned || actor.stopped || actor.paralyzed) return false;
  const statusValues = [
    actor.status,
    actor.state,
    ...(Array.isArray(actor.statuses) ? actor.statuses : []),
    ...(Array.isArray(actor.statusEffects) ? actor.statusEffects : []),
  ].map(value => String(value || '').toLowerCase());
  return !statusValues.some(value => (
    value === 'dead'
    || value === 'disabled'
    || value === 'stopped'
    || value === 'paralyzed'
    || value === 'stunned'
  ));
}

export function buildTeamPhaseSlots(roster = [], teamType = 0) {
  return (Array.isArray(roster) ? roster : [])
    .filter(actor => Number(actor?.type || 0) === Number(teamType || 0))
    .filter(isAbleToActSlot)
    .map(actor => ({
      uid: Number(actor?.uid || 0),
      type: Number(actor?.type || 0),
      spd: Number(actor?.spd || actor?.SPD || actor?.stats?.SPD || 0),
      extra: !!actor?.extra,
    }))
    .filter(actor => actor.uid > 0)
    .sort(compareSchedulerSlots);
}

export function deriveBattleStartRemaining({
  remaining = {},
  roster = [],
  teamType = 0,
  allowCurrentTurnReseed = false,
  currentUID = 0,
} = {}) {
  const nextRemaining = { ...(remaining || {}) };
  if (Object.keys(nextRemaining).length === 0) {
    for (const r of roster) {
      if (Number(r?.type || 0) === Number(teamType || 0)) nextRemaining[Number(r?.uid || 0)] = true;
    }
  } else if (allowCurrentTurnReseed && !Number(currentUID || 0)) {
    for (const r of roster) {
      const uid = Number(r?.uid || 0);
      if (Number(r?.type || 0) === Number(teamType || 0) && !nextRemaining[uid]) nextRemaining[uid] = true;
    }
  }
  const rosterByUID = new Map(roster.map(r => [Number(r?.uid || 0), Number(r?.type || 0)]));
  for (const uid of Object.keys(nextRemaining)) {
    const num = Number(uid || 0);
    if (!rosterByUID.has(num) || Number(rosterByUID.get(num) || 0) !== Number(teamType || 0)) {
      delete nextRemaining[uid];
    }
  }
  return {
    remaining: nextRemaining,
    exhausted: Object.keys(nextRemaining).length === 0,
  };
}

export function deriveBattleStartConsume(remaining = {}, uid = 0) {
  const nextRemaining = { ...(remaining || {}) };
  const key = String(Number(uid || 0));
  const consumed = !!nextRemaining[key];
  if (consumed) delete nextRemaining[key];
  return {
    consumed,
    remaining: nextRemaining,
    exhausted: Object.keys(nextRemaining).length === 0,
  };
}

export function deriveBattleStartRoundPartition(withInit = [], startMode = '') {
  const next = Array.isArray(withInit) ? withInit.map(actor => ({ ...actor })) : [];
  const sortByBattleStartInit = (a, b) => (Number(b?.init || 0) - Number(a?.init || 0))
    || compareSchedulerSlots(a, b);
  const ordered = next.sort(sortByBattleStartInit);
  const priorityType = String(startMode || '') === 'ambush' ? 1 : 0;
  const priorityIndex = ordered.findIndex(actor => Number(actor?.type || 0) === priorityType);
  if (priorityIndex <= 0) return ordered;
  const [priorityActor] = ordered.splice(priorityIndex, 1);
  ordered.unshift(priorityActor);
  return ordered;
}
