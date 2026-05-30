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
]);

const CONFIG_BY_KIND = Object.freeze({
  [ENEMY_KIND_CODES.Djinn]: Object.freeze({
    specialSkillCode: ENEMY_SKILL_CODES.Enemy_Scathe,
    specialChance: 0.30,
    regularSkillCode: ENEMY_SKILL_CODES.Enemy_MAG_Single,
    regularChance: 0.85,
    requiresDamaged: 0,
  }),
  [ENEMY_KIND_CODES.Marid]: Object.freeze({
    specialSkillCode: ENEMY_SKILL_CODES.Enemy_Sweep,
    specialChance: 0.25,
    regularSkillCode: ENEMY_SKILL_CODES.Enemy_MAG_Single,
    regularChance: 0.65,
    requiresDamaged: 0,
  }),
  [ENEMY_KIND_CODES.Chimerilass]: Object.freeze({
    specialSkillCode: ENEMY_SKILL_CODES.Enemy_Wipe,
    specialChance: 0.20,
    regularSkillCode: ENEMY_SKILL_CODES.Enemy_Heal_Self,
    regularChance: 0.49,
    requiresDamaged: 1,
  }),
});

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function clampRoll(value) {
  const normalized = numberOr(value, 0);
  return Math.max(0, Math.min(0.999999999, normalized));
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

function baseEnemySkillChoice(kindCode, hp, maxHP, roll) {
  const conf = CONFIG_BY_KIND[kindCode];
  if (!conf) {
    return {
      selectedCode: ENEMY_SKILL_CODES.Enemy_ATK_Single,
      branchCode: ENEMY_SKILL_BRANCH_CODES.fallback,
    };
  }
  const isDamaged = numberOr(hp, 0) < numberOr(maxHP, 0);
  const hpEligible = conf.requiresDamaged ? isDamaged : true;
  if (hpEligible && clampRoll(roll) < Number(conf.specialChance || 0)) {
    return {
      selectedCode: conf.specialSkillCode,
      branchCode: ENEMY_SKILL_BRANCH_CODES.special,
    };
  }
  if (hpEligible && clampRoll(roll) < Number(conf.regularChance || 0)) {
    return {
      selectedCode: conf.regularSkillCode,
      branchCode: ENEMY_SKILL_BRANCH_CODES.regular,
    };
  }
  return {
    selectedCode: ENEMY_SKILL_CODES.Enemy_ATK_Single,
    branchCode: ENEMY_SKILL_BRANCH_CODES.fallback,
  };
}

function applyBoardFallback(kindCode, boardReady, selectedCode, branchCode) {
  if (Number(boardReady || 0) === 1) return { selectedCode, branchCode };
  if (
    selectedCode !== ENEMY_SKILL_CODES.Enemy_Scathe
    && selectedCode !== ENEMY_SKILL_CODES.Enemy_Sweep
  ) {
    return { selectedCode, branchCode };
  }
  const conf = CONFIG_BY_KIND[kindCode];
  return {
    selectedCode: conf?.regularSkillCode ?? ENEMY_SKILL_CODES.Enemy_ATK_Single,
    branchCode: Number(branchCode || 0) === ENEMY_SKILL_BRANCH_CODES.special
      ? ENEMY_SKILL_BRANCH_CODES.special_blocked_incomplete_board
      : ENEMY_SKILL_BRANCH_CODES.regular_blocked_incomplete_board,
  };
}

function chimerilassHealChoice(hp, maxHP, damagedAlliesCount, healRoll) {
  const weighted = [];
  if (numberOr(damagedAlliesCount, 0) > 1) {
    weighted.push({ selectedCode: ENEMY_SKILL_CODES.Enemy_Heal_Allies, weight: 20 });
  }
  if (numberOr(damagedAlliesCount, 0) > 0) {
    weighted.push({ selectedCode: ENEMY_SKILL_CODES.Enemy_Heal_Ally, weight: 15 });
  }
  if (numberOr(hp, 0) < numberOr(maxHP, 0)) {
    weighted.push({ selectedCode: ENEMY_SKILL_CODES.Enemy_Heal_Self, weight: 65 });
  }
  if (!weighted.length) return null;

  const total = weighted.reduce((sum, row) => sum + Number(row.weight || 0), 0);
  let pick = clampRoll(healRoll) * total;
  let selected = weighted[weighted.length - 1];
  for (const row of weighted) {
    pick -= row.weight;
    if (pick <= 0) {
      selected = row;
      break;
    }
  }
  return {
    selectedCode: selected.selectedCode,
    branchCode: ENEMY_SKILL_BRANCH_CODES.cmh_under_50_forced_heal,
  };
}

export function enemySkillChoiceFromJs({
  enemyName = '',
  enemyKindCode = null,
  hp = 0,
  maxHP = 0,
  damagedAlliesCount = 0,
  boardReady = 1,
  roll = 0,
  healRoll = 0,
} = {}) {
  const kindCode = enemyKindCode == null
    ? enemyKindCodeFromName(enemyName)
    : Math.max(0, Math.trunc(numberOr(enemyKindCode, 0)));
  const hpValue = numberOr(hp, 0);
  const maxValue = Math.max(1, numberOr(maxHP, hpValue || 1));
  const belowHalfHP = hpValue <= Math.floor(maxValue * 0.5);

  let decision = null;
  if (kindCode === ENEMY_KIND_CODES.Chimerilass) {
    if (!belowHalfHP) {
      decision = baseEnemySkillChoice(kindCode, hpValue, maxValue, roll);
      if (
        decision.selectedCode === ENEMY_SKILL_CODES.Enemy_Heal_Self
        || decision.selectedCode === ENEMY_SKILL_CODES.Enemy_Heal_Ally
        || decision.selectedCode === ENEMY_SKILL_CODES.Enemy_Heal_Allies
        || decision.selectedCode === ENEMY_SKILL_CODES.Enemy_Wipe
      ) {
        decision = {
          selectedCode: ENEMY_SKILL_CODES.Enemy_MAG_Single,
          branchCode: ENEMY_SKILL_BRANCH_CODES.cmh_over_50_no_heal,
        };
      }
    } else {
      decision = chimerilassHealChoice(hpValue, maxValue, damagedAlliesCount, healRoll);
    }
  }

  if (!decision) {
    decision = baseEnemySkillChoice(kindCode, hpValue, maxValue, roll);
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
    roll: numberOr(roll, 0),
  };
}

export function resolveEnemySkillChoice({
  enemyName = '',
  hp = 0,
  maxHP = 0,
  damagedAlliesCount = 0,
  boardReady = 1,
  roll = 0,
  healRoll = 0,
  ownerHook = null,
} = {}) {
  const jsDecision = enemySkillChoiceFromJs({
    enemyName,
    hp,
    maxHP,
    damagedAlliesCount,
    boardReady,
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
        boardReady: Number(boardReady || 0) === 1 ? 1 : 0,
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
          roll: numberOr(roll, 0),
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
