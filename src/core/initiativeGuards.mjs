export function shouldAutoCorrectImproperRepeat({
  timeMode = false,
  beforeUID = 0,
  afterSlot = null,
  queue = [],
} = {}) {
  if (!timeMode) return false;
  const before = Number(beforeUID || 0);
  const after = Number(afterSlot?.uid || 0);
  if (before <= 0 || after <= 0) return false;
  if (before !== after) return false;
  if (!Array.isArray(queue) || queue.length <= 1) return false;
  const distinct = new Set(
    queue
      .map(slot => Number(slot?.uid || 0))
      .filter(uid => uid > 0),
  );
  if (distinct.size <= 1) return false;
  return true;
}

export function sanitizeInitiativeQueue(queue = [], { allowExtraRepeats = false } = {}) {
  if (!Array.isArray(queue) || queue.length <= 1) return Array.isArray(queue) ? queue.slice() : [];
  const seenBase = new Set();
  const seenExtra = new Set();
  const out = [];
  for (const slot of queue) {
    const uid = Number(slot?.uid || 0);
    if (uid <= 0) continue;
    const extra = !!slot?.extra;
    if (extra) {
      if (!allowExtraRepeats) continue;
      if (seenExtra.has(uid)) continue;
      seenExtra.add(uid);
      out.push({ ...slot, uid, extra: true });
      continue;
    }
    if (seenBase.has(uid)) continue;
    seenBase.add(uid);
    out.push({ ...slot, uid, extra: false });
  }
  return out;
}
