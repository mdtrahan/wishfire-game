export const COMBAT_OUTCOME_CONTINUE = 0;
export const COMBAT_OUTCOME_ENERGY_DEPLETED = 1;
export const COMBAT_OUTCOME_PARTY_DEFEATED = 2;
export const COMBAT_OUTCOME_NO_LIVING_HEROES = 3;

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

export function combatOutcomeCodeFromJs({ energy = 0, partyHp = 0, livingHeroes = 0 } = {}) {
  if (Number(partyHp || 0) <= 0) return COMBAT_OUTCOME_PARTY_DEFEATED;
  if (Number(livingHeroes || 0) <= 0) return COMBAT_OUTCOME_NO_LIVING_HEROES;
  return COMBAT_OUTCOME_CONTINUE;
}

export function combatOutcomeReasonFromCode(code = COMBAT_OUTCOME_CONTINUE) {
  if (Number(code || 0) === COMBAT_OUTCOME_ENERGY_DEPLETED) return 'energy_depleted';
  if (Number(code || 0) === COMBAT_OUTCOME_PARTY_DEFEATED) return 'party_defeated';
  if (Number(code || 0) === COMBAT_OUTCOME_NO_LIVING_HEROES) return 'no_living_heroes';
  return '';
}

export function resolveCombatOutcome({
  source = 'unknown',
  energy = 0,
  partyHp = 0,
  livingHeroes = 0,
  ownerHook = null,
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    energy: Number(energy || 0),
    partyHp: Number(partyHp || 0),
    livingHeroes: Number(livingHeroes || 0),
  };
  const jsCode = combatOutcomeCodeFromJs(normalized);
  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({ ...normalized, jsCode });
      const code = Number(result?.code);
      if (Number.isFinite(code)) {
        return {
          owner: String(result?.owner || 'rust'),
          code,
          reason: combatOutcomeReasonFromCode(code),
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
    reason: combatOutcomeReasonFromCode(jsCode),
    jsCode,
  };
}

export function createCombatOutcomeSimulationPacket({
  source = 'unknown',
  energy = 0,
  partyHp = 0,
  livingHeroes = 0,
  ownerHook = null,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    energy: Number(energy || 0),
    partyHp: Number(partyHp || 0),
    livingHeroes: Number(livingHeroes || 0),
  };
  const action = {
    type: 'combat.outcome',
    ...normalized,
  };
  const requestContext = {
    ruleFamily: 'combatOutcome',
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
  const outcome = resolveCombatOutcome({
    ...normalized,
    ownerHook,
  });
  const response = createFallbackSimulationCoreResponse({
    nextGameState: request && request.gameState ? request.gameState : gameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: outcome.reason || 'continue',
    diagnostics: {
      ruleFamily: 'combatOutcome',
      owner: outcome.owner,
      code: Number(outcome.code || 0),
      reason: String(outcome.reason || ''),
      jsCode: Number(outcome.jsCode || 0),
      source: normalized.source,
      energy: normalized.energy,
      partyHp: normalized.partyHp,
      livingHeroes: normalized.livingHeroes,
    },
  });
  const appliedResponse = typeof responseApplier === 'function'
    ? responseApplier(response)
    : response;
  return {
    ...outcome,
    simulationCoreRequest: request,
    simulationCoreResponse: appliedResponse,
  };
}
