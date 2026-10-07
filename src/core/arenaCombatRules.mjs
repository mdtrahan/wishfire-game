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
  return isActorRanged(actor) ? 146 : 46;
}

export function isActorRanged(actor) {
  return actor?.kind === 'enemy'
    ? String(actor?.streamDelivery || '').toLowerCase() === 'ranged'
    : String(actor?.attackType || '').toLowerCase() === 'magic';
}

export function actorFootprintRadius(actor) {
  return String(actor?.combatRank || actor?.enemyRole || actor?.role || '').toLowerCase() === 'boss' ? 72 : 18;
}

function actorBodyReach(actor) {
  // Boss attacks originate from the edge of the four-times body. Ordinary
  // actors retain the established foot-to-target reach contract.
  return String(actor?.combatRank || actor?.enemyRole || actor?.role || '').toLowerCase() === 'boss'
    ? actorFootprintRadius(actor)
    : 0;
}

export function isActorTargetInRange(actor, target) {
  if (!actor || !target || number(actor.hp) <= 0 || number(target.hp) <= 0) return false;
  if (target.streamState === 'approaching') return false;
  const source = actorFootPoint(actor), destination = actorFootPoint(target);
  return Math.hypot(destination.x - source.x, destination.y - source.y) <= actorAttackReach(actor) + actorBodyReach(actor) + actorFootprintRadius(target);
}

export function advanceActorToward(actor, target, { seconds = 0, speed = 0, now = 0, minX = 0, maxX = 360, minY = 0, maxY = 640, preserveActionState = false } = {}) {
  const source = actorFootPoint(actor), destination = actorFootPoint(target);
  const reach = actorAttackReach(actor) + actorBodyReach(actor) + actorFootprintRadius(target);
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
  if (Math.abs(dx) > 1e-6) actor.facing = dx > 0 ? 'right' : 'left';
  actor.arenaEnabled = true;
  const nextLocomotion = moved > 0 ? 'walk' : 'idle';
  if (actor.locomotion !== nextLocomotion) actor.locomotionStartedAt = number(now);
  actor.locomotion = nextLocomotion;
  if (!preserveActionState) actor.actionState = actor.locomotion;
  return moved;
}
