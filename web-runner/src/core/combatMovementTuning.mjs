// Leader-anchored party movement and camera tunables (bd-ORKA-6i3).
// Defaults follow the StoneAge combat-movement study
// (output/stoneage-combat-movement-2026-10-19/SPEC.md §0). Values marked
// "loose" were not measured with confidence; they stay adjustable from the dev
// panel and are never written into save data.

export const COMBAT_MOVEMENT_TUNING_STORAGE_KEY = 'wishfire.dev.movementTuning.v1';
export const COMBAT_LEADER_NAMES = Object.freeze(['Fara', 'Hondo', 'Runa', 'Kaja']);

export const COMBAT_MOVEMENT_TUNING_FIELDS = Object.freeze([
  { key: 'leaderAnchor', label: 'Leader anchor (0 centroid, 1 leader)', min: 0, max: 1, step: 1, value: 1, confidence: 'high' },
  // StoneAge units each take their own nearest enemy (stacking only when that
  // is shared). Wishfire packs approach from one side, so any bias above zero
  // collapsed every hero onto one target in browser sampling.
  { key: 'leaderTargetBias', label: 'Leader-target bias (1 = all heroes share one target)', min: 0, max: 1, step: 0.05, value: 0, confidence: 'high' },
  { key: 'heroOverlap', label: 'Hero spacing (0 = free stacking, 1 = full separation)', min: 0, max: 1, step: 0.05, value: 0.25, confidence: 'high' },
  { key: 'combatLeash', label: 'Combat leash from leader (world units)', min: 60, max: 400, step: 4, value: 144, confidence: 'loose' },
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
  leaderAnchor: 0, leaderTargetBias: 1, heroOverlap: 1, combatLeash: 144, travelSpacing: 1,
  detectionRadius: 460, cameraDeadZone: 0, cameraSmoothing: 0, skillFocus: 0,
});

export function defaultCombatMovementTuning() {
  return Object.fromEntries([
    ...COMBAT_MOVEMENT_TUNING_FIELDS.map(field => [field.key, field.value]),
    ['leaderName', COMBAT_LEADER_NAMES[0]],
    // The dev leader only applies when explicitly enabled; otherwise Formation decides.
    ['leaderOverride', false],
  ]);
}

export function sanitizeCombatMovementTuning(input = null) {
  const base = defaultCombatMovementTuning();
  const raw = input && typeof input === 'object' ? input : {};
  const next = { ...base };
  for (const field of COMBAT_MOVEMENT_TUNING_FIELDS) {
    const value = Number(raw[field.key]);
    if (Number.isFinite(value)) next[field.key] = Math.max(field.min, Math.min(field.max, value));
  }
  next.leaderAnchor = next.leaderAnchor >= 0.5 ? 1 : 0;
  const leaderName = String(raw.leaderName || '').trim();
  next.leaderName = COMBAT_LEADER_NAMES.find(name => name.toLowerCase() === leaderName.toLowerCase()) || base.leaderName;
  next.leaderOverride = raw.leaderOverride === true;
  return next;
}

// The player's Formation leader applies unless the dev tuning enables `leaderOverride`.
// Dev tunings saved before the flag existed always carried a leader name, so they do not override.
// `succession` follows the Formation board for KO hand-off.
export function resolveCombatMovementTuning(globals = {}) {
  const dev = globals?.DevMovementTuning;
  const tuning = sanitizeCombatMovementTuning(dev?.leaderOverride === true ? dev : { ...(dev || {}), leaderName: globals?.HeroFormationLeader });
  const succession = Array.isArray(globals?.HeroFormationOrder) ? globals.HeroFormationOrder.filter(name => COMBAT_LEADER_NAMES.includes(name)) : [];
  return succession.length ? { ...tuning, succession } : tuning;
}

const heroKey = hero => String(hero?.baseHeroName || hero?.name || '').trim().toLowerCase();
const LEADER_ALIASES = Object.freeze({ fara: ['fara', 'falie'], hondo: ['hondo', 'huun'], runa: ['runa'], kaja: ['kaja', 'kojonn'] });

// The chosen leader leads while living. Otherwise the first living hero in the
// Formation succession, then party order, takes over, so the anchor never points at a KO actor.
export function resolveCombatLeader(heroes = [], leaderName = COMBAT_LEADER_NAMES[0], succession = []) {
  const living = (heroes || []).filter(hero => hero && Number(hero.hp || 0) > 0);
  const byName = name => {
    const aliases = LEADER_ALIASES[String(name || '').toLowerCase()] || [String(name || '').toLowerCase()];
    return living.find(hero => aliases.includes(heroKey(hero)));
  };
  for (const name of [leaderName, ...(succession || [])]) { const hero = byName(name); if (hero) return hero; }
  return living[0] || null;
}
