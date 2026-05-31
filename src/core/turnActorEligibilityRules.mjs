export const TURN_ACTOR_ELIGIBILITY_SKIP = 0;
export const TURN_ACTOR_ELIGIBILITY_ACT = 1;
export const TURN_ACTOR_ELIGIBILITY_HOLD = 2;

const SIMULATION_CORE_CONTRACT_VERSION = 1;
const SIMULATION_CORE_BASELINE_ID = 'main@5364ede23e3160fadb1a6ac9bf940c57bdd15f87';

function clonePacketJson(value, fallback) {
  const source = value == null ? fallback : value;
  const json = JSON.stringify(source);
  if (typeof json !== 'string') return fallback;
  return JSON.parse(json);
}

function createFallbackSimulationCoreRequest({
  gameState = {},
  action = {},
  rngState = {},
  context = {},
} = {}) {
  return {
    contractVersion: SIMULATION_CORE_CONTRACT_VERSION,
    baselineId: SIMULATION_CORE_BASELINE_ID,
    gameState: clonePacketJson(gameState, {}),
    action: clonePacketJson(action, { type: 'unknown' }),
    rngState: clonePacketJson(rngState, {}),
    context: clonePacketJson(context, {}),
  };
}

function createFallbackSimulationCoreResponse({
  nextGameState = {},
  events = [],
  rngState = {},
  result = 'continue',
  diagnostics = {},
} = {}) {
  return {
    contractVersion: SIMULATION_CORE_CONTRACT_VERSION,
    nextGameState: clonePacketJson(nextGameState, {}),
    events: Array.isArray(events) ? clonePacketJson(events, []) : [],
    rngState: clonePacketJson(rngState, {}),
    result: String(result || 'continue'),
    diagnostics: clonePacketJson(diagnostics, {}),
  };
}

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function flag(value = 0) {
  return Number(value || 0) ? 1 : 0;
}

function normalizeTurnActorEligibilityInput({
  source = 'unknown',
  turnType = -1,
  actorExists = 0,
  actorHp = 0,
  partyHp = 0,
  roundActive = 0,
  pendingGroupMatches = 0,
  blueBuffSequenceActive = 0,
} = {}) {
  return {
    source: String(source || 'unknown'),
    turnType: Math.trunc(numberOr(turnType, 0)),
    actorExists: flag(actorExists),
    actorHp: numberOr(actorHp, 0),
    partyHp: numberOr(partyHp, 0),
    roundActive: flag(roundActive),
    pendingGroupMatches: flag(pendingGroupMatches),
    blueBuffSequenceActive: flag(blueBuffSequenceActive),
  };
}

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

export function turnActorEligibilityResultFromCode(code = TURN_ACTOR_ELIGIBILITY_SKIP) {
  return turnActorEligibilityReasonFromCode(code);
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
  const normalized = normalizeTurnActorEligibilityInput({
    source,
    turnType,
    actorExists,
    actorHp,
    partyHp,
    roundActive,
    pendingGroupMatches,
    blueBuffSequenceActive,
  });
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

export function createTurnActorEligibilitySimulationPacket({
  source = 'unknown',
  turnType = -1,
  actorExists = 0,
  actorHp = 0,
  partyHp = 0,
  roundActive = 0,
  pendingGroupMatches = 0,
  blueBuffSequenceActive = 0,
  ownerHook = null,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
} = {}) {
  const normalized = normalizeTurnActorEligibilityInput({
    source,
    turnType,
    actorExists,
    actorHp,
    partyHp,
    roundActive,
    pendingGroupMatches,
    blueBuffSequenceActive,
  });
  const action = {
    type: 'turn.actorEligibility',
    ...normalized,
  };
  const requestContext = {
    ruleFamily: 'turnActorEligibility',
    owner: 'rust',
    ...context,
  };
  const request = typeof requestFactory === 'function'
    ? requestFactory(action, requestContext)
    : createFallbackSimulationCoreRequest({
      gameState,
      action,
      rngState,
      context: requestContext,
    });
  const decision = resolveTurnActorEligibility({
    ...normalized,
    ownerHook,
  });
  const sourceGameState = request && request.gameState ? request.gameState : gameState;
  const nextGameState = {
    ...clonePacketJson(sourceGameState, {}),
    turnState: {
      ...clonePacketJson(sourceGameState?.turnState, {}),
      turnType: normalized.turnType,
      actorEligibilityCode: Number(decision.code || 0),
      actorEligibilityReason: turnActorEligibilityReasonFromCode(decision.code),
      actorEligibilityOwner: String(decision.owner || 'fallback'),
    },
  };
  const response = createFallbackSimulationCoreResponse({
    nextGameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: turnActorEligibilityResultFromCode(decision.code),
    diagnostics: {
      ruleFamily: 'turnActorEligibility',
      owner: decision.owner,
      source: normalized.source,
      turnType: normalized.turnType,
      actorExists: normalized.actorExists,
      actorHp: normalized.actorHp,
      partyHp: normalized.partyHp,
      roundActive: normalized.roundActive,
      pendingGroupMatches: normalized.pendingGroupMatches,
      blueBuffSequenceActive: normalized.blueBuffSequenceActive,
      code: Number(decision.code || 0),
      jsCode: Number(decision.jsCode ?? decision.code ?? 0),
      reason: turnActorEligibilityReasonFromCode(decision.code),
    },
  });
  const appliedResponse = typeof responseApplier === 'function'
    ? responseApplier(response)
    : response;
  return {
    ...decision,
    simulationCoreRequest: request,
    simulationCoreResponse: appliedResponse,
  };
}
