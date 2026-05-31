const SIMULATION_CORE_CONTRACT_VERSION = 1;
const SIMULATION_CORE_BASELINE_ID = 'main@5364ede23e3160fadb1a6ac9bf940c57bdd15f87';

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function intOr(value, fallback = 0) {
  return Math.floor(numberOr(value, fallback));
}

function flag(value) {
  return Number(value || 0) > 0 ? 1 : 0;
}

function positiveFloorOrOne(value) {
  return Math.max(1, intOr(value, 1) || 1);
}

function normalizeDebuffValue(value) {
  const normalized = numberOr(value, 0);
  return normalized > 0 ? Math.floor(normalized) : 0;
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

function createStatusEffectPacket({
  actionType,
  ruleFamily,
  resultName,
  stateKey,
  normalized,
  fallbackDecision,
  ownerHook = null,
  mapOwnerResult,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
} = {}) {
  const action = {
    type: actionType,
    ...normalized,
  };
  const requestContext = {
    ruleFamily,
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
  let decision = {
    owner: 'fallback',
    ...fallbackDecision,
  };
  if (typeof ownerHook === 'function') {
    try {
      const mapped = mapOwnerResult(ownerHook(normalized), normalized);
      if (mapped) {
        decision = {
          owner: String(mapped.owner || 'rust'),
          ...mapped,
        };
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable.
    }
  }
  const sourceGameState = request && request.gameState ? request.gameState : gameState;
  const nextGameState = {
    ...clonePacketJson(sourceGameState, {}),
    statusEffects: {
      ...clonePacketJson(sourceGameState?.statusEffects, {}),
      [stateKey]: clonePacketJson(decision, {}),
    },
  };
  const response = createFallbackSimulationCoreResponse({
    nextGameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: resultName,
    diagnostics: {
      ruleFamily,
      owner: decision.owner,
      ...normalized,
      ...decision,
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

function finiteNumbers(value, keys) {
  return keys.every((key) => Number.isFinite(Number(value?.[key])));
}

function normalizeEnemyDotPacketInput(input = {}) {
  return {
    source: String(input.source || 'unknown'),
    actorUID: numberOr(input.actorUID, 0),
    enemyUID: numberOr(input.enemyUID, 0),
    totalDamage: numberOr(input.totalDamage, 0),
    totalTicks: numberOr(input.totalTicks, 0),
    nowTick: numberOr(input.nowTick, 0),
    nowTurnSerial: numberOr(input.nowTurnSerial, 0),
    firesEveryTicks: numberOr(input.firesEveryTicks, 0),
    startAfterTicks: numberOr(input.startAfterTicks, 0),
    firesEveryTurns: numberOr(input.firesEveryTurns, 0),
    startAfterTurns: numberOr(input.startAfterTurns, 0),
    cadence: String(input.cadence || ''),
    effectName: String(input.effectName || ''),
    taintedGroundZoneId: String(input.taintedGroundZoneId || ''),
    jsTargetUID: numberOr(input.jsTargetUID, 0),
    jsSourceUID: numberOr(input.jsSourceUID, 0),
    jsRemainingFires: numberOr(input.jsRemainingFires, 0),
    jsTotalDamageRemaining: numberOr(input.jsTotalDamageRemaining, 0),
    jsFiresEveryTicks: numberOr(input.jsFiresEveryTicks, 0),
    jsNextFireTick: numberOr(input.jsNextFireTick, 0),
    jsFiresEveryTurns: numberOr(input.jsFiresEveryTurns, 0),
    jsNextFireTurnSerial: numberOr(input.jsNextFireTurnSerial, 0),
    jsLastProcessedTurnSerial: numberOr(input.jsLastProcessedTurnSerial, 0),
  };
}

export function createEnemyDotPacketSimulationPacket(input = {}) {
  const { ownerHook = null, requestFactory = null, responseApplier = null, rngState = {}, gameState = {}, context = {} } = input;
  const normalized = normalizeEnemyDotPacketInput(input);
  const fallbackDecision = {
    targetUID: normalized.jsTargetUID,
    sourceUID: normalized.jsSourceUID,
    remainingFires: normalized.jsRemainingFires,
    totalDamageRemaining: normalized.jsTotalDamageRemaining,
    firesEveryTicks: normalized.jsFiresEveryTicks,
    nextFireTick: normalized.jsNextFireTick,
    firesEveryTurns: normalized.jsFiresEveryTurns,
    nextFireTurnSerial: normalized.jsNextFireTurnSerial,
    lastProcessedTurnSerial: normalized.jsLastProcessedTurnSerial,
    cadence: normalized.cadence,
    effectName: normalized.effectName,
    taintedGroundZoneId: normalized.taintedGroundZoneId,
  };
  return createStatusEffectPacket({
    actionType: 'status.enemyDotPacket',
    ruleFamily: 'enemyDotPacket',
    resultName: 'enemy_dot_packet',
    stateKey: 'lastEnemyDotPacket',
    normalized,
    fallbackDecision,
    ownerHook,
    requestFactory,
    responseApplier,
    rngState,
    gameState,
    context,
    mapOwnerResult: (result) => {
      const mapped = {
        owner: String(result?.owner || 'rust'),
        targetUID: Number(result?.targetUID),
        sourceUID: Number(result?.sourceUID),
        remainingFires: Number(result?.remainingFires),
        totalDamageRemaining: Number(result?.totalDamageRemaining),
        firesEveryTicks: Number(result?.firesEveryTicks),
        nextFireTick: Number(result?.nextFireTick),
        firesEveryTurns: Number(result?.firesEveryTurns),
        nextFireTurnSerial: Number(result?.nextFireTurnSerial),
        lastProcessedTurnSerial: Number(result?.lastProcessedTurnSerial),
        cadence: normalized.cadence,
        effectName: normalized.effectName,
        taintedGroundZoneId: normalized.taintedGroundZoneId,
      };
      return finiteNumbers(mapped, [
        'targetUID',
        'sourceUID',
        'remainingFires',
        'totalDamageRemaining',
        'firesEveryTicks',
        'nextFireTick',
        'firesEveryTurns',
        'nextFireTurnSerial',
        'lastProcessedTurnSerial',
      ]) ? mapped : null;
    },
  });
}

function normalizeEnemyDotTickInput(input = {}) {
  return {
    source: String(input.source || 'unknown'),
    totalDamageRemaining: numberOr(input.totalDamageRemaining, 0),
    remainingFires: numberOr(input.remainingFires, 0),
    damagePerFire: numberOr(input.damagePerFire, 0),
    hasTotalDamageRemaining: flag(input.hasTotalDamageRemaining),
    nextFireTurnSerial: numberOr(input.nextFireTurnSerial, 0),
    firesEveryTurns: numberOr(input.firesEveryTurns, 1),
    jsDamage: numberOr(input.jsDamage, 0),
    jsTotalDamageRemaining: numberOr(input.jsTotalDamageRemaining, 0),
    jsRemainingFires: numberOr(input.jsRemainingFires, 0),
    jsNextFireTurnSerial: numberOr(input.jsNextFireTurnSerial, 0),
  };
}

export function createEnemyDotTickSimulationPacket(input = {}) {
  const { ownerHook = null, requestFactory = null, responseApplier = null, rngState = {}, gameState = {}, context = {} } = input;
  const normalized = normalizeEnemyDotTickInput(input);
  return createStatusEffectPacket({
    actionType: 'status.enemyDotTick',
    ruleFamily: 'enemyDotTick',
    resultName: 'enemy_dot_tick',
    stateKey: 'lastEnemyDotTick',
    normalized,
    fallbackDecision: {
      damage: normalized.jsDamage,
      totalDamageRemaining: normalized.jsTotalDamageRemaining,
      remainingFires: normalized.jsRemainingFires,
      nextFireTurnSerial: normalized.jsNextFireTurnSerial,
    },
    ownerHook,
    requestFactory,
    responseApplier,
    rngState,
    gameState,
    context,
    mapOwnerResult: (result) => {
      const mapped = {
        owner: String(result?.owner || 'rust'),
        damage: Number(result?.damage),
        totalDamageRemaining: Number(result?.totalDamageRemaining),
        remainingFires: Number(result?.remainingFires),
        nextFireTurnSerial: Number(result?.nextFireTurnSerial),
      };
      return finiteNumbers(mapped, ['damage', 'totalDamageRemaining', 'remainingFires', 'nextFireTurnSerial'])
        ? mapped
        : null;
    },
  });
}

function normalizeEnemyDotLifecycleInput(input = {}) {
  return {
    source: String(input.source || 'unknown'),
    cadenceIsTurn: flag(input.cadenceIsTurn),
    dotTargetUID: numberOr(input.dotTargetUID, 0),
    targetUID: numberOr(input.targetUID, 0),
    remainingFires: numberOr(input.remainingFires, 0),
    hasTotalDamageRemaining: flag(input.hasTotalDamageRemaining),
    totalDamageRemaining: numberOr(input.totalDamageRemaining, 0),
    targetAlive: flag(input.targetAlive),
    currentTurnSerial: numberOr(input.currentTurnSerial, 0),
    nextFireTurnSerial: numberOr(input.nextFireTurnSerial, 0),
    lastProcessedTurnSerial: numberOr(input.lastProcessedTurnSerial, 0),
    jsAction: numberOr(input.jsAction, 0),
  };
}

export function createEnemyDotLifecycleSimulationPacket(input = {}) {
  const { ownerHook = null, requestFactory = null, responseApplier = null, rngState = {}, gameState = {}, context = {} } = input;
  const normalized = normalizeEnemyDotLifecycleInput(input);
  return createStatusEffectPacket({
    actionType: 'status.enemyDotLifecycle',
    ruleFamily: 'enemyDotLifecycle',
    resultName: 'enemy_dot_lifecycle',
    stateKey: 'lastEnemyDotLifecycle',
    normalized,
    fallbackDecision: { action: normalized.jsAction },
    ownerHook,
    requestFactory,
    responseApplier,
    rngState,
    gameState,
    context,
    mapOwnerResult: (result) => {
      const action = Number(result?.action);
      return Number.isFinite(action) ? { owner: String(result?.owner || 'rust'), action } : null;
    },
  });
}

function normalizeEnemyDebuffApplyInput(input = {}) {
  return {
    source: String(input.source || 'unknown'),
    stat: String(input.stat || '').toUpperCase(),
    amountBefore: normalizeDebuffValue(input.amountBefore),
    turnsBefore: normalizeDebuffValue(input.turnsBefore),
    addAmount: normalizeDebuffValue(input.addAmount),
    durationTurns: normalizeDebuffValue(input.durationTurns),
    jsAmountAfter: normalizeDebuffValue(input.jsAmountAfter),
    jsTurnsAfter: normalizeDebuffValue(input.jsTurnsAfter),
    jsActive: flag(input.jsActive),
  };
}

export function createEnemyDebuffApplySimulationPacket(input = {}) {
  const { ownerHook = null, requestFactory = null, responseApplier = null, rngState = {}, gameState = {}, context = {} } = input;
  const normalized = normalizeEnemyDebuffApplyInput(input);
  return createStatusEffectPacket({
    actionType: 'status.enemyDebuffApply',
    ruleFamily: 'enemyDebuffApply',
    resultName: 'enemy_debuff_apply',
    stateKey: 'lastEnemyDebuffApply',
    normalized,
    fallbackDecision: {
      amountAfter: normalized.jsAmountAfter,
      turnsAfter: normalized.jsTurnsAfter,
      active: normalized.jsActive,
    },
    ownerHook,
    requestFactory,
    responseApplier,
    rngState,
    gameState,
    context,
    mapOwnerResult: (result) => ({
      owner: String(result?.owner || 'rust'),
      amountAfter: normalizeDebuffValue(result?.amountAfter),
      turnsAfter: normalizeDebuffValue(result?.turnsAfter),
      active: flag(result?.active),
    }),
  });
}

function normalizeEnemyDebuffDecayInput(input = {}) {
  return {
    source: String(input.source || 'unknown'),
    stat: String(input.stat || '').toUpperCase(),
    amountBefore: normalizeDebuffValue(input.amountBefore),
    turnsBefore: normalizeDebuffValue(input.turnsBefore),
    jsAmountAfter: normalizeDebuffValue(input.jsAmountAfter),
    jsTurnsAfter: normalizeDebuffValue(input.jsTurnsAfter),
    jsActive: flag(input.jsActive),
  };
}

export function createEnemyDebuffDecaySimulationPacket(input = {}) {
  const { ownerHook = null, requestFactory = null, responseApplier = null, rngState = {}, gameState = {}, context = {} } = input;
  const normalized = normalizeEnemyDebuffDecayInput(input);
  return createStatusEffectPacket({
    actionType: 'status.enemyDebuffDecay',
    ruleFamily: 'enemyDebuffDecay',
    resultName: 'enemy_debuff_decay',
    stateKey: 'lastEnemyDebuffDecay',
    normalized,
    fallbackDecision: {
      amountAfter: normalized.jsAmountAfter,
      turnsAfter: normalized.jsTurnsAfter,
      active: normalized.jsActive,
    },
    ownerHook,
    requestFactory,
    responseApplier,
    rngState,
    gameState,
    context,
    mapOwnerResult: (result) => ({
      owner: String(result?.owner || 'rust'),
      amountAfter: normalizeDebuffValue(result?.amountAfter),
      turnsAfter: normalizeDebuffValue(result?.turnsAfter),
      active: flag(result?.active),
    }),
  });
}

function normalizeEnemyDebuffSlotInput(input = {}) {
  return {
    source: String(input.source || 'unknown'),
    stat: String(input.stat || '').toUpperCase(),
    statIndex: intOr(input.statIndex, -1),
    active: flag(input.active),
    slotCount: Math.max(0, Math.min(3, intOr(input.slotCount, 0))),
    slot0Index: intOr(input.slot0Index, -1),
    slot1Index: intOr(input.slot1Index, -1),
    slot2Index: intOr(input.slot2Index, -1),
    jsAction: numberOr(input.jsAction, 0),
    jsDropSlotIndex: intOr(input.jsDropSlotIndex, -1),
    jsAppendSlotIndex: intOr(input.jsAppendSlotIndex, -1),
  };
}

export function createEnemyDebuffSlotSimulationPacket(input = {}) {
  const { ownerHook = null, requestFactory = null, responseApplier = null, rngState = {}, gameState = {}, context = {} } = input;
  const normalized = normalizeEnemyDebuffSlotInput(input);
  return createStatusEffectPacket({
    actionType: 'status.enemyDebuffSlot',
    ruleFamily: 'enemyDebuffSlot',
    resultName: 'enemy_debuff_slot',
    stateKey: 'lastEnemyDebuffSlot',
    normalized,
    fallbackDecision: {
      action: normalized.jsAction,
      dropSlotIndex: normalized.jsDropSlotIndex,
      appendSlotIndex: normalized.jsAppendSlotIndex,
    },
    ownerHook,
    requestFactory,
    responseApplier,
    rngState,
    gameState,
    context,
    mapOwnerResult: (result) => {
      const mapped = {
        owner: String(result?.owner || 'rust'),
        action: Number(result?.action),
        dropSlotIndex: intOr(result?.dropSlotIndex, -1),
        appendSlotIndex: intOr(result?.appendSlotIndex, -1),
      };
      return Number.isFinite(mapped.action) ? mapped : null;
    },
  });
}

function normalizePartyRegenLifecycleInput(input = {}) {
  return {
    source: String(input.source || 'unknown'),
    remainingFires: numberOr(input.remainingFires, 0),
    hasTotalHealRemaining: flag(input.hasTotalHealRemaining),
    totalHealRemaining: numberOr(input.totalHealRemaining, 0),
    currentSerial: numberOr(input.currentSerial, 0),
    nextFireSerial: numberOr(input.nextFireSerial, 0),
    appliedOnSerial: numberOr(input.appliedOnSerial, 0),
    lastProcessedSerial: numberOr(input.lastProcessedSerial, 0),
    jsAction: numberOr(input.jsAction, 0),
  };
}

export function createPartyRegenLifecycleSimulationPacket(input = {}) {
  const { ownerHook = null, requestFactory = null, responseApplier = null, rngState = {}, gameState = {}, context = {} } = input;
  const normalized = normalizePartyRegenLifecycleInput(input);
  return createStatusEffectPacket({
    actionType: 'status.partyRegenLifecycle',
    ruleFamily: 'partyRegenLifecycle',
    resultName: 'party_regen_lifecycle',
    stateKey: 'lastPartyRegenLifecycle',
    normalized,
    fallbackDecision: { action: normalized.jsAction },
    ownerHook,
    requestFactory,
    responseApplier,
    rngState,
    gameState,
    context,
    mapOwnerResult: (result) => {
      const action = Number(result?.action);
      return Number.isFinite(action) ? { owner: String(result?.owner || 'rust'), action } : null;
    },
  });
}

function normalizePartyRegenTickInput(input = {}) {
  return {
    source: String(input.source || 'unknown'),
    totalHealRemaining: numberOr(input.totalHealRemaining, 0),
    remainingFires: numberOr(input.remainingFires, 0),
    healPerFire: numberOr(input.healPerFire, 0),
    hasTotalHealRemaining: flag(input.hasTotalHealRemaining),
    nextFireSerial: numberOr(input.nextFireSerial, 0),
    firesEvery: positiveFloorOrOne(input.firesEvery),
    distributionMode: numberOr(input.distributionMode, 0),
    jsHeal: numberOr(input.jsHeal, 0),
    jsTotalHealRemaining: numberOr(input.jsTotalHealRemaining, 0),
    jsRemainingFires: numberOr(input.jsRemainingFires, 0),
    jsNextFireSerial: numberOr(input.jsNextFireSerial, 0),
  };
}

export function createPartyRegenTickSimulationPacket(input = {}) {
  const { ownerHook = null, requestFactory = null, responseApplier = null, rngState = {}, gameState = {}, context = {} } = input;
  const normalized = normalizePartyRegenTickInput(input);
  return createStatusEffectPacket({
    actionType: 'status.partyRegenTick',
    ruleFamily: 'partyRegenTick',
    resultName: 'party_regen_tick',
    stateKey: 'lastPartyRegenTick',
    normalized,
    fallbackDecision: {
      heal: normalized.jsHeal,
      totalHealRemaining: normalized.jsTotalHealRemaining,
      remainingFires: normalized.jsRemainingFires,
      nextFireSerial: normalized.jsNextFireSerial,
    },
    ownerHook,
    requestFactory,
    responseApplier,
    rngState,
    gameState,
    context,
    mapOwnerResult: (result) => {
      const mapped = {
        owner: String(result?.owner || 'rust'),
        heal: Number(result?.heal),
        totalHealRemaining: Number(result?.totalHealRemaining),
        remainingFires: Number(result?.remainingFires),
        nextFireSerial: Number(result?.nextFireSerial),
      };
      return finiteNumbers(mapped, ['heal', 'totalHealRemaining', 'remainingFires', 'nextFireSerial'])
        ? mapped
        : null;
    },
  });
}
