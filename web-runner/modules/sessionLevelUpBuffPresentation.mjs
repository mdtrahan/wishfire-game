import { applyLevelUpBuffCard, buildLevelUpBuffOffer, createSessionLevelBuffState } from '../../src/core/sessionLevelBuffOffers.mjs';
import { SESSION_LEVEL_UP_BUFF_CARDS, UNIVERSAL_SESSION_POWER_BUFF_CARDS, isUniversalSessionPowerBuffCard } from '../../src/core/sessionLevelBuffCatalog.mjs';
import { buildAstralFlowSpecialOffer } from '../../src/core/astralFlowSpecialOffers.mjs';
import { heroDefinition } from '../src/core/heroDefinitions.mjs';
import { acknowledgeSessionLevelUpEntry, createSessionOpeningBuffQueue, currentSessionLevelUpEntry, enqueueSessionFlowThresholds, isSessionFlowThresholdEntry } from '../src/core/sessionLevelUpQueue.mjs';

export { SESSION_LEVEL_UP_BUFF_CARDS };
export const QA_LEVEL_UP_BUFF_CARDS = SESSION_LEVEL_UP_BUFF_CARDS;

export const LOW_HP_WARNING_RATIO = 0.25;
const EXP_FILL_SECONDS = 0.48;
const EXP_RESET_SECONDS = 0.08;
const LEVEL_UP_DANCE_SECONDS = 0.38;
const DEFAULT_TIER_WEIGHTS = Object.freeze({ 1: 70, 2: 20, 3: 7, 4: 3 });

const heroId = hero => String(hero?.heroInstanceKey ?? hero?.uid ?? '');
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const isPowerBuffCard = isUniversalSessionPowerBuffCard;

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
  return UNIVERSAL_SESSION_POWER_BUFF_CARDS.filter(card => Number(activeStages[card.effectId] || 0) === Number(card.stage || 0));
}

export function beginFreshSessionBuffQueue(globals, heroes = []) {
  globals.SessionLevelBuffState = createSessionLevelBuffState();
  globals.SessionLevelUpOffersByQueueIndex = {};
  globals.SessionLevelUpOfferGeneration = Number(globals.SessionLevelUpOfferGeneration || 0) + 1;
  globals.SessionLevelUpSettlement = null;
  globals.PendingFlowThresholds = [];
  globals.SessionLevelUpQueue = createSessionOpeningBuffQueue({ heroes });
  return globals.SessionLevelUpQueue;
}

export function reconcileSessionFlowThresholds(globals, heroes = []) {
  const pending = Array.isArray(globals?.PendingFlowThresholds) ? globals.PendingFlowThresholds : [];
  if (!pending.length) return globals?.SessionLevelUpQueue || null;
  const queue = enqueueSessionFlowThresholds(globals.SessionLevelUpQueue || {}, { heroes, thresholds: pending });
  globals.SessionLevelUpQueue = queue;
  return queue;
}

export function serializeSessionBuffChoiceState(globals = {}) {
  return JSON.parse(JSON.stringify({
    SessionLevelBuffState: globals.SessionLevelBuffState || createSessionLevelBuffState(),
    SessionLevelUpQueue: globals.SessionLevelUpQueue || null,
    SessionLevelUpOffersByQueueIndex: globals.SessionLevelUpOffersByQueueIndex || {},
    SessionLevelUpOfferGeneration: Number(globals.SessionLevelUpOfferGeneration || 0),
    SessionLevelUpQueueResumeRequested: Number(globals.SessionLevelUpQueueResumeRequested || 0) ? 1 : 0,
    PendingFlowThresholds: globals.PendingFlowThresholds || [],
    CombatSessionId: Number(globals.CombatSessionId || 0),
    CurrentTurnIndex: Number(globals.CurrentTurnIndex || 0),
    TurnSerial: Number(globals.TurnSerial || 0),
    TurnPhase: Number(globals.TurnPhase || 0),
    RuntimeRandomSeed: Number(globals.RuntimeRandomSeed || 0),
    RuntimeRandomDraws: Number(globals.RuntimeRandomDraws || 0),
    RuntimeRandomOwner: String(globals.RuntimeRandomOwner || ''),
    RuntimeRandomReason: String(globals.RuntimeRandomReason || ''),
  }));
}

export function restoreSessionBuffChoiceState(globals, snapshot = {}) {
  const restored = serializeSessionBuffChoiceState(snapshot);
  Object.assign(globals, restored);
  return restored;
}

export function claimSessionBuffQueueResume(globals = {}) {
  if (!globals.SessionLevelUpQueueResumeRequested || globals.SessionLevelUpQueue?.status !== 'complete' || globals.SessionLevelUpSettlement) return false;
  globals.SessionLevelUpQueueResumeRequested = 0;
  globals.SessionLevelUpQueueResumeConsumed = Number(globals.SessionLevelUpQueueResumeConsumed || 0) + 1;
  return true;
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
  reconcileSessionFlowThresholds(globals, heroes);
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
  const hero = heroes.find(candidate => heroId(candidate) === entry.heroId) || null;
  const offerCards = (Array.isArray(globals?.SessionLevelUpQaOfferCards) ? globals.SessionLevelUpQaOfferCards : UNIVERSAL_SESSION_POWER_BUFF_CARDS)
    .filter(isPowerBuffCard);
  if (!offers[key]) {
    offers[key] = isSessionFlowThresholdEntry(entry)
      ? buildAstralFlowSpecialOffer({ hero, rng: globals.RuntimeRandom, preferredSpecialId: globals.QaPreferredAstralFlowSpecialId })
      : buildLevelUpBuffOffer({ state: globals.SessionLevelBuffState || createSessionLevelBuffState(), heroId: entry.heroId, cards: offerCards, progress, rng: globals.RuntimeRandom, tierWeights: tierWeightsFor(globals, progress), preferredCardId: globals.SessionLevelUpPreferredCardId });
  }
  const offer = offers[key];
  const offerToken = `${Number(globals.SessionLevelUpOfferGeneration || 0)}:${key}:${entry.heroId}:${entry.earnedLevel}`;
  return { open: offer.status === 'offered', cards: offer.cards || [], heroUID: Number(hero?.uid || entry.heroUID || 0), queue: entry, offer, offerToken };
}

export function chooseSessionLevelUpBuff(globals, heroes = [], cardId, now = 0, executeSpecial = null) {
  const presentation = getSessionLevelUpBuffPresentation(globals, heroes, globals.SessionLevelProgress || {});
  if (!presentation.open) return { status: 'rejected' };
  if (isSessionFlowThresholdEntry(presentation.queue)) {
    const card = presentation.cards.find(candidate => String(candidate?.cardId || '') === String(cardId || '')) || null;
    const hero = heroes.find(candidate => Number(candidate?.uid || 0) === Number(presentation.queue.heroUID || 0)
      || heroId(candidate) === String(presentation.queue.heroId));
    if (!card || !hero || Number(hero.hp || 0) <= 0) return { status: 'rejected', reason: card ? 'ownerUnavailable' : 'ineligibleCard' };
    const result = typeof executeSpecial === 'function'
      ? executeSpecial(card, hero)
      : { ok: true, deferred: true };
    if (!result || result.ok === false) return { status: 'rejected', reason: String(result?.reason || 'specialRejected') };
    hero.flow = 0;
    globals.PendingFlowThresholds = (globals.PendingFlowThresholds || [])
      .filter(signal => String(signal?.token || '') !== String(presentation.queue.thresholdToken));
    globals.SessionLevelUpQueue = acknowledgeSessionLevelUpEntry(globals.SessionLevelUpQueue);
    if (globals.SessionLevelUpQueue.status === 'complete') globals.SessionLevelUpQueueResumeRequested = 1;
    return { status: 'applied', card, special: true, execution: result };
  }
  const applied = applyLevelUpBuffCard({ state: globals.SessionLevelBuffState, heroId: presentation.queue.heroId, cardId, cards: UNIVERSAL_SESSION_POWER_BUFF_CARDS });
  if (applied.status !== 'applied') return applied;
  globals.SessionLevelBuffState = applied.state;
  globals.SessionLevelUpQueue = acknowledgeSessionLevelUpEntry(globals.SessionLevelUpQueue);
  if (globals.SessionLevelUpQueue.status === 'complete') globals.SessionLevelUpQueueResumeRequested = 1;
  if (globals.SessionLevelUpQueue.status === 'complete' && globals.SessionLevelUpSettlement) { globals.SessionLevelUpSettlement.phase = 'fadeOut'; globals.SessionLevelUpSettlement.fadeOutStartedAt = Number(now || 0); }
  return applied;
}
