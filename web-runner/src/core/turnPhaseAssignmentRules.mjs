function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

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

function normalizeTurnTypeCode(value) {
  return Number(value || 0) === 0 ? 0 : 1;
}

export function turnPhaseAssignmentResultFromPhase(turnPhase = 0) {
  if (Number(turnPhase || 0) === 0) return 'hero_turn';
  if (Number(turnPhase || 0) === 2) return 'enemy_turn';
  return `turn_phase_${Math.trunc(Number(turnPhase || 0))}`;
}

export function turnPhaseFromJs(input = {}) {
  const payload = input && typeof input === 'object' ? input : {};
  const turnType = hasOwn(payload, 'turnType') ? payload.turnType : 0;
  const turnTypeCode = hasOwn(payload, 'turnTypeCode')
    ? normalizeTurnTypeCode(payload.turnTypeCode)
    : (turnType === 0 ? 0 : 1);

  return {
    owner: 'fallback',
    turnTypeCode,
    turnPhase: turnTypeCode === 0 ? 0 : 2,
  };
}

export function resolveTurnPhaseAssignment(input = {}) {
  const payload = input && typeof input === 'object' ? input : {};
  const source = hasOwn(payload, 'source') ? payload.source : 'unknown';
  const turnType = hasOwn(payload, 'turnType') ? payload.turnType : 0;
  const ownerHook = hasOwn(payload, 'ownerHook') ? payload.ownerHook : null;
  const jsDecision = turnPhaseFromJs({ turnType });
  const normalized = {
    source: String(source || 'unknown'),
    turnTypeCode: jsDecision.turnTypeCode,
  };

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsTurnPhase: jsDecision.turnPhase,
      });
      const turnPhase = Number(result?.turnPhase);
      if (Number.isFinite(turnPhase)) {
        return {
          owner: String(result?.owner || 'rust'),
          turnTypeCode: normalized.turnTypeCode,
          turnPhase,
          jsDecision,
        };
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

export function createTurnPhaseAssignmentSimulationPacket({
  source = 'unknown',
  turnType = 0,
  ownerHook = null,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
} = {}) {
  const jsDecision = turnPhaseFromJs({ turnType });
  const normalized = {
    source: String(source || 'unknown'),
    turnTypeCode: jsDecision.turnTypeCode,
  };
  const action = {
    type: 'turn.phaseAssignment',
    ...normalized,
  };
  const requestContext = {
    ruleFamily: 'turnPhaseAssignment',
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
  const decision = resolveTurnPhaseAssignment({
    source: normalized.source,
    turnType: normalized.turnTypeCode,
    ownerHook,
  });
  const sourceGameState = request && request.gameState ? request.gameState : gameState;
  const nextGameState = {
    ...clonePacketJson(sourceGameState, {}),
    turnState: {
      ...clonePacketJson(sourceGameState?.turnState, {}),
      turnTypeCode: Number(decision.turnTypeCode || 0),
      turnPhase: Number(decision.turnPhase || 0),
    },
  };
  const response = createFallbackSimulationCoreResponse({
    nextGameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: turnPhaseAssignmentResultFromPhase(decision.turnPhase),
    diagnostics: {
      ruleFamily: 'turnPhaseAssignment',
      owner: decision.owner,
      source: normalized.source,
      turnTypeCode: Number(decision.turnTypeCode || 0),
      turnPhase: Number(decision.turnPhase || 0),
      jsTurnPhase: Number(decision.jsDecision?.turnPhase ?? decision.turnPhase ?? 0),
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
