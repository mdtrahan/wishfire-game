export function normalizePartyFormationSlots(slots = [], size = 4) {
  return Array.from({ length: size }, (_, idx) => String(slots?.[idx] || '').trim());
}

export function assignHeroToPartySlot(slots = [], heroName = '', slotIndex = 0) {
  const normalized = normalizePartyFormationSlots(slots);
  const safeHeroName = String(heroName || '').trim();
  const safeSlotIndex = Math.max(0, Math.min(normalized.length - 1, Math.floor(Number(slotIndex || 0))));
  if (!safeHeroName) return normalized;
  const existingIdx = normalized.findIndex((name, idx) => idx !== safeSlotIndex && name === safeHeroName);
  if (existingIdx >= 0) {
    const prevAtTarget = normalized[safeSlotIndex];
    normalized[safeSlotIndex] = safeHeroName;
    normalized[existingIdx] = prevAtTarget;
    return normalized;
  }
  normalized[safeSlotIndex] = safeHeroName;
  return normalized;
}
