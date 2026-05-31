const SIMULATION_CORE_CONTRACT_VERSION = 1;
const SIMULATION_CORE_BASELINE_ID = 'main@5364ede23e3160fadb1a6ac9bf940c57bdd15f87';

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

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

export function effectiveStatFromJs({
  base = 0,
  partyBuff = 0,
  enemyDebuff = 0,
  isHero = 0,
  isEnemy = 0,
} = {}) {
  let value = numberOr(base, 0);
  if (Number(isHero || 0) === 1) {
    value += numberOr(partyBuff, 0);
  } else if (Number(isEnemy || 0) === 1) {
    value -= numberOr(enemyDebuff, 0);
  }
  return Math.max(0, value);
}

function normalizeEffectiveStatInput({
  source = 'unknown',
  uid = 0,
  stat = '',
  actorKind = '',
  base = 0,
  partyBuff = 0,
  enemyDebuff = 0,
  isHero = 0,
  isEnemy = 0,
} = {}) {
  return {
    source: String(source || 'unknown'),
    uid: numberOr(uid, 0),
    stat: String(stat || '').toUpperCase(),
    actorKind: String(actorKind || ''),
    base: numberOr(base, 0),
    partyBuff: numberOr(partyBuff, 0),
    enemyDebuff: numberOr(enemyDebuff, 0),
    isHero: Number(isHero || 0) === 1 ? 1 : 0,
    isEnemy: Number(isEnemy || 0) === 1 ? 1 : 0,
  };
}

export function resolveEffectiveStat({
  ownerHook = null,
  ...input
} = {}) {
  const normalized = normalizeEffectiveStatInput(input);
  const jsValue = effectiveStatFromJs(normalized);
  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsValue,
      });
      const value = Number(result?.value);
      if (Number.isFinite(value)) {
        return {
          owner: String(result?.owner || 'rust'),
          value,
          jsValue,
        };
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable.
    }
  }
  return {
    owner: 'fallback',
    value: jsValue,
    jsValue,
  };
}

export function createEffectiveStatSimulationPacket({
  ownerHook = null,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
  ...input
} = {}) {
  const normalized = normalizeEffectiveStatInput(input);
  const action = {
    type: 'combat.effectiveStat',
    ...normalized,
  };
  const requestContext = {
    ruleFamily: 'effectiveStat',
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
  const decision = resolveEffectiveStat({
    ...normalized,
    ownerHook,
  });
  const sourceGameState = request && request.gameState ? request.gameState : gameState;
  const nextGameState = {
    ...clonePacketJson(sourceGameState, {}),
    combat: {
      ...clonePacketJson(sourceGameState?.combat, {}),
      lastEffectiveStat: {
        uid: normalized.uid,
        stat: normalized.stat,
        actorKind: normalized.actorKind,
        owner: String(decision.owner || 'fallback'),
        value: Number(decision.value || 0),
      },
    },
  };
  const response = createFallbackSimulationCoreResponse({
    nextGameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: 'effective_stat',
    diagnostics: {
      ruleFamily: 'effectiveStat',
      owner: decision.owner,
      ...normalized,
      value: Number(decision.value || 0),
      jsValue: Number(decision.jsValue || 0),
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
