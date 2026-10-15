const VALID_TARGET_PREFERENCES = new Set([
  'low_hp',
  'highest_atk',
  'frontline',
  'healer',
]);

export const ENEMY_TARGET_PREFERENCE_CODES = Object.freeze({
  none: 0,
  low_hp: 1,
  highest_atk: 2,
  frontline: 3,
  healer: 4,
});

export const ENEMY_TARGET_MODE_CODES = Object.freeze({
  none: 0,
  uniform: 1,
  identity_preference: 2,
  stable_order: 3,
});

function liveHeroes(heroes) {
  return (Array.isArray(heroes) ? heroes : []).filter((h) => h && Number(h.hp ?? 0) > 0);
}

export function normalizeEnemyTargetPreference(enemy = null) {
  const raw = String(
    enemy?.targetPreference
      ?? enemy?.targetingPreference
      ?? enemy?.targetingPolicy
      ?? enemy?.targetPolicy
      ?? '',
  ).trim().toLowerCase();
  return VALID_TARGET_PREFERENCES.has(raw) ? raw : '';
}

export function enemyTargetPreferenceCodeFromId(preference = '') {
  return ENEMY_TARGET_PREFERENCE_CODES[String(preference || '').trim().toLowerCase()]
    ?? ENEMY_TARGET_PREFERENCE_CODES.none;
}

export function enemyTargetPreferenceFromCode(code = 0) {
  const normalized = Math.max(0, Math.trunc(Number(code || 0)));
  return Object.entries(ENEMY_TARGET_PREFERENCE_CODES)
    .find(([, value]) => value === normalized)?.[0] || 'none';
}

export function enemyTargetModeCodeFromId(mode = '') {
  return ENEMY_TARGET_MODE_CODES[String(mode || '').trim().toLowerCase()]
    ?? ENEMY_TARGET_MODE_CODES.none;
}

export function enemyTargetModeFromCode(code = 0) {
  const normalized = Math.max(0, Math.trunc(Number(code || 0)));
  return Object.entries(ENEMY_TARGET_MODE_CODES)
    .find(([, value]) => value === normalized)?.[0] || 'none';
}

function statValue(hero, stat) {
  return Number(hero?.stats?.[stat] ?? hero?.[stat] ?? 0);
}

function heroRoleCode(hero = null) {
  const role = String(hero?.role ?? hero?.heroRole ?? hero?.classRole ?? '').toLowerCase();
  return role.includes('heal') || role.includes('support') ? 1 : 0;
}

function normalizeHeroForOwner(hero = null, order = 0) {
  const hp = Math.max(0, Number(hero?.hp ?? 0));
  return {
    uid: Number(hero?.uid || 0),
    hp,
    maxHP: Math.max(1, Number(hero?.maxHP ?? hp ?? 1)),
    atk: statValue(hero, 'ATK'),
    slot: Number(hero?.slotIndex ?? hero?.displaySlot ?? order),
    roleCode: heroRoleCode(hero),
  };
}

export function pickEnemyTargetHeroFromRoster({ enemy = null, heroes = [] } = {}) {
  const candidates = liveHeroes(heroes);
  if (!candidates.length) {
    return {
      target: null,
      trace: {
        enemyUID: Number(enemy?.uid || 0),
        mode: 'none',
        targetUID: 0,
        heroCount: 0,
      },
    };
  }

  const target = candidates[0] || null;
  return {
    target,
    trace: {
      enemyUID: Number(enemy?.uid || 0),
      mode: 'stable_order',
      targetUID: Number(target?.uid || 0),
      heroCount: candidates.length,
      roll: 0,
      rollUnit: 0,
    },
  };
}

export function enemyTargetSelectionFromJs({ enemy = null, heroes = [], rng = Math.random } = {}) {
  const result = pickEnemyTargetHeroFromRoster({ enemy, heroes, rng });
  const trace = result.trace || {};
  return {
    owner: 'fallback',
    target: result.target || null,
    targetUID: Number(result.target?.uid || 0),
    mode: String(trace.mode || 'none'),
    modeCode: enemyTargetModeCodeFromId(trace.mode || 'none'),
    preference: '',
    preferenceCode: ENEMY_TARGET_PREFERENCE_CODES.none,
    heroCount: Number(trace.heroCount || 0),
    rollIndex: Number(trace.roll || 0),
    rollUnit: Number(trace.rollUnit || 0),
    trace,
  };
}

export function resolveEnemyTargetHero({
  enemy = null,
  heroes = [],
  rng = Math.random,
  ownerHook = null,
} = {}) {
  const jsDecision = enemyTargetSelectionFromJs({ enemy, heroes, rng });

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        enemyUID: Number(enemy?.uid || 0),
        preference: jsDecision.preference,
        preferenceCode: jsDecision.preferenceCode,
        roll: jsDecision.rollUnit,
        heroes: (Array.isArray(heroes) ? heroes : []).slice(0, 6).map(normalizeHeroForOwner),
        jsTargetUID: jsDecision.targetUID,
        jsModeCode: jsDecision.modeCode,
        jsRollIndex: jsDecision.rollIndex,
      });
      const targetUID = Number(result?.targetUID || 0);
      const modeCode = Number(result?.modeCode ?? jsDecision.modeCode);
      const rollIndex = Number(result?.rollIndex ?? jsDecision.rollIndex);
      const target = (Array.isArray(heroes) ? heroes : []).find((hero) => Number(hero?.uid || 0) === targetUID && Number(hero?.hp || 0) > 0) || null;
      if (target || targetUID === 0) {
        const mode = enemyTargetModeFromCode(modeCode);
        return {
          owner: String(result?.owner || 'rust'),
          target,
          targetUID,
          mode,
          modeCode,
          preference: jsDecision.preference,
          preferenceCode: jsDecision.preferenceCode,
          heroCount: jsDecision.heroCount,
          rollIndex,
          rollUnit: jsDecision.rollUnit,
          jsDecision,
          trace: {
            enemyUID: Number(enemy?.uid || 0),
            mode,
            preference: mode === 'identity_preference' ? jsDecision.preference : undefined,
            targetUID,
            heroCount: jsDecision.heroCount,
            roll: rollIndex,
            owner: String(result?.owner || 'rust'),
            jsTargetUID: jsDecision.targetUID,
          },
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
