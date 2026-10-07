const finite = value => Number.isFinite(Number(value));
const number = value => finite(value) ? Number(value) : 0;

export const ARENA_ACTOR_SEMANTIC_FIELDS = Object.freeze([
  'footX', 'footY', 'facing', 'locomotion', 'actionState',
]);

export function actorFootPoint(actor) {
  return {
    x: number(actor?.footX ?? actor?.x),
    y: number(actor?.footY ?? actor?.y),
  };
}

export function actorAttackReach(actor) {
  const ranged = actor?.kind === 'enemy'
    ? String(actor?.streamDelivery || '').toLowerCase() === 'ranged'
    : String(actor?.attackType || '').toLowerCase() === 'magic';
  return ranged ? 146 : 46;
}

export function actorFootprintRadius(actor) {
  return String(actor?.combatRank || actor?.enemyRole || actor?.role || '').toLowerCase() === 'boss' ? 30 : 18;
}

export function isActorTargetInRange(actor, target) {
  if (!actor || !target || number(actor.hp) <= 0 || number(target.hp) <= 0) return false;
  if (target.streamState === 'approaching') return false;
  if (!actor.arenaEnabled) return finite(target.x) && number(target.x) >= 0 && number(target.x) <= 290;
  const source = actorFootPoint(actor), destination = actorFootPoint(target);
  return Math.hypot(destination.x - source.x, destination.y - source.y) <= actorAttackReach(actor) + actorFootprintRadius(target);
}

export function advanceActorToward(actor, target, { seconds = 0, speed = 0, minX = 0, maxX = 360, minY = 0, maxY = 640, preserveActionState = false } = {}) {
  const source = actorFootPoint(actor), destination = actorFootPoint(target);
  const reach = actorAttackReach(actor) + actorFootprintRadius(target);
  const dx = destination.x - source.x, dy = destination.y - source.y;
  const distance = Math.hypot(dx, dy);
  const gap = Math.max(0, distance - reach);
  const moved = Math.min(gap, Math.max(0, number(seconds)) * Math.max(0, number(speed)));
  if (moved > 0 && distance > 0) {
    actor.footX = Math.max(minX, Math.min(maxX, source.x + dx / distance * moved));
    actor.footY = Math.max(minY, Math.min(maxY, source.y + dy / distance * moved));
    actor.x = actor.footX;
    actor.y = actor.footY;
  } else {
    actor.footX = source.x;
    actor.footY = source.y;
  }
  actor.facing = destination.x >= source.x ? 'right' : 'left';
  actor.arenaEnabled = true;
  actor.locomotion = moved > 0 ? 'walk' : 'idle';
  if (!preserveActionState) actor.actionState = actor.locomotion;
  return moved;
}
