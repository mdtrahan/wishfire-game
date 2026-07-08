export const ENEMY_KIND_CODES = Object.freeze({
  fallback: 0,
  Djinn: 1,
  Marid: 2,
  Chimerilass: 3,
});

export const ENEMY_SKILL_CODES = Object.freeze({
  Enemy_ATK_Single: 0,
  Enemy_Scathe: 1,
  Enemy_MAG_Single: 2,
  Enemy_Sweep: 3,
  Enemy_Wipe: 4,
  Enemy_Heal_Self: 5,
  Enemy_Heal_Ally: 6,
  Enemy_Heal_Allies: 7,
});

export const ENEMY_SKILL_IDS = Object.freeze([
  'Enemy_ATK_Single',
  'Enemy_Scathe',
  'Enemy_MAG_Single',
  'Enemy_Sweep',
  'Enemy_Wipe',
  'Enemy_Heal_Self',
  'Enemy_Heal_Ally',
  'Enemy_Heal_Allies',
]);

export const ENEMY_SKILL_BRANCH_CODES = Object.freeze({
  fallback: 0,
  special: 1,
  regular: 2,
  cmh_over_50_no_heal: 3,
  cmh_under_50_forced_heal: 4,
  special_blocked_incomplete_board: 5,
  regular_blocked_incomplete_board: 6,
  fallback_blocked_incomplete_board: 7,
  opening: 8,
  loop: 9,
  rule_heal_party: 10,
  rule_heal_ally: 11,
  rule_heal_self: 12,
  rule_heal_party_critical: 13,
  rule_heal_ally_critical: 14,
  rule_heal_self_critical: 15,
  repeat_prevented_heal: 16,
  repeat_prevented_special: 17,
  opening_blocked_incomplete_board: 18,
  loop_blocked_incomplete_board: 19,
});

export const ENEMY_SKILL_BRANCH_IDS = Object.freeze([
  'fallback',
  'special',
  'regular',
  'cmh_over_50_no_heal',
  'cmh_under_50_forced_heal',
  'special_blocked_incomplete_board',
  'regular_blocked_incomplete_board',
  'fallback_blocked_incomplete_board',
  'opening',
  'loop',
  'rule_heal_party',
  'rule_heal_ally',
  'rule_heal_self',
  'rule_heal_party_critical',
  'rule_heal_ally_critical',
  'rule_heal_self_critical',
  'repeat_prevented_heal',
  'repeat_prevented_special',
  'opening_blocked_incomplete_board',
  'loop_blocked_incomplete_board',
]);

const DEFAULT_MELEE_SCRIPT = Object.freeze({
  opening: ENEMY_SKILL_CODES.Enemy_ATK_Single,
  loop: Object.freeze([ENEMY_SKILL_CODES.Enemy_ATK_Single]),
  fallback: ENEMY_SKILL_CODES.Enemy_ATK_Single,
});

const SCRIPT_BY_KIND = Object.freeze({
  [ENEMY_KIND_CODES.Djinn]: Object.freeze({
    opening: ENEMY_SKILL_CODES.Enemy_Scathe,
    loop: Object.freeze([
      ENEMY_SKILL_CODES.Enemy_MAG_Single,
      ENEMY_SKILL_CODES.Enemy_MAG_Single,
    ]),
    fallback: ENEMY_SKILL_CODES.Enemy_MAG_Single,
  }),
  [ENEMY_KIND_CODES.Marid]: Object.freeze({
    opening: ENEMY_SKILL_CODES.Enemy_Sweep,
    loop: Object.freeze([
      ENEMY_SKILL_CODES.Enemy_MAG_Single,
      ENEMY_SKILL_CODES.Enemy_MAG_Single,
    ]),
    fallback: ENEMY_SKILL_CODES.Enemy_MAG_Single,
  }),
  [ENEMY_KIND_CODES.Chimerilass]: Object.freeze({
    opening: ENEMY_SKILL_CODES.Enemy_MAG_Single,
    loop: Object.freeze([ENEMY_SKILL_CODES.Enemy_MAG_Single]),
    fallback: ENEMY_SKILL_CODES.Enemy_MAG_Single,
  }),
});

const HEAL_SKILL_CODES = Object.freeze([
  ENEMY_SKILL_CODES.Enemy_Heal_Self,
  ENEMY_SKILL_CODES.Enemy_Heal_Ally,
  ENEMY_SKILL_CODES.Enemy_Heal_Allies,
]);

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function wholeNumberOr(value, fallback = 0) {
  return Math.trunc(numberOr(value, fallback));
}

function positiveWholeOr(value, fallback = 0) {
  return Math.max(0, wholeNumberOr(value, fallback));
}

export function enemyKindCodeFromName(name = '') {
  return ENEMY_KIND_CODES[String(name || '')] || ENEMY_KIND_CODES.fallback;
}

export function enemySkillIdFromCode(code = 0) {
  return ENEMY_SKILL_IDS[Math.max(0, Math.trunc(numberOr(code, 0)))] || 'Enemy_ATK_Single';
}

export function enemySkillCodeFromId(skillId = '') {
  return ENEMY_SKILL_CODES[String(skillId || '')] ?? ENEMY_SKILL_CODES.Enemy_ATK_Single;
}

export function enemySkillBranchFromCode(code = 0) {
  return ENEMY_SKILL_BRANCH_IDS[Math.max(0, Math.trunc(numberOr(code, 0)))] || 'fallback';
}

export function enemySkillBranchCodeFromId(branch = '') {
  return ENEMY_SKILL_BRANCH_CODES[String(branch || '')] ?? ENEMY_SKILL_BRANCH_CODES.fallback;
}

function normalizeSkillCode(value, skillId = '') {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.trunc(numeric);
  }
  if (String(skillId || '')) {
    return enemySkillCodeFromId(skillId);
  }
  return -1;
}

function isHealSkillCode(skillCode) {
  return HEAL_SKILL_CODES.includes(Math.trunc(numberOr(skillCode, -1)));
}

function isBoardLockSkillCode(skillCode) {
  const normalized = Math.trunc(numberOr(skillCode, -1));
  return normalized === ENEMY_SKILL_CODES.Enemy_Scathe
    || normalized === ENEMY_SKILL_CODES.Enemy_Sweep;
}

function branchCodeFromSkillBranch(branch) {
  return enemySkillBranchCodeFromId(branch);
}

function makeDecision(selectedCode, branch) {
  return {
    selectedCode,
    branchCode: branchCodeFromSkillBranch(branch),
  };
}

function getScript(kindCode) {
  return SCRIPT_BY_KIND[kindCode] || DEFAULT_MELEE_SCRIPT;
}

function loopChoice(script, behaviorTurn) {
  const loop = Array.isArray(script.loop) && script.loop.length ? script.loop : [script.fallback];
  const loopIndex = Math.max(0, positiveWholeOr(behaviorTurn, 1) - 1) % loop.length;
  return loop[loopIndex] ?? script.fallback;
}

function scriptChoice(kindCode, behaviorTurn, lastSkillCode) {
  const script = getScript(kindCode);
  const turn = positiveWholeOr(behaviorTurn, 0);
  const selectedCode = turn === 0 ? script.opening : loopChoice(script, turn);
  const branch = turn === 0 ? 'opening' : 'loop';
  if (isBoardLockSkillCode(selectedCode) && selectedCode === Math.trunc(numberOr(lastSkillCode, -1))) {
    return makeDecision(script.fallback, 'repeat_prevented_special');
  }
  return makeDecision(selectedCode, branch);
}

function applyBoardFallback(kindCode, boardReady, selectedCode, branchCode) {
  if (Number(boardReady || 0) === 1) return { selectedCode, branchCode };
  if (!isBoardLockSkillCode(selectedCode)) {
    return { selectedCode, branchCode };
  }
  const branch = enemySkillBranchFromCode(branchCode) === 'loop'
    ? 'loop_blocked_incomplete_board'
    : 'opening_blocked_incomplete_board';
  return {
    selectedCode: getScript(kindCode).fallback,
    branchCode: enemySkillBranchCodeFromId(branch),
  };
}

function isSelfCritical(hp, maxHP) {
  const hpValue = numberOr(hp, 0);
  const maxValue = Math.max(1, numberOr(maxHP, hpValue || 1));
  return hpValue > 0 && hpValue <= Math.floor(maxValue * 0.25);
}

function chimerilassRuleChoice({
  hp,
  maxHP,
  damagedAlliesCount,
  criticalAlliesCount,
  lastSkillCode,
}) {
  const hpValue = numberOr(hp, 0);
  const maxValue = Math.max(1, numberOr(maxHP, hpValue || 1));
  const damaged = positiveWholeOr(damagedAlliesCount, 0);
  const criticalAllies = positiveWholeOr(criticalAlliesCount, 0);
  const selfCritical = isSelfCritical(hpValue, maxValue);

  let decision = null;
  if (damaged >= 2) {
    decision = makeDecision(
      ENEMY_SKILL_CODES.Enemy_Heal_Allies,
      criticalAllies > 0 ? 'rule_heal_party_critical' : 'rule_heal_party',
    );
  } else if (damaged >= 1) {
    decision = makeDecision(
      ENEMY_SKILL_CODES.Enemy_Heal_Ally,
      criticalAllies > 0 ? 'rule_heal_ally_critical' : 'rule_heal_ally',
    );
  } else if (hpValue < maxValue && hpValue <= Math.floor(maxValue * 0.5)) {
    decision = makeDecision(
      ENEMY_SKILL_CODES.Enemy_Heal_Self,
      selfCritical ? 'rule_heal_self_critical' : 'rule_heal_self',
    );
  }

  if (
    decision
    && isHealSkillCode(lastSkillCode)
    && criticalAllies <= 0
    && !selfCritical
  ) {
    return makeDecision(ENEMY_SKILL_CODES.Enemy_MAG_Single, 'repeat_prevented_heal');
  }
  return decision;
}

export function enemySkillChoiceFromJs({
  enemyName = '',
  enemyKindCode = null,
  hp = 0,
  maxHP = 0,
  damagedAlliesCount = 0,
  criticalAlliesCount = 0,
  boardReady = 1,
  behaviorTurn = 0,
  lastBehaviorSkill = '',
  lastBehaviorSkillCode = -1,
  roll = 0,
  healRoll = 0,
} = {}) {
  const kindCode = enemyKindCode == null
    ? enemyKindCodeFromName(enemyName)
    : Math.max(0, Math.trunc(numberOr(enemyKindCode, 0)));
  const hpValue = numberOr(hp, 0);
  const maxValue = Math.max(1, numberOr(maxHP, hpValue || 1));
  const lastSkillCode = normalizeSkillCode(lastBehaviorSkillCode, lastBehaviorSkill);

  let decision = null;
  if (kindCode === ENEMY_KIND_CODES.Chimerilass) {
    decision = chimerilassRuleChoice({
      hp: hpValue,
      maxHP: maxValue,
      damagedAlliesCount,
      criticalAlliesCount,
      lastSkillCode,
    });
  }

  if (!decision) {
    decision = scriptChoice(kindCode, behaviorTurn, lastSkillCode);
    decision = applyBoardFallback(kindCode, boardReady, decision.selectedCode, decision.branchCode);
  }

  return {
    owner: 'fallback',
    enemyKindCode: kindCode,
    selectedCode: decision.selectedCode,
    selected: enemySkillIdFromCode(decision.selectedCode),
    branchCode: decision.branchCode,
    branch: enemySkillBranchFromCode(decision.branchCode),
    enemyName: String(enemyName || ''),
    behaviorTurn: positiveWholeOr(behaviorTurn, 0),
    lastBehaviorSkill: String(lastBehaviorSkill || ''),
    lastBehaviorSkillCode: lastSkillCode,
    roll: numberOr(roll, 0),
    healRoll: numberOr(healRoll, 0),
  };
}

export function resolveEnemySkillChoice({
  enemyName = '',
  hp = 0,
  maxHP = 0,
  damagedAlliesCount = 0,
  criticalAlliesCount = 0,
  boardReady = 1,
  behaviorTurn = 0,
  lastBehaviorSkill = '',
  lastBehaviorSkillCode = -1,
  roll = 0,
  healRoll = 0,
  ownerHook = null,
} = {}) {
  const jsDecision = enemySkillChoiceFromJs({
    enemyName,
    hp,
    maxHP,
    damagedAlliesCount,
    criticalAlliesCount,
    boardReady,
    behaviorTurn,
    lastBehaviorSkill,
    lastBehaviorSkillCode,
    roll,
    healRoll,
  });

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        enemyName: String(enemyName || ''),
        enemyKindCode: jsDecision.enemyKindCode,
        hp: numberOr(hp, 0),
        maxHP: Math.max(1, numberOr(maxHP, hp || 1)),
        damagedAlliesCount: Math.max(0, Math.trunc(numberOr(damagedAlliesCount, 0))),
        criticalAlliesCount: Math.max(0, Math.trunc(numberOr(criticalAlliesCount, 0))),
        boardReady: Number(boardReady || 0) === 1 ? 1 : 0,
        behaviorTurn: positiveWholeOr(behaviorTurn, 0),
        lastBehaviorSkill: String(lastBehaviorSkill || ''),
        lastBehaviorSkillCode: jsDecision.lastBehaviorSkillCode,
        roll: numberOr(roll, 0),
        healRoll: numberOr(healRoll, 0),
        jsSelectedCode: jsDecision.selectedCode,
        jsBranchCode: jsDecision.branchCode,
      });
      const selectedCode = Number(result?.selectedCode);
      const branchCode = Number(result?.branchCode);
      if (Number.isFinite(selectedCode) && Number.isFinite(branchCode)) {
        return {
          owner: String(result?.owner || 'rust'),
          enemyKindCode: jsDecision.enemyKindCode,
          selectedCode,
          selected: enemySkillIdFromCode(selectedCode),
          branchCode,
          branch: enemySkillBranchFromCode(branchCode),
          enemyName: String(enemyName || ''),
          behaviorTurn: jsDecision.behaviorTurn,
          lastBehaviorSkill: jsDecision.lastBehaviorSkill,
          lastBehaviorSkillCode: jsDecision.lastBehaviorSkillCode,
          roll: numberOr(roll, 0),
          healRoll: numberOr(healRoll, 0),
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
