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
});

function liveHeroes(heroes) {
  return (Array.isArray(heroes) ? heroes : []).filter((h) => h && Number(h.hp ?? 0) > 0);
}

function readRandomUnit(rng) {
  const raw = Number((typeof rng === 'function' ? rng() : Math.random()) ?? 0);
  return Number.isFinite(raw) && raw >= 0 && raw < 1 ? raw : Math.random();
}

function randomIndexFromUnit(unit, size) {
  if (!(size > 0)) return 0;
  const value = Number.isFinite(Number(unit)) && unit >= 0 && unit < 1 ? Number(unit) : 0;
  return Math.max(0, Math.min(size - 1, Math.floor(value * size)));
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

function hpRatio(hero) {
  const hp = Math.max(0, Number(hero?.hp ?? 0));
  const maxHP = Math.max(1, Number(hero?.maxHP ?? hp ?? 1));
  return hp / maxHP;
}

function statValue(hero, stat) {
  return Number(hero?.stats?.[stat] ?? hero?.[stat] ?? 0);
}

function pickPreferredHero(heroes, preference) {
  if (preference === 'low_hp') {
    return heroes.slice().sort((a, b) => hpRatio(a) - hpRatio(b) || Number(a.uid || 0) - Number(b.uid || 0))[0] || null;
  }
  if (preference === 'highest_atk') {
    return heroes.slice().sort((a, b) => statValue(b, 'ATK') - statValue(a, 'ATK') || Number(a.uid || 0) - Number(b.uid || 0))[0] || null;
  }
  if (preference === 'frontline') {
    return heroes.slice().sort((a, b) => Number(a.slotIndex ?? a.displaySlot ?? 0) - Number(b.slotIndex ?? b.displaySlot ?? 0))[0] || null;
  }
  if (preference === 'healer') {
    return heroes.find((h) => {
      const role = String(h?.role ?? h?.heroRole ?? h?.classRole ?? '').toLowerCase();
      return role.includes('heal') || role.includes('support');
    }) || null;
  }
  return null;
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

export function pickEnemyTargetHeroFromRoster({ enemy = null, heroes = [], rng = Math.random } = {}) {
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

  const preference = normalizeEnemyTargetPreference(enemy);
  const preferred = preference ? pickPreferredHero(candidates, preference) : null;
  if (preferred) {
    return {
      target: preferred,
      trace: {
        enemyUID: Number(enemy?.uid || 0),
        mode: 'identity_preference',
        preference,
        targetUID: Number(preferred.uid || 0),
        heroCount: candidates.length,
      },
    };
  }

  const rollUnit = readRandomUnit(rng);
  const roll = randomIndexFromUnit(rollUnit, candidates.length);
  const target = candidates[roll] || candidates[0] || null;
  return {
    target,
    trace: {
      enemyUID: Number(enemy?.uid || 0),
      mode: 'uniform',
      targetUID: Number(target?.uid || 0),
      heroCount: candidates.length,
      roll,
      rollUnit,
    },
  };
}

export function enemyTargetSelectionFromJs({ enemy = null, heroes = [], rng = Math.random } = {}) {
  const result = pickEnemyTargetHeroFromRoster({ enemy, heroes, rng });
  const trace = result.trace || {};
  const preference = normalizeEnemyTargetPreference(enemy);
  return {
    owner: 'fallback',
    target: result.target || null,
    targetUID: Number(result.target?.uid || 0),
    mode: String(trace.mode || 'none'),
    modeCode: enemyTargetModeCodeFromId(trace.mode || 'none'),
    preference,
    preferenceCode: enemyTargetPreferenceCodeFromId(preference),
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
        heroes: (Array.isArray(heroes) ? heroes : []).slice(0, 4).map(normalizeHeroForOwner),
        jsTargetUID: jsDecision.targetUID,
        jsModeCode: jsDecision.modeCode,
        jsRollIndex: jsDecision.rollIndex,
      });
      const targetUID = Number(result?.targetUID || 0);
      const modeCode = Number(result?.modeCode ?? jsDecision.modeCode);
      const rollIndex = Number(result?.rollIndex ?? jsDecision.rollIndex);
      const target = (Array.isArray(heroes) ? heroes : []).find((hero) => Number(hero?.uid || 0) === targetUID) || null;
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
