import { HERO_FORMATION_WIDTH } from "./heroFormationGeometry.mjs";
const finite = (value) => Number.isFinite(Number(value));
const number = (value) => finite(value) ? Number(value) : 0;
const ARENA_ACTOR_SEMANTIC_FIELDS = Object.freeze([
  "footX",
  "footY",
  "facing",
  "locomotion",
  "actionState"
]);
function actorFootPoint(actor) {
  return {
    x: number(actor?.footX ?? actor?.x),
    y: number(actor?.footY ?? actor?.y)
  };
}
function actorAttackReach(actor) {
  return actor?.kind === "hero" ? 92 * (Number(actor.attackRangeMultiplier) > 0 ? Number(actor.attackRangeMultiplier) : 1) : Math.max(isActorRanged(actor) ? 146 : 46, 46 * actorFootprintRadius(actor) / 18);
}
function isActorRanged(actor) {
  return actor?.kind === "enemy" ? String(actor?.streamDelivery || "").toLowerCase() === "ranged" : String(actor?.attackType || "").toLowerCase() === "magic";
}
function actorFootprintRadius(actor) {
  return String(actor?.combatRank || actor?.enemyRole || actor?.role || "").toLowerCase() === "boss" ? 72 : 18;
}
function actorBodyReach(actor) {
  return String(actor?.combatRank || actor?.enemyRole || actor?.role || "").toLowerCase() === "boss" ? actorFootprintRadius(actor) : 0;
}
function heroSpecialReach(actor) {
  return Math.max(2 * HERO_FORMATION_WIDTH, actorAttackReach(actor));
}
function isActorTargetInRange(actor, target) {
  if (!actor || !target || number(actor.hp) <= 0 || number(target.hp) <= 0) return false;
  if (target.streamState === "approaching") return false;
  if (actor.kind === "hero" && String(target.combatRank || target.enemyRole || target.role || "").toLowerCase() === "boss") return true;
  const source = actorFootPoint(actor), destination = actorFootPoint(target);
  return Math.hypot(destination.x - source.x, destination.y - source.y) <= actorAttackReach(actor) + actorBodyReach(actor) + actorFootprintRadius(target);
}
export {
  actorFootPoint,
  actorFootprintRadius,
  heroSpecialReach,
  isActorTargetInRange
};
