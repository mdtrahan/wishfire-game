import { advanceActorToward, actorFootPoint, actorFootprintRadius, isActorTargetInRange } from '../../../src/core/arenaCombatRules.mjs';
import { deriveCombatFormationAnchors, deriveCombatWorldBounds } from '../../../src/core/combatOrientation.mjs';

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
function activeProvokeTarget(enemy, heroes, globals) {
  const effect = globals?.RealtimeSkillEffects?.[String(enemy?.uid)]?.provoke;
  if (!effect || Number(effect.expiresAt || 0) <= Number(globals?.time || 0)) return null;
  return heroes.find(hero => Number(hero.uid || 0) === Number(effect.sourceUID || 0)) || null;
}

// The arena and the enemy action scheduler must agree about which hero an
// enemy intends to fight. Provoke takes priority while active; the stable
// nearest selection preserves target hysteresis for every other enemy.
export function selectContinuousEnemyTarget({ enemy = null, heroes = [], globals = {}, preferredTarget = null, requireInReach = false } = {}) {
  const candidates = heroes.filter(isLiving)
    .filter(hero => !requireInReach || isActorTargetInRange(enemy, hero));
  if (!candidates.length) return null;
  const provoker = activeProvokeTarget(enemy, candidates, globals);
  if (provoker) {
    enemy.arenaTargetUID = Number(provoker.uid || 0);
    return provoker;
  }
  if (preferredTarget && candidates.some(hero => Number(hero.uid || 0) === Number(preferredTarget.uid || 0))) {
    enemy.arenaTargetUID = Number(preferredTarget.uid || 0);
    return preferredTarget;
  }
  return stableNearest(enemy, candidates);
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const DETECTION_RADIUS = 460;
const SQUAD_STRAGGLE_RADIUS = 180;
const SEARCH_SPEED = 78;
const TRAVEL_FRONT_OFFSET = 28;
const FORMATION_ROW_GAP = 10;
const FRONTLINE_HERO_NAMES = new Set(['fara', 'falie', 'hondo', 'huun']);
function heroFormationSlot(hero, index) {
  const name = String(hero?.baseHeroName || hero?.name || '').trim().toLowerCase();
  const slot = name === 'fara' || name === 'falie' ? 0
    : name === 'hondo' || name === 'huun' ? 1
      : name === 'runa' ? 2
        : name === 'kaja' || name === 'kojonn' ? 3
          : index;
  return {
    frontline: FRONTLINE_HERO_NAMES.has(name) || (!name && index < 2),
    rowOffset: slot % 2 === 0 ? -FORMATION_ROW_GAP : FORMATION_ROW_GAP,
  };
}
function separateFootprints(actors, bounds) {
  const actorXBounds = actor => actor?.kind === 'hero'
    ? { min: bounds.heroMinX, max: bounds.heroMaxX }
    : String(actor?.combatRank || actor?.enemyRole || actor?.role || '').toLowerCase() === 'boss'
      && Number.isFinite(bounds.bossMinX) && Number.isFinite(bounds.bossMaxX)
      ? { min: bounds.bossMinX, max: bounds.bossMaxX }
      : { min: bounds.heroMinX, max: bounds.maxX };
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
    const firstBounds = actorXBounds(first);
    const secondBounds = actorXBounds(second);
    first.footX = clamp(a.x - dx * push, firstBounds.min, firstBounds.max);
    first.footY = clamp(a.y - dy * push, bounds.visibleTopY, bounds.visibleBottomY);
    second.footX = clamp(b.x + dx * push, secondBounds.min, secondBounds.max);
    second.footY = clamp(b.y + dy * push, bounds.visibleTopY, bounds.visibleBottomY);
    for (const actor of [first, second]) { actor.x = actor.footX; actor.y = actor.footY; }
  }
  // A stationary actor can arrive outside the encounter band through a skill
  // or restore path. Enforce the same bounds after movement and separation.
  for (const actor of ordered) {
    const point = actorFootPoint(actor), xBounds = actorXBounds(actor);
    actor.footX = clamp(point.x, xBounds.min, xBounds.max);
    actor.footY = clamp(point.y, bounds.visibleTopY, bounds.visibleBottomY);
    actor.x = actor.footX;
    actor.y = actor.footY;
  }
}

export function advanceContinuousCombatArena({ globals = {}, entities = [], seconds = 0 } = {}) {
  const heroes = entities.filter(actor => actor?.kind === 'hero' && isLiving(actor));
  // Retreat is stage-owned displacement. Letting its direct steering run here
  // would pull an enemy back toward its target during Frost Reversal.
  const enemies = entities.filter(actor => actor?.kind === 'enemy' && isLiving(actor)
    && ['roaming', 'in_range', 'engaged'].includes(actor.streamState));
  const anchors = deriveCombatFormationAnchors({ globals, entities, heroCount: heroes.length });
  const worldBounds = deriveCombatWorldBounds();
  const stage = globals.ContinuousCombatStage;
  const bossEncounter = !!stage?.bossActive;
  const boss = bossEncounter ? enemies.find(enemy => String(enemy.combatRank || enemy.enemyRole || enemy.role || '').toLowerCase() === 'boss') : null;
  const bossAnchorX = Number.isFinite(stage?.bossWorldX) ? Number(stage.bossWorldX) : Number(boss?.footX ?? boss?.x ?? 0);
  const bossRadius = boss ? actorFootprintRadius(boss) : 0;
  const bounds = { ...anchors.arenaBounds, ...worldBounds };
  if (bossEncounter && boss) {
    bounds.heroMinX = Math.max(worldBounds.heroMinX, bossAnchorX - worldBounds.visibleWorldWidth * 0.75);
    bounds.heroMaxX = Math.min(worldBounds.heroMaxX, bossAnchorX - bossRadius - 18);
    bounds.bossMinX = bossAnchorX;
    bounds.bossMaxX = Math.min(worldBounds.heroMaxX - bossRadius, bossAnchorX + 32);
  }
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
  if (!heroes.length) return 0;
  const center = heroes.reduce((sum, hero) => sum + actorFootPoint(hero).x, 0) / heroes.length;
  const centerY = heroes.reduce((sum, hero) => sum + actorFootPoint(hero).y, 0) / heroes.length;
  const hasStragglers = heroes.some(hero => Math.hypot(actorFootPoint(hero).x - center, actorFootPoint(hero).y - centerY) > SQUAD_STRAGGLE_RADIUS);
  const groups = new Map();
  for (const enemy of enemies) {
    const groupId = Number(enemy.streamSectorIndex ?? enemy.streamPackIndex ?? 0);
    const group = groups.get(groupId) || [];
    group.push(enemy);
    groups.set(groupId, group);
  }
  const groupCenter = group => group.reduce((sum, enemy) => sum + actorFootPoint(enemy).x, 0) / group.length;
  const nearestGroup = [...groups.values()].sort((a, b) => Math.abs(groupCenter(a) - center) - Math.abs(groupCenter(b) - center))[0] || [];
  const nearestGroupX = nearestGroup.length ? groupCenter(nearestGroup) : null;
  const locallyDetected = !hasStragglers && nearestGroup.length && Math.abs(nearestGroupX - center) <= DETECTION_RADIUS;
  const focusedEnemies = locallyDetected ? nearestGroup : [];
  const sharedTarget = focusedEnemies.length ? nearest({ footX: center, footY: centerY }, focusedEnemies) : null;
  const targetPoint = sharedTarget ? actorFootPoint(sharedTarget) : null;
  const targetDirection = targetPoint ? Math.sign(targetPoint.x - center) || Math.sign((nearestGroupX ?? center) - center) || 1 : 0;
  for (const enemy of focusedEnemies) if (enemy.streamState === 'roaming') enemy.streamState = 'in_range';
  for (const [index, hero] of heroes.entries()) {
    const formation = heroFormationSlot(hero, index);
    const target = sharedTarget;
    if (target) {
      hero.arenaTargetUID = Number(target.uid || 0);
      const contactTarget = {
        ...target,
        footX: formation.frontline ? targetPoint.x + Math.sign(targetPoint.x - actorFootPoint(hero).x) * 8 : targetPoint.x,
        footY: targetPoint.y + (formation.frontline ? 0 : formation.rowOffset),
      };
      advanceActorToward(hero, contactTarget, { seconds, speed: SEARCH_SPEED, now: Number(globals.time || 0), minX: bounds.heroMinX, maxX: bounds.heroMaxX, minY, maxY,
      preserveActionState: Number(hero.actionStateUntil || 0) > Number(globals.time || 0) });
    } else {
      const nextPackX = hasStragglers ? center : (nearestGroup.length ? nearestGroupX : clamp(center + 160, bounds.heroMinX, bounds.heroMaxX));
      const searchX = hasStragglers ? center : (locallyDetected ? nextPackX : clamp(nextPackX - Math.sign(nextPackX - center) * 130, bounds.heroMinX, bounds.heroMaxX));
      const searchDirection = Math.sign(searchX - center) || targetDirection || 1;
      const frontOffset = formation.frontline ? TRAVEL_FRONT_OFFSET : -TRAVEL_FRONT_OFFSET;
      const searchTarget = { footX: searchX + searchDirection * frontOffset, footY: centerY + formation.rowOffset };
      hero.arenaTargetUID = 0;
      advanceActorToward(hero, searchTarget, { seconds, speed: SEARCH_SPEED, now: Number(globals.time || 0), minX: bounds.heroMinX, maxX: bounds.heroMaxX, minY, maxY,
        preserveActionState: Number(hero.actionStateUntil || 0) > Number(globals.time || 0) });
    }
  }
  let newlyEngaged = 0;
  for (const enemy of focusedEnemies) {
    const target = selectContinuousEnemyTarget({ enemy, heroes, globals });
    if (!target) { enemy.locomotion = 'idle'; if (Number(enemy.actionStateUntil || 0) <= Number(globals.time || 0)) enemy.actionState = 'idle'; continue; }
    const isBoss = bossEncounter && enemy === boss;
    advanceActorToward(enemy, target, { seconds, speed: Math.max(34, Number(enemy.streamWalkSpeed || 40)), now: Number(globals.time || 0), minX: isBoss ? bounds.bossMinX : bounds.heroMinX, maxX: isBoss ? bounds.bossMaxX : bounds.maxX, minY, maxY,
      preserveActionState: Number(enemy.actionStateUntil || 0) > Number(globals.time || 0) });
  }
  separateFootprints([...heroes, ...enemies], bounds);
  for (const enemy of focusedEnemies) {
    const target = selectContinuousEnemyTarget({ enemy, heroes, globals });
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
