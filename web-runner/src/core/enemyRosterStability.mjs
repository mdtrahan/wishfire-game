function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function enemyUidFromSlotCell(cell) {
  const raw = Number(cell || 0);
  return raw > 0 ? raw - 1 : 0;
}

function isLiveEnemy(entity) {
  if (!entity || entity.kind !== 'enemy') return false;
  if (
    Number(entity.pendingOfficialDeath || 0) > 0 ||
    Number(entity.deathVisualHold || 0) > 0 ||
    String(entity.deathState || '') === 'pending_attack' ||
    String(entity.deathState || '') === 'payout'
  ) {
    return true;
  }
  if (entity.isAlive === false) return false;
  return Number(entity.hp ?? 1) > 0;
}

export function getEnemyRosterStability({
  enemySlots = [],
  enemyIds = [],
  pendingRespawnSlots = [],
  pendingRespawnTimerActive = 0,
  entities = [],
} = {}) {
  const slots = normalizeArray(enemySlots);
  const ids = normalizeArray(enemyIds);
  const pendingSlots = normalizeArray(pendingRespawnSlots);
  const maxSlots = Math.max(slots.length, ids.length, pendingSlots.length);
  const entityByUID = new Map();
  for (const entity of normalizeArray(entities)) {
    const uid = Number(entity?.uid || 0);
    if (uid > 0 && entity?.kind === 'enemy') entityByUID.set(uid, entity);
  }

  const required = new Set();
  for (let slotIndex = 0; slotIndex < maxSlots; slotIndex += 1) {
    if (enemyUidFromSlotCell(slots[slotIndex]) > 0) required.add(slotIndex);
    if (Number(ids[slotIndex] || 0) > 0) required.add(slotIndex);
    if (Number(pendingSlots[slotIndex] || 0) > 0) required.add(slotIndex);
  }

  const requiredSlots = Array.from(required).sort((a, b) => a - b);
  const missingSlots = [];
  const deadSlots = [];
  const mismatchedSlots = [];
  const duplicateUIDs = [];
  const liveSlotUIDs = [];
  const seenUIDs = new Set();
  const duplicateSet = new Set();

  for (const slotIndex of requiredSlots) {
    const slotUID = enemyUidFromSlotCell(slots[slotIndex]);
    const idUID = Number(ids[slotIndex] || 0);
    const uid = slotUID || idUID;
    if (!(slotUID > 0) || !(idUID > 0)) {
      missingSlots.push(slotIndex);
      continue;
    }
    if (slotUID !== idUID) {
      mismatchedSlots.push(slotIndex);
      continue;
    }
    if (seenUIDs.has(uid)) duplicateSet.add(uid);
    seenUIDs.add(uid);
    const entity = entityByUID.get(uid);
    if (!isLiveEnemy(entity)) {
      deadSlots.push(slotIndex);
      continue;
    }
    if (Number(entity.slotIndex ?? slotIndex) !== slotIndex) {
      mismatchedSlots.push(slotIndex);
      continue;
    }
    liveSlotUIDs.push(uid);
  }

  duplicateUIDs.push(...Array.from(duplicateSet).sort((a, b) => a - b));
  const pending = Number(pendingRespawnTimerActive || 0) > 0 || pendingSlots.some((flag) => Number(flag || 0) > 0);
  const stable =
    !pending &&
    missingSlots.length === 0 &&
    deadSlots.length === 0 &&
    mismatchedSlots.length === 0 &&
    duplicateUIDs.length === 0;

  return {
    stable,
    pending,
    requiredSlots,
    missingSlots,
    deadSlots,
    mismatchedSlots,
    duplicateUIDs,
    liveSlotUIDs,
  };
}
