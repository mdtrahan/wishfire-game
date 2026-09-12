import { applyLevelUpBuffCard, buildLevelUpBuffOffer, createSessionLevelBuffState } from '../../src/core/sessionLevelBuffOffers.mjs';
import { heroDefinition } from '../src/core/heroDefinitions.mjs';
import { acknowledgeSessionLevelUpEntry, currentSessionLevelUpEntry } from '../src/core/sessionLevelUpQueue.mjs';

export const QA_LEVEL_UP_BUFF_CARDS = Object.freeze([
  { id: 'qa_atk_focus_1', cardId: 'qa_atk_focus_1', tier: 1, kind: 'stat', effectId: 'qa_atk_focus', stage: 1, name: 'ATK Focus', rarity: 'Common', effect: 'ATK +10%', formula: { surface: 'stat_percent', stat: 'atk', percent: 0.10 } },
  { id: 'qa_atk_focus_2', cardId: 'qa_atk_focus_2', tier: 2, kind: 'stat', effectId: 'qa_atk_focus', stage: 2, requiresStage: 1, replacesStage: 1, name: 'ATK Focus II', rarity: 'Uncommon', effect: 'ATK +18%', formula: { surface: 'stat_percent', stat: 'atk', percent: 0.18 } },
  { cardId: 'qa_max_vitality_1', tier: 1, kind: 'stat', effectId: 'qa_max_vitality', stage: 1, name: 'Max Vitality', rarity: 'Common', effect: 'Max HP +20%', formula: { surface: 'stat_percent', stat: 'max_hp', percent: 0.20 } },
  { cardId: 'qa_opening_shield_1', tier: 1, kind: 'behavior', effectId: 'qa_opening_shield', stage: 1, name: 'Crimson Ward', rarity: 'Common', effect: 'Start battle with a 25% Max HP shield', formula: { surface: 'shield_percent_max_hp', percent: 0.25 } },
  { id: 'qa_pulse_1', cardId: 'qa_pulse_1', tier: 1, kind: 'behavior', effectId: 'qa_pulse', stage: 1, name: 'Spectral Orb', rarity: 'Common', effect: 'Every 3 basics: 4 magic damage', formula: { surface: 'cadence_magic_damage', everyCompletedBasics: 3, amount: 4 } },
  { id: 'qa_pulse_2', cardId: 'qa_pulse_2', tier: 2, kind: 'behavior', effectId: 'qa_pulse', stage: 2, requiresStage: 1, replacesStage: 1, name: 'Spectral Orb II', rarity: 'Uncommon', effect: 'Every 2 basics: 6 magic damage', formula: { surface: 'cadence_magic_damage', everyCompletedBasics: 2, amount: 6 } },
  { cardId: 'qa_heal_on_basic_1', tier: 1, kind: 'behavior', effectId: 'qa_heal_on_basic', stage: 1, name: 'Inner Flow', rarity: 'Common', effect: '15%: heal 5% Max HP', formula: { surface: 'heal_percent_max_hp', chance: 0.15, percent: 0.05 } },
  { cardId: 'qa_status_on_basic_1', tier: 1, kind: 'behavior', effectId: 'qa_status_on_basic', stage: 1, name: 'Saffron Mark', rarity: 'Common', effect: '20%: Venom 3 damage for 2 turns', formula: { surface: 'status_on_basic', chance: 0.20, statusId: 'dot', durationTurns: 2, damagePerTurn: 3 } },
  { cardId: 'qa_bounce_1', tier: 1, kind: 'behavior', effectId: 'qa_bounce', stage: 1, name: 'Mirage Chain', rarity: 'Common', effect: '25%: bounce for 50% damage', formula: { surface: 'bounce_percent_damage', chance: 0.25, damagePercent: 0.50 } },
  { cardId: 'qa_counter_1', tier: 1, kind: 'behavior', effectId: 'qa_counter', stage: 1, name: 'Glass Reprisal', rarity: 'Common', effect: '20%: counter 40% ATK, heal 3%', formula: { surface: 'counter_percent_atk', chance: 0.20, damagePercent: 0.40, healPercentMaxHp: 0.03, maxPerDamagePackage: 1 } },
  { cardId: 'qa_speed_1', tier: 1, kind: 'stat', effectId: 'qa_speed', stage: 1, name: 'Swift Current', rarity: 'Common', effect: 'SPD +10%', formula: { surface: 'stat_percent', stat: 'spd', percent: 0.10 } },
  // These ungated same-tier stat fallbacks keep a real Tier 2 offer at three cards
  // while an upgraded behavior or stat is grant-gated for its owner.
  { cardId: 'qa_max_vitality_2', tier: 2, kind: 'stat', effectId: 'qa_max_vitality_2', stage: 1, name: 'Max Vitality II', rarity: 'Uncommon', effect: 'Max HP +20%', formula: { surface: 'stat_percent', stat: 'max_hp', percent: 0.20 } },
  { cardId: 'qa_speed_2', tier: 2, kind: 'stat', effectId: 'qa_speed_2', stage: 1, name: 'Swift Current II', rarity: 'Uncommon', effect: 'SPD +10%', formula: { surface: 'stat_percent', stat: 'spd', percent: 0.10 } },
  { cardId: 'qa_power_bargain_1', tier: 1, kind: 'bargain', effectId: 'qa_power_bargain', stage: 1, name: 'Sun Debt', rarity: 'Common', effect: 'ATK +15%, Max HP -10%', formula: { surface: 'bargain_percent', benefitStat: 'atk', benefitPercent: 0.15, penaltyStat: 'max_hp', penaltyPercent: -0.10 } },
].map(card => Object.freeze({ ...card, id: card.cardId })));

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
  return QA_LEVEL_UP_BUFF_CARDS.filter(card => Number(activeStages[card.effectId] || 0) === Number(card.stage || 0));
}

export function beginSessionLevelUpSettlement(globals, results = [], heroes = [], now = 0) {
  const byHero = new Map((heroes || []).map(hero => [heroId(hero), hero]));
  globals.SessionLevelBuffState ||= createSessionLevelBuffState();
  globals.SessionLevelUpOffersByQueueIndex = {};
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
  if (!offers[key]) offers[key] = buildLevelUpBuffOffer({ state: globals.SessionLevelBuffState || createSessionLevelBuffState(), heroId: entry.heroId, cards: QA_LEVEL_UP_BUFF_CARDS, progress, rng: globals.RuntimeRandom, tierWeights: tierWeightsFor(globals, progress), preferredCardId: globals.SessionLevelUpPreferredCardId });
  const offer = offers[key];
  const hero = heroes.find(candidate => heroId(candidate) === entry.heroId) || null;
  return { open: offer.status === 'offered', cards: offer.cards || [], heroUID: Number(hero?.uid || entry.heroUID || 0), queue: entry, offer };
}

export function chooseSessionLevelUpBuff(globals, heroes = [], cardId, now = 0) {
  const presentation = getSessionLevelUpBuffPresentation(globals, heroes, globals.SessionLevelProgress || {});
  if (!presentation.open) return { status: 'rejected' };
  const applied = applyLevelUpBuffCard({ state: globals.SessionLevelBuffState, heroId: presentation.queue.heroId, cardId, cards: QA_LEVEL_UP_BUFF_CARDS });
  if (applied.status !== 'applied') return applied;
  globals.SessionLevelBuffState = applied.state;
  globals.SessionLevelUpQueue = acknowledgeSessionLevelUpEntry(globals.SessionLevelUpQueue);
  if (globals.SessionLevelUpQueue.status === 'complete' && globals.SessionLevelUpSettlement) { globals.SessionLevelUpSettlement.phase = 'fadeOut'; globals.SessionLevelUpSettlement.fadeOutStartedAt = Number(now || 0); }
  return applied;
}
