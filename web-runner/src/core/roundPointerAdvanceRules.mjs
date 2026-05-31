export const ROUND_POINTER_CONTINUE_MEMBER = 0;
export const ROUND_POINTER_COMPLETE_GROUP = 1;
export const ROUND_POINTER_COMPLETE_ROUND = 2;

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

function phaseType(value = 0) {
  return Number(value || 0) === 1 ? 1 : 0;
}

export function roundPointerAdvanceResultFromCode(code = ROUND_POINTER_CONTINUE_MEMBER) {
  if (Number(code || 0) === ROUND_POINTER_COMPLETE_ROUND) return 'complete_round';
  if (Number(code || 0) === ROUND_POINTER_COMPLETE_GROUP) return 'complete_group';
  return 'continue_member';
}

export function roundPointerAdvanceFromJs({
  roundMemberIndex = 0,
  groupMemberCount = 0,
  roundGroupIndex = 0,
  groupCount = 0,
  teamPhaseType = 0,
} = {}) {
  const nextMemberIndex = Math.max(0, Math.trunc(numberOr(roundMemberIndex, 0))) + 1;
  const memberCount = Math.max(0, Math.trunc(numberOr(groupMemberCount, 0)));
  const currentGroupIndex = Math.max(0, Math.trunc(numberOr(roundGroupIndex, 0)));
  const totalGroups = Math.max(0, Math.trunc(numberOr(groupCount, 0)));
  const nextGroupIndex = currentGroupIndex + 1;
  const groupComplete = nextMemberIndex >= memberCount ? 1 : 0;
  const roundComplete = groupComplete && nextGroupIndex >= totalGroups ? 1 : 0;
  const code = roundComplete
    ? ROUND_POINTER_COMPLETE_ROUND
    : (groupComplete ? ROUND_POINTER_COMPLETE_GROUP : ROUND_POINTER_CONTINUE_MEMBER);

  return {
    owner: 'fallback',
    code,
    nextMemberIndex,
    groupComplete,
    nextGroupIndex,
    roundComplete,
    nextTeamPhaseType: phaseType(teamPhaseType) === 1 ? 0 : 1,
  };
}

export function resolveRoundPointerAdvance({
  source = 'unknown',
  roundMemberIndex = 0,
  groupMemberCount = 0,
  roundGroupIndex = 0,
  groupCount = 0,
  teamPhaseType = 0,
  ownerHook = null,
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    roundMemberIndex: Math.max(0, Math.trunc(numberOr(roundMemberIndex, 0))),
    groupMemberCount: Math.max(0, Math.trunc(numberOr(groupMemberCount, 0))),
    roundGroupIndex: Math.max(0, Math.trunc(numberOr(roundGroupIndex, 0))),
    groupCount: Math.max(0, Math.trunc(numberOr(groupCount, 0))),
    teamPhaseType: phaseType(teamPhaseType),
  };
  const jsDecision = roundPointerAdvanceFromJs(normalized);

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsCode: jsDecision.code,
        jsNextMemberIndex: jsDecision.nextMemberIndex,
        jsGroupComplete: jsDecision.groupComplete,
        jsNextGroupIndex: jsDecision.nextGroupIndex,
        jsRoundComplete: jsDecision.roundComplete,
        jsNextTeamPhaseType: jsDecision.nextTeamPhaseType,
      });
      const code = Number(result?.code);
      const nextMemberIndex = Number(result?.nextMemberIndex);
      if (Number.isFinite(code) && Number.isFinite(nextMemberIndex)) {
        return {
          owner: String(result?.owner || 'rust'),
          code,
          nextMemberIndex,
          groupComplete: Number(result?.groupComplete || 0) ? 1 : 0,
          nextGroupIndex: Math.max(0, Math.trunc(numberOr(result?.nextGroupIndex, 0))),
          roundComplete: Number(result?.roundComplete || 0) ? 1 : 0,
          nextTeamPhaseType: phaseType(result?.nextTeamPhaseType),
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

export function createRoundPointerAdvanceSimulationPacket({
  source = 'unknown',
  roundMemberIndex = 0,
  groupMemberCount = 0,
  roundGroupIndex = 0,
  groupCount = 0,
  teamPhaseType = 0,
  ownerHook = null,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    roundMemberIndex: Math.max(0, Math.trunc(numberOr(roundMemberIndex, 0))),
    groupMemberCount: Math.max(0, Math.trunc(numberOr(groupMemberCount, 0))),
    roundGroupIndex: Math.max(0, Math.trunc(numberOr(roundGroupIndex, 0))),
    groupCount: Math.max(0, Math.trunc(numberOr(groupCount, 0))),
    teamPhaseType: phaseType(teamPhaseType),
  };
  const action = {
    type: 'turn.roundPointerAdvance',
    ...normalized,
  };
  const requestContext = {
    ruleFamily: 'roundPointerAdvance',
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
  const decision = resolveRoundPointerAdvance({
    ...normalized,
    ownerHook,
  });
  const sourceGameState = request && request.gameState ? request.gameState : gameState;
  const nextGameState = {
    ...clonePacketJson(sourceGameState, {}),
    turnState: {
      ...clonePacketJson(sourceGameState?.turnState, {}),
      roundMemberIndex: Number(decision.nextMemberIndex || 0),
      roundGroupIndex: Number(decision.nextGroupIndex || 0),
      teamPhaseType: Number(decision.nextTeamPhaseType || 0),
      groupComplete: Number(decision.groupComplete || 0),
      roundComplete: Number(decision.roundComplete || 0),
    },
  };
  const response = createFallbackSimulationCoreResponse({
    nextGameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: roundPointerAdvanceResultFromCode(decision.code),
    diagnostics: {
      ruleFamily: 'roundPointerAdvance',
      owner: decision.owner,
      code: Number(decision.code || 0),
      jsCode: Number(decision.jsDecision?.code ?? decision.code ?? 0),
      source: normalized.source,
      roundMemberIndex: normalized.roundMemberIndex,
      groupMemberCount: normalized.groupMemberCount,
      roundGroupIndex: normalized.roundGroupIndex,
      groupCount: normalized.groupCount,
      teamPhaseType: normalized.teamPhaseType,
      nextMemberIndex: Number(decision.nextMemberIndex || 0),
      nextGroupIndex: Number(decision.nextGroupIndex || 0),
      nextTeamPhaseType: Number(decision.nextTeamPhaseType || 0),
      groupComplete: Number(decision.groupComplete || 0),
      roundComplete: Number(decision.roundComplete || 0),
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
