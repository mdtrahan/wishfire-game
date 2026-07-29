export const COMBAT_ORIENTATION_LEFT_WISE = 'left-wise';
export const COMBAT_ORIENTATION_RIGHT_WISE = 'right-wise';

export function normalizeCombatOrientation(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === COMBAT_ORIENTATION_RIGHT_WISE
    ? COMBAT_ORIENTATION_RIGHT_WISE
    : COMBAT_ORIENTATION_LEFT_WISE;
}

export function readCombatOrientationFromSearch(search = '') {
  const params = new URLSearchParams(String(search ?? ''));
  return normalizeCombatOrientation(params.get('combat_orientation'));
}

export function orientCombatWorldX(x, layoutW, orientation) {
  const worldX = Number(x);
  const worldWidth = Number(layoutW);
  if (!Number.isFinite(worldX) || !Number.isFinite(worldWidth)) return worldX;
  return normalizeCombatOrientation(orientation) === COMBAT_ORIENTATION_RIGHT_WISE
    ? worldWidth - worldX
    : worldX;
}

export function orientCombatWorldOffsetX(offsetX, orientation) {
  const offset = Number(offsetX);
  if (!Number.isFinite(offset)) return offset;
  return normalizeCombatOrientation(orientation) === COMBAT_ORIENTATION_RIGHT_WISE
    ? -offset
    : offset;
}

export function createCombatOrientationGeometry({ orientation, layoutW, actors = [] } = {}) {
  const normalizedOrientation = normalizeCombatOrientation(orientation);
  const worldWidth = Number(layoutW);
  return {
    orientation: normalizedOrientation,
    axis: Number.isFinite(worldWidth) ? worldWidth / 2 : null,
    layoutW: Number.isFinite(worldWidth) ? worldWidth : null,
    actors: actors.map((actor) => {
      const canonicalX = Number(actor?.canonicalX ?? actor?.x);
      return {
        ...actor,
        canonicalX,
        x: orientCombatWorldX(canonicalX, worldWidth, normalizedOrientation),
      };
    }),
  };
}
