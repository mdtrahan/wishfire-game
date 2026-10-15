export function resolveCurrentHeroUID({ directUID, turnOrder, currentTurnIndex } = {}) {
  const uid = Number(directUID || 0);
  if (uid > 0) return uid;
  if (!Array.isArray(turnOrder)) return 0;
  const idx = Number(currentTurnIndex || 0);
  const slot = turnOrder[idx];
  const candidate = Number(slot?.uid || 0);
  return candidate > 0 ? candidate : 0;
}
