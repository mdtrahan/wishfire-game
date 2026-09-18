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

function unitIntervalOrHalf(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 && normalized < 1 ? normalized : 0.5;
}

function ceilAtLeastOne(value) {
  return Math.max(1, Math.ceil(numberOr(value, 0)));
}

export function calculateDamageFromJs({
  power = 0,
  resist = 0,
  roll01 = 0.5,
  critRoll01 = 0.5,
  sourceIsHero = 0,
  heroAoe = 0,
  chainActive = 0,
  chainMultiplier = 1,
} = {}) {
  const powerValue = numberOr(power, 0);
  const resistValue = numberOr(resist, 0);
  const isHero = Number(sourceIsHero || 0) === 1;
  const roll = 0.9 + (unitIntervalOrHalf(roll01) * 0.2);
  // The same bounded attack/guard curve applies in both directions.  Damage kind
  // selects ATK/DEF or MAG/RES before this contract receives its inputs.
  const rawDamage = (2 + (Math.max(0, powerValue) * 0.48)) * (20 / (20 + Math.max(0, resistValue))) * roll;
  const baseDamage = ceilAtLeastOne(rawDamage);
  const critMultiplier = 1.25;
  const didCrit = numberOr(critRoll01, 1) < 0.01;
  const postCritDamage = ceilAtLeastOne(didCrit ? baseDamage * critMultiplier : baseDamage);
  const shouldChain = isHero && Number(chainActive || 0) === 1;
  const multiplier = numberOr(chainMultiplier, 1) || 1;
  const damage = shouldChain ? ceilAtLeastOne(postCritDamage * multiplier) : postCritDamage;

  return {
    damage,
    baseDamage,
    postCritDamage,
    didCrit,
    critMultiplier,
    roll,
  };
}

function normalizeCalculateDamageInput({
  source = 'unknown',
  attackerUID = 0,
  targetUID = 0,
  mode = '',
  power = 0,
  resist = 0,
  roll01 = 0.5,
  critRoll01 = 0.5,
  sourceIsHero = 0,
  heroAoe = 0,
  chainActive = 0,
  chainMultiplier = 1,
} = {}) {
  return {
    source: String(source || 'unknown'),
    attackerUID: numberOr(attackerUID, 0),
    targetUID: numberOr(targetUID, 0),
    mode: String(mode || ''),
    power: numberOr(power, 0),
    resist: numberOr(resist, 0),
    roll01: numberOr(roll01, 0),
    critRoll01: numberOr(critRoll01, 0),
    sourceIsHero: Number(sourceIsHero || 0) === 1 ? 1 : 0,
    heroAoe: Number(heroAoe || 0) === 1 ? 1 : 0,
    chainActive: Number(chainActive || 0) === 1 ? 1 : 0,
    chainMultiplier: numberOr(chainMultiplier, 1) || 1,
  };
}

export function resolveCalculateDamage({
  ownerHook = null,
  ...input
} = {}) {
  const normalized = normalizeCalculateDamageInput(input);
  const jsDecision = calculateDamageFromJs(normalized);
  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsDamage: Number(jsDecision.damage || 0),
      });
      const damage = Number(result?.damage);
      if (Number.isFinite(damage)) {
        return {
          ...jsDecision,
          owner: String(result?.owner || 'rust'),
          damage,
          jsDecision,
        };
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable or unhealthy.
    }
  }
  return {
    ...jsDecision,
    owner: 'fallback',
    jsDecision,
  };
}

export function createCalculateDamageSimulationPacket({
  ownerHook = null,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
  ...input
} = {}) {
  const normalized = normalizeCalculateDamageInput(input);
  const action = {
    type: 'combat.calculateDamage',
    ...normalized,
  };
  const requestContext = {
    ruleFamily: 'calculateDamage',
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
  const decision = resolveCalculateDamage({
    ...normalized,
    ownerHook,
  });
  const sourceGameState = request && request.gameState ? request.gameState : gameState;
  const nextGameState = {
    ...clonePacketJson(sourceGameState, {}),
    combat: {
      ...clonePacketJson(sourceGameState?.combat, {}),
      lastDamage: {
        attackerUID: normalized.attackerUID,
        targetUID: normalized.targetUID,
        mode: normalized.mode,
        owner: String(decision.owner || 'fallback'),
        damage: Number(decision.damage || 0),
      },
    },
  };
  const response = createFallbackSimulationCoreResponse({
    nextGameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: 'damage',
    diagnostics: {
      ruleFamily: 'calculateDamage',
      owner: decision.owner,
      ...normalized,
      damage: Number(decision.damage || 0),
      jsDamage: Number(decision.jsDecision?.damage ?? decision.damage ?? 0),
      baseDamage: Number(decision.jsDecision?.baseDamage ?? decision.baseDamage ?? 0),
      postCritDamage: Number(decision.jsDecision?.postCritDamage ?? decision.postCritDamage ?? 0),
      didCrit: !!(decision.jsDecision?.didCrit ?? decision.didCrit),
      critMultiplier: Number(decision.jsDecision?.critMultiplier ?? decision.critMultiplier ?? 1),
      roll: Number(decision.jsDecision?.roll ?? decision.roll ?? 0),
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
