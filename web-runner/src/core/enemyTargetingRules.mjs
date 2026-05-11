const VALID_TARGET_PREFERENCES = new Set([
  'low_hp',
  'highest_atk',
  'frontline',
  'healer',
]);

function liveHeroes(heroes) {
  return (Array.isArray(heroes) ? heroes : []).filter((h) => h && Number(h.hp ?? 0) > 0);
}

function randomIndex(rng, size) {
  if (!(size > 0)) return 0;
  const raw = Number((typeof rng === 'function' ? rng() : Math.random()) ?? 0);
  const value = Number.isFinite(raw) && raw >= 0 && raw < 1 ? raw : Math.random();
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

  const roll = randomIndex(rng, candidates.length);
  const target = candidates[roll] || candidates[0] || null;
  return {
    target,
    trace: {
      enemyUID: Number(enemy?.uid || 0),
      mode: 'uniform',
      targetUID: Number(target?.uid || 0),
      heroCount: candidates.length,
      roll,
    },
  };
}
