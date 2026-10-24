import { actorFootPoint } from './arenaCombatRules.mjs';
import { deriveCombatWorldBounds } from './combatOrientation.mjs';
import { isActorRanged, isActorTargetInRange } from './arenaCombatRules.mjs';

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function isHeroBasicTargetInRange(enemy, hero) {
  if (!hero || !enemy || number(hero.hp)<=0 || number(enemy.hp)<=0 || enemy.streamState==='approaching') return false;
  if (String(enemy.combatRank || enemy.enemyRole || enemy.role || '').toLowerCase()==='boss') return true;
  const source=actorFootPoint(hero),target=actorFootPoint(enemy);
  return Math.hypot(target.x-source.x,target.y-source.y) <= (Number(hero.basicAttackScreenWidth)>0 ? Number(hero.basicAttackScreenWidth) : deriveCombatWorldBounds().visibleWorldWidth);
}

export { isActorRanged, isActorTargetInRange };

export function resolveHeroAttackTarget({ hero = null, enemies = [], randomPick = null, inRange = null } = {}) {
  const living = Array.isArray(enemies)
    ? enemies.filter(enemy => enemy && number(enemy.hp) > 0 && (!inRange || inRange(enemy)))
    : [];
  if (!living.length) return null;
  if (hero) {
    const source=actorFootPoint(hero);
    return living.sort((a,b)=>{
      const pa=actorFootPoint(a),pb=actorFootPoint(b);
      return Math.hypot(pa.x-source.x,pa.y-source.y)-Math.hypot(pb.x-source.x,pb.y-source.y)||number(a.uid)-number(b.uid);
    })[0];
  }
  return typeof randomPick === 'function' ? randomPick(living) || null : null;
}
