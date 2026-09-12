const HERO_NAMES = Object.freeze(['Fara', 'Hondo', 'Runa', 'Kaja']);
const RARITIES = Object.freeze(['Common', 'Rare', 'Epic', 'Legendary']);

export const HERO_TURN_CARD_CONFIG = Object.freeze({
  rarityWeights: Object.freeze({ Common: 60, Rare: 27, Epic: 10, Legendary: 3 }),
  rareGuaranteeAfterMisses: 3,
  epicGuaranteeAfterMisses: 6,
});

const card = (hero, id, name, rarity, energy, tempo, nextTurn, effect, role) => Object.freeze({
  id, hero, name, rarity, energy, tempo, nextTurn, effect, role,
});

const HERO_TURN_CARD_LIST = [
  card('Fara', 'fara_brass_strike', 'Brass Strike', 'Common', 0, 'Normal', 100, 'Attack one enemy for light damage.', 'Attack'),
  card('Fara', 'fara_sentinel_step', 'Sentinel Step', 'Common', 1, 'Fast', 80, 'Attack one enemy for light damage and gain a small shield.', 'Attack'),
  card('Fara', 'fara_oath_ring_ward', 'Oath-Ring Ward', 'Rare', 2, 'Fast', 80, 'Give one ally a medium shield.', 'Defense'),
  card('Fara', 'fara_gate_of_brass', 'Gate of Brass', 'Epic', 3, 'Normal', 100, 'Give every ally a small shield.', 'Defense'),
  card('Fara', 'fara_commanding_challenge', 'Commanding Challenge', 'Common', 2, 'Normal', 100, 'Taunt one enemy until Fara’s next turn.', 'Setup'),
  card('Fara', 'fara_sandlock', 'Sandlock', 'Rare', 3, 'Normal', 100, 'Delay one enemy’s next turn.', 'Utility'),
  card('Fara', 'fara_warding_lamp', 'Warding Lamp', 'Rare', 3, 'Normal', 100, 'Weaken every enemy’s next attack.', 'Defense'),
  card('Fara', 'fara_sovereigns_intercession', 'Sovereign’s Intercession', 'Legendary', 4, 'Slow', 130, 'Intercept the next attack against one ally, then counterattack its attacker for heavy damage.', 'Defense'),

  card('Hondo', 'hondo_alley_jab', 'Alley Jab', 'Common', 0, 'Normal', 100, 'Attack one enemy for light damage.', 'Attack'),
  card('Hondo', 'hondo_rooftop_cut', 'Rooftop Cut', 'Rare', 1, 'Fast', 80, 'Attack one enemy for light damage and apply Mark.', 'Attack'),
  card('Hondo', 'hondo_scorpion_sting', 'Scorpion Sting', 'Rare', 2, 'Normal', 100, 'Attack one enemy for moderate damage.', 'Attack'),
  card('Hondo', 'hondo_coin_charm_feint', 'Coin-Charm Feint', 'Common', 2, 'Fast', 80, 'Mark one enemy for the next attack against them.', 'Setup'),
  card('Hondo', 'hondo_smoke_passage', 'Smoke Passage', 'Rare', 3, 'Fast', 80, 'Evade the next attack against Hondo.', 'Defense'),
  card('Hondo', 'hondo_broken_crown', 'Broken Crown', 'Epic', 3, 'Normal', 100, 'Attack one enemy for moderate damage, increased to heavy damage if the target is weakened.', 'Attack'),
  card('Hondo', 'hondo_midnight_verdict', 'Midnight Verdict', 'Legendary', 4, 'Slow', 130, 'Attack one enemy for heavy damage, increased to massive damage if the target is marked.', 'Attack'),
  card('Hondo', 'hondo_borrowed_breath', 'Borrowed Breath', 'Common', 0, 'Slow', 130, 'Attack one enemy for light damage, increased to moderate against enemies with Mark.', 'Attack'),

  card('Runa', 'runa_blue_ember', 'Blue Ember', 'Common', 1, 'Fast', 80, 'Attack one enemy with blue flame for light damage.', 'Attack'),
  card('Runa', 'runa_starfall_lens', 'Starfall Lens', 'Rare', 2, 'Normal', 100, 'Attack one enemy with starlight for moderate damage.', 'Attack'),
  card('Runa', 'runa_cracked_seal', 'Cracked Seal', 'Common', 2, 'Normal', 100, 'Mark one enemy for the next attack against them.', 'Setup'),
  card('Runa', 'runa_ashen_wind', 'Ashen Wind', 'Rare', 3, 'Normal', 100, 'Burn one enemy for heavy damage at the start of their next turn.', 'Setup'),
  card('Runa', 'runa_dustbound_hands', 'Dustbound Hands', 'Rare', 3, 'Fast', 80, 'Weaken one enemy’s next attack.', 'Setup'),
  card('Runa', 'runa_borrowed_starlight', 'Borrowed Starlight', 'Common', 0, 'Slow', 130, 'Slightly delay one enemy’s next turn and apply Weaken.', 'Utility'),
  card('Runa', 'runa_observatory_flare', 'Observatory Flare', 'Epic', 3, 'Normal', 100, 'Attack every enemy with starlight for moderate damage.', 'Attack'),
  card('Runa', 'runa_sealed_horizon', 'Sealed Horizon', 'Legendary', 4, 'Slow', 130, 'Greatly delay every enemy’s next turn.', 'Utility'),

  card('Kaja', 'kaja_moonwell_flask', 'Moonwell Flask', 'Common', 1, 'Normal', 100, 'Heal one ally for a small amount.', 'Recovery'),
  card('Kaja', 'kaja_bottled_dawn', 'Bottled Dawn', 'Rare', 3, 'Normal', 100, 'Heal one ally for a large amount.', 'Recovery'),
  card('Kaja', 'kaja_lantern_screen', 'Lantern Screen', 'Rare', 2, 'Fast', 80, 'Give one ally a medium shield.', 'Defense'),
  card('Kaja', 'kaja_warded_diagram', 'Warded Diagram', 'Epic', 3, 'Normal', 100, 'Give every ally a small shield.', 'Defense'),
  card('Kaja', 'kaja_clearwater_kit', 'Clearwater Kit', 'Rare', 2, 'Fast', 80, 'Cleanse one harmful effect from one ally.', 'Recovery'),
  card('Kaja', 'kaja_mending_beetle', 'Mending Beetle', 'Common', 3, 'Normal', 100, 'Heal one ally for a moderate amount at the start of their next turn.', 'Recovery'),
  card('Kaja', 'kaja_spare_spark', 'Spare Spark', 'Common', 0, 'Slow', 130, 'Give another ally a small shield.', 'Utility'),
  card('Kaja', 'kaja_last_light_reservoir', 'Last Light Reservoir', 'Legendary', 4, 'Slow', 130, 'Heal every living ally for a large amount and cleanse one harmful effect from each.', 'Recovery'),
];

export const HERO_TURN_CARDS = Object.freeze(HERO_TURN_CARD_LIST.reduce((pools, entry) => {
  pools[entry.hero] = Object.freeze([...pools[entry.hero] || [], entry]);
  return pools;
}, Object.fromEntries(HERO_NAMES.map(name => [name, Object.freeze([])]))));

const HERO_ALIASES = Object.freeze({ Falie: 'Fara', Huun: 'Hondo', Kojonn: 'Kaja' });
const normalizeHeroName = hero => {
  const raw = typeof hero === 'string' ? hero : hero?.baseHeroName || hero?.name;
  const name = String(raw || '');
  return HERO_NAMES.includes(name) ? name : HERO_ALIASES[name] || '';
};

const emptyHeroState = () => ({ noRareTurns: 0, noEpicTurns: 0 });

export function createHeroTurnCardState() {
  return { heroes: Object.fromEntries(HERO_NAMES.map(name => [name, emptyHeroState()])) };
}

export function resetHeroTurnCardState(state = createHeroTurnCardState(), heroName) {
  const next = snapshotState(state);
  const name = normalizeHeroName(heroName);
  if (name) next.heroes = { ...(next.heroes || {}), [name]: emptyHeroState() };
  else next.heroes = Object.fromEntries(HERO_NAMES.map(hero => [hero, emptyHeroState()]));
  return next;
}

export function getHeroTurnCards(heroName) {
  const name = normalizeHeroName(heroName);
  return (HERO_TURN_CARDS[name] || []).map(entry => ({ ...entry }));
}

const safeRandom = rng => {
  const value = Number(typeof rng === 'function' ? rng() : Math.random());
  return Number.isFinite(value) && value >= 0 && value < 1 ? value : 0;
};

const weightedPick = (entries, rng) => {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
  if (!entries.length) return null;
  if (!total) return entries[Math.min(entries.length - 1, Math.floor(safeRandom(rng) * entries.length))];
  let roll = safeRandom(rng) * total;
  for (const entry of entries) {
    roll -= Math.max(0, Number(entry.weight) || 0);
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1];
};

const snapshotState = state => {
  const source = state && typeof state === 'object' ? state : createHeroTurnCardState();
  return {
    heroes: Object.fromEntries(HERO_NAMES.map(name => {
      const row = source.heroes?.[name] || {};
      return [name, {
        noRareTurns: Math.max(0, Math.floor(Number(row.noRareTurns) || 0)),
        noEpicTurns: Math.max(0, Math.floor(Number(row.noEpicTurns) || 0)),
      }];
    })),
  };
};

const BASIC_FALLBACK = (hero, index) => ({
  id: `${hero.toLowerCase()}_basic_attack_${index}`,
  hero,
  name: 'Basic Attack',
  rarity: 'Common',
  energy: 0,
  tempo: 'Normal',
  nextTurn: 100,
  effect: 'Attack one enemy for light damage.',
  role: 'Attack',
  isBasicFallback: true,
});

export function drawHeroTurnCards(heroName, state = createHeroTurnCardState(), rng = Math.random, options = {}) {
  const hero = normalizeHeroName(heroName);
  const previous = snapshotState(state);
  if (!hero) return { cards: [], state: previous, hero: '' };
  const configured = Array.isArray(options.eligibleCards) ? options.eligibleCards : getHeroTurnCards(hero);
  const eligible = [...new Map(configured
    .filter(entry => entry && entry.hero === hero && entry.id && entry.name && RARITIES.includes(entry.rarity))
    .map(entry => [entry.name, entry])).values()];
  const cards = [];
  const remaining = [...eligible];
  const before = previous.heroes[hero];
  const requireEpic = before.noEpicTurns >= HERO_TURN_CARD_CONFIG.epicGuaranteeAfterMisses;
  const requireRare = !requireEpic && before.noRareTurns >= HERO_TURN_CARD_CONFIG.rareGuaranteeAfterMisses;
  const guaranteedMinimum = requireEpic ? ['Epic', 'Legendary'] : requireRare ? ['Rare', 'Epic', 'Legendary'] : [];

  const drawOne = allowedRarities => {
    if (!remaining.length) return;
    const tiers = RARITIES.filter(rarity => allowedRarities.includes(rarity) && remaining.some(entry => entry.rarity === rarity));
    const rarityEntries = tiers.map(rarity => ({ rarity, weight: HERO_TURN_CARD_CONFIG.rarityWeights[rarity] }));
    const chosenTier = weightedPick(rarityEntries, rng)?.rarity;
    const candidates = remaining.filter(entry => entry.rarity === chosenTier);
    const chosen = candidates[Math.min(candidates.length - 1, Math.floor(safeRandom(rng) * candidates.length))];
    if (chosen) {
      cards.push({ ...chosen });
      remaining.splice(remaining.indexOf(chosen), 1);
    }
  };

  if (guaranteedMinimum.length) drawOne(guaranteedMinimum);
  while (cards.length < 3 && remaining.length) drawOne(RARITIES);
  while (cards.length < 3) cards.push(BASIC_FALLBACK(hero, cards.length));

  const showedRare = cards.some(entry => ['Rare', 'Epic', 'Legendary'].includes(entry.rarity));
  const showedEpic = cards.some(entry => ['Epic', 'Legendary'].includes(entry.rarity));
  const next = snapshotState(previous);
  next.heroes[hero] = {
    noRareTurns: showedRare ? 0 : before.noRareTurns + 1,
    noEpicTurns: showedEpic ? 0 : before.noEpicTurns + 1,
  };
  return { cards, state: next, hero };
}
