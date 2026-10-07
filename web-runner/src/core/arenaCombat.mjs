import { advanceActorToward, actorFootPoint, actorFootprintRadius, isActorTargetInRange } from '../../../src/core/arenaCombatRules.mjs';
import { deriveCombatFormationAnchors } from '../../../src/core/combatOrientation.mjs';

const isLiving = actor => actor && Number(actor.hp || 0) > 0;
const distance = (actor, target) => {
  const origin = actorFootPoint(actor), destination = actorFootPoint(target);
  return Math.hypot(destination.x - origin.x, destination.y - origin.y);
};
const nearest = (actor, candidates) => candidates.slice().sort((a, b) => {
  const origin = actorFootPoint(actor), pa = actorFootPoint(a), pb = actorFootPoint(b);
  return Math.hypot(pa.x - origin.x, pa.y - origin.y) - Math.hypot(pb.x - origin.x, pb.y - origin.y)
    || Number(a.uid || 0) - Number(b.uid || 0);
})[0] || null;
const stableNearest = (actor, candidates) => {
  const current = candidates.find(candidate => Number(candidate.uid || 0) === Number(actor.arenaTargetUID || 0));
  const closest = nearest(actor, candidates);
  const chosen = current && (!closest || distance(actor, current) <= distance(actor, closest) + 24) ? current : closest;
  actor.arenaTargetUID = Number(chosen?.uid || 0);
  return chosen;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function separateFootprints(actors, bounds) {
  const ordered = actors.slice().sort((a, b) => Number(a.uid || 0) - Number(b.uid || 0));
  // Several passes settle a compact crowd after one separation changes a
  // neighboring pair. Zero-distance actors split vertically so an X boundary
  // cannot leave them stacked.
  for (let pass = 0; pass < 4; pass += 1) for (let index = 0; index < ordered.length; index += 1) for (let otherIndex = index + 1; otherIndex < ordered.length; otherIndex += 1) {
    const first = ordered[index], second = ordered[otherIndex], a = actorFootPoint(first), b = actorFootPoint(second);
    const minDistance = actorFootprintRadius(first) + actorFootprintRadius(second);
    const currentDistance = Math.hypot(b.x - a.x, b.y - a.y);
    if (currentDistance >= minDistance) continue;
    const dx = currentDistance > 0.001 ? (b.x - a.x) / currentDistance : 0;
    const dy = currentDistance > 0.001 ? (b.y - a.y) / currentDistance : (Number(first.uid || 0) <= Number(second.uid || 0) ? -1 : 1);
    const push = (minDistance - currentDistance) / 2;
    first.footX = clamp(a.x - dx * push, bounds.heroBackCenterX, bounds.attackStartX);
    first.footY = clamp(a.y - dy * push, bounds.visibleTopY, bounds.visibleBottomY);
    second.footX = clamp(b.x + dx * push, bounds.heroBackCenterX, bounds.attackStartX);
    second.footY = clamp(b.y + dy * push, bounds.visibleTopY, bounds.visibleBottomY);
    for (const actor of [first, second]) { actor.x = actor.footX; actor.y = actor.footY; }
  }
}

export function advanceContinuousCombatArena({ globals = {}, entities = [], seconds = 0 } = {}) {
  const heroes = entities.filter(actor => actor?.kind === 'hero' && isLiving(actor));
  // Retreat is stage-owned displacement. Letting its direct steering run here
  // would pull an enemy back toward its target during Frost Reversal.
  const enemies = entities.filter(actor => actor?.kind === 'enemy' && isLiving(actor)
    && ['in_range', 'engaged'].includes(actor.streamState));
  const anchors = deriveCombatFormationAnchors({ globals, entities, heroCount: heroes.length });
  const bounds = anchors.arenaBounds;
  const minY = bounds.visibleTopY, maxY = bounds.visibleBottomY;
  heroes.forEach((hero, index) => {
    if (!Number.isFinite(Number(hero.footX))) {
      hero.footX = index % 2 === 0 ? bounds.heroRightEdgeX : bounds.heroBackCenterX;
      hero.footY = Number(anchors.heroYs[index] ?? (minY + maxY) / 2) + Number(anchors.heroH || 0) / 2;
    }
    hero.arenaEnabled = true;
  });
  for (const enemy of enemies) {
    if (!Number.isFinite(Number(enemy.footX))) { enemy.footX = Number(enemy.x || bounds.attackStartX); enemy.footY = Number(enemy.y || (minY + maxY) / 2); }
  }
  for (const hero of heroes) {
    const target = stableNearest(hero, enemies);
    if (!target) { hero.locomotion = 'idle'; if (Number(hero.actionStateUntil || 0) <= Number(globals.time || 0)) hero.actionState = 'idle'; continue; }
    advanceActorToward(hero, target, { seconds, speed: 78, now: Number(globals.time || 0), minX: bounds.heroBackCenterX, maxX: bounds.attackStartX, minY, maxY,
      preserveActionState: Number(hero.actionStateUntil || 0) > Number(globals.time || 0) });
  }
  let newlyEngaged = 0;
  for (const enemy of enemies) {
    const target = stableNearest(enemy, heroes);
    if (!target) { enemy.locomotion = 'idle'; if (Number(enemy.actionStateUntil || 0) <= Number(globals.time || 0)) enemy.actionState = 'idle'; continue; }
    advanceActorToward(enemy, target, { seconds, speed: Math.max(34, Number(enemy.streamWalkSpeed || 40)), now: Number(globals.time || 0), minX: bounds.heroBackCenterX, maxX: bounds.attackStartX, minY, maxY,
      preserveActionState: Number(enemy.actionStateUntil || 0) > Number(globals.time || 0) });
  }
  if (!heroes.length) return newlyEngaged;
  separateFootprints([...heroes, ...enemies], bounds);
  for (const enemy of enemies) {
    const target = stableNearest(enemy, heroes);
    if (target && isActorTargetInRange(enemy, target)) {
      if (enemy.streamState !== 'engaged') newlyEngaged += 1;
      enemy.streamState = 'engaged';
      enemy.arenaInReach = true;
    } else {
      enemy.streamState = 'in_range';
      enemy.arenaInReach = false;
    }
  }
  return newlyEngaged;
}
