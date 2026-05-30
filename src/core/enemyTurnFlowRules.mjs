export const ENEMY_TURN_FLOW_CODES = Object.freeze({
  none: 0,
  advanceTurn: 1,
  startAction: 2,
});

export const ENEMY_TURN_PHASE = 2;

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

export function enemyTurnFlowFromJs({
  activeEnemyUID = 0,
  enemyExists = 0,
  enemyHp = 0,
} = {}) {
  const uid = nonNegativeInt(activeEnemyUID);
  let actionCode = ENEMY_TURN_FLOW_CODES.advanceTurn;
  if (uid > 0 && boolCode(enemyExists) === 1 && numberOr(enemyHp, 0) > 0) {
    actionCode = ENEMY_TURN_FLOW_CODES.startAction;
  }
  return {
    owner: 'fallback',
    activeEnemyUID: uid,
    turnPhase: ENEMY_TURN_PHASE,
    actionCode,
    shouldAdvance: actionCode === ENEMY_TURN_FLOW_CODES.advanceTurn ? 1 : 0,
    shouldStartAction: actionCode === ENEMY_TURN_FLOW_CODES.startAction ? 1 : 0,
  };
}

function ownerDecisionFromResult(result, jsDecision) {
  const actionCode = Math.max(0, Math.trunc(numberOr(result?.actionCode, jsDecision.actionCode)));
  return {
    ...jsDecision,
    owner: String(result?.owner || 'rust'),
    activeEnemyUID: nonNegativeInt(result?.activeEnemyUID ?? jsDecision.activeEnemyUID),
    turnPhase: Math.trunc(numberOr(result?.turnPhase, ENEMY_TURN_PHASE)),
    actionCode,
    shouldAdvance: actionCode === ENEMY_TURN_FLOW_CODES.advanceTurn ? 1 : 0,
    shouldStartAction: actionCode === ENEMY_TURN_FLOW_CODES.startAction ? 1 : 0,
    jsDecision,
  };
}

export function resolveEnemyTurnFlow({
  source = 'unknown',
  ownerHook = null,
  ...payload
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    activeEnemyUID: nonNegativeInt(payload.activeEnemyUID),
    enemyExists: boolCode(payload.enemyExists),
    enemyHp: numberOr(payload.enemyHp, 0),
  };
  const jsDecision = enemyTurnFlowFromJs(normalized);

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsTurnPhase: jsDecision.turnPhase,
        jsActionCode: jsDecision.actionCode,
        jsActiveEnemyUID: jsDecision.activeEnemyUID,
      });
      if (Number.isFinite(Number(result?.actionCode))) {
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
