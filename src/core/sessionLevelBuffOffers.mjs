const TIER_ORDER = Object.freeze([1, 2, 3, 4]);
const OFFER_SIZE = 3;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integerAtLeast(value, minimum = 0) {
  return Math.max(minimum, Math.floor(finiteNumber(value, minimum)));
}

function isPositiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function normalizedRandom(rng) {
  const value = typeof rng === 'function' ? finiteNumber(rng(), 0) : 0;
  return value >= 0 && value < 1 ? value : 0;
}

function canonicalCards(cards) {
  const seen = new Set();
  return (Array.isArray(cards) ? cards : [])
    .filter(card => card && typeof card.cardId === 'string' && card.cardId.length > 0)
    .filter((card) => {
      if (seen.has(card.cardId)) return false;
      seen.add(card.cardId);
      const hasRequirement = card.requiresStage != null;
      const hasReplacement = card.replacesStage != null;
      const isStageUpgrade = card.stage > 1;
      return TIER_ORDER.includes(card.tier)
        && ['behavior', 'stat', 'bargain'].includes(card.kind)
        && typeof card.effectId === 'string'
        && card.effectId.length > 0
        && isPositiveInteger(card.stage)
        && (!hasRequirement || isPositiveInteger(card.requiresStage))
        && (!hasReplacement || isPositiveInteger(card.replacesStage))
        && (hasRequirement === hasReplacement)
        && (isStageUpgrade
          ? card.requiresStage === card.stage - 1 && card.replacesStage === card.stage - 1
          : !hasRequirement && !hasReplacement)
        && (card.kind !== 'behavior' || card.tier === 1 || isStageUpgrade);
    })
    .slice()
    .sort((left, right) => left.cardId.localeCompare(right.cardId));
}

function canonicalHero(heroState = {}) {
  const activeStageByEffectId = {};
  for (const [effectId, stage] of Object.entries(heroState.activeStageByEffectId || {})) {
    const normalizedStage = integerAtLeast(stage, 0);
    if (effectId && normalizedStage > 0) activeStageByEffectId[effectId] = normalizedStage;
  }
  const completedEffectIds = [...new Set(Array.isArray(heroState.completedEffectIds)
    ? heroState.completedEffectIds.filter(effectId => typeof effectId === 'string' && effectId.length > 0)
    : [])].sort();
  const triggerCountersByEffectId = {};
  for (const [effectId, count] of Object.entries(heroState.triggerCountersByEffectId || {})) {
    if (effectId) triggerCountersByEffectId[effectId] = integerAtLeast(count, 0);
  }
  return { activeStageByEffectId, completedEffectIds, triggerCountersByEffectId };
}

function canonicalState(state = {}) {
  const heroes = {};
  for (const [heroId, heroState] of Object.entries(state?.heroes || {})) {
    if (heroId) heroes[heroId] = canonicalHero(heroState);
  }
  return { heroes };
}

function stageFor(heroState, effectId) {
  return integerAtLeast(heroState.activeStageByEffectId[effectId], 0);
}

function requiredStage(card) {
  return card.requiresStage == null ? 0 : integerAtLeast(card.requiresStage, 0);
}

function isPureFallback(card) {
  return (card.kind === 'stat' || card.kind === 'bargain')
    && card.requiresStage == null
    && card.stage === 1;
}

function isEligibleCard(card, heroState) {
  const ownedStage = stageFor(heroState, card.effectId);
  const required = requiredStage(card);
  const replacesStage = card.replacesStage == null ? null : integerAtLeast(card.replacesStage, 0);
  if (isPureFallback(card)) return ownedStage === 0;
  // Same-tier stat cards stay available as fallbacks. A later stat stage may
  // grant directly, or replace any lower stage the owner already has.
  if (card.kind === 'stat' && card.stage > 1) return ownedStage < card.stage;
  if (card.kind === 'behavior' && card.tier > 1 && card.requiresStage == null) return false;
  if (replacesStage != null && replacesStage !== ownedStage) return false;
  return required === ownedStage && card.stage === ownedStage + 1;
}

function shuffle(cards, rng) {
  const shuffled = cards.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(normalizedRandom(rng) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function weightsForRemaining(weightTable, remaining) {
  return remaining.map(tier => Math.max(0, finiteNumber(weightTable?.[tier], 0)));
}

function weightedTier(remaining, weights, rng) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return remaining[0];
  let threshold = normalizedRandom(rng) * total;
  for (let index = 0; index < remaining.length; index += 1) {
    threshold -= weights[index];
    if (threshold < 0) return remaining[index];
  }
  return remaining.at(-1);
}

function maxStageByEffect(cards) {
  const maxStages = new Map();
  for (const card of cards) {
    maxStages.set(card.effectId, Math.max(maxStages.get(card.effectId) || 0, card.stage));
  }
  return maxStages;
}

export function normalizeLevelUpProgress(progress = {}) {
  const total = finiteNumber(progress.totalMilestonesToFinalBoss, 0);
  const completed = finiteNumber(progress.completedMilestones, 0);
  const normalizedProgress = total > 0 ? Math.max(0, Math.min(1, completed / total)) : 0;
  return { normalizedProgress, finalBossReached: Boolean(progress.finalBossReached) };
}

function* tierAttemptIterator(progress = {}, rng = () => 0, tierWeights = () => ({})) {
  const { normalizedProgress, finalBossReached } = normalizeLevelUpProgress(progress);
  const remaining = TIER_ORDER.slice();
  while (remaining.length > 0) {
    const allWeights = typeof tierWeights === 'function'
      ? tierWeights(normalizedProgress, finalBossReached)
      : tierWeights;
    const weights = weightsForRemaining(allWeights, remaining);
    const tier = weightedTier(remaining, weights, rng);
    remaining.splice(remaining.indexOf(tier), 1);
    yield tier;
  }
}

export function deterministicTierAttempts(progress = {}, rng = () => 0, tierWeights = () => ({})) {
  return [...tierAttemptIterator(progress, rng, tierWeights)];
}

export function createSessionLevelBuffState() {
  return { heroes: {} };
}

export function getHeroSessionLevelBuffState(state, heroId) {
  return canonicalHero(canonicalState(state).heroes[String(heroId)]);
}

export function getEligibleLevelUpBuffCards({ state, heroId, cards, tier } = {}) {
  const heroState = getHeroSessionLevelBuffState(state, heroId);
  return canonicalCards(cards).filter(card => card.tier === tier && isEligibleCard(card, heroState));
}

export function buildLevelUpBuffOffer({ state, heroId, cards, progress, rng, tierWeights, preferredCardId = '' } = {}) {
  const normalizedCards = canonicalCards(cards);
  const attemptedTiers = [];
  for (const tier of tierAttemptIterator(progress, rng, tierWeights)) {
    attemptedTiers.push(tier);
    const eligible = getEligibleLevelUpBuffCards({ state, heroId, cards: normalizedCards, tier });
    const preferred = eligible.find(card => card.cardId === preferredCardId) || null;
    const preferredPool = cards => preferred && cards.some(card => card.cardId === preferred.cardId)
      ? [preferred, ...cards.filter(card => card.cardId !== preferred.cardId)]
      : cards;
    const behavior = preferred && preferred.kind === 'behavior'
      ? [preferred, ...shuffle(eligible.filter(card => card.kind === 'behavior' && card.cardId !== preferred.cardId), rng)]
      : shuffle(preferredPool(eligible.filter(card => card.kind === 'behavior')), rng);
    const offeredCards = behavior.slice(0, OFFER_SIZE);
    if (offeredCards.length < OFFER_SIZE) {
      const fallbackCards = eligible.filter(card => (card.kind === 'stat' || card.kind === 'bargain') && card.cardId !== preferred?.cardId);
      const fallbacks = preferred && (preferred.kind === 'stat' || preferred.kind === 'bargain')
        ? [preferred, ...shuffle(fallbackCards, rng)]
        : shuffle(fallbackCards, rng);
      offeredCards.push(...fallbacks.slice(0, OFFER_SIZE - offeredCards.length));
    }
    if (offeredCards.length === OFFER_SIZE) {
      return { status: 'offered', heroId: String(heroId), tier, cards: offeredCards, attemptedTiers };
    }
  }
  return { status: 'offerUnavailable', heroId: String(heroId), cards: [], attemptedTiers };
}

export function applyLevelUpBuffCard({ state, heroId, cardId, cards } = {}) {
  const normalizedState = canonicalState(state);
  const heroKey = String(heroId);
  const heroState = canonicalHero(normalizedState.heroes[heroKey]);
  const definitions = canonicalCards(cards);
  const card = definitions.find(candidate => candidate.cardId === cardId);
  if (!card || !isEligibleCard(card, heroState)) {
    return { status: 'rejected', state: normalizedState, reason: 'ineligibleCard' };
  }
  const activeStageByEffectId = { ...heroState.activeStageByEffectId, [card.effectId]: card.stage };
  const maxStages = maxStageByEffect(definitions);
  const completedEffectIds = Object.entries(activeStageByEffectId)
    .filter(([effectId, stage]) => stage >= (maxStages.get(effectId) || Infinity))
    .map(([effectId]) => effectId)
    .sort();
  return {
    status: 'applied',
    card,
    replacedStage: stageFor(heroState, card.effectId) || null,
    state: {
      heroes: {
        ...normalizedState.heroes,
        [heroKey]: {
          activeStageByEffectId,
          completedEffectIds,
          triggerCountersByEffectId: { ...heroState.triggerCountersByEffectId },
        },
      },
    },
  };
}

export function clearSessionLevelBuffState() {
  return createSessionLevelBuffState();
}

export const sessionLevelBuffOfferConstants = Object.freeze({ OFFER_SIZE, TIER_ORDER });
