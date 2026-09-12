import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLevelUpBuffCard,
  buildLevelUpBuffOffer,
  clearSessionLevelBuffState,
  createSessionLevelBuffState,
  deterministicTierAttempts,
  getEligibleLevelUpBuffCards,
  normalizeLevelUpProgress,
} from '../src/core/sessionLevelBuffOffers.mjs';

const nextRng = (...values) => {
  let index = 0;
  return () => values[index++] ?? 0;
};

const CARD = (cardId, tier, kind, effectId, stage, requiresStage = null, replacesStage = null) => ({
  cardId, tier, kind, effectId, stage, requiresStage, replacesStage,
});

const CARDS = [
  CARD('focus-1', 1, 'behavior', 'focus', 1),
  CARD('focus-2', 2, 'behavior', 'focus', 2, 1, 1),
  CARD('vitality', 2, 'stat', 'vitality', 1),
  CARD('fortune', 2, 'bargain', 'fortune', 1),
  CARD('armor', 3, 'stat', 'armor', 1),
  CARD('clarity', 3, 'stat', 'clarity', 1),
  CARD('speed', 3, 'stat', 'speed', 1),
];

test('normalizes milestone progress and tries every tier once with weighted retries', () => {
  assert.deepEqual(normalizeLevelUpProgress({ completedMilestones: 5, totalMilestonesToFinalBoss: 0 }), {
    normalizedProgress: 0,
    finalBossReached: false,
  });
  const calls = [];
  const attempts = deterministicTierAttempts(
    { completedMilestones: 3, totalMilestonesToFinalBoss: 6, finalBossReached: true },
    nextRng(0, 0),
    (progress, finalBossReached) => {
      calls.push([progress, finalBossReached]);
      return { 1: 0, 2: 2, 3: 0, 4: 0 };
    },
  );
  assert.deepEqual(attempts, [2, 1, 3, 4]);
  assert.deepEqual(calls, [[0.5, true], [0.5, true], [0.5, true], [0.5, true]]);
});

test('offers three distinct cards for the leveled hero and fills a behavior grant with same-tier fallbacks', () => {
  const firstGrant = applyLevelUpBuffCard({ state: createSessionLevelBuffState(), heroId: 'Fara', cardId: 'focus-1', cards: CARDS });
  const offer = buildLevelUpBuffOffer({
    state: firstGrant.state,
    heroId: 'Fara',
    cards: CARDS,
    progress: {},
    rng: nextRng(0, 0, 0),
    tierWeights: { 1: 0, 2: 1, 3: 0, 4: 0 },
  });
  assert.equal(offer.status, 'offered');
  assert.equal(offer.tier, 2);
  assert.deepEqual(offer.cards.map(card => card.cardId).sort(), ['focus-2', 'fortune', 'vitality']);
  assert.equal(new Set(offer.cards.map(card => card.cardId)).size, 3);
  assert.deepEqual(getEligibleLevelUpBuffCards({ state: firstGrant.state, heroId: 'Hondo', cards: CARDS, tier: 2 })
    .map(card => card.cardId).sort(), ['fortune', 'vitality']);
});

test('stops tier sampling after a valid first tier and only consumes its card-selection RNG', () => {
  let calls = 0;
  const offer = buildLevelUpBuffOffer({
    state: createSessionLevelBuffState(), heroId: 'Fara', cards: CARDS, progress: {},
    rng: () => { calls += 1; return 0; },
    tierWeights: { 1: 0, 2: 0, 3: 1, 4: 0 },
  });
  assert.equal(offer.tier, 3);
  assert.equal(calls, 3, 'one tier sample plus two Fisher-Yates card-selection samples');
});

test('gates next behavior, stat, and bargain stages while leaving pure same-tier stat fallback ungated', () => {
  const staged = [
    CARD('ward-1', 1, 'behavior', 'ward', 1), CARD('ward-2', 2, 'behavior', 'ward', 2, 1, 1),
    CARD('might-2', 2, 'stat', 'might', 2, 1, 1), CARD('trade-2', 2, 'bargain', 'trade', 2, 1, 1),
    CARD('pure-armor', 2, 'stat', 'armor', 1), CARD('invalid-free-behavior', 2, 'behavior', 'free', 1),
    CARD('malformed-negative-prereq', 2, 'behavior', 'malformed', 1, -1),
  ];
  assert.deepEqual(getEligibleLevelUpBuffCards({ state: createSessionLevelBuffState(), heroId: 'Runa', cards: staged, tier: 2 })
    .map(card => card.cardId), ['pure-armor']);
  const state = {
    heroes: {
      Runa: { activeStageByEffectId: { ward: 1, might: 1, trade: 1 }, completedEffectIds: [], triggerCountersByEffectId: {} },
    },
  };
  assert.deepEqual(getEligibleLevelUpBuffCards({ state, heroId: 'Runa', cards: staged, tier: 2 })
    .map(card => card.cardId).sort(), ['might-2', 'pure-armor', 'trade-2', 'ward-2']);
});

test('rejects a malformed T2 stage-1 behavior card with requiresStage -1', () => {
  const malformed = CARD('malformed-negative-prereq', 2, 'behavior', 'malformed', 1, -1);
  assert.deepEqual(getEligibleLevelUpBuffCards({
    state: createSessionLevelBuffState(), heroId: 'Runa', cards: [malformed], tier: 2,
  }), []);
  assert.equal(applyLevelUpBuffCard({
    state: createSessionLevelBuffState(), heroId: 'Runa', cardId: malformed.cardId, cards: [malformed],
  }).status, 'rejected');
});

test('replaces prior stage per hero, keeps other heroes independent, and clears the session seam', () => {
  const one = applyLevelUpBuffCard({ state: createSessionLevelBuffState(), heroId: 'Fara', cardId: 'focus-1', cards: CARDS });
  const two = applyLevelUpBuffCard({ state: one.state, heroId: 'Fara', cardId: 'focus-2', cards: CARDS });
  assert.equal(two.status, 'applied');
  assert.equal(two.replacedStage, 1);
  assert.deepEqual(two.state.heroes.Fara.activeStageByEffectId, { focus: 2 });
  assert.deepEqual(two.state.heroes.Fara.completedEffectIds, ['focus']);
  assert.deepEqual(getEligibleLevelUpBuffCards({ state: two.state, heroId: 'Hondo', cards: CARDS, tier: 1 })
    .map(card => card.cardId), ['focus-1']);
  assert.deepEqual(clearSessionLevelBuffState(two.state), { heroes: {} });
  assert.doesNotThrow(() => JSON.stringify(two.state));
});

test('rerolls whole tiers and returns a deterministic exhausted-pool result after four failures', () => {
  const rerolled = buildLevelUpBuffOffer({
    state: createSessionLevelBuffState(), heroId: 'Kaja', cards: CARDS,
    progress: {}, rng: nextRng(0, 0, 0), tierWeights: { 1: 1, 2: 0, 3: 0, 4: 0 },
  });
  assert.equal(rerolled.status, 'offered');
  assert.equal(rerolled.tier, 3);
  assert.deepEqual(rerolled.attemptedTiers, [1, 2, 3]);
  const unavailable = buildLevelUpBuffOffer({
    state: createSessionLevelBuffState(), heroId: 'Kaja', cards: [], progress: {}, rng: () => 0,
    tierWeights: { 1: 1, 2: 1, 3: 1, 4: 1 },
  });
  assert.deepEqual(unavailable, {
    status: 'offerUnavailable', heroId: 'Kaja', cards: [], attemptedTiers: [1, 2, 3, 4],
  });
});
