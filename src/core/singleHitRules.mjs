import { calculateDamageFromJs } from './calculateDamageRules.mjs';

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

function normalizeSingleHitInput({
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
  targetHp = 0,
  shield = 0,
  jsDamage = null,
  jsAppliedDamage = null,
  jsAfterHp = null,
} = {}) {
  const formulaDamage = calculateDamageFromJs({
    power,
    resist,
    roll01,
    critRoll01,
    sourceIsHero,
    heroAoe,
    chainActive,
    chainMultiplier,
  }).damage;
  const normalizedJsDamage = jsDamage == null
    ? Number(formulaDamage || 0)
    : Math.max(0, numberOr(jsDamage, 0));
  const normalizedTargetHp = Math.max(0, numberOr(targetHp, 0));
  const normalizedShield = Math.max(0, numberOr(shield, 0));
  const projectedDamageToHp = Math.max(0, normalizedJsDamage - Math.min(normalizedShield, normalizedJsDamage));
  const projectedAfterHp = Math.max(0, normalizedTargetHp - projectedDamageToHp);
  const projectedAppliedDamage = Math.max(0, normalizedTargetHp - projectedAfterHp);

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
    targetHp: normalizedTargetHp,
    shield: normalizedShield,
    formulaDamage: Number(formulaDamage || 0),
    jsDamage: normalizedJsDamage,
    jsAppliedDamage: jsAppliedDamage == null
      ? projectedAppliedDamage
      : Math.max(0, numberOr(jsAppliedDamage, 0)),
    jsAfterHp: jsAfterHp == null
      ? projectedAfterHp
      : Math.max(0, numberOr(jsAfterHp, 0)),
  };
}

export function singleHitFromJs(input = {}) {
  const normalized = normalizeSingleHitInput(input);
  return {
    damage: normalized.jsDamage,
    appliedDamage: normalized.jsAppliedDamage,
    afterHp: normalized.jsAfterHp,
    formulaDamage: normalized.formulaDamage,
  };
}

export function resolveSingleHit({
  ownerHook = null,
  ...input
} = {}) {
  const normalized = normalizeSingleHitInput(input);
  const jsDecision = singleHitFromJs(normalized);
  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
      });
      const damage = Number(result?.damage);
      const appliedDamage = Number(result?.appliedDamage);
      const afterHp = Number(result?.afterHp);
      if (
        Number.isFinite(damage)
        && Number.isFinite(appliedDamage)
        && Number.isFinite(afterHp)
      ) {
        return {
          owner: String(result?.owner || 'rust'),
          damage,
          appliedDamage,
          afterHp,
          jsDecision,
        };
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable.
    }
  }
  return {
    owner: 'fallback',
    ...jsDecision,
    jsDecision,
  };
}

export function createSingleHitSimulationPacket({
  ownerHook = null,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
  ...input
} = {}) {
  const normalized = normalizeSingleHitInput(input);
  const action = {
    type: 'combat.singleHit',
    ...normalized,
  };
  const requestContext = {
    ruleFamily: 'singleHit',
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
  const decision = resolveSingleHit({
    ...normalized,
    ownerHook,
  });
  const sourceGameState = request && request.gameState ? request.gameState : gameState;
  const nextGameState = {
    ...clonePacketJson(sourceGameState, {}),
    combat: {
      ...clonePacketJson(sourceGameState?.combat, {}),
      lastSingleHit: {
        attackerUID: normalized.attackerUID,
        targetUID: normalized.targetUID,
        mode: normalized.mode,
        owner: String(decision.owner || 'fallback'),
        damage: Number(decision.damage || 0),
        appliedDamage: Number(decision.appliedDamage || 0),
        afterHp: Number(decision.afterHp || 0),
      },
    },
  };
  const response = createFallbackSimulationCoreResponse({
    nextGameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: 'single_hit',
    diagnostics: {
      ruleFamily: 'singleHit',
      owner: decision.owner,
      ...normalized,
      damage: Number(decision.damage || 0),
      appliedDamage: Number(decision.appliedDamage || 0),
      afterHp: Number(decision.afterHp || 0),
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
