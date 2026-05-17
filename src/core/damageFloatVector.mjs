export const DAMAGE_FLOAT_CENTER_ANGLE_DEG = 0;
export const DAMAGE_FLOAT_MAX_ANGLE_DEG = 30;
export const DAMAGE_FLOAT_CENTER_DEADZONE_FRACTION = 0.15;
export const DAMAGE_FLOAT_SEQUENCE_STRIDE = 0.6180339887498949;
export const DAMAGE_FLOAT_DEFAULT_TRAVEL = 28;
export const DAMAGE_FLOAT_ENERGY_TRAVEL = 32.2;

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanNumber(value) {
  return Object.is(value, -0) ? 0 : value;
}

function wrapUnit(value) {
  return value - Math.floor(value);
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, finiteNumber(value, 0)));
}

export function normalizeDamageFloatAngleDeg(
  angleDeg = DAMAGE_FLOAT_CENTER_ANGLE_DEG,
  maxAbsAngleDeg = DAMAGE_FLOAT_MAX_ANGLE_DEG,
) {
  const maxAbs = Math.max(0, finiteNumber(maxAbsAngleDeg, DAMAGE_FLOAT_MAX_ANGLE_DEG));
  const angle = finiteNumber(angleDeg, DAMAGE_FLOAT_CENTER_ANGLE_DEG);
  return Math.max(-maxAbs, Math.min(maxAbs, angle));
}

export function pickDamageFloatAngleDeg({
  random = Math.random,
  maxAbsAngleDeg = DAMAGE_FLOAT_MAX_ANGLE_DEG,
  centerDeadzoneFraction = DAMAGE_FLOAT_CENTER_DEADZONE_FRACTION,
  sequence = 0,
} = {}) {
  const maxAbs = Math.max(0, finiteNumber(maxAbsAngleDeg, DAMAGE_FLOAT_MAX_ANGLE_DEG));
  if (maxAbs === 0) return DAMAGE_FLOAT_CENTER_ANGLE_DEG;
  const raw = typeof random === 'function' ? finiteNumber(random(), 0.5) : 0.5;
  const rawUnit = raw >= 0 && raw < 1 ? raw : 0.5;
  const seq = Math.max(0, finiteNumber(sequence, 0));
  const unit = seq > 0
    ? wrapUnit(rawUnit + (seq * DAMAGE_FLOAT_SEQUENCE_STRIDE))
    : rawUnit;
  const deadzone = clamp01(centerDeadzoneFraction);
  const minAbs = maxAbs * deadzone;
  const side = unit < 0.5 ? -1 : 1;
  const sideUnit = unit < 0.5 ? 1 - (unit * 2) : (unit - 0.5) * 2;
  const magnitude = minAbs + (sideUnit * (maxAbs - minAbs));
  return normalizeDamageFloatAngleDeg(side * magnitude, maxAbs);
}

export function deriveDamageFloatVector({
  angleDeg = DAMAGE_FLOAT_CENTER_ANGLE_DEG,
  travel = DAMAGE_FLOAT_DEFAULT_TRAVEL,
  maxAbsAngleDeg = DAMAGE_FLOAT_MAX_ANGLE_DEG,
} = {}) {
  const normalizedAngleDeg = normalizeDamageFloatAngleDeg(angleDeg, maxAbsAngleDeg);
  const distance = Math.max(0, finiteNumber(travel, DAMAGE_FLOAT_DEFAULT_TRAVEL));
  const radians = normalizedAngleDeg * (Math.PI / 180);
  const x = cleanNumber(Math.sin(radians) * distance);
  const y = cleanNumber(-Math.cos(radians) * distance);
  return {
    angleDeg: normalizedAngleDeg,
    x,
    y: y > 0 ? -Math.abs(y) : y,
    travel: distance,
  };
}

export function deriveDamageFloatFrameOffset(floatText = {}, progress = 1) {
  const fallback = deriveDamageFloatVector({
    angleDeg: finiteNumber(floatText.floatAngleDeg, DAMAGE_FLOAT_CENTER_ANGLE_DEG),
    travel: finiteNumber(floatText.floatTravel, DAMAGE_FLOAT_DEFAULT_TRAVEL),
    maxAbsAngleDeg: finiteNumber(floatText.floatMaxAngleDeg, DAMAGE_FLOAT_MAX_ANGLE_DEG),
  });
  const x = Number.isFinite(Number(floatText.floatVectorX))
    ? Number(floatText.floatVectorX)
    : fallback.x;
  const y = Number.isFinite(Number(floatText.floatVectorY))
    ? Number(floatText.floatVectorY)
    : fallback.y;
  const p = clamp01(progress);
  return {
    x: cleanNumber(x * p),
    y: cleanNumber(y * p),
    progress: p,
  };
}

export function isDamageFloatVectorUpward(vector) {
  const y = Number(vector && vector.y);
  return Number.isFinite(y) && y <= 0;
}
