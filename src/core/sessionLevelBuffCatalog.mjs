const TIER_RARITY = Object.freeze({ 1: 'Common', 2: 'Rare', 3: 'Epic', 4: 'Legendary' });
const REQUIRED_TESTS = Object.freeze([
  'ownership',
  'deterministic_trigger',
  'compatibility',
  'caps',
  'early_mid_late',
  'human_readability',
]);
const TRIGGER_BY_SURFACE = Object.freeze({
  stat_percent: 'passive',
  bargain_percent: 'passive',
  shield_percent_max_hp: 'battle_start',
  cadence_magic_damage: 'basic_attack_completed',
  heal_percent_max_hp: 'basic_attack_completed',
  status_on_basic: 'basic_attack_completed',
  bounce_percent_damage: 'basic_attack_completed',
  counter_percent_atk: 'direct_damage_received',
  party_defeat_raise: 'party_defeat',
});
const TAGS_BY_SURFACE = Object.freeze({
  stat_percent: ['all_attacks'],
  bargain_percent: ['all_attacks'],
  shield_percent_max_hp: ['hero_native'],
  cadence_magic_damage: ['basic_attack', 'direct_damage'],
  heal_percent_max_hp: ['basic_attack', 'direct_damage'],
  status_on_basic: ['basic_attack', 'direct_damage'],
  bounce_percent_damage: ['basic_attack', 'direct_damage'],
  counter_percent_atk: ['direct_damage_received'],
  party_defeat_raise: ['party_defeat'],
});
const AXES_BY_SURFACE = Object.freeze({
  stat_percent: formula => [String(formula.stat)],
  bargain_percent: formula => [String(formula.benefitStat), String(formula.penaltyStat)],
  shield_percent_max_hp: () => ['safety'],
  cadence_magic_damage: () => ['cadence', 'damage'],
  heal_percent_max_hp: () => ['sustain'],
  status_on_basic: () => ['status', 'damage'],
  bounce_percent_damage: () => ['coverage', 'damage'],
  counter_percent_atk: () => ['retaliation', 'sustain'],
  party_defeat_raise: () => ['party_defeat', 'recovery'],
});
const formulaCopy = formula => {
  switch (formula.surface) {
    case 'stat_percent': {
      const labels = { atk: 'ATK', matk: 'MATK', def: 'DEF', res: 'RES', speed: 'Speed', spd: 'Speed', max_hp: 'Max HP' };
      const label = labels[String(formula.stat)] || String(formula.stat).toUpperCase();
      return `${label} ${formula.percent >= 0 ? '+' : ''}${Math.round(formula.percent * 100)}%`;
    }
    case 'bargain_percent': {
      const labels = { atk: 'ATK', matk: 'MATK', def: 'DEF', res: 'RES', speed: 'Speed', spd: 'Speed', max_hp: 'Max HP' };
      const benefitLabel = labels[String(formula.benefitStat)] || String(formula.benefitStat).toUpperCase();
      const penaltyLabel = labels[String(formula.penaltyStat)] || String(formula.penaltyStat).toUpperCase();
      return `${benefitLabel} +${Math.round(formula.benefitPercent * 100)}%, ${penaltyLabel} ${formula.penaltyPercent >= 0 ? '+' : ''}${Math.round(formula.penaltyPercent * 100)}%`;
    }
    case 'shield_percent_max_hp':
      return `Start battle with a ${Math.round(formula.percent * 100)}% Max HP shield`;
    case 'cadence_magic_damage':
      return `Every ${formula.everyCompletedBasics === 1 ? 'completed basic' : `${formula.everyCompletedBasics} completed basics`}: ${formula.amount} magic damage`;
    case 'heal_percent_max_hp':
      return `${Math.round(formula.chance * 100)}%: heal ${Math.round(formula.percent * 100)}% Max HP`;
    case 'status_on_basic':
      return `${Math.round(formula.chance * 100)}%: ${String(formula.statusId[0]).toUpperCase()}${String(formula.statusId).slice(1)} for ${formula.damagePerTurn} damage, ${formula.durationTurns} turns`;
    case 'bounce_percent_damage':
      return `${Math.round(formula.chance * 100)}%: bounce for ${Math.round(formula.damagePercent * 100)}% damage`;
    case 'counter_percent_atk':
      return `${Math.round(formula.chance * 100)}%: counter for ${Math.round(formula.damagePercent * 100)}% ATK, heal ${Math.round(formula.healPercentMaxHp * 100)}% Max HP`;
    case 'party_defeat_raise':
      return `${Math.round(formula.chance * 100)}%: revive party at ${Math.round(formula.revivePercent * 100)}% Max HP`;
    default:
      return '';
  }
};
const rankEffects = formula => Object.freeze({ ...formula });

function createCard({
  cardId,
  tier,
  kind,
  effectId,
  stage = 1,
  name,
  formula,
  nativeOutputMultiplier = 1,
  coverageMultiplier = 1,
  counterpressure = [],
  tests = REQUIRED_TESTS,
}) {
  const surface = String(formula.surface);
  const staged = stage > 1;
  const effect = formulaCopy(formula);
  return Object.freeze({
    id: cardId,
    cardId,
    tier,
    kind,
    effectId,
    stage,
    requiresStage: staged ? stage - 1 : null,
    replacesStage: staged ? stage - 1 : null,
    name,
    rarity: TIER_RARITY[tier],
    effect,
    description: effect,
    formula: Object.freeze({ ...formula }),
    lane: 'shared_card',
    lifetime: 'session',
    acquisitionSource: 'level_up',
    sourceTag: 'session_level_buff',
    sourceTags: Object.freeze([`session_level_buff:${effectId}`, `payload:${surface}`]),
    ownership: Object.freeze({ kind: 'shared', ownerId: 'session' }),
    trigger: Object.freeze({
      event: TRIGGER_BY_SURFACE[surface],
      sourceTags: Object.freeze(['hero_native']),
      allowGenerated: false,
      excludeSelfGenerated: true,
    }),
    compatibleAttackTags: Object.freeze(TAGS_BY_SURFACE[surface] || ['hero_native']),
    incompatibleFeatures: Object.freeze([]),
    grantsFeatures: Object.freeze([]),
    modifiesAxes: Object.freeze(AXES_BY_SURFACE[surface]?.(formula) || []),
    effects: Object.freeze({ nativeOutputMultiplier, coverageMultiplier, spawnsEntities: false }),
    ranks: Object.freeze([{ rank: 1, effects: rankEffects(formula) }]),
    branches: Object.freeze([]),
    maxRank: 1,
    endState: Object.freeze({ kind: 'stage_owned', removeFromOffers: true }),
    limits: Object.freeze({ stackCap: 1, uptimeCap: 1, procDepthCap: 0, entityCap: 0, overflow: 'discard_new' }),
    counterpressure: Object.freeze(counterpressure),
    conflicts: Object.freeze([]),
    offer: Object.freeze({ compatibleBuildsOnly: true }),
    tests: Object.freeze([...tests]),
  });
}

function stagedFamily({ effectId, names, formulas, kind, nativeOutputMultipliers, coverageMultipliers, counterpressure = [], tests }) {
  return formulas.map((formula, index) => createCard({
    cardId: `${effectId}_${index + 1}`,
    tier: index + 1,
    kind,
    effectId,
    stage: index + 1,
    name: names[index],
    formula,
    nativeOutputMultiplier: nativeOutputMultipliers[index],
    coverageMultiplier: coverageMultipliers[index],
    counterpressure,
    tests,
  }));
}

const behaviorCards = [
  ...stagedFamily({
    effectId: 'dawn_chorus',
    names: ['Dawn Chorus', 'Dawn Chorus II', 'Dawn Chorus III', 'Dawn Chorus IV'],
    kind: 'behavior',
    formulas: [
      { surface: 'party_defeat_raise', chance: 0.02, revivePercent: 0.15 },
      { surface: 'party_defeat_raise', chance: 0.03, revivePercent: 0.20 },
      { surface: 'party_defeat_raise', chance: 0.04, revivePercent: 0.25 },
      { surface: 'party_defeat_raise', chance: 0.05, revivePercent: 0.30 },
    ],
    nativeOutputMultipliers: [1, 1, 1, 1],
    coverageMultipliers: [1, 1, 1, 1],
    tests: [...REQUIRED_TESTS, 'defeat_intercept'],
  }),
  ...stagedFamily({
    effectId: 'spectral_orb',
    names: ['Spectral Orb', 'Spectral Orb II', 'Spectral Orb III', 'Spectral Orb IV'],
    kind: 'behavior',
    formulas: [
      { surface: 'cadence_magic_damage', everyCompletedBasics: 3, amount: 4 },
      { surface: 'cadence_magic_damage', everyCompletedBasics: 2, amount: 6 },
      { surface: 'cadence_magic_damage', everyCompletedBasics: 2, amount: 10 },
      { surface: 'cadence_magic_damage', everyCompletedBasics: 1, amount: 12 },
    ],
    nativeOutputMultipliers: [1.05, 1.10, 1.20, 1.35],
    coverageMultipliers: [1, 1, 1, 1],
    tests: [...REQUIRED_TESTS, 'proc_recursion'],
  }),
  ...stagedFamily({
    effectId: 'inner_flow',
    names: ['Inner Flow', 'Inner Flow II', 'Inner Flow III', 'Inner Flow IV'],
    kind: 'behavior',
    formulas: [
      { surface: 'heal_percent_max_hp', chance: 0.15, percent: 0.05 },
      { surface: 'heal_percent_max_hp', chance: 0.25, percent: 0.06 },
      { surface: 'heal_percent_max_hp', chance: 0.35, percent: 0.08 },
      { surface: 'heal_percent_max_hp', chance: 0.45, percent: 0.10 },
    ],
    nativeOutputMultipliers: [1.05, 1.10, 1.20, 1.35],
    coverageMultipliers: [1, 1, 1, 1],
    tests: [...REQUIRED_TESTS, 'proc_recursion'],
  }),
  ...stagedFamily({
    effectId: 'venom_sigil',
    names: ['Venom Sigil', 'Venom Sigil II', 'Venom Sigil III', 'Venom Sigil IV'],
    kind: 'behavior',
    formulas: [
      { surface: 'status_on_basic', chance: 0.20, statusId: 'venom', durationTurns: 2, damagePerTurn: 3 },
      { surface: 'status_on_basic', chance: 0.30, statusId: 'venom', durationTurns: 2, damagePerTurn: 4 },
      { surface: 'status_on_basic', chance: 0.40, statusId: 'venom', durationTurns: 3, damagePerTurn: 5 },
      { surface: 'status_on_basic', chance: 0.50, statusId: 'venom', durationTurns: 3, damagePerTurn: 7 },
    ],
    nativeOutputMultipliers: [1.08, 1.12, 1.22, 1.40],
    coverageMultipliers: [1, 1, 1, 1],
    tests: [...REQUIRED_TESTS, 'proc_recursion'],
  }),
  ...stagedFamily({
    effectId: 'mirage_chain',
    names: ['Chain Strike', 'Chain Strike II', 'Chain Strike III', 'Chain Strike IV'],
    kind: 'behavior',
    formulas: [
      { surface: 'bounce_percent_damage', chance: 0.25, damagePercent: 0.50 },
      { surface: 'bounce_percent_damage', chance: 0.35, damagePercent: 0.60 },
      { surface: 'bounce_percent_damage', chance: 0.45, damagePercent: 0.75 },
      { surface: 'bounce_percent_damage', chance: 0.55, damagePercent: 0.90 },
    ],
    nativeOutputMultipliers: [1.10, 1.15, 1.25, 1.45],
    coverageMultipliers: [1.10, 1.20, 1.30, 1.40],
    tests: [...REQUIRED_TESTS, 'proc_recursion'],
  }),
  ...stagedFamily({
    effectId: 'glass_reprisal',
    names: ['Glass Reprisal', 'Glass Reprisal II', 'Glass Reprisal III', 'Glass Reprisal IV'],
    kind: 'behavior',
    formulas: [
      { surface: 'counter_percent_atk', chance: 0.20, damagePercent: 0.40, healPercentMaxHp: 0.03, maxPerDamagePackage: 1 },
      { surface: 'counter_percent_atk', chance: 0.30, damagePercent: 0.50, healPercentMaxHp: 0.04, maxPerDamagePackage: 1 },
      { surface: 'counter_percent_atk', chance: 0.40, damagePercent: 0.65, healPercentMaxHp: 0.05, maxPerDamagePackage: 1 },
      { surface: 'counter_percent_atk', chance: 0.50, damagePercent: 0.80, healPercentMaxHp: 0.06, maxPerDamagePackage: 1 },
    ],
    nativeOutputMultipliers: [1.08, 1.12, 1.22, 1.40],
    coverageMultipliers: [1, 1, 1, 1],
    tests: [...REQUIRED_TESTS, 'proc_recursion'],
  }),
];

const statCards = [
  ...stagedFamily({
    effectId: 'dune_edge',
    names: ['Dune Edge', 'Dune Edge II', 'Dune Edge III', 'Dune Edge IV'],
    kind: 'stat',
    formulas: [
      { surface: 'stat_percent', stat: 'atk', percent: 0.10 },
      { surface: 'stat_percent', stat: 'atk', percent: 0.18 },
      { surface: 'stat_percent', stat: 'atk', percent: 0.28 },
      { surface: 'stat_percent', stat: 'atk', percent: 0.40 },
    ],
    nativeOutputMultipliers: [1.10, 1.18, 1.28, 1.40],
    coverageMultipliers: [1, 1, 1, 1],
  }),
  ...stagedFamily({
    effectId: 'astral_reservoir',
    names: ['Astral Reservoir', 'Astral Reservoir II', 'Astral Reservoir III', 'Astral Reservoir IV'],
    kind: 'stat',
    formulas: [
      { surface: 'stat_percent', stat: 'matk', percent: 0.10 },
      { surface: 'stat_percent', stat: 'matk', percent: 0.18 },
      { surface: 'stat_percent', stat: 'matk', percent: 0.28 },
      { surface: 'stat_percent', stat: 'matk', percent: 0.40 },
    ],
    nativeOutputMultipliers: [1.10, 1.18, 1.28, 1.40],
    coverageMultipliers: [1, 1, 1, 1],
  }),
  ...stagedFamily({
    effectId: 'sandstone_guard',
    names: ['Sandstone Guard', 'Sandstone Guard II', 'Sandstone Guard III', 'Sandstone Guard IV'],
    kind: 'stat',
    formulas: [
      { surface: 'stat_percent', stat: 'def', percent: 0.10 },
      { surface: 'stat_percent', stat: 'def', percent: 0.18 },
      { surface: 'stat_percent', stat: 'def', percent: 0.28 },
      { surface: 'stat_percent', stat: 'def', percent: 0.40 },
    ],
    nativeOutputMultipliers: [1.10, 1.18, 1.28, 1.40],
    coverageMultipliers: [1, 1, 1, 1],
  }),
  ...stagedFamily({
    effectId: 'desert_step',
    names: ['Desert Step', 'Desert Step II', 'Desert Step III', 'Desert Step IV'],
    kind: 'stat',
    formulas: [
      { surface: 'stat_percent', stat: 'speed', percent: 0.10 },
      { surface: 'stat_percent', stat: 'speed', percent: 0.16 },
      { surface: 'stat_percent', stat: 'speed', percent: 0.24 },
      { surface: 'stat_percent', stat: 'speed', percent: 0.35 },
    ],
    nativeOutputMultipliers: [1.10, 1.16, 1.24, 1.35],
    coverageMultipliers: [1, 1, 1, 1],
  }),
  createCard({
    cardId: 'well_of_life_1', tier: 1, kind: 'stat', effectId: 'well_of_life', name: 'Well of Life',
    formula: { surface: 'stat_percent', stat: 'max_hp', percent: 0.20 }, nativeOutputMultiplier: 1.05,
  }),
  createCard({
    cardId: 'oasis_mirror_2', tier: 2, kind: 'stat', effectId: 'oasis_mirror', name: 'Oasis Mirror',
    formula: { surface: 'stat_percent', stat: 'res', percent: 0.18 }, nativeOutputMultiplier: 1.05,
  }),
  createCard({
    cardId: 'well_of_life_3', tier: 3, kind: 'stat', effectId: 'well_of_life_elite', name: 'Well of Life: Deep',
    formula: { surface: 'stat_percent', stat: 'max_hp', percent: 0.30 }, nativeOutputMultiplier: 1.05,
  }),
  createCard({
    cardId: 'oasis_mirror_4', tier: 4, kind: 'stat', effectId: 'oasis_mirror_crown', name: 'Oasis Mirror: Crown',
    formula: { surface: 'stat_percent', stat: 'res', percent: 0.40 }, nativeOutputMultiplier: 1.10,
  }),
];

const bargainCards = [
  createCard({
    cardId: 'sun_debt_1', tier: 1, kind: 'bargain', effectId: 'sun_debt', name: 'Sun Debt',
    formula: { surface: 'bargain_percent', benefitStat: 'atk', benefitPercent: 0.15, penaltyStat: 'max_hp', penaltyPercent: -0.10 },
    nativeOutputMultiplier: 1.10, counterpressure: ['Max HP -10%'],
  }),
  createCard({
    cardId: 'glass_debt_2', tier: 2, kind: 'bargain', effectId: 'glass_debt', name: 'Glass Debt',
    formula: { surface: 'bargain_percent', benefitStat: 'matk', benefitPercent: 0.24, penaltyStat: 'res', penaltyPercent: -0.14 },
    nativeOutputMultiplier: 1.18, counterpressure: ['RES -14%'],
  }),
  createCard({
    cardId: 'star_debt_3', tier: 3, kind: 'bargain', effectId: 'star_debt', name: 'Star Debt',
    formula: { surface: 'bargain_percent', benefitStat: 'atk', benefitPercent: 0.36, penaltyStat: 'max_hp', penaltyPercent: -0.20 },
    nativeOutputMultiplier: 1.30, counterpressure: ['Max HP -20%'],
  }),
  createCard({
    cardId: 'last_wish_4', tier: 4, kind: 'bargain', effectId: 'last_wish', name: 'Last Wish',
    formula: { surface: 'bargain_percent', benefitStat: 'matk', benefitPercent: 0.50, penaltyStat: 'res', penaltyPercent: -0.25 },
    nativeOutputMultiplier: 1.50, counterpressure: ['RES -25%'],
  }),
];

const byTier = tier => [
  ...behaviorCards.filter(card => card.tier === tier),
  ...statCards.filter(card => card.tier === tier),
  ...bargainCards.filter(card => card.tier === tier),
];

export const SESSION_LEVEL_UP_BUFF_CARDS = Object.freeze([1, 2, 3, 4].flatMap(byTier));
// The opening/session queue consumes only this named production pool.  Keep
// direct active cards, relief cards, signatures, and retired turn cards out by
// omission; offer generation and application use this same ID list.
export const UNIVERSAL_SESSION_POWER_BUFF_IDS = Object.freeze([
  'dawn_chorus_1', 'spectral_orb_1', 'venom_sigil_1', 'mirage_chain_1', 'glass_reprisal_1', 'dune_edge_1', 'astral_reservoir_1', 'sandstone_guard_1', 'desert_step_1', 'well_of_life_1', 'sun_debt_1',
  'dawn_chorus_2', 'spectral_orb_2', 'venom_sigil_2', 'mirage_chain_2', 'glass_reprisal_2', 'dune_edge_2', 'astral_reservoir_2', 'sandstone_guard_2', 'desert_step_2', 'oasis_mirror_2', 'glass_debt_2',
  'dawn_chorus_3', 'spectral_orb_3', 'venom_sigil_3', 'mirage_chain_3', 'glass_reprisal_3', 'dune_edge_3', 'astral_reservoir_3', 'sandstone_guard_3', 'desert_step_3', 'well_of_life_3', 'star_debt_3',
  'dawn_chorus_4', 'spectral_orb_4', 'venom_sigil_4', 'mirage_chain_4', 'glass_reprisal_4', 'dune_edge_4', 'astral_reservoir_4', 'sandstone_guard_4', 'desert_step_4', 'oasis_mirror_4', 'last_wish_4',
]);
const UNIVERSAL_SESSION_POWER_BUFF_ID_SET = new Set(UNIVERSAL_SESSION_POWER_BUFF_IDS);
export const isUniversalSessionPowerBuffCard = card => UNIVERSAL_SESSION_POWER_BUFF_ID_SET.has(String(card?.cardId || ''));
export const UNIVERSAL_SESSION_POWER_BUFF_CARDS = Object.freeze(SESSION_LEVEL_UP_BUFF_CARDS.filter(isUniversalSessionPowerBuffCard));
export const SESSION_LEVEL_UP_BUFF_POOL_SUMMARY = Object.freeze({
  total: SESSION_LEVEL_UP_BUFF_CARDS.length,
  byTier: Object.freeze(Object.fromEntries([1, 2, 3, 4].map(tier => [tier, byTier(tier).length]))),
});
