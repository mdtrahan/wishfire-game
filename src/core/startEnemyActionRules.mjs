import {
  enemyJobSkillCodeFromId,
  enemyJobSkillIdFromCode,
} from './enemyJobSkillRules.mjs';

export const START_ENEMY_ACTION_STATE_CODES = Object.freeze({
  none: 0,
  advance: 1,
});

export function startEnemyActionStateFromCode(code = START_ENEMY_ACTION_STATE_CODES.none) {
  return Number(code || 0) === START_ENEMY_ACTION_STATE_CODES.advance ? 'ADVANCE' : '';
}

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function nonNegativeInt(value) {
  return Math.max(0, Math.floor(numberOr(value, 0)));
}

function boolCode(value) {
  return Number(value || 0) ? 1 : 0;
}

export function startEnemyActionFromJs({
  enemyExists = 0,
  enemyUID = 0,
  targetUID = 0,
  skillId = '',
  skillCode = null,
  originX = 0,
} = {}) {
  const active = boolCode(enemyExists);
  const normalizedSkillCode = skillCode == null
    ? enemyJobSkillCodeFromId(skillId)
    : Math.trunc(numberOr(skillCode, -1));
  const stateCode = active ? START_ENEMY_ACTION_STATE_CODES.advance : START_ENEMY_ACTION_STATE_CODES.none;
  const uid = active ? nonNegativeInt(enemyUID) : 0;
  const resolvedTargetUID = active ? nonNegativeInt(targetUID) : 0;
  const resolvedSkillCode = active ? normalizedSkillCode : -1;
  return {
    owner: 'fallback',
    active,
    uid,
    stateCode,
    state: startEnemyActionStateFromCode(stateCode),
    timer: 0,
    actionApplied: 0,
    targetUID: resolvedTargetUID,
    skillCode: resolvedSkillCode,
    skillId: enemyJobSkillIdFromCode(resolvedSkillCode, String(skillId || 'Enemy_Unknown')),
    forwardX: active ? numberOr(originX, 0) - 55 : 0,
  };
}

function ownerDecisionFromResult(result, jsDecision) {
  const active = boolCode(result?.active ?? jsDecision.active);
  const stateCode = Math.max(0, Math.trunc(numberOr(result?.stateCode, jsDecision.stateCode)));
  const skillCode = Math.trunc(numberOr(result?.skillCode, jsDecision.skillCode));
  return {
    ...jsDecision,
    owner: String(result?.owner || 'rust'),
    active,
    uid: active ? nonNegativeInt(result?.uid ?? jsDecision.uid) : 0,
    stateCode,
    state: startEnemyActionStateFromCode(stateCode),
    timer: Math.max(0, numberOr(result?.timer, jsDecision.timer)),
    actionApplied: boolCode(result?.actionApplied ?? jsDecision.actionApplied),
    targetUID: active ? nonNegativeInt(result?.targetUID ?? jsDecision.targetUID) : 0,
    skillCode,
    skillId: enemyJobSkillIdFromCode(skillCode, jsDecision.skillId),
    forwardX: active ? numberOr(result?.forwardX, jsDecision.forwardX) : 0,
    jsDecision,
  };
}

export function resolveStartEnemyAction({
  source = 'unknown',
  ownerHook = null,
  ...payload
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    enemyExists: boolCode(payload.enemyExists),
    enemyUID: nonNegativeInt(payload.enemyUID),
    targetUID: nonNegativeInt(payload.targetUID),
    skillId: String(payload.skillId || ''),
    skillCode: payload.skillCode == null ? null : Math.trunc(numberOr(payload.skillCode, -1)),
    originX: numberOr(payload.originX, 0),
  };
  const jsDecision = startEnemyActionFromJs(normalized);

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        skillCode: jsDecision.skillCode,
        jsActive: jsDecision.active,
        jsStateCode: jsDecision.stateCode,
        jsTargetUID: jsDecision.targetUID,
        jsSkillCode: jsDecision.skillCode,
        jsForwardX: jsDecision.forwardX,
      });
      if (Number.isFinite(Number(result?.active))) {
        return ownerDecisionFromResult(result, jsDecision);
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
