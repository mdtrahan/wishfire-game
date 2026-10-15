import { heroDefinition } from '../src/core/heroDefinitions.mjs';

// Level-up EXP remains a visible settlement. Combat card offers were retired;
// milestone skill rewards will use their own future presentation contract.
export const LOW_HP_WARNING_RATIO = 0.25;
const EXP_FILL_SECONDS = 0.48;
const EXP_RESET_SECONDS = 0.08;
const LEVEL_UP_DANCE_SECONDS = 0.38;

const heroId = hero => String(hero?.heroInstanceKey ?? hero?.uid ?? '');
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export function beginSessionLevelUpSettlement(globals, results = [], heroes = [], now = 0) {
  const byHero = new Map((heroes || []).map(hero => [heroId(hero), hero]));
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

export function updateSessionLevelUpSettlement(globals, now = 0) {
  const settlement = globals?.SessionLevelUpSettlement;
  if (!settlement) return null;
  const elapsed = Math.max(0, Number(now || 0) - Number(settlement.phase === 'fadeOut' ? settlement.fadeOutStartedAt : settlement.startedAt));
  if (settlement.phase === 'fadeIn' && elapsed >= 0.18) settlement.phase = 'active';
  if (settlement.phase === 'active' && (settlement.rows || []).every(row => settlementRowVisual(row, now, settlement).complete)) {
    settlement.phase = 'fadeOut';
    settlement.fadeOutStartedAt = Number(now || 0);
  }
  if (settlement.phase === 'fadeOut' && elapsed >= 0.22) { delete globals.SessionLevelUpSettlement; return null; }
  return settlement;
}
