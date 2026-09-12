import { applyLevelUpBuffCard, buildLevelUpBuffOffer, createSessionLevelBuffState } from '../../src/core/sessionLevelBuffOffers.mjs';
import { SESSION_LEVEL_UP_BUFF_CARDS } from '../../src/core/sessionLevelBuffCatalog.mjs';
import { heroDefinition } from '../src/core/heroDefinitions.mjs';
import { acknowledgeSessionLevelUpEntry, currentSessionLevelUpEntry } from '../src/core/sessionLevelUpQueue.mjs';

export { SESSION_LEVEL_UP_BUFF_CARDS };
export const QA_LEVEL_UP_BUFF_CARDS = SESSION_LEVEL_UP_BUFF_CARDS;

export const LOW_HP_WARNING_RATIO = 0.25;
const EXP_FILL_SECONDS = 0.48;
const EXP_RESET_SECONDS = 0.08;
const LEVEL_UP_DANCE_SECONDS = 0.38;
const DEFAULT_TIER_WEIGHTS = Object.freeze({ 1: 70, 2: 20, 3: 7, 4: 3 });

const heroId = hero => String(hero?.heroInstanceKey ?? hero?.uid ?? '');
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

function tierWeightsFor(globals, progress) {
  const normalizedProgress = Number(progress?.totalMilestonesToFinalBoss || 0) > 0
    ? clamp(Number(progress.completedMilestones || 0) / Number(progress.totalMilestonesToFinalBoss), 0, 1)
    : 0;
  const configured = globals?.SessionLevelUpTierWeights;
  if (typeof configured === 'function') return configured(normalizedProgress, !!progress?.finalBossReached);
  if (configured && typeof configured === 'object') return configured;
  return DEFAULT_TIER_WEIGHTS;
}

export function getActiveSessionLevelUpBuffCards(globals, hero) {
  const activeStages = globals?.SessionLevelBuffState?.heroes?.[heroId(hero)]?.activeStageByEffectId || {};
  return SESSION_LEVEL_UP_BUFF_CARDS.filter(card => Number(activeStages[card.effectId] || 0) === Number(card.stage || 0));
}

export function beginSessionLevelUpSettlement(globals, results = [], heroes = [], now = 0) {
  const byHero = new Map((heroes || []).map(hero => [heroId(hero), hero]));
  globals.SessionLevelBuffState ||= createSessionLevelBuffState();
  globals.SessionLevelUpOffersByQueueIndex = {};
  globals.SessionLevelUpOfferGeneration = Number(globals.SessionLevelUpOfferGeneration || 0) + 1;
  globals.SessionLevelUpSettlement = {
    phase: 'fadeIn', startedAt: Number(now || 0), fadeOutStartedAt: 0,
    rows: (results || []).map(result => {
      const hero = [...byHero.values()].find(candidate => [heroDefinition(candidate)?.name, candidate?.name].some(name => String(name || '') === String(result?.hero || ''))) || null;
      const before = Math.max(0, Number(result?.expBefore ?? 0));
      const max = Math.max(1, Number(result?.expToNextBefore ?? hero?.EXPToNextLevel ?? 1));
      return { heroId: heroId(hero), heroUID: Number(hero?.uid || 0), gainedEXP: Math.max(0, Number(result?.exp || 0)), beforeEXP: before, afterEXP: Math.max(0, Number(result?.expAfter ?? hero?.currentEXP ?? before)), expToNext: max, fromLevel: Number(result?.fromLevel || 1), toLevel: Number(result?.toLevel || result?.fromLevel || 1) };
    }),
  };
  return globals.SessionLevelUpSettlement;
}

export function updateSessionLevelUpSettlement(globals, now = 0) {
  const settlement = globals?.SessionLevelUpSettlement;
  if (!settlement) return null;
  const elapsed = Math.max(0, Number(now || 0) - Number(settlement.phase === 'fadeOut' ? settlement.fadeOutStartedAt : settlement.startedAt));
  if (settlement.phase === 'fadeIn' && elapsed >= 0.18) settlement.phase = 'active';
  if (settlement.phase === 'active' && globals.SessionLevelUpQueue?.status !== 'active'
    && settlement.rows.every(row => settlementRowVisual(row, now, settlement).complete)) {
    settlement.phase = 'fadeOut';
    settlement.fadeOutStartedAt = Number(now || 0);
  }
  if (settlement.phase === 'fadeOut' && elapsed >= 0.22) { delete globals.SessionLevelUpSettlement; return null; }
  return settlement;
}

export function settlementRowVisual(row, now, settlement) {
  const animationElapsed = Math.max(0, Number(now || 0) - Number(settlement?.startedAt || 0));
  const opacityElapsed = Math.max(0, Number(now || 0) - Number(settlement?.phase === 'fadeOut' ? settlement?.fadeOutStartedAt : settlement?.startedAt || 0));
  const gain = Math.max(0, Number(row?.gainedEXP || 0));
  const max = Math.max(1, Number(row?.expToNext || 1));
  const before = clamp(row?.beforeEXP, 0, max);
  let elapsed = Math.max(0, animationElapsed - 0.12);
  let remaining = gain;
  let current = before;
  let crossedLevels = 0;
  // One bar fills to its threshold, briefly resets empty, then carries the remainder forward.
  while (remaining > 0) {
    const toThreshold = Math.max(0, max - current);
    const fillAmount = Math.min(remaining, toThreshold);
    const fillDuration = Math.max(0.04, EXP_FILL_SECONDS * (fillAmount / max));
    if (elapsed < fillDuration) return { progress: clamp((current + fillAmount * (elapsed / fillDuration)) / max, 0, 1), crossedLevels, complete: false, opacity: settlement?.phase === 'fadeOut' ? clamp(1 - opacityElapsed / 0.22, 0, 1) : clamp(opacityElapsed / 0.18, 0, 1) };
    elapsed -= fillDuration;
    remaining -= fillAmount;
    current += fillAmount;
    if (current < max) break;
    crossedLevels += 1;
    if (remaining <= 0) break;
    if (elapsed < EXP_RESET_SECONDS) return { progress: 0, crossedLevels, complete: false, opacity: settlement?.phase === 'fadeOut' ? clamp(1 - opacityElapsed / 0.22, 0, 1) : clamp(opacityElapsed / 0.18, 0, 1) };
    elapsed -= EXP_RESET_SECONDS;
    current = 0;
  }
  return { progress: clamp(current / max, 0, 1), crossedLevels, complete: true, opacity: settlement?.phase === 'fadeOut' ? clamp(1 - opacityElapsed / 0.22, 0, 1) : clamp(opacityElapsed / 0.18, 0, 1) };
}

export function getSessionLevelUpBuffPresentation(globals, heroes = [], progress = {}) {
  const entry = currentSessionLevelUpEntry(globals?.SessionLevelUpQueue || {});
  if (!entry) return { open: false, cards: [], heroUID: 0, queue: null };
  const settlementRow = (globals.SessionLevelUpSettlement?.rows || []).find(row => String(row.heroId) === String(entry.heroId));
  if (settlementRow && !settlementRowVisual(settlementRow, globals.time, globals.SessionLevelUpSettlement).complete) {
    return { open: false, cards: [], heroUID: Number(entry.heroUID || 0), queue: entry, awaitingEXP: true };
  }
  const key = String(globals.SessionLevelUpQueue.currentIndex || 0);
  const settlement = globals.SessionLevelUpSettlement;
  if (settlement) {
    const dance = settlement.dance;
    if (!dance || dance.queueIndex !== key) {
      settlement.dance = { queueIndex: key, heroUID: Number(entry.heroUID || 0), startedAt: Number(globals.time || 0), endsAt: Number(globals.time || 0) + LEVEL_UP_DANCE_SECONDS };
      return { open: false, cards: [], heroUID: Number(entry.heroUID || 0), queue: entry, dancing: true };
    }
    if (Number(globals.time || 0) < Number(dance.endsAt || 0)) return { open: false, cards: [], heroUID: Number(entry.heroUID || 0), queue: entry, dancing: true };
  }
  const offers = globals.SessionLevelUpOffersByQueueIndex || (globals.SessionLevelUpOffersByQueueIndex = {});
  const offerCards = Array.isArray(globals?.SessionLevelUpQaOfferCards) ? globals.SessionLevelUpQaOfferCards : SESSION_LEVEL_UP_BUFF_CARDS;
  if (!offers[key]) offers[key] = buildLevelUpBuffOffer({ state: globals.SessionLevelBuffState || createSessionLevelBuffState(), heroId: entry.heroId, cards: offerCards, progress, rng: globals.RuntimeRandom, tierWeights: tierWeightsFor(globals, progress), preferredCardId: globals.SessionLevelUpPreferredCardId });
  const offer = offers[key];
  const hero = heroes.find(candidate => heroId(candidate) === entry.heroId) || null;
  const offerToken = `${Number(globals.SessionLevelUpOfferGeneration || 0)}:${key}:${entry.heroId}:${entry.earnedLevel}`;
  return { open: offer.status === 'offered', cards: offer.cards || [], heroUID: Number(hero?.uid || entry.heroUID || 0), queue: entry, offer, offerToken };
}

export function chooseSessionLevelUpBuff(globals, heroes = [], cardId, now = 0) {
  const presentation = getSessionLevelUpBuffPresentation(globals, heroes, globals.SessionLevelProgress || {});
  if (!presentation.open) return { status: 'rejected' };
  const applied = applyLevelUpBuffCard({ state: globals.SessionLevelBuffState, heroId: presentation.queue.heroId, cardId, cards: SESSION_LEVEL_UP_BUFF_CARDS });
  if (applied.status !== 'applied') return applied;
  globals.SessionLevelBuffState = applied.state;
  globals.SessionLevelUpQueue = acknowledgeSessionLevelUpEntry(globals.SessionLevelUpQueue);
  if (globals.SessionLevelUpQueue.status === 'complete' && globals.SessionLevelUpSettlement) { globals.SessionLevelUpSettlement.phase = 'fadeOut'; globals.SessionLevelUpSettlement.fadeOutStartedAt = Number(now || 0); }
  return applied;
}
