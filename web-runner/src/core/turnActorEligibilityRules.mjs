export const TURN_ACTOR_ELIGIBILITY_SKIP = 0;
export const TURN_ACTOR_ELIGIBILITY_ACT = 1;
export const TURN_ACTOR_ELIGIBILITY_HOLD = 2;

export function turnActorEligibilityCodeFromJs({
  turnType = -1,
  actorExists = 0,
  actorHp = 0,
  partyHp = 0,
  roundActive = 0,
  pendingGroupMatches = 0,
  blueBuffSequenceActive = 0,
} = {}) {
  const type = Number(turnType || 0);
  const isRoundPending = Number(roundActive || 0) === 1 && Number(pendingGroupMatches || 0) === 1;

  if (type === 0) {
    if (Number(actorExists || 0) !== 1) return TURN_ACTOR_ELIGIBILITY_SKIP;
    if (Number(partyHp || 0) > 0 || isRoundPending) return TURN_ACTOR_ELIGIBILITY_ACT;
    return TURN_ACTOR_ELIGIBILITY_SKIP;
  }

  if (type === 1) {
    if (Number(blueBuffSequenceActive || 0) === 1) return TURN_ACTOR_ELIGIBILITY_HOLD;
    if (Number(actorExists || 0) !== 1) return TURN_ACTOR_ELIGIBILITY_SKIP;
    if (Number(actorHp || 0) > 0 || isRoundPending) return TURN_ACTOR_ELIGIBILITY_ACT;
  }

  return TURN_ACTOR_ELIGIBILITY_SKIP;
}

export function turnActorEligibilityReasonFromCode(code = TURN_ACTOR_ELIGIBILITY_SKIP) {
  if (Number(code || 0) === TURN_ACTOR_ELIGIBILITY_ACT) return 'act';
  if (Number(code || 0) === TURN_ACTOR_ELIGIBILITY_HOLD) return 'hold';
  return 'skip';
}

export function resolveTurnActorEligibility({
  source = 'unknown',
  turnType = -1,
  actorExists = 0,
  actorHp = 0,
  partyHp = 0,
  roundActive = 0,
  pendingGroupMatches = 0,
  blueBuffSequenceActive = 0,
  ownerHook = null,
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    turnType: Number(turnType || 0),
    actorExists: Number(actorExists || 0),
    actorHp: Number(actorHp || 0),
    partyHp: Number(partyHp || 0),
    roundActive: Number(roundActive || 0) ? 1 : 0,
    pendingGroupMatches: Number(pendingGroupMatches || 0) ? 1 : 0,
    blueBuffSequenceActive: Number(blueBuffSequenceActive || 0) ? 1 : 0,
  };
  const jsCode = turnActorEligibilityCodeFromJs(normalized);
  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({ ...normalized, jsCode });
      const code = Number(result?.code);
      if (Number.isFinite(code)) {
        return {
          owner: String(result?.owner || 'rust'),
          code,
          reason: turnActorEligibilityReasonFromCode(code),
          jsCode,
        };
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable or unhealthy.
    }
  }
  return {
    owner: 'fallback',
    code: jsCode,
    reason: turnActorEligibilityReasonFromCode(jsCode),
    jsCode,
  };
}
