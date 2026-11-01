// Party-anchored party movement and camera tunables (bd-ORKA-6i3).
// Defaults follow the StoneAge combat-movement study
// (output/stoneage-combat-movement-2026-10-19/SPEC.md §0). Values marked
// "loose" were not measured with confidence; they stay adjustable from the dev
// panel and are never written into save data.

export const COMBAT_MOVEMENT_TUNING_STORAGE_KEY = 'wishfire.dev.movementTuning.v1';

export const COMBAT_MOVEMENT_TUNING_FIELDS = Object.freeze([
  { key: 'partyAnchor', label: 'Party anchor (0 centroid, 1 first living slot)', min: 0, max: 1, step: 1, value: 1, confidence: 'high' },
  // StoneAge units each take their own nearest enemy (stacking only when that
  // is shared). Wishfire packs approach from one side, so any bias above zero
  // collapsed every hero onto one target in browser sampling.
  { key: 'partyTargetBias', label: 'Party-target bias (1 = all heroes share one target)', min: 0, max: 1, step: 0.05, value: 0, confidence: 'high' },
  { key: 'heroOverlap', label: 'Hero spacing (0 = free stacking, 1 = full separation)', min: 0, max: 1, step: 0.05, value: 0.25, confidence: 'high' },
  { key: 'combatLeash', label: 'Combat leash from party anchor (world units)', min: 60, max: 400, step: 4, value: 144, confidence: 'loose' },
  { key: 'travelSpacing', label: 'Travel slot spacing (x authored offsets)', min: 0.5, max: 4, step: 0.1, value: 1.5, confidence: 'loose' },
  { key: 'detectionRadius', label: 'Aggro detection radius (world units)', min: 120, max: 900, step: 10, value: 460, confidence: 'loose' },
  { key: 'cameraDeadZone', label: 'Camera dead zone (world units)', min: 0, max: 120, step: 2, value: 24, confidence: 'high' },
  { key: 'cameraSmoothing', label: 'Camera smoothing (seconds)', min: 0, max: 1, step: 0.05, value: 0.25, confidence: 'loose' },
  { key: 'skillFocus', label: 'Skill camera pull toward caster (0 off)', min: 0, max: 1, step: 0.05, value: 0.6, confidence: 'high' },
  { key: 'skillFocusHold', label: 'Skill camera hold (seconds)', min: 0.2, max: 3, step: 0.1, value: 1.2, confidence: 'loose' },
  { key: 'skillFocusCooldown', label: 'Skill camera cooldown (seconds)', min: 0, max: 15, step: 0.5, value: 6, confidence: 'loose' },
]);

// Pre-ORKA-6i3 behaviour: centroid anchor, one shared target, full hero
// spacing and the authored travel offsets. Kept selectable for comparison.
export const LEGACY_COMBAT_MOVEMENT_TUNING = Object.freeze({
  partyAnchor: 0, partyTargetBias: 1, heroOverlap: 1, combatLeash: 144, travelSpacing: 1,
  detectionRadius: 460, cameraDeadZone: 0, cameraSmoothing: 0, skillFocus: 0,
});

export function defaultCombatMovementTuning() {
  return Object.fromEntries(COMBAT_MOVEMENT_TUNING_FIELDS.map(field => [field.key, field.value]));
}

export function sanitizeCombatMovementTuning(input = null) {
  const base = defaultCombatMovementTuning();
  const raw = input && typeof input === 'object' ? input : {};
  const next = { ...base };
  for (const field of COMBAT_MOVEMENT_TUNING_FIELDS) {
    const value = Number(raw[field.key]);
    if (Number.isFinite(value)) next[field.key] = Math.max(field.min, Math.min(field.max, value));
  }
  next.partyAnchor = next.partyAnchor >= 0.5 ? 1 : 0;
  return next;
}

// Retired formation and named-leader fields are ignored, including old dev saves.
export function resolveCombatMovementTuning(globals = {}) {
  return sanitizeCombatMovementTuning(globals?.DevMovementTuning);
}

// Party order is the neutral anchor rule; KO actors cannot anchor the camera.
export function resolveCombatAnchor(heroes = []) {
  return heroes.find(hero => hero && Number(hero.hp || 0) > 0) || null;
}
