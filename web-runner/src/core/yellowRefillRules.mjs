export const YELLOW_COLOR = 3;
export const YELLOW_REFILL_TARGETS = [1, 2, 5];

function pickFromTargets(rng = Math.random) {
  const targets = YELLOW_REFILL_TARGETS;
  const idx = Math.floor(Math.max(0, Math.min(0.999999, Number(rng() || 0))) * targets.length);
  return targets[idx] ?? targets[0];
}

export function pickYellowReassignTarget(rng = Math.random) {
  return pickFromTargets(rng);
}

export function pickYellowRefillTarget(rng = Math.random) {
  return pickFromTargets(rng);
}
