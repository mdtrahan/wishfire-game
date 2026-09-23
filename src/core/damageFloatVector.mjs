export const DAMAGE_FLOAT_DEFAULT_TRAVEL = 28;
export const DAMAGE_FLOAT_ENERGY_TRAVEL = 32.2;

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp01 = value => Math.max(0, Math.min(1, finite(value, 0)));

export function deriveDamageFloatVector({ travel = DAMAGE_FLOAT_DEFAULT_TRAVEL } = {}) {
  const distance = Math.max(0, finite(travel, DAMAGE_FLOAT_DEFAULT_TRAVEL));
  return { angleDeg: 0, x: 0, y: -distance, travel: distance };
}

export function deriveDamageFloatFrameOffset(floatText = {}, progress = 1) {
  const travel = Math.max(0, finite(floatText.floatTravel, DAMAGE_FLOAT_DEFAULT_TRAVEL));
  const y = finite(floatText.floatVectorY, -travel);
  const p = clamp01(progress);
  return { x: 0, y: p === 0 ? 0 : Math.min(0, y) * p, progress: p };
}

export function isDamageFloatVectorUpward(vector) {
  const y = Number(vector && vector.y);
  return Number.isFinite(y) && y <= 0;
}
