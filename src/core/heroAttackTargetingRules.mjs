const ROLE_BY_HERO_KEY = Object.freeze({
  falie: 'tank',
  fara: 'tank',
  huun: 'fighter',
  hondo: 'fighter',
  runa: 'controller',
  kojonn: 'support',
  kaja: 'support',
});

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function stat(actor, key) {
  return number(actor?.stats?.[key] ?? actor?.[key]);
}

function roleForHero(hero) {
  const declared = String(hero?.role ?? hero?.heroRole ?? hero?.classRole ?? '').trim().toLowerCase();
  if (declared.includes('tank')) return 'tank';
  if (declared.includes('fighter') || declared.includes('dps')) return 'fighter';
  if (declared.includes('controller')) return 'controller';
  if (declared.includes('support') || declared.includes('guardian')) return 'support';
  if (declared) return '';
  return ROLE_BY_HERO_KEY[String(hero?.baseHeroName ?? hero?.name ?? '').trim().toLowerCase()] || '';
}

function selectByCriteria(enemies, criteria) {
  return enemies.slice().sort((left, right) => {
    for (const [field, direction] of criteria) {
      const delta = (field(left) - field(right)) * direction;
      if (delta !== 0) return delta;
    }
    return number(left?.uid) - number(right?.uid);
  })[0] || null;
}

export function resolveHeroAttackTarget({ hero = null, enemies = [], randomPick = null } = {}) {
  const living = Array.isArray(enemies)
    ? enemies.filter(enemy => enemy && number(enemy.hp) > 0)
    : [];
  if (!living.length) return null;

  const criteriaByRole = {
    tank: [[enemy => number(enemy.hp), -1], [enemy => stat(enemy, 'DEF'), -1]],
    fighter: [[enemy => number(enemy.hp), 1], [enemy => stat(enemy, 'ATK'), -1]],
    controller: [[enemy => stat(enemy, 'SPD'), -1], [enemy => stat(enemy, 'MAG'), -1]],
    support: [[enemy => number(enemy.hp) / Math.max(1, number(enemy.maxHP)), 1], [enemy => stat(enemy, 'MAG'), -1]],
  };
  const criteria = criteriaByRole[roleForHero(hero)];
  return criteria
    ? selectByCriteria(living, criteria)
    : (typeof randomPick === 'function' ? randomPick(living) || null : null);
}
