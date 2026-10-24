import { HERO_DEFINITIONS } from './heroDefinitions.mjs';

export const STAR_MAX = 8;
export const STAR_COST_STEP = 50;
export const STAR_STAT_BONUS = 0.02;
export const GROWTH_STATS = Object.freeze(['HP', 'ATK', 'DEF', 'MAG', 'RES']);
export const STAR_EFFECTS = Object.freeze(Object.fromEntries(
  [
    ['special', { magnitudeBonus: 0.1, text: '+10% Special damage/healing' }],
    ['special', { cooldownMultiplier: 0.92, text: '-8% Special cooldown' }],
    ['passive', { magnitudeBonus: 0.15, text: '+15% Passive magnitude' }],
    ['passive', { magnitudeBonus: 0.15, text: '+15% Passive magnitude' }],
    ['resonance1', null], ['resonance1', null], ['resonance2', null], ['resonance2', null],
  ].map(([skillSlot, skillEffect], index) => [index + 1, Object.freeze({ [skillSlot]: Object.freeze({
    statBonus: STAR_STAT_BONUS, skillEffect: skillEffect && Object.freeze(skillEffect),
  }) })])
));
export const RESONANCE_SLOTS = 2;
const clampStars = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(STAR_MAX, Math.floor(Number(value)))) : 0;
const safeId = value => Object.hasOwn(HERO_DEFINITIONS, value) ? value : '';
export function starUpCost(stars) { return STAR_COST_STEP * (clampStars(stars) + 1); }
export function sanitizeHeroGrowth(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const stars = Object.fromEntries(Object.entries(raw.stars && typeof raw.stars === 'object' ? raw.stars : {})
    .map(([id, count]) => [safeId(id), clampStars(count)]).filter(([id, count]) => id && count > 0));
  return Object.keys(stars).length ? { stars } : null;
}
export function canonicalGrowthId(key) {
  const base = String(key || '').replace(/#1$/, '');
  return Object.keys(HERO_DEFINITIONS).find(id => id.toLowerCase() === base.toLowerCase()) || '';
}
export function heroStars(growth, heroId) { return clampStars(growth?.stars?.[canonicalGrowthId(heroId)]); }
export function heroStarSkillMultipliers(growth, heroId) {
  const stars = heroStars(growth, heroId);
  let specialBonus = 0, passiveBonus = 0, specialCooldown = 1;
  for (const [index, slots] of Object.entries(STAR_EFFECTS)) {
    if (Number(index) > stars) continue;
    specialBonus += slots.special?.skillEffect?.magnitudeBonus || 0;
    passiveBonus += slots.passive?.skillEffect?.magnitudeBonus || 0;
    specialCooldown *= slots.special?.skillEffect?.cooldownMultiplier ?? 1;
  }
  return { specialMagnitude: 1 + specialBonus, specialCooldown, passiveMagnitude: 1 + passiveBonus };
}
export function heroGrowthBreakdown(growth, heroId) {
  const stars = heroStars(growth, heroId);
  const own = Object.entries(STAR_EFFECTS).reduce((sum, [index, slots]) => sum + (Number(index) <= stars ? Object.values(slots).reduce((bonus,effect)=>bonus+effect.statBonus,0) : 0), 0);
  return { stars, own: Math.round(own * 10000) / 10000 };
}
export function heroGrowthModifiers(growth, heroId) {
  const { own } = heroGrowthBreakdown(growth, heroId);
  return own > 0 ? GROWTH_STATS.map(channel => ({ channel, direction: 'up', magnitude: own })) : [];
}
function growthOf(state) { return sanitizeHeroGrowth(state.growth) || { stars: {} }; }
function withGrowth(state, growth) {
  const next = { ...state }, clean = sanitizeHeroGrowth(growth);
  if (clean) next.growth = clean; else delete next.growth;
  return next;
}

// Spends the hero's own tickets from the combat progression wallet. `state` must already be sanitized.
export function starUpHero(state, heroId) {
  const id = safeId(heroId);
  if (!HERO_DEFINITIONS[id]) return { state, ok: false, reason: 'hero_unavailable' };
  const growth = growthOf(state);
  const stars = clampStars(growth.stars[id]);
  if (stars >= STAR_MAX) return { state, ok: false, reason: 'max_stars' };
  const cost = starUpCost(stars);
  const balance = state.wallet?.ticketsByHero?.[id] || 0;
  if (balance < cost) return { state, ok: false, reason: 'insufficient_tickets', cost };
  growth.stars[id] = stars + 1;
  const next = withGrowth({ ...state, wallet: { ...state.wallet, ticketsByHero: { ...state.wallet.ticketsByHero, [id]: balance - cost } } }, growth);
  return { state: next, ok: true, cost, stars: stars + 1 };
}

export function setHeroResonance(state, hostId, slot, linkedId = '') {
  return { state, ok: false, reason: 'unavailable' };

}
