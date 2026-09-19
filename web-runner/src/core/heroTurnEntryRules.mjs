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

export function heroTurnEntryFromJs(payload = {}) {
  const heroUID = nonNegativeInt(payload.heroUID);
  const currentHeroUIDBefore = nonNegativeInt(payload.currentHeroUIDBefore);
  const acceptHeroUID = heroUID > 0 ? 1 : 0;
  return {
    owner: 'fallback',
    turnPhase: HERO_TURN_PHASE,
    hideHeroSelector: 0,
    acceptHeroUID,
    currentHeroUIDAfter: acceptHeroUID ? heroUID : currentHeroUIDBefore,
  };
}

function ownerDecisionFromResult(result, jsDecision) {
  const acceptHeroUID = boolCode(result?.acceptHeroUID ?? jsDecision.acceptHeroUID);
  return {
    ...jsDecision,
    owner: String(result?.owner || 'rust'),
    turnPhase: Math.trunc(numberOr(result?.turnPhase, HERO_TURN_PHASE)),
    hideHeroSelector: boolCode(result?.hideHeroSelector ?? jsDecision.hideHeroSelector),
    acceptHeroUID,
    currentHeroUIDAfter: nonNegativeInt(result?.currentHeroUIDAfter ?? jsDecision.currentHeroUIDAfter),
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
