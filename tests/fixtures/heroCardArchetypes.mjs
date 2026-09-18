// Canonical hero-card IDs only. Runtime definitions stay owned by heroTurnCards.mjs.
export const HERO_CARD_ARCHETYPE_CASES = Object.freeze([
  {
    id: 'basic-attack', category: 'core', hero: 'Hondo', actorName: 'Huun', cardId: 'hondo_alley_jab',
    selection: { targetUID: 9 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 18 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { hp: { 9: 30 }, queue: [1, 9, 10] },
  },
  {
    id: 'direct-heal', category: 'core', hero: 'Kaja', actorName: 'Kojonn', cardId: 'kaja_moonwell_flask',
    selection: { targetUID: 2, illegalTargetUID: 9 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 8 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { hp: { 2: 12 }, queue: [1, 9, 10] },
  },
  {
    id: 'shield', category: 'core', hero: 'Fara', actorName: 'Falie', cardId: 'fara_oath_ring_ward',
    selection: { targetUID: 2 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 20 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { statuses: { 2: [{ statusEffect: 'barrier', magnitude: .35, remaining: 7 }] }, queue: [1, 9, 10] },
  },
  {
    id: 'positive-buff-evade', category: 'core', hero: 'Hondo', actorName: 'Huun', cardId: 'hondo_smoke_passage',
    selection: {},
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 18 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { statuses: { 1: [{ statusEffect: 'evadeNext', magnitude: 1, duration: 2 }] }, queue: [1, 9, 10] },
  },
  {
    id: 'enemy-debuff', category: 'core', hero: 'Fara', actorName: 'Falie', cardId: 'fara_warding_lamp',
    selection: {},
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 18 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { statuses: { 9: [{ statusEffect: 'atkDown', magnitude: .25, duration: 1 }], 10: [{ statusEffect: 'atkDown', magnitude: .25, duration: 1 }] }, queue: [1, 9, 10] },
  },
  {
    id: 'delay', category: 'core', hero: 'Fara', actorName: 'Falie', cardId: 'fara_sandlock',
    selection: { targetUID: 9 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 18 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { statuses: { 9: [{ statusEffect: 'delayNextTurn', delaySlots: 1, duration: 1 }] }, queue: [1, 10, 9] },
  },
  {
    id: 'area-attack', category: 'core', hero: 'Runa', actorName: 'Runa', cardId: 'runa_observatory_flare',
    selection: {},
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 18 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { hp: { 9: 26, 10: 26 }, queue: [1, 9, 10] },
  },
  {
    id: 'cleanse', category: 'core', hero: 'Kaja', actorName: 'Kojonn', cardId: 'kaja_clearwater_kit',
    selection: { targetUID: 2 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 18, statuses: [{ statusEffect: 'atkDown', magnitude: .25, duration: 1 }, { statusEffect: 'dot', magnitude: 1, duration: 1 }] }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { statuses: { 2: [] }, queue: [1, 9, 10] },
  },
  {
    id: 'dot', category: 'secondary', hero: 'Runa', actorName: 'Runa', cardId: 'runa_ashen_wind',
    selection: { targetUID: 9 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 18 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { hp: { 9: 40 }, tickHP: { 9: 20 }, statuses: { 9: [{ statusEffect: 'dot', duration: 1, potency: 2 }] }, queue: [1, 9, 10] },
  },
  {
    id: 'hot', category: 'secondary', hero: 'Kaja', actorName: 'Kojonn', cardId: 'kaja_mending_beetle',
    selection: { targetUID: 2 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 10 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { hp: { 2: 10 }, tickHP: { 2: 12 }, statuses: { 2: [{ statusEffect: 'hot', duration: 1, potency: .25 }] }, queue: [1, 9, 10] },
  },
  {
    id: 'taunt', category: 'secondary', hero: 'Fara', actorName: 'Falie', cardId: 'fara_commanding_challenge',
    selection: { targetUID: 9 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 18 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { statuses: { 9: [{ statusEffect: 'taunted', magnitude: 1, duration: 1 }] }, queue: [1, 9, 10] },
  },
  {
    id: 'cover-counter', category: 'secondary', hero: 'Fara', actorName: 'Falie', cardId: 'fara_sovereigns_intercession',
    selection: { targetUID: 2 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 18 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { statuses: { 2: [{ statusEffect: 'cover', magnitude: 1, duration: 2 }], 1: [{ statusEffect: 'counter', magnitude: 2, duration: 2 }] }, queue: [1, 9, 10] },
  },
  {
    id: 'conditional-attack', category: 'secondary', hero: 'Hondo', actorName: 'Huun', cardId: 'hondo_borrowed_breath',
    selection: { targetUID: 9 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 18 }], enemies: [{ uid: 9, hp: 40, statuses: [{ statusEffect: 'mark', magnitude: 1, duration: 2 }] }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { hp: { 9: 26 }, queue: [1, 9, 10] },
  },
  {
    id: 'ally-self-exclusion', category: 'secondary', hero: 'Kaja', actorName: 'Kojonn', cardId: 'kaja_spare_spark',
    selection: { targetUID: 2, illegalTargetUID: 1 },
    preState: { actorHP: 20, allies: [{ uid: 2, hp: 20 }], enemies: [{ uid: 9, hp: 40 }, { uid: 10, hp: 40 }], queue: [1, 9, 10] },
    expected: { statuses: { 2: [{ statusEffect: 'barrier', magnitude: .2, remaining: 4 }] }, queue: [1, 9, 10] },
  },
]);

export const HERO_CARD_ARCHETYPE_CORE = Object.freeze(HERO_CARD_ARCHETYPE_CASES.filter(testCase => testCase.category === 'core'));
export const HERO_CARD_ARCHETYPE_SECONDARY = Object.freeze(HERO_CARD_ARCHETYPE_CASES.filter(testCase => testCase.category === 'secondary'));
