// Mirrors wf_combat::formulas for CP and previews; Rust resolves live combat.
export function mitigationMultiplier(defense) {
  return 100 / (100 + Math.max(0, defense));
}
