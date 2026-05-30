import {
  ENEMY_KIND_CODES,
  enemyKindCodeFromName,
} from './enemySkillChoiceRules.mjs';

export const ENEMY_JOB_SKILL_UNKNOWN = -1;

export const ENEMY_JOB_SKILL_CODES = Object.freeze({
  Enemy_ATK_Single: 0,
  Enemy_Scathe: 1,
  Enemy_MAG_Single: 2,
  Enemy_Sweep: 3,
  Enemy_Wipe: 4,
  Enemy_Heal_Self: 5,
  Enemy_Heal_Ally: 6,
  Enemy_Heal_Allies: 7,
  Enemy_MAG_AOE: 8,
  Enemy_Drain_Buff: 9,
});

export const ENEMY_JOB_SKILL_IDS = Object.freeze([
  'Enemy_ATK_Single',
  'Enemy_Scathe',
  'Enemy_MAG_Single',
  'Enemy_Sweep',
  'Enemy_Wipe',
  'Enemy_Heal_Self',
  'Enemy_Heal_Ally',
  'Enemy_Heal_Allies',
  'Enemy_MAG_AOE',
  'Enemy_Drain_Buff',
]);

export const ENEMY_JOB_ACTION_CODES = Object.freeze({
  noop: 0,
  attackSingle: 1,
  magicSingle: 2,
  magicAoe: 3,
  healSelf: 4,
  healAllies: 5,
  healAlly: 6,
  scathe: 7,
  sweep: 8,
  drainBuff: 9,
  wipe: 10,
});

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function nonNegativeInt(value) {
  return Math.max(0, Math.floor(numberOr(value, 0)));
}

function normalizeKindCode(enemyKindCode, enemyName = '') {
  if (enemyKindCode == null) return enemyKindCodeFromName(enemyName);
  const normalized = Math.max(0, Math.trunc(numberOr(enemyKindCode, ENEMY_KIND_CODES.fallback)));
  return normalized === ENEMY_KIND_CODES.Djinn
    || normalized === ENEMY_KIND_CODES.Marid
    || normalized === ENEMY_KIND_CODES.Chimerilass
    ? normalized
    : ENEMY_KIND_CODES.fallback;
}

export function enemyJobSkillCodeFromId(skillId = '') {
  const key = String(skillId || '');
  return Object.prototype.hasOwnProperty.call(ENEMY_JOB_SKILL_CODES, key)
    ? ENEMY_JOB_SKILL_CODES[key]
    : ENEMY_JOB_SKILL_UNKNOWN;
}

export function enemyJobSkillIdFromCode(code = ENEMY_JOB_SKILL_UNKNOWN, fallback = 'Enemy_Unknown') {
  const normalized = Math.trunc(numberOr(code, ENEMY_JOB_SKILL_UNKNOWN));
  return ENEMY_JOB_SKILL_IDS[normalized] || fallback;
}

function normalizeSkillCode(value = ENEMY_JOB_SKILL_UNKNOWN) {
  const normalized = Math.trunc(numberOr(value, ENEMY_JOB_SKILL_UNKNOWN));
  if (normalized >= 0 && normalized < ENEMY_JOB_SKILL_IDS.length) return normalized;
  return ENEMY_JOB_SKILL_UNKNOWN;
}

function regularSkillCodeForKind(kindCode = ENEMY_KIND_CODES.fallback) {
  if (kindCode === ENEMY_KIND_CODES.Djinn || kindCode === ENEMY_KIND_CODES.Marid) {
    return ENEMY_JOB_SKILL_CODES.Enemy_MAG_Single;
  }
  if (kindCode === ENEMY_KIND_CODES.Chimerilass) {
    return ENEMY_JOB_SKILL_CODES.Enemy_Heal_Self;
  }
  return ENEMY_JOB_SKILL_CODES.Enemy_ATK_Single;
}

export function enemyJobSkillNormalizedCode({
  skillId = '',
  skillCode = null,
  enemyName = '',
  enemyKindCode = null,
  boardReady = 1,
} = {}) {
  const inputCode = skillCode == null
    ? enemyJobSkillCodeFromId(skillId)
    : normalizeSkillCode(skillCode);
  if (
    Number(boardReady || 0) !== 1
    && (
      inputCode === ENEMY_JOB_SKILL_CODES.Enemy_Scathe
      || inputCode === ENEMY_JOB_SKILL_CODES.Enemy_Sweep
    )
  ) {
    return regularSkillCodeForKind(normalizeKindCode(enemyKindCode, enemyName));
  }
  return inputCode;
}

export function enemyJobSkillResolvedTargetUID(targetUID = 0, fallbackTargetUID = 0) {
  const direct = nonNegativeInt(targetUID);
  return direct > 0 ? direct : nonNegativeInt(fallbackTargetUID);
}

export function enemyJobSkillAllyTargetUID(targetUID = 0) {
  return nonNegativeInt(targetUID);
}

export function enemyJobSkillActionCode(normalizedSkillCode = ENEMY_JOB_SKILL_UNKNOWN, resolvedTargetUID = 0) {
  const skillCode = normalizeSkillCode(normalizedSkillCode);
  if (skillCode === ENEMY_JOB_SKILL_CODES.Enemy_Heal_Self) return ENEMY_JOB_ACTION_CODES.healSelf;
  if (skillCode === ENEMY_JOB_SKILL_CODES.Enemy_Heal_Allies) return ENEMY_JOB_ACTION_CODES.healAllies;
  if (skillCode === ENEMY_JOB_SKILL_CODES.Enemy_Heal_Ally) return ENEMY_JOB_ACTION_CODES.healAlly;
  if (skillCode === ENEMY_JOB_SKILL_CODES.Enemy_Scathe) return ENEMY_JOB_ACTION_CODES.scathe;
  if (skillCode === ENEMY_JOB_SKILL_CODES.Enemy_Sweep) return ENEMY_JOB_ACTION_CODES.sweep;
  if (skillCode === ENEMY_JOB_SKILL_CODES.Enemy_MAG_Single) return ENEMY_JOB_ACTION_CODES.magicSingle;
  if (skillCode === ENEMY_JOB_SKILL_CODES.Enemy_MAG_AOE) return ENEMY_JOB_ACTION_CODES.magicAoe;
  if (skillCode === ENEMY_JOB_SKILL_CODES.Enemy_Drain_Buff) return ENEMY_JOB_ACTION_CODES.drainBuff;
  if (skillCode === ENEMY_JOB_SKILL_CODES.Enemy_Wipe) return ENEMY_JOB_ACTION_CODES.wipe;
  return nonNegativeInt(resolvedTargetUID) > 0
    ? ENEMY_JOB_ACTION_CODES.attackSingle
    : ENEMY_JOB_ACTION_CODES.noop;
}

export function enemyJobSkillReturnValue(actionCode = ENEMY_JOB_ACTION_CODES.noop) {
  return Number(actionCode || 0) === ENEMY_JOB_ACTION_CODES.noop ? 0 : 1;
}

export function enemyJobSkillFromJs({
  skillId = '',
  skillCode = null,
  enemyName = '',
  enemyKindCode = null,
  boardReady = 1,
  targetUID = 0,
  fallbackTargetUID = 0,
} = {}) {
  const inputSkillCode = skillCode == null
    ? enemyJobSkillCodeFromId(skillId)
    : normalizeSkillCode(skillCode);
  const kindCode = normalizeKindCode(enemyKindCode, enemyName);
  const normalizedSkillCode = enemyJobSkillNormalizedCode({
    skillId,
    skillCode: inputSkillCode,
    enemyName,
    enemyKindCode: kindCode,
    boardReady,
  });
  const resolvedTargetUID = enemyJobSkillResolvedTargetUID(targetUID, fallbackTargetUID);
  const allyTargetUID = enemyJobSkillAllyTargetUID(targetUID);
  const actionCode = enemyJobSkillActionCode(normalizedSkillCode, resolvedTargetUID);
  return {
    owner: 'fallback',
    enemyKindCode: kindCode,
    skillId: String(skillId || ''),
    skillCode: inputSkillCode,
    normalizedSkillCode,
    normalizedSkillId: enemyJobSkillIdFromCode(normalizedSkillCode, String(skillId || 'Enemy_Unknown')),
    actionCode,
    resolvedTargetUID,
    allyTargetUID,
    returnValue: enemyJobSkillReturnValue(actionCode),
  };
}

function ownerDecisionFromResult(result, jsDecision) {
  const normalizedSkillCode = normalizeSkillCode(result?.normalizedSkillCode ?? jsDecision.normalizedSkillCode);
  const resolvedTargetUID = nonNegativeInt(result?.resolvedTargetUID ?? jsDecision.resolvedTargetUID);
  const actionCode = Math.max(0, Math.trunc(numberOr(result?.actionCode, enemyJobSkillActionCode(normalizedSkillCode, resolvedTargetUID))));
  return {
    ...jsDecision,
    owner: String(result?.owner || 'rust'),
    normalizedSkillCode,
    normalizedSkillId: enemyJobSkillIdFromCode(normalizedSkillCode, jsDecision.normalizedSkillId),
    actionCode,
    resolvedTargetUID,
    allyTargetUID: nonNegativeInt(result?.allyTargetUID ?? jsDecision.allyTargetUID),
    returnValue: Math.max(0, Math.trunc(numberOr(result?.returnValue, enemyJobSkillReturnValue(actionCode)))),
    jsDecision,
  };
}

export function resolveEnemyJobSkill({
  source = 'unknown',
  ownerHook = null,
  ...payload
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    skillId: String(payload.skillId || ''),
    skillCode: payload.skillCode == null ? null : normalizeSkillCode(payload.skillCode),
    enemyName: String(payload.enemyName || ''),
    enemyKindCode: payload.enemyKindCode == null
      ? null
      : normalizeKindCode(payload.enemyKindCode, payload.enemyName),
    boardReady: Number(payload.boardReady || 0) === 1 ? 1 : 0,
    targetUID: nonNegativeInt(payload.targetUID),
    fallbackTargetUID: nonNegativeInt(payload.fallbackTargetUID),
  };
  const jsDecision = enemyJobSkillFromJs(normalized);

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        skillCode: jsDecision.skillCode,
        enemyKindCode: jsDecision.enemyKindCode,
        jsNormalizedSkillCode: jsDecision.normalizedSkillCode,
        jsActionCode: jsDecision.actionCode,
        jsResolvedTargetUID: jsDecision.resolvedTargetUID,
        jsAllyTargetUID: jsDecision.allyTargetUID,
        jsReturnValue: jsDecision.returnValue,
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
