export const GEM_ACTION_UNKNOWN = -1;
export const GEM_ACTION_GREEN_ATTACK = 0;
export const GEM_ACTION_RED_ATTACK = 1;
export const GEM_ACTION_BLUE_ASTRAL = 2;
export const GEM_ACTION_YELLOW_CASINO = 3;
export const GEM_ACTION_HEAL = 4;
export const GEM_ACTION_PURPLE_ENERGY = 5;

export const GEM_ACTION_PENDING_NONE = 0;
export const GEM_ACTION_PENDING_HERO_AOE = 1;
export const GEM_ACTION_PENDING_HERO_SINGLE = 2;

export const GEM_ACTION_CALL_NONE = 0;
export const GEM_ACTION_CALL_DO_HEAL = 1;
export const GEM_ACTION_CALL_PURPLE_MATCH_ENERGY = 2;

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function unitIntervalOrHalf(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 && normalized < 1 ? normalized : 0.5;
}

function nonNegativeInt(value) {
  return Math.max(0, Math.floor(numberOr(value, 0)));
}

function oneOrMoreInt(value) {
  const normalized = numberOr(value, 1);
  return Math.max(1, Math.floor(normalized || 1));
}

export function gemActionRouteCode(gemColor = GEM_ACTION_UNKNOWN) {
  const color = Math.floor(numberOr(gemColor, GEM_ACTION_UNKNOWN));
  return color >= 0 && color <= 5 ? color : GEM_ACTION_UNKNOWN;
}

export function gemActionPendingSkillCode(routeCode = GEM_ACTION_UNKNOWN) {
  const route = Number(routeCode);
  if (route === GEM_ACTION_GREEN_ATTACK) return GEM_ACTION_PENDING_HERO_AOE;
  if (route === GEM_ACTION_RED_ATTACK) return GEM_ACTION_PENDING_HERO_SINGLE;
  return GEM_ACTION_PENDING_NONE;
}

export function gemActionPendingSkillId(code = GEM_ACTION_PENDING_NONE) {
  const normalized = Number(code);
  if (normalized === GEM_ACTION_PENDING_HERO_AOE) return 'HERO_AOE';
  if (normalized === GEM_ACTION_PENDING_HERO_SINGLE) return 'HERO_SINGLE';
  return '';
}

export function gemActionCallCode(routeCode = GEM_ACTION_UNKNOWN) {
  const route = Number(routeCode);
  if (route === GEM_ACTION_HEAL) return GEM_ACTION_CALL_DO_HEAL;
  if (route === GEM_ACTION_PURPLE_ENERGY) return GEM_ACTION_CALL_PURPLE_MATCH_ENERGY;
  return GEM_ACTION_CALL_NONE;
}

export function gemActionIntentMeta(routeCode = GEM_ACTION_UNKNOWN) {
  const route = Number(routeCode);
  if (route === GEM_ACTION_GREEN_ATTACK) return { frame: 0, colorName: 'GREEN', intentKey: 'HERO_AOE', extra: '' };
  if (route === GEM_ACTION_RED_ATTACK) return { frame: 1, colorName: 'RED', intentKey: 'HERO_SINGLE', extra: '' };
  if (route === GEM_ACTION_BLUE_ASTRAL) return { frame: 2, colorName: 'BLUE', intentKey: 'Astral_Flow', extra: '' };
  if (route === GEM_ACTION_YELLOW_CASINO) return { frame: 3, colorName: 'YELLOW', intentKey: 'Casino_Recolor', extra: '' };
  if (route === GEM_ACTION_HEAL) return { frame: 4, colorName: 'LIGHTGREEN', intentKey: 'Do_Heal', extra: '' };
  if (route === GEM_ACTION_PURPLE_ENERGY) return { frame: 5, colorName: 'PURPLE', intentKey: 'Energy_Gain', extra: 'hero-routing' };
  return { frame: -1, colorName: '', intentKey: '', extra: '' };
}

export function purpleEnergyAmountFromRoll(roll01 = 0.5) {
  const energyOptions = [6, 12, 15];
  const index = Math.floor(unitIntervalOrHalf(roll01) * energyOptions.length);
  return energyOptions[index] || energyOptions[0];
}

export function gemActionFromJs({
  gemColor = GEM_ACTION_UNKNOWN,
  consumedCount = 0,
  astralFlowWallet = 0,
  astralFlowAmpPoints = 0,
  astralFlowAmpMax = 18,
  astralFlowAmpReady = 0,
  time = 0,
  actionLockUntil = 0,
  textAnimEndAt = 0,
  purpleRoll01 = 0.5,
} = {}) {
  const routeCode = gemActionRouteCode(gemColor);
  const consumed = nonNegativeInt(consumedCount);
  const wallet = Math.max(0, numberOr(astralFlowWallet, 0));
  const currentAmp = Math.max(0, numberOr(astralFlowAmpPoints, 0));
  const ampMax = oneOrMoreInt(astralFlowAmpMax);
  const ampReady = Number(astralFlowAmpReady || 0) === 1 ? 1 : 0;
  const blueWalletAfter = wallet + consumed;
  const shouldChargeAmp = consumed >= 3 && !ampReady;
  const blueAmpPointsAfter = shouldChargeAmp ? Math.min(ampMax, currentAmp + consumed) : currentAmp;
  const blueOpenDraught = shouldChargeAmp && blueAmpPointsAfter >= ampMax ? 1 : 0;
  const blueAmpReadyAfter = ampReady || blueOpenDraught ? 1 : 0;
  const now = numberOr(time, 0);
  const currentLock = numberOr(actionLockUntil, 0);
  let resolvedActionLockUntil = currentLock;
  if (routeCode === GEM_ACTION_BLUE_ASTRAL) {
    resolvedActionLockUntil = Math.max(currentLock, now + 0.32, blueOpenDraught ? now + 4 : currentLock);
  } else if (routeCode === GEM_ACTION_PURPLE_ENERGY) {
    resolvedActionLockUntil = Math.max(currentLock, now + 0.32, numberOr(textAnimEndAt, 0));
  }
  const pendingSkillCode = gemActionPendingSkillCode(routeCode);
  const callCode = gemActionCallCode(routeCode);
  const intent = gemActionIntentMeta(routeCode);

  return {
    owner: 'fallback',
    routeCode,
    consumedCount: consumed,
    hideHeroSelector: 1,
    pendingSkillCode,
    pendingSkillId: gemActionPendingSkillId(pendingSkillCode),
    setIsAoe: routeCode === GEM_ACTION_GREEN_ATTACK || routeCode === GEM_ACTION_RED_ATTACK || routeCode === GEM_ACTION_BLUE_ASTRAL ? 1 : 0,
    isAoe: routeCode === GEM_ACTION_GREEN_ATTACK ? 1 : 0,
    showAttackUi: routeCode === GEM_ACTION_GREEN_ATTACK || routeCode === GEM_ACTION_RED_ATTACK ? 1 : 0,
    callCode,
    consumesTurn: routeCode === GEM_ACTION_BLUE_ASTRAL || routeCode === GEM_ACTION_PURPLE_ENERGY ? 1 : 0,
    intentFrame: intent.frame,
    intentColorName: intent.colorName,
    intentKey: intent.intentKey,
    intentExtra: intent.extra,
    blueWalletAfter,
    blueAmpPointsAfter,
    blueAmpReadyAfter,
    blueOpenDraught,
    blueBuffReset: routeCode === GEM_ACTION_BLUE_ASTRAL ? 1 : 0,
    logBlueChannel: routeCode === GEM_ACTION_BLUE_ASTRAL ? 1 : 0,
    logAstralFlowGained: routeCode === GEM_ACTION_BLUE_ASTRAL && blueOpenDraught ? 1 : 0,
    purpleEnergyAmount: purpleEnergyAmountFromRoll(purpleRoll01),
    actionLockUntil: resolvedActionLockUntil,
    deferAdvance: routeCode === GEM_ACTION_BLUE_ASTRAL || routeCode === GEM_ACTION_PURPLE_ENERGY ? 1 : 0,
    advanceAfterAction: routeCode === GEM_ACTION_BLUE_ASTRAL || routeCode === GEM_ACTION_PURPLE_ENERGY ? 1 : 0,
  };
}

function ownerDecisionFromResult(result, jsDecision) {
  const routeCode = gemActionRouteCode(result?.routeCode);
  const pendingSkillCode = Math.max(0, Math.floor(numberOr(result?.pendingSkillCode, gemActionPendingSkillCode(routeCode))));
  const intent = gemActionIntentMeta(routeCode);
  return {
    ...jsDecision,
    owner: String(result?.owner || 'rust'),
    routeCode,
    consumedCount: nonNegativeInt(result?.consumedCount ?? jsDecision.consumedCount),
    pendingSkillCode,
    pendingSkillId: gemActionPendingSkillId(pendingSkillCode),
    setIsAoe: Number(result?.setIsAoe || 0) ? 1 : 0,
    isAoe: Number(result?.isAoe || 0) ? 1 : 0,
    showAttackUi: Number(result?.showAttackUi || 0) ? 1 : 0,
    callCode: Math.max(0, Math.floor(numberOr(result?.callCode, gemActionCallCode(routeCode)))),
    consumesTurn: Number(result?.consumesTurn || 0) ? 1 : 0,
    intentFrame: intent.frame,
    intentColorName: intent.colorName,
    intentKey: intent.intentKey,
    intentExtra: intent.extra,
    blueWalletAfter: numberOr(result?.blueWalletAfter, jsDecision.blueWalletAfter),
    blueAmpPointsAfter: numberOr(result?.blueAmpPointsAfter, jsDecision.blueAmpPointsAfter),
    blueAmpReadyAfter: Number(result?.blueAmpReadyAfter || 0) ? 1 : 0,
    blueOpenDraught: Number(result?.blueOpenDraught || 0) ? 1 : 0,
    blueBuffReset: routeCode === GEM_ACTION_BLUE_ASTRAL ? 1 : 0,
    logBlueChannel: routeCode === GEM_ACTION_BLUE_ASTRAL ? 1 : 0,
    logAstralFlowGained: routeCode === GEM_ACTION_BLUE_ASTRAL && Number(result?.blueOpenDraught || 0) ? 1 : 0,
    purpleEnergyAmount: numberOr(result?.purpleEnergyAmount, jsDecision.purpleEnergyAmount),
    actionLockUntil: numberOr(result?.actionLockUntil, jsDecision.actionLockUntil),
    deferAdvance: routeCode === GEM_ACTION_BLUE_ASTRAL || routeCode === GEM_ACTION_PURPLE_ENERGY ? 1 : 0,
    advanceAfterAction: routeCode === GEM_ACTION_BLUE_ASTRAL || routeCode === GEM_ACTION_PURPLE_ENERGY ? 1 : 0,
    jsDecision,
  };
}

export function resolveGemAction({
  source = 'unknown',
  ownerHook = null,
  ...payload
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    gemColor: numberOr(payload.gemColor, GEM_ACTION_UNKNOWN),
    consumedCount: nonNegativeInt(payload.consumedCount),
    astralFlowWallet: numberOr(payload.astralFlowWallet, 0),
    astralFlowAmpPoints: numberOr(payload.astralFlowAmpPoints, 0),
    astralFlowAmpMax: oneOrMoreInt(payload.astralFlowAmpMax || 18),
    astralFlowAmpReady: Number(payload.astralFlowAmpReady || 0) === 1 ? 1 : 0,
    time: numberOr(payload.time, 0),
    actionLockUntil: numberOr(payload.actionLockUntil, 0),
    textAnimEndAt: numberOr(payload.textAnimEndAt, 0),
    purpleRoll01: unitIntervalOrHalf(payload.purpleRoll01),
  };
  const jsDecision = gemActionFromJs(normalized);

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsRouteCode: jsDecision.routeCode,
        jsPendingSkillCode: jsDecision.pendingSkillCode,
        jsSetIsAoe: jsDecision.setIsAoe,
        jsIsAoe: jsDecision.isAoe,
        jsShowAttackUi: jsDecision.showAttackUi,
        jsCallCode: jsDecision.callCode,
        jsConsumesTurn: jsDecision.consumesTurn,
        jsConsumedCount: jsDecision.consumedCount,
        jsBlueWalletAfter: jsDecision.blueWalletAfter,
        jsBlueAmpPointsAfter: jsDecision.blueAmpPointsAfter,
        jsBlueAmpReadyAfter: jsDecision.blueAmpReadyAfter,
        jsBlueOpenDraught: jsDecision.blueOpenDraught,
        jsActionLockUntil: jsDecision.actionLockUntil,
        jsPurpleEnergyAmount: jsDecision.purpleEnergyAmount,
      });
      const routeCode = Number(result?.routeCode);
      if (Number.isFinite(routeCode)) return ownerDecisionFromResult(result, jsDecision);
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable or unhealthy.
    }
  }

  return {
    ...jsDecision,
    jsDecision,
  };
}
