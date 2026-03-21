export function resolveCurrentHeroUID({ directUID, turnOrder, currentTurnIndex } = {}) {
  const uid = Number(directUID || 0);
  if (uid > 0) return uid;
  if (!Array.isArray(turnOrder)) return 0;
  const idx = Number(currentTurnIndex || 0);
  const slot = turnOrder[idx];
  const candidate = Number(slot?.uid || 0);
  return candidate > 0 ? candidate : 0;
}

export function shouldRenderHeroTurnSelector({
  turnPhase = 0,
  hideHeroSelector = 0,
  canPickGems = 0,
  currentHeroUID = 0,
  heroUID = 0,
} = {}) {
  if (Number(hideHeroSelector || 0) !== 0) return false;
  if (Number(canPickGems || 0) === 0) return false;
  if (Number(turnPhase || 0) !== 0) return false;
  const current = Number(currentHeroUID || 0);
  const hero = Number(heroUID || 0);
  return current > 0 && hero > 0 && current === hero;
}
