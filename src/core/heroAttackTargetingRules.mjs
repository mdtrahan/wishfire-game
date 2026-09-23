function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function resolveHeroAttackTarget({ enemies = [], focusUID = null, randomPick = null } = {}) {
  const living = Array.isArray(enemies)
    ? enemies.filter(enemy => enemy && number(enemy.hp) > 0)
    : [];
  if (!living.length) return null;
  if (focusUID !== null) return living.find(enemy => number(enemy.uid) === number(focusUID)) || living[0];
  return typeof randomPick === 'function' ? randomPick(living) || null : null;
}
