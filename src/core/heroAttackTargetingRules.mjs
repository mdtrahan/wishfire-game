import { COMBAT_ARENA_BOUNDS } from './combatOrientation.mjs';
import { isActorTargetInRange } from './arenaCombatRules.mjs';

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function isHeroBasicTargetInRange(enemy, attackStartX = COMBAT_ARENA_BOUNDS.attackStartX) {
  if (attackStartX && typeof attackStartX === 'object') return isActorTargetInRange(attackStartX, enemy);
  return !!enemy && number(enemy.hp) > 0 && enemy.x != null && enemy.streamState !== 'approaching'
    && Number.isFinite(Number(enemy.x)) && Number(enemy.x) >= 0 && Number(enemy.x) <= attackStartX;
}

export { isActorTargetInRange };

export function resolveHeroAttackTarget({ enemies = [], focusUID = null, randomPick = null, inRange = null } = {}) {
  const living = Array.isArray(enemies)
    ? enemies.filter(enemy => enemy && number(enemy.hp) > 0 && (!inRange || inRange(enemy)))
    : [];
  if (!living.length) return null;
  if (focusUID !== null) return living.find(enemy => number(enemy.uid) === number(focusUID)) || living[0];
  return typeof randomPick === 'function' ? randomPick(living) || null : null;
}
