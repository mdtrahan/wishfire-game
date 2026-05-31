export const RUNA_MAGIC_RESIST_TRIGGER_CHANCE = 0.6;
export const RUNA_MAGIC_RESIST_NULLIFY_CHANCE = 0.35;
export const RUNA_MAGIC_RESIST_REDUCE_FACTOR = 0.2;

export const RUNA_MAGIC_RESIST_MODE_CODES = Object.freeze({
  not_runa: 0,
  no_proc: 1,
  nullify: 2,
  heavy_resist: 3,
});

export const RUNA_MAGIC_RESIST_MODE_IDS = Object.freeze([
  'not_runa',
  'no_proc',
  'nullify',
  'heavy_resist',
]);

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

function readRoll(rollSource = Math.random, fallback = 0) {
  const value = Number(typeof rollSource === 'function' ? rollSource() : fallback);
  return Number.isFinite(value) ? value : fallback;
}

export function runaMagicResistModeFromCode(code = 0) {
  return RUNA_MAGIC_RESIST_MODE_IDS[Math.max(0, Math.trunc(numberOr(code, 0)))] || 'not_runa';
}

export function runaMagicResistModeCodeFromId(mode = '') {
  return RUNA_MAGIC_RESIST_MODE_CODES[String(mode || '')] ?? RUNA_MAGIC_RESIST_MODE_CODES.not_runa;
}

export function runaMagicResistFromJs({
  targetIsRuna = 0,
  incomingDamage = 0,
  triggerRoll = null,
  nullifyRoll = null,
  rollSource = Math.random,
} = {}) {
  const baseDamage = Math.max(0, numberOr(incomingDamage, 0));
  if (Number(targetIsRuna || 0) !== 1) {
    return {
      owner: 'fallback',
      mode: 'not_runa',
      modeCode: RUNA_MAGIC_RESIST_MODE_CODES.not_runa,
      finalDamage: baseDamage,
      incomingDamage: baseDamage,
    };
  }

  const trigger = triggerRoll == null ? readRoll(rollSource, 0) : numberOr(triggerRoll, 0);
  if (trigger >= RUNA_MAGIC_RESIST_TRIGGER_CHANCE) {
    return {
      owner: 'fallback',
      mode: 'no_proc',
      modeCode: RUNA_MAGIC_RESIST_MODE_CODES.no_proc,
      finalDamage: baseDamage,
      incomingDamage: baseDamage,
      triggerRoll: trigger,
    };
  }

  const nullify = nullifyRoll == null ? readRoll(rollSource, 0) : numberOr(nullifyRoll, 0);
  const didNullify = nullify < RUNA_MAGIC_RESIST_NULLIFY_CHANCE;
  const finalDamage = didNullify ? 0 : Math.max(1, Math.floor(baseDamage * RUNA_MAGIC_RESIST_REDUCE_FACTOR));
  const mode = didNullify ? 'nullify' : 'heavy_resist';
  return {
    owner: 'fallback',
    mode,
    modeCode: runaMagicResistModeCodeFromId(mode),
    finalDamage,
    incomingDamage: baseDamage,
    triggerRoll: trigger,
    nullifyRoll: nullify,
  };
}

export function resolveRunaMagicResist({
  targetIsRuna = 0,
  incomingDamage = 0,
  rollSource = Math.random,
  ownerHook = null,
} = {}) {
  const jsDecision = runaMagicResistFromJs({
    targetIsRuna,
    incomingDamage,
    rollSource,
  });

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        targetIsRuna: Number(targetIsRuna || 0) === 1 ? 1 : 0,
        incomingDamage: jsDecision.incomingDamage,
        triggerRoll: numberOr(jsDecision.triggerRoll, 0),
        nullifyRoll: numberOr(jsDecision.nullifyRoll, 0),
        jsFinalDamage: jsDecision.finalDamage,
        jsModeCode: jsDecision.modeCode,
      });
      const finalDamage = Number(result?.finalDamage);
      const modeCode = Number(result?.modeCode);
      if (Number.isFinite(finalDamage) && Number.isFinite(modeCode)) {
        const mode = runaMagicResistModeFromCode(modeCode);
        return {
          owner: String(result?.owner || 'rust'),
          mode,
          modeCode,
          finalDamage,
          incomingDamage: jsDecision.incomingDamage,
          triggerRoll: jsDecision.triggerRoll,
          nullifyRoll: jsDecision.nullifyRoll,
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

function normalizeRunaMagicResistInput({
  source = 'unknown',
  enemyUID = 0,
  targetUID = 0,
  skillId = '',
  targetIsRuna = 0,
  incomingDamage = 0,
  triggerRoll = null,
  nullifyRoll = null,
  rollSource = Math.random,
} = {}) {
  const jsDecision = runaMagicResistFromJs({
    targetIsRuna,
    incomingDamage,
    triggerRoll,
    nullifyRoll,
    rollSource,
  });
  return {
    source: String(source || 'unknown'),
    enemyUID: numberOr(enemyUID, 0),
    targetUID: numberOr(targetUID, 0),
    skillId: String(skillId || ''),
    targetIsRuna: Number(targetIsRuna || 0) === 1 ? 1 : 0,
    incomingDamage: Math.max(0, numberOr(incomingDamage, 0)),
    triggerRoll: numberOr(jsDecision.triggerRoll, 0),
    nullifyRoll: numberOr(jsDecision.nullifyRoll, 0),
    jsFinalDamage: numberOr(jsDecision.finalDamage, 0),
    jsModeCode: numberOr(jsDecision.modeCode, 0),
    jsDecision,
  };
}

export function createRunaMagicResistSimulationPacket({
  ownerHook = null,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
  ...input
} = {}) {
  const normalized = normalizeRunaMagicResistInput(input);
  const action = {
    type: 'combat.runaMagicResist',
    source: normalized.source,
    enemyUID: normalized.enemyUID,
    targetUID: normalized.targetUID,
    skillId: normalized.skillId,
    targetIsRuna: normalized.targetIsRuna,
    incomingDamage: normalized.incomingDamage,
    triggerRoll: normalized.triggerRoll,
    nullifyRoll: normalized.nullifyRoll,
    jsFinalDamage: normalized.jsFinalDamage,
    jsModeCode: normalized.jsModeCode,
  };
  const requestContext = {
    ruleFamily: 'runaMagicResist',
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
  let rollIndex = 0;
  const deterministicRollSource = () => {
    const rolls = [normalized.triggerRoll, normalized.nullifyRoll];
    const value = rolls[Math.min(rollIndex, rolls.length - 1)];
    rollIndex += 1;
    return value;
  };
  const decision = resolveRunaMagicResist({
    targetIsRuna: normalized.targetIsRuna,
    incomingDamage: normalized.incomingDamage,
    rollSource: deterministicRollSource,
    ownerHook,
  });
  decision.triggerRoll = normalized.triggerRoll;
  decision.nullifyRoll = normalized.nullifyRoll;
  decision.jsDecision = normalized.jsDecision;
  const sourceGameState = request && request.gameState ? request.gameState : gameState;
  const nextGameState = {
    ...clonePacketJson(sourceGameState, {}),
    combat: {
      ...clonePacketJson(sourceGameState?.combat, {}),
      lastRunaMagicResist: {
        enemyUID: normalized.enemyUID,
        targetUID: normalized.targetUID,
        skillId: normalized.skillId,
        owner: String(decision.owner || 'fallback'),
        mode: String(decision.mode || 'not_runa'),
        finalDamage: Number(decision.finalDamage || 0),
      },
    },
  };
  const response = createFallbackSimulationCoreResponse({
    nextGameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: 'magic_resist',
    diagnostics: {
      ruleFamily: 'runaMagicResist',
      owner: decision.owner,
      ...action,
      mode: String(decision.mode || 'not_runa'),
      modeCode: Number(decision.modeCode || 0),
      finalDamage: Number(decision.finalDamage || 0),
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
