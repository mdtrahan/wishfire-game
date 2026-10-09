import { advanceActorToward, actorAttackReach, actorFootPoint, actorFootprintRadius, isActorTargetInRange } from '../../../src/core/arenaCombatRules.mjs';
import { deriveCombatFormationAnchors, deriveCombatWorldBounds, deriveCombatWorldStartFormation, deriveCombatWorldVerticalBounds } from '../../../src/core/combatOrientation.mjs';
import { resetActorPresentationAfterRestore } from './actorPresentationState.mjs';

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
export const CONTINUOUS_COMBAT_ENEMY_DETECTION_RADIUS = 460;
export const CONTINUOUS_COMBAT_SPAWN_RUNWAY_SCREEN_FRACTION = 0.25;
const SQUAD_STRAGGLE_RADIUS = 144;
const SEARCH_SPEED = 78;
const TRAVEL_FRONT_OFFSET = 22.4;
const FORMATION_ROW_GAP = 8;
const FRONTLINE_LEAD_GAP = 6.4;
const REGROUP_BACK_OFFSET = 9.6;
const SUPPORT_STEP_BACK = 12.8;
const CONTACT_INSET = 6.4;
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

export function deriveContinuousCombatRecoveryHuddle(heroes = []) {
  const formation = deriveCombatWorldStartFormation(heroes.length);
  const vertical = deriveCombatWorldVerticalBounds();
  const centerY = (vertical.minY + vertical.maxY) / 2;
  return heroes.map((hero, index) => {
    const slot = heroFormationSlot(hero, index);
    const rowSide = Math.sign(slot.rowOffset) || (index % 2 === 0 ? -1 : 1);
    return {
      hero,
      x: formation.centerX + (slot.frontline ? TRAVEL_FRONT_OFFSET : -TRAVEL_FRONT_OFFSET),
      y: centerY + rowSide * (actorFootprintRadius(hero) + 2),
    };
  });
}

export function deriveContinuousCombatSpawnMoat() {
  const world = deriveCombatWorldBounds();
  const formation = deriveCombatWorldStartFormation(0);
  const vertical = deriveCombatWorldVerticalBounds();
  return {
    centerX: formation.centerX,
    centerY: (vertical.minY + vertical.maxY) / 2,
    minimumEnemyCenterDistance: CONTINUOUS_COMBAT_ENEMY_DETECTION_RADIUS
      + world.visibleWorldWidth * CONTINUOUS_COMBAT_SPAWN_RUNWAY_SCREEN_FRACTION
      + actorFootprintRadius({ kind: 'hero' })
      + actorFootprintRadius({ kind: 'enemy' }),
  };
}

export function placeContinuousCombatHeroesInRecoveryHuddle({ globals = {}, heroes = [], now = 0 } = {}) {
  Object.assign(globals, {
    HeroLungeOffsetByUID: {}, HeroRestBasePosByUID: {}, HeroRestFeetPosByUID: {}, HeroIconPosByIndex: [],
    RealtimeHeroBasicScheduledActions: {}, RealtimeHeroFocusTargetUID: 0,
  });
  for (const { hero, x, y } of deriveContinuousCombatRecoveryHuddle(heroes)) {
    hero.x = hero.footX = x;
    hero.y = hero.footY = y;
    hero.arenaEnabled = true;
    hero.arenaTargetUID = 0;
    hero.facing = 'right';
    delete hero.originX;
    delete hero.originY;
    delete hero.targetX;
    delete hero.targetY;
    delete hero.arenaDirectionX;
    delete hero.arenaDirectionY;
    hero.recoveryFadeStartedAt = Number(now || 0);
    resetActorPresentationAfterRestore(hero, now);
  }
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
    && ['roaming', 'in_range', 'engaged', 'retreating'].includes(actor.streamState));
  const anchors = deriveCombatFormationAnchors({ globals, entities, heroCount: heroes.length });
  const worldBounds = deriveCombatWorldBounds();
  const stage = globals.ContinuousCombatStage;
  const bossEncounter = !!stage?.bossActive;
  const boss = bossEncounter ? enemies.find(enemy => String(enemy.combatRank || enemy.enemyRole || enemy.role || '').toLowerCase() === 'boss') : null;
  const bossAnchorX = Number.isFinite(stage?.bossWorldX) ? Number(stage.bossWorldX) : Number(boss?.footX ?? boss?.x ?? 0);
  const bossRadius = boss ? actorFootprintRadius(boss) : 0;
  const worldYBounds = deriveCombatWorldVerticalBounds();
  const bounds = { ...anchors.arenaBounds, ...worldBounds, visibleTopY: worldYBounds.minY, visibleBottomY: worldYBounds.maxY };
  if (bossEncounter && boss) {
    bounds.heroMinX = Math.max(worldBounds.heroMinX, bossAnchorX - worldBounds.visibleWorldWidth * 0.75);
    bounds.heroMaxX = Math.min(worldBounds.heroMaxX, bossAnchorX - bossRadius - 18);
    const bossAnchorY = Number.isFinite(stage?.bossWorldY) ? Number(stage.bossWorldY) : Number(boss.footY ?? boss.y ?? 290);
    bounds.visibleTopY = Math.max(worldYBounds.minY, bossAnchorY - 180);
    bounds.visibleBottomY = Math.min(worldYBounds.maxY, bossAnchorY + 180);
    bounds.bossMinX = bossAnchorX;
    bounds.bossMaxX = Math.min(worldBounds.heroMaxX - bossRadius, bossAnchorX + 32);
    bounds.bossMinY = Math.max(worldYBounds.minY, bossAnchorY - 32);
    bounds.bossMaxY = Math.min(worldYBounds.maxY, bossAnchorY + 32);
  }
  const minY = bounds.visibleTopY, maxY = bounds.visibleBottomY;
  const startFormation = deriveCombatWorldStartFormation(heroes.length);
  heroes.forEach((hero, index) => {
    if (!Number.isFinite(Number(hero.footX))) {
      hero.footX = startFormation.heroX[index];
    }
    if (!Number.isFinite(Number(hero.footY)) && !Number.isFinite(Number(hero.y))) {
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
  const groupCenter = group => group.reduce((sum, enemy) => {
    const foot = actorFootPoint(enemy);
    return { x: sum.x + foot.x / group.length, y: sum.y + foot.y / group.length };
  }, { x: 0, y: 0 });
  const groupDistance = group => {
    const point = groupCenter(group);
    return Math.hypot(point.x - center, point.y - centerY);
  };
  const orderedGroups = [...groups.entries()].sort((a, b) => groupDistance(a[1]) - groupDistance(b[1]));
  const activeStates = new Set(['in_range', 'engaged', 'retreating']);
  const activeGroups = orderedGroups.filter(([, group]) => group.some(enemy => activeStates.has(enemy.streamState)));
  const storedGroupId = Number(stage?.activeEncounterGroupId);
  const storedGroup = activeGroups.find(([groupId]) => groupId === storedGroupId);
  const committedGroup = storedGroup || activeGroups[0] || null;
  const localGroups = orderedGroups.filter(([, group]) => group.some(enemy =>
    selectContinuousEnemyTarget({ enemy, heroes, globals, requireInReach: true })
      || activeStates.has(enemy.streamState))
    || groupDistance(group) <= CONTINUOUS_COMBAT_ENEMY_DETECTION_RADIUS);
  const nearestEntry = localGroups[0] || orderedGroups[0] || null;
  const nearestGroup = committedGroup?.[1] || nearestEntry?.[1] || [];
  const nearestGroupId = committedGroup?.[0] ?? nearestEntry?.[0] ?? null;
  const nearestGroupCenter = nearestGroup.length ? groupCenter(nearestGroup) : null;
  const locallyDetected = localGroups.length > 0;
  // Heroes commit to every nearby threat before roaming onward. Enemy attack
  // eligibility is resolved separately below, per actor and delivery range.
  const focusedEnemies = localGroups.flatMap(([, group]) => group);
  if (stage) {
    if (locallyDetected && nearestGroupId != null) stage.activeEncounterGroupId = Number(nearestGroupId);
    else delete stage.activeEncounterGroupId;
  }
  const sharedTarget = focusedEnemies.length ? nearest({ footX: center, footY: centerY }, focusedEnemies) : null;
  const targetPoint = sharedTarget ? actorFootPoint(sharedTarget) : null;
  const travelPoint = targetPoint || nearestGroupCenter || { x: center + 1, y: centerY };
  const travelDeltaX = travelPoint.x - center, travelDeltaY = travelPoint.y - centerY;
  const travelLength = Math.hypot(travelDeltaX, travelDeltaY);
  const directionX = travelLength > 1e-6 ? travelDeltaX / travelLength : 1;
  const directionY = travelLength > 1e-6 ? travelDeltaY / travelLength : 0;
  const targetDirection = Math.sign(directionX) || 1;
  const frontline = heroes.filter((hero, index) => heroFormationSlot(hero, index).frontline);
  const supports = heroes.filter((hero, index) => !heroFormationSlot(hero, index).frontline);
  const progress = actor => {
    const point = actorFootPoint(actor);
    return (point.x - center) * directionX + (point.y - centerY) * directionY;
  };
  const regrouping = !bossEncounter && frontline.length > 0 && supports.length > 0
    && Math.min(...frontline.map(progress)) <= Math.max(...supports.map(progress)) + FRONTLINE_LEAD_GAP;
  for (const enemy of focusedEnemies) if (enemy.streamState === 'roaming') enemy.streamState = 'in_range';
  for (const [index, hero] of heroes.entries()) {
    const formation = heroFormationSlot(hero, index);
    if (regrouping && !formation.frontline) {
      const point = actorFootPoint(hero);
      if (Math.hypot(point.x - center, point.y - centerY) > SQUAD_STRAGGLE_RADIUS) {
        const regroupTarget = {
          footX: center - directionX * REGROUP_BACK_OFFSET - directionY * formation.rowOffset,
          footY: centerY - directionY * REGROUP_BACK_OFFSET + directionX * formation.rowOffset,
        };
        hero.arenaTargetUID = 0;
        advanceActorToward(hero, regroupTarget, { seconds, speed: SEARCH_SPEED, now: Number(globals.time || 0), minX: bounds.heroMinX, maxX: bounds.heroMaxX, minY, maxY,
          preserveActionState: Number(hero.actionStateUntil || 0) > Number(globals.time || 0) });
        continue;
      }
      // Let supports ease back a short step while either tank catches up.
      // The reach compensation makes advanceActorToward move the actor by the
      // intended 12.8 world units without changing its authored attack range.
      const supportPoint = actorFootPoint(hero);
      const retreatDistance = actorAttackReach(hero) + actorFootprintRadius({}) + SUPPORT_STEP_BACK;
      const retreatTarget = {
        footX: supportPoint.x - directionX * retreatDistance,
        footY: supportPoint.y - directionY * retreatDistance,
      };
      hero.arenaTargetUID = Number(sharedTarget?.uid || 0);
      advanceActorToward(hero, retreatTarget, { seconds, speed: SEARCH_SPEED, now: Number(globals.time || 0), minX: bounds.heroMinX, maxX: bounds.heroMaxX, minY, maxY,
        preserveActionState: Number(hero.actionStateUntil || 0) > Number(globals.time || 0) });
      if (Math.abs(directionX) > 1e-6) hero.facing = directionX > 0 ? 'right' : 'left';
      continue;
    }
    const target = sharedTarget;
    if (target) {
      hero.arenaTargetUID = Number(target.uid || 0);
      const alongOffset = CONTACT_INSET;
      const contactTarget = {
        ...target,
        footX: targetPoint.x + directionX * alongOffset - directionY * formation.rowOffset,
        footY: targetPoint.y + directionY * alongOffset + directionX * formation.rowOffset,
      };
      advanceActorToward(hero, contactTarget, { seconds, speed: SEARCH_SPEED, now: Number(globals.time || 0), minX: bounds.heroMinX, maxX: bounds.heroMaxX, minY, maxY,
      preserveActionState: Number(hero.actionStateUntil || 0) > Number(globals.time || 0) });
    } else {
    const nextPoint = hasStragglers ? { x: center, y: centerY }
        : nearestGroupCenter || { x: clamp(center + 160, bounds.heroMinX, bounds.heroMaxX), y: centerY };
      const deltaX = nextPoint.x - center, deltaY = nextPoint.y - centerY;
      const deltaLength = Math.hypot(deltaX, deltaY) || 1;
      const directionX = deltaLength > 1e-6 ? deltaX / deltaLength : targetDirection;
      const directionY = deltaLength > 1e-6 ? deltaY / deltaLength : 0;
      const approachDistance = hasStragglers || locallyDetected ? 0 : 130;
      const approachX = nextPoint.x - directionX * approachDistance;
      const approachY = nextPoint.y - directionY * approachDistance;
      const frontOffset = formation.frontline ? TRAVEL_FRONT_OFFSET : -TRAVEL_FRONT_OFFSET;
      const sideOffset = formation.rowOffset;
      const searchTarget = {
        footX: clamp(approachX + directionX * frontOffset - directionY * sideOffset, bounds.heroMinX, bounds.heroMaxX),
      footY: clamp(approachY + directionY * frontOffset + directionX * sideOffset, minY, maxY),
      };
      hero.arenaTargetUID = 0;
      advanceActorToward(hero, searchTarget, { seconds, speed: SEARCH_SPEED, now: Number(globals.time || 0), minX: bounds.heroMinX, maxX: bounds.heroMaxX, minY, maxY,
        preserveActionState: Number(hero.actionStateUntil || 0) > Number(globals.time || 0) });
    }
  }
  let newlyEngaged = 0;
  for (const enemy of focusedEnemies) {
    if (enemy.streamState === 'retreating') continue;
    const target = selectContinuousEnemyTarget({ enemy, heroes, globals });
    if (!target) { enemy.locomotion = 'idle'; if (Number(enemy.actionStateUntil || 0) <= Number(globals.time || 0)) enemy.actionState = 'idle'; continue; }
    const isBoss = bossEncounter && enemy === boss;
    advanceActorToward(enemy, target, { seconds, speed: Math.max(34, Number(enemy.streamWalkSpeed || 40)), now: Number(globals.time || 0), minX: isBoss ? bounds.bossMinX : bounds.heroMinX, maxX: isBoss ? bounds.bossMaxX : bounds.maxX, minY: isBoss ? bounds.bossMinY : minY, maxY: isBoss ? bounds.bossMaxY : maxY,
      preserveActionState: Number(enemy.actionStateUntil || 0) > Number(globals.time || 0) });
  }
  separateFootprints([...heroes, ...enemies], bounds);
  for (const enemy of enemies) {
    if (enemy.streamState === 'retreating') continue;
    const target = selectContinuousEnemyTarget({ enemy, heroes, globals, requireInReach: true });
    if (target && isActorTargetInRange(enemy, target)) {
      if (enemy.streamState !== 'engaged') newlyEngaged += 1;
      enemy.streamState = 'engaged';
      enemy.arenaInReach = true;
    } else {
      if (enemy.streamState === 'engaged') enemy.streamState = 'in_range';
      enemy.arenaInReach = false;
    }
  }
  return newlyEngaged;
}
