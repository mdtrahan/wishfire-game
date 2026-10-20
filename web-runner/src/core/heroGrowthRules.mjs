// Star Up and Resonance rules (ORKA-9ee phases 3-4, goals/wishfire-hero-party-screen-plan.md).
// Pure and deterministic. Saved inside the combat progression record under `growth`,
// which is omitted while empty so untouched saves stay byte-identical.

export const STAR_MAX = 15;
export const STAR_TIER_SIZE = 5;
export const STAR_COST_STEP = 50;
// Each own star adds 2% HP/ATK/DEF/MATK/RES to that hero.
export const STAR_STAT_BONUS = 0.02;
// Each completed tier (5, 10, 15 stars) on any hero adds 1% to the whole party.
export const STAR_TIER_PARTY_BONUS = 0.01;
export const GROWTH_STATS = Object.freeze(['HP', 'ATK', 'DEF', 'MAG', 'RES']);
// Slot 1 is open from the start; slot 2 opens when the host completes the bronze tier.
export const RESONANCE_SLOT_STARS = Object.freeze([0, 5]);
export const RESONANCE_BASE_BONUS = 0.05;
export const RESONANCE_STAR_BONUS = 0.005;
// A resonating hero lends a passive echo of its signature stat.
export const RESONANCE_ECHOES = Object.freeze({
  Falie: Object.freeze({ stat: 'DEF', label: 'Guard' }),
  Huun: Object.freeze({ stat: 'ATK', label: 'Might' }),
  Runa: Object.freeze({ stat: 'MAG', label: 'Insight' }),
  Kojonn: Object.freeze({ stat: 'HP', label: 'Grace' }),
});

const safeId = value => typeof value === 'string' && value.length <= 180 && !['__proto__', 'constructor', 'prototype'].includes(value) ? value : '';
const clampStars = value => Math.max(0, Math.min(STAR_MAX, Math.floor(Number(value) || 0)));

export function starUpCost(stars) { return STAR_COST_STEP * (clampStars(stars) + 1); }

export function sanitizeHeroGrowth(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const stars = Object.fromEntries(Object.entries(raw.stars || {}).map(([id, count]) => [safeId(id), clampStars(count)]).filter(([id, count]) => id && count > 0));
  const resonance = Object.fromEntries(Object.entries(raw.resonance || {}).map(([id, slots]) => {
    const host = safeId(id);
    const linked = (Array.isArray(slots) ? slots : []).slice(0, RESONANCE_SLOT_STARS.length).map(value => RESONANCE_ECHOES[safeId(value)] && value !== host ? value : '');
    while (linked.length < RESONANCE_SLOT_STARS.length) linked.push('');
    if (linked[0] && linked[0] === linked[1]) linked[1] = '';
    return [host, linked];
  }).filter(([id, slots]) => id && slots.some(Boolean)));
  return Object.keys(stars).length || Object.keys(resonance).length ? { stars, resonance } : null;
}

// Combat actors use the canonical key or its first deployed copy (`falie#1`), matching gear ownership.
export function canonicalGrowthId(key) {
  const text = String(key || '');
  const match = /^(.+)#1$/.exec(text);
  const base = match ? match[1] : text.includes('#') ? '' : text;
  return Object.keys(RESONANCE_ECHOES).find(id => id.toLowerCase() === base.toLowerCase()) || base;
}

export function heroStars(growth, heroId) { return clampStars(growth?.stars?.[canonicalGrowthId(heroId)]); }

export function resonanceSlots(growth, heroId) {
  const slots = growth?.resonance?.[canonicalGrowthId(heroId)] || [];
  return RESONANCE_SLOT_STARS.map((_, index) => slots[index] || '');
}

export function resonanceSlotUnlocked(growth, heroId, slot) { return heroStars(growth, heroId) >= (RESONANCE_SLOT_STARS[slot] ?? Infinity); }

export function resonanceEcho(growth, linkedId) {
  const echo = RESONANCE_ECHOES[linkedId];
  return echo ? { ...echo, from: linkedId, magnitude: Math.round((RESONANCE_BASE_BONUS + RESONANCE_STAR_BONUS * heroStars(growth, linkedId)) * 10000) / 10000 } : null;
}

export function partyStarBonus(growth) {
  return Object.values(growth?.stars || {}).reduce((sum, count) => sum + Math.floor(clampStars(count) / STAR_TIER_SIZE), 0) * STAR_TIER_PARTY_BONUS;
}

export function heroGrowthBreakdown(growth, heroId) {
  const id = canonicalGrowthId(heroId);
  const stars = heroStars(growth, id);
  const echoes = resonanceSlots(growth, id).map((linked, slot) => resonanceSlotUnlocked(growth, id, slot) ? resonanceEcho(growth, linked) : null).filter(Boolean);
  return { stars, own: stars * STAR_STAT_BONUS, party: partyStarBonus(growth), echoes };
}

export function heroGrowthModifiers(growth, heroId) {
  if (!growth || !RESONANCE_ECHOES[canonicalGrowthId(heroId)]) return [];
  const { own, party, echoes } = heroGrowthBreakdown(growth, heroId);
  const totals = Object.fromEntries(GROWTH_STATS.map(stat => [stat, own + party]));
  for (const echo of echoes) totals[echo.stat] += echo.magnitude;
  return GROWTH_STATS.filter(stat => totals[stat] > 0).map(stat => ({ channel: stat, direction: 'up', magnitude: Math.round(totals[stat] * 10000) / 10000 }));
}

function growthOf(state) { return sanitizeHeroGrowth(state.growth) || { stars: {}, resonance: {} }; }
function withGrowth(state, growth) {
  const next = { ...state };
  const clean = sanitizeHeroGrowth(growth);
  if (clean) next.growth = clean; else delete next.growth;
  return next;
}

// Spends the hero's own tickets from the combat progression wallet. `state` must already be sanitized.
export function starUpHero(state, heroId) {
  const id = safeId(heroId);
  if (!RESONANCE_ECHOES[id]) return { state, ok: false, reason: 'hero_unavailable' };
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
  const host = safeId(hostId), linked = safeId(linkedId), index = Math.floor(Number(slot));
  if (!RESONANCE_ECHOES[host]) return { state, ok: false, reason: 'hero_unavailable' };
  if (!(index >= 0 && index < RESONANCE_SLOT_STARS.length)) return { state, ok: false, reason: 'invalid_slot' };
  const growth = growthOf(state);
  if (!resonanceSlotUnlocked(growth, host, index)) return { state, ok: false, reason: 'slot_locked', stars: RESONANCE_SLOT_STARS[index] };
  if (linked && (!RESONANCE_ECHOES[linked] || linked === host)) return { state, ok: false, reason: 'invalid_link' };
  const slots = resonanceSlots(growth, host);
  if (linked && slots.some((value, other) => other !== index && value === linked)) slots[slots.indexOf(linked)] = '';
  slots[index] = linked;
  growth.resonance[host] = slots;
  return { state: withGrowth(state, growth), ok: true };
}
