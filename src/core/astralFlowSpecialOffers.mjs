const PARTY_SPECIALS = Object.freeze([
  Object.freeze({ cardId: 'af_magic_fruit', specialId: 'magic_fruit', name: 'Magic Fruit', description: 'Restore a shared healing pool equal to 30% of the caster\'s Max HP.' }),
  Object.freeze({ cardId: 'af_chain_strike_ii', specialId: 'chain_strike_ii', name: 'Chain Strike II', description: 'Strike twice through the enemy line.' }),
  Object.freeze({ cardId: 'af_faze', specialId: 'faze', name: 'Faze', description: 'Blight every living enemy.' }),
]);

const HERO_SIGNATURE_ALIASES = Object.freeze({ falie: 'fara', huun: 'hondo', kojonn: 'kaja' });

const SIGNATURES_BY_HERO = Object.freeze({
  fara: Object.freeze({ cardId: 'af_crimson_ward', specialId: 'crimson_ward', name: 'Crimson Ward', description: 'Shield every living hero.' }),
  hondo: Object.freeze({ cardId: 'af_split', specialId: 'split', name: 'Split', description: 'Strike every living enemy.' }),
  runa: Object.freeze({ cardId: 'af_arcane_pulse', specialId: 'arcane_pulse', name: 'Arcane Pulse', description: 'Release a focused arcane blast.' }),
  kaja: Object.freeze({ cardId: 'af_destiny', specialId: 'destiny', name: 'Destiny', description: 'Each living hero regenerates 8% Max HP on their next 3 turns.' }),
});

function normalizedRandom(rng) {
  const value = typeof rng === 'function' ? Number(rng()) : 0;
  return Number.isFinite(value) && value >= 0 && value < 1 ? value : 0;
}

function canonicalHeroName(hero = {}) {
  const key = String(hero.baseHeroName || hero.heroName || hero.name || hero.heroInstanceKey || '')
    .trim().toLowerCase()
    .split(/[-_\s]/)[0];
  return HERO_SIGNATURE_ALIASES[key] || key;
}

export function getAstralFlowSignature(hero = {}) {
  return SIGNATURES_BY_HERO[canonicalHeroName(hero)] || null;
}

export function buildAstralFlowSpecialOffer({ hero, rng, preferredSpecialId = '' } = {}) {
  const signature = getAstralFlowSignature(hero);
  if (!signature) return { status: 'offerUnavailable', cards: [] };
  const remaining = PARTY_SPECIALS.slice();
  const selected = [];
  const preferred = remaining.find(card => card.specialId === String(preferredSpecialId || ''));
  if (preferred) {
    selected.push(preferred);
    remaining.splice(remaining.indexOf(preferred), 1);
  }
  while (selected.length < 2 && remaining.length) {
    const index = Math.floor(normalizedRandom(rng) * remaining.length);
    selected.push(remaining.splice(index, 1)[0]);
  }
  return {
    status: selected.length === 2 ? 'offered' : 'offerUnavailable',
    source: 'flow_threshold',
    heroUID: Number(hero?.uid || 0),
    cards: [signature, ...selected].map((card, index) => Object.freeze({ ...card, index, source: 'astral_flow_special', lifetime: 'one_use_active' })),
  };
}

export const ASTRAL_FLOW_PARTY_SPECIALS = PARTY_SPECIALS;
export const ASTRAL_FLOW_SIGNATURES_BY_HERO = SIGNATURES_BY_HERO;
