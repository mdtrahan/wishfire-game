import { isActorRanged, isActorTargetInRange } from './arenaCombatRules.mjs';

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function isHeroBasicTargetInRange(enemy, hero) {
  return !!hero && isActorTargetInRange(hero, enemy);
}

export { isActorRanged, isActorTargetInRange };

export function resolveHeroAttackTarget({ enemies = [], focusUID = null, randomPick = null, inRange = null } = {}) {
  const living = Array.isArray(enemies)
    ? enemies.filter(enemy => enemy && number(enemy.hp) > 0 && (!inRange || inRange(enemy)))
    : [];
  if (!living.length) return null;
  if (focusUID !== null) return living.find(enemy => number(enemy.uid) === number(focusUID)) || living[0];
  return typeof randomPick === 'function' ? randomPick(living) || null : null;
}
