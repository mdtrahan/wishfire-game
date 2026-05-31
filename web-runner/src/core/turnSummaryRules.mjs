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

function clampCount(value = 0) {
  return Math.max(0, Math.min(4, Math.floor(numberOr(value, 0))));
}

function normalizeHpSlots(values = []) {
  const source = Array.isArray(values) ? values : [];
  return [0, 1, 2, 3].map((index) => numberOr(source[index], 0));
}

function aliveCount(count, hpValues) {
  return hpValues
    .slice(0, clampCount(count))
    .filter((hp) => Number(hp || 0) > 0)
    .length;
}

export function normalizeTurnSummaryInput({
  source = 'unknown',
  heroCount = 0,
  heroHp = [],
  enemyCount = 0,
  enemyHp = [],
} = {}) {
  return {
    source: String(source || 'unknown'),
    heroCount: clampCount(heroCount),
    heroHp: normalizeHpSlots(heroHp),
    enemyCount: clampCount(enemyCount),
    enemyHp: normalizeHpSlots(enemyHp),
  };
}

export function turnSummaryFromJs(input = {}) {
  const normalized = normalizeTurnSummaryInput(input);
  const heroAlive = aliveCount(normalized.heroCount, normalized.heroHp);
  const enemyAlive = aliveCount(normalized.enemyCount, normalized.enemyHp);
  const heroDefeated = Math.max(0, normalized.heroCount - heroAlive);
  const enemyDefeated = Math.max(0, normalized.enemyCount - enemyAlive);
  const partyDefeated = normalized.heroCount > 0 && heroAlive === 0 ? 1 : 0;
  const enemiesDefeated = enemyAlive === 0 ? 1 : 0;

  return {
    owner: 'fallback',
    heroAlive,
    heroDefeated,
    enemyAlive,
    enemyDefeated,
    partyDefeated,
    enemiesDefeated,
    code: (heroAlive * 100000)
      + (heroDefeated * 10000)
      + (enemyAlive * 1000)
      + (enemyDefeated * 100)
      + (partyDefeated * 10)
      + enemiesDefeated,
  };
}

export function turnSummaryFromCode(code = 0) {
  const normalized = Math.max(0, Math.trunc(numberOr(code, 0)));
  return {
    heroAlive: Math.floor(normalized / 100000) % 10,
    heroDefeated: Math.floor(normalized / 10000) % 10,
    enemyAlive: Math.floor(normalized / 1000) % 10,
    enemyDefeated: Math.floor(normalized / 100) % 10,
    partyDefeated: Math.floor(normalized / 10) % 10,
    enemiesDefeated: normalized % 10,
    code: normalized,
  };
}

export function turnSummaryResultFromSnapshot(summary = {}) {
  if (Number(summary.partyDefeated || 0) === 1) return 'loss';
  if (Number(summary.enemiesDefeated || 0) === 1) return 'win';
  return 'continue';
}

export function resolveTurnSummary({
  source = 'unknown',
  heroCount = 0,
  heroHp = [],
  enemyCount = 0,
  enemyHp = [],
  ownerHook = null,
} = {}) {
  const normalized = normalizeTurnSummaryInput({
    source,
    heroCount,
    heroHp,
    enemyCount,
    enemyHp,
  });
  const jsSummary = turnSummaryFromJs(normalized);
  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsCode: jsSummary.code,
      });
      const code = Number(result?.code);
      if (Number.isFinite(code)) {
        const rustSummary = turnSummaryFromCode(code);
        return {
          ...rustSummary,
          owner: String(result?.owner || 'rust'),
          jsSummary,
        };
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable or unhealthy.
    }
  }
  return {
    ...jsSummary,
    jsSummary,
  };
}

export function createTurnSummarySimulationPacket({
  source = 'unknown',
  heroCount = 0,
  heroHp = [],
  enemyCount = 0,
  enemyHp = [],
  ownerHook = null,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
} = {}) {
  const normalized = normalizeTurnSummaryInput({
    source,
    heroCount,
    heroHp,
    enemyCount,
    enemyHp,
  });
  const jsSummary = turnSummaryFromJs(normalized);
  const action = {
    type: 'turn.summary',
    ...normalized,
  };
  const requestContext = {
    ruleFamily: 'turnSummary',
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
  const decision = resolveTurnSummary({
    ...normalized,
    ownerHook,
  });
  const sourceGameState = request && request.gameState ? request.gameState : gameState;
  const nextGameState = {
    ...clonePacketJson(sourceGameState, {}),
    turnSummary: {
      ...clonePacketJson(sourceGameState?.turnSummary, {}),
      owner: String(decision.owner || 'fallback'),
      code: Number(decision.code || 0),
      heroAlive: Number(decision.heroAlive || 0),
      heroDefeated: Number(decision.heroDefeated || 0),
      enemyAlive: Number(decision.enemyAlive || 0),
      enemyDefeated: Number(decision.enemyDefeated || 0),
      partyDefeated: Number(decision.partyDefeated || 0),
      enemiesDefeated: Number(decision.enemiesDefeated || 0),
    },
  };
  const response = createFallbackSimulationCoreResponse({
    nextGameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: turnSummaryResultFromSnapshot(decision),
    diagnostics: {
      ruleFamily: 'turnSummary',
      owner: decision.owner,
      source: normalized.source,
      heroCount: normalized.heroCount,
      heroHp: normalized.heroHp,
      enemyCount: normalized.enemyCount,
      enemyHp: normalized.enemyHp,
      code: Number(decision.code || 0),
      jsCode: Number(jsSummary.code || 0),
      heroAlive: Number(decision.heroAlive || 0),
      heroDefeated: Number(decision.heroDefeated || 0),
      enemyAlive: Number(decision.enemyAlive || 0),
      enemyDefeated: Number(decision.enemyDefeated || 0),
      partyDefeated: Number(decision.partyDefeated || 0),
      enemiesDefeated: Number(decision.enemiesDefeated || 0),
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
