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
  const heroes = next.filter(a => Number(a?.type || 0) === 0).sort((a, b) => Number(b?.init || 0) - Number(a?.init || 0));
  const enemies = next.filter(a => Number(a?.type || 0) === 1).sort((a, b) => Number(b?.init || 0) - Number(a?.init || 0));
  return String(startMode || '') === 'ambush'
    ? enemies.concat(heroes)
    : heroes.concat(enemies);
}
