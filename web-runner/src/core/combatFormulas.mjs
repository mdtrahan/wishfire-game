// Mirrors wf_combat::formulas for CP and previews; Rust resolves live combat.
export function mitigationMultiplier(defense) {
  return 100 / (100 + Math.max(0, defense));
}

// Positive rate inputs can also encode slowdown as Haste between -100 and 0.
export function cooldownSeconds(base, haste = 0) {
  return base * 100 / (100 + haste);
}
