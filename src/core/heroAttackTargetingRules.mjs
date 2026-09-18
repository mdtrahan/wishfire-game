function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function resolveHeroAttackTarget({ enemies = [], randomPick = null } = {}) {
  const living = Array.isArray(enemies)
    ? enemies.filter(enemy => enemy && number(enemy.hp) > 0)
    : [];
  if (!living.length) return null;
  return typeof randomPick === 'function' ? randomPick(living) || null : null;
}
