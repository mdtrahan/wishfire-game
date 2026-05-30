export const HERO_TURN_PHASE = 0;

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function nonNegativeInt(value) {
  return Math.max(0, Math.floor(numberOr(value, 0)));
}

function boolCode(value) {
  return Number(value || 0) ? 1 : 0;
}

function shouldResetAstralFlowAmp({
  skillDraughtOpen = 0,
  astralFlowAmpReady = 0,
  astralFlowAmpPoints = 0,
  astralFlowAmpMax = 18,
  time = 0,
  combatActionPinnedUntil = 0,
} = {}) {
  if (boolCode(skillDraughtOpen)) return 0;
  if (!boolCode(astralFlowAmpReady)) return 0;
  const ampMax = Math.max(1, numberOr(astralFlowAmpMax || 18, 18));
  if (Math.max(0, numberOr(astralFlowAmpPoints, 0)) < ampMax) return 0;
  return numberOr(time, 0) >= numberOr(combatActionPinnedUntil, 0) ? 1 : 0;
}

export function heroTurnEntryFromJs(payload = {}) {
  const heroUID = nonNegativeInt(payload.heroUID);
  const currentHeroUIDBefore = nonNegativeInt(payload.currentHeroUIDBefore);
  const shouldReset = shouldResetAstralFlowAmp(payload);
  const acceptHeroUID = heroUID > 0 ? 1 : 0;
  return {
    owner: 'fallback',
    turnPhase: HERO_TURN_PHASE,
    hideHeroSelector: 0,
    acceptHeroUID,
    currentHeroUIDAfter: acceptHeroUID ? heroUID : currentHeroUIDBefore,
    shouldResetAstralFlowAmp: shouldReset,
    astralFlowAmpPointsAfter: shouldReset ? 0 : Math.max(0, numberOr(payload.astralFlowAmpPoints, 0)),
    astralFlowAmpReadyAfter: shouldReset ? 0 : boolCode(payload.astralFlowAmpReady),
    clearCombatActionPinned: shouldReset,
  };
}

function ownerDecisionFromResult(result, jsDecision) {
  const shouldReset = boolCode(result?.shouldResetAstralFlowAmp ?? jsDecision.shouldResetAstralFlowAmp);
  const acceptHeroUID = boolCode(result?.acceptHeroUID ?? jsDecision.acceptHeroUID);
  return {
    ...jsDecision,
    owner: String(result?.owner || 'rust'),
    turnPhase: Math.trunc(numberOr(result?.turnPhase, HERO_TURN_PHASE)),
    hideHeroSelector: boolCode(result?.hideHeroSelector ?? jsDecision.hideHeroSelector),
    acceptHeroUID,
    currentHeroUIDAfter: nonNegativeInt(result?.currentHeroUIDAfter ?? jsDecision.currentHeroUIDAfter),
    shouldResetAstralFlowAmp: shouldReset,
    astralFlowAmpPointsAfter: shouldReset ? 0 : Math.max(0, numberOr(result?.astralFlowAmpPointsAfter, jsDecision.astralFlowAmpPointsAfter)),
    astralFlowAmpReadyAfter: shouldReset ? 0 : boolCode(result?.astralFlowAmpReadyAfter ?? jsDecision.astralFlowAmpReadyAfter),
    clearCombatActionPinned: boolCode(result?.clearCombatActionPinned ?? shouldReset),
    jsDecision,
  };
}

export function resolveHeroTurnEntry({
  source = 'unknown',
  ownerHook = null,
  ...payload
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    heroUID: nonNegativeInt(payload.heroUID),
    currentHeroUIDBefore: nonNegativeInt(payload.currentHeroUIDBefore),
    skillDraughtOpen: boolCode(payload.skillDraughtOpen),
    astralFlowAmpPoints: Math.max(0, numberOr(payload.astralFlowAmpPoints, 0)),
    astralFlowAmpMax: Math.max(1, numberOr(payload.astralFlowAmpMax || 18, 18)),
    astralFlowAmpReady: boolCode(payload.astralFlowAmpReady),
    time: numberOr(payload.time, 0),
    combatActionPinnedUntil: numberOr(payload.combatActionPinnedUntil, 0),
  };
  const jsDecision = heroTurnEntryFromJs(normalized);

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsTurnPhase: jsDecision.turnPhase,
        jsHideHeroSelector: jsDecision.hideHeroSelector,
        jsAcceptHeroUID: jsDecision.acceptHeroUID,
        jsCurrentHeroUIDAfter: jsDecision.currentHeroUIDAfter,
        jsShouldResetAstralFlowAmp: jsDecision.shouldResetAstralFlowAmp,
        jsAstralFlowAmpPointsAfter: jsDecision.astralFlowAmpPointsAfter,
        jsAstralFlowAmpReadyAfter: jsDecision.astralFlowAmpReadyAfter,
        jsClearCombatActionPinned: jsDecision.clearCombatActionPinned,
      });
      if (Number.isFinite(Number(result?.turnPhase))) {
        return ownerDecisionFromResult(result, jsDecision);
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable or unhealthy.
    }
  }

  return {
    ...jsDecision,
    jsDecision,
  };
}
