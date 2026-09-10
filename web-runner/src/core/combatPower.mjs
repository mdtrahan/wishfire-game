// Deterministic gate metric used for progression/access comparisons.
export function computeCombatPower(atk, def, hp) {
  const a = Number(atk || 0);
  const d = Number(def || 0);
  const h = Number(hp || 0);
  return Math.round((a + d + (h / 10)) * 100) / 100;
}
