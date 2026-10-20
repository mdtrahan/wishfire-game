import { advanceActorToward, actorAttackReach, actorFootPoint, actorFootprintRadius, isActorTargetInRange } from '../../../src/core/arenaCombatRules.mjs';
import { COMBAT_BATTLEFIELD_ZOOM, deriveCombatFormationAnchors, deriveCombatOrdinaryPatrolBounds, deriveCombatWorldBounds, deriveCombatWorldStartFormation, deriveCombatWorldVerticalBounds } from '../../../src/core/combatOrientation.mjs';
import { previewSeededRng } from '../../../src/core/seededRngRules.mjs';
import { isActorRecoveryRevealActive, resetActorPresentationAfterRestore } from './actorPresentationState.mjs';
import { resolveCombatLeader, resolveCombatMovementTuning } from './combatMovementTuning.mjs';

const isLiving = actor => actor && Number(actor.hp || 0) > 0;
const distance = (actor, target) => {
  const origin = actorFootPoint(actor), destination = actorFootPoint(target);
  return Math.hypot(destination.x - origin.x, destination.y - origin.y);
};
function compensateActorTravelTarget(actor, target) {
  const source = actorFootPoint(actor), dx = Number(target?.footX || 0) - source.x, dy = Number(target?.footY || 0) - source.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return target;
  const reach = actorAttackReach(actor) + actorFootprintRadius({ kind: 'arena-waypoint' });
  return { ...target, footX: Number(target.footX) + dx / length * reach, footY: Number(target.footY) + dy / length * reach };
}
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
// Each hero weighs its own nearest threat against the leader's target. Bias 1
// always returns the shared target (legacy dog-pile); bias 0 is pure own-nearest.
// A short hysteresis keeps a hero from flickering between equal candidates.
export function selectHeroMovementTarget(hero, candidates = [], sharedTarget = null, bias = 1) {
  const living = candidates.filter(isLiving);
  if (!living.length) return null;
  if (bias >= 1 && sharedTarget && living.includes(sharedTarget)) return sharedTarget;
  const score = enemy => distance(hero, enemy) * (enemy === sharedTarget ? 1 - Math.max(0, Math.min(1, bias)) : 1);
  const ordered = living.slice().sort((a, b) => score(a) - score(b) || Number(a.uid || 0) - Number(b.uid || 0));
  const current = living.find(enemy => Number(enemy.uid || 0) === Number(hero.arenaTargetUID || 0));
  return current && score(current) <= score(ordered[0]) + 24 ? current : ordered[0];
}
export const CONTINUOUS_COMBAT_ENEMY_DETECTION_RADIUS = 460;
const RECOVERY_MOAT_DIAMETER_SCREEN_PX = 150;
const SEARCH_SPEED = 78;
const SEARCH_STANDOFF = 130;
const TRAVEL_FRONT_OFFSET = 22.4;
const FORMATION_ROW_GAP = 8;
const FRONTLINE_LEAD_GAP = 6.4;
const REGROUP_BACK_OFFSET = 9.6;
const SUPPORT_STEP_BACK = 12.8;
const INITIAL_ROAM_WALK_DISTANCE = 200;
const INITIAL_ROAM_SEED_DRAW = 0x764;
const CONTACT_INSET = 6.4;
const FRONTLINE_CONTACT_DISTANCE = 46;
const FARA_TRAVEL_OFFSET = 16;
const HONDO_TRAVEL_OFFSET = 4;
const SUPPORT_TRAVEL_OFFSET = -10;
const FARA_CONTACT_OFFSET = 8;
const HONDO_CONTACT_OFFSET = 4;
const FRONTLINE_HERO_NAMES = new Set(['fara', 'falie', 'hondo', 'huun']);
const heroName = hero => String(hero?.baseHeroName || hero?.name || '').trim().toLowerCase();
const isFara = hero => ['fara', 'falie'].includes(heroName(hero));
const isHondo = hero => ['hondo', 'huun'].includes(heroName(hero));
function heroFormationSlot(hero, index, { faraLeads = false } = {}) {
  const name = heroName(hero);
  const slot = name === 'fara' || name === 'falie' ? 0
    : name === 'hondo' || name === 'huun' ? 1
      : name === 'runa' ? 2
        : name === 'kaja' || name === 'kojonn' ? 3
          : index;
  return {
    frontline: FRONTLINE_HERO_NAMES.has(name) || (!name && index < 2),
    hondo: isHondo(hero),
    travelOffset: faraLeads && isFara(hero) ? FARA_TRAVEL_OFFSET
      : faraLeads && isHondo(hero) ? HONDO_TRAVEL_OFFSET
        : faraLeads
          ? SUPPORT_TRAVEL_OFFSET
      : FRONTLINE_HERO_NAMES.has(name) || (!name && index < 2) ? TRAVEL_FRONT_OFFSET : -TRAVEL_FRONT_OFFSET,
    contactOffset: faraLeads && isFara(hero) ? FARA_CONTACT_OFFSET
      : faraLeads && isHondo(hero) ? HONDO_CONTACT_OFFSET
        : CONTACT_INSET,
    rowOffset: slot % 2 === 0 ? -FORMATION_ROW_GAP : FORMATION_ROW_GAP,
  };
}

export function deriveContinuousCombatRecoveryHuddle(heroes = [], heading = 1) {
  const formation = deriveCombatWorldStartFormation(heroes.length);
  const vertical = deriveCombatOrdinaryPatrolBounds();
  const centerY = (vertical.minY + vertical.maxY) / 2;
  const direction = Number(heading) < 0 ? -1 : 1;
  const faraLeads = heroes.some(hero => isLiving(hero) && isFara(hero));
  return heroes.map((hero, index) => {
    const slot = heroFormationSlot(hero, index, { faraLeads });
    const rowSide = Math.sign(slot.rowOffset) || (index % 2 === 0 ? -1 : 1);
    return {
      hero,
      x: formation.centerX + direction * slot.travelOffset,
      y: centerY + rowSide * (actorFootprintRadius(hero) + 2),
    };
  });
}

function setContinuousCombatInitialRoam({ globals = {}, attempt = 0 } = {}) {
  const stageSeed = Number(globals.ContinuousCombatStage?.seed || globals.EncounterSeed || 1) >>> 0 || 1;
  const roamAttempt = Math.max(0, Math.floor(Number(attempt) || 0));
  const direction = previewSeededRng(stageSeed, INITIAL_ROAM_SEED_DRAW + roamAttempt) < 0.5 ? -1 : 1;
  const centerX = deriveCombatWorldStartFormation(0).centerX;
  const patrol = deriveCombatOrdinaryPatrolBounds();
  const targetX = clamp(centerX + direction * INITIAL_ROAM_WALK_DISTANCE, patrol.minX, patrol.maxX);
  globals.ContinuousCombatRoamAttempt = roamAttempt;
  globals.ContinuousCombatInitialRoam = {
    direction,
    originX: centerX,
    targetX,
    distance: Math.abs(targetX - centerX),
    attempt: roamAttempt,
  };
  return direction;
}

export function deriveContinuousCombatSpawnMoat() {
  const formation = deriveCombatWorldStartFormation(0);
  const vertical = deriveCombatOrdinaryPatrolBounds();
  return {
    centerX: formation.centerX,
    centerY: (vertical.minY + vertical.maxY) / 2,
    minimumEnemyCenterDistance: RECOVERY_MOAT_DIAMETER_SCREEN_PX / (2 * COMBAT_BATTLEFIELD_ZOOM),
  };
}

export function placeContinuousCombatHeroesInRecoveryHuddle({ globals = {}, heroes = [], now = 0 } = {}) {
  delete globals.ContinuousCombatPatrolReturn;
  Object.assign(globals, {
    HeroLungeOffsetByUID: {}, HeroRestBasePosByUID: {}, HeroRestFeetPosByUID: {}, HeroIconPosByIndex: [],
    RealtimeHeroBasicScheduledActions: {}, RealtimeHeroFocusTargetUID: 0,
  });
  const attempt = Number.isSafeInteger(globals.ContinuousCombatRoamAttempt)
    ? globals.ContinuousCombatRoamAttempt + 1
    : 0;
  const direction = setContinuousCombatInitialRoam({ globals, attempt });
  for (const { hero, x, y } of deriveContinuousCombatRecoveryHuddle(heroes, direction)) {
    hero.x = hero.footX = x;
    hero.y = hero.footY = y;
    hero.arenaEnabled = true;
    hero.arenaTargetUID = 0;
    hero.facing = direction < 0 ? 'left' : 'right';
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

export function beginContinuousCombatPatrolReturn(globals, heroes) {
  const patrol = deriveCombatOrdinaryPatrolBounds();
  const points = heroes.map(actorFootPoint);
  if (!points.length) return;
  const project = (axis, min, max) => {
    const low = Math.min(...points.map(point => point[axis]));
    const high = Math.max(...points.map(point => point[axis]));
    const shift = clamp(0, min - low, max - high);
    return value => high - low <= max - min ? value + shift : min + (value - low) * (max - min) / (high - low);
  };
  const projectX = project('x', patrol.minX, patrol.maxX), projectY = project('y', patrol.minY, patrol.maxY);
  const targets = heroes.map((hero, index) => ({
    ...hero,
    footX: projectX(points[index].x),
    footY: projectY(points[index].y),
  }));
  // Settle the destination before walking there, including compressed rows.
  // Otherwise the first ordinary collision pass would displace arrived Heroes.
  for (let pass = 0; pass < 32; pass += 1) {
    separateFootprints(targets, { heroMinX: patrol.minX, heroMaxX: patrol.maxX, heroMinY: patrol.minY, heroMaxY: patrol.maxY });
    if (targets.every((actor, index) => targets.slice(index + 1).every(other => distance(actor, other)
      >= actorFootprintRadius(actor) + actorFootprintRadius(other) - 1e-6))) break;
  }
  if (targets.some((target, index) => Math.hypot(target.footX - points[index].x, target.footY - points[index].y) > 1e-6)) {
    globals.ContinuousCombatPatrolReturn = targets.map(({ uid, footX, footY }) => ({ uid, footX, footY }));
  }
}
function separateFootprints(actors, bounds, { heroSpacing = 1 } = {}) {
  const actorXBounds = actor => actor?.kind === 'hero'
    ? { min: bounds.heroMinX, max: bounds.heroMaxX }
    : String(actor?.combatRank || actor?.enemyRole || actor?.role || '').toLowerCase() === 'boss'
      && Number.isFinite(bounds.bossMinX) && Number.isFinite(bounds.bossMaxX)
      ? { min: bounds.bossMinX, max: bounds.bossMaxX }
      : { min: bounds.enemyMinX, max: bounds.maxX };
  const actorYBounds = actor => actor?.kind === 'hero'
    ? { min: bounds.heroMinY, max: bounds.heroMaxY }
    : { min: bounds.visibleTopY, max: bounds.visibleBottomY };
  const ordered = actors.slice().sort((a, b) => Number(a.uid || 0) - Number(b.uid || 0));
  // Several passes settle a compact crowd after one separation changes a
  // neighboring pair. Zero-distance actors split vertically so an X boundary
  // cannot leave them stacked.
  for (let pass = 0; pass < 4; pass += 1) for (let index = 0; index < ordered.length; index += 1) for (let otherIndex = index + 1; otherIndex < ordered.length; otherIndex += 1) {
    const first = ordered[index], second = ordered[otherIndex], a = actorFootPoint(first), b = actorFootPoint(second);
    // Heroes may stack on a shared target (StoneAge); hero-enemy contact keeps full spacing.
    const minDistance = (actorFootprintRadius(first) + actorFootprintRadius(second))
      * (first.kind === 'hero' && second.kind === 'hero' ? heroSpacing : 1);
    const currentDistance = Math.hypot(b.x - a.x, b.y - a.y);
    if (currentDistance >= minDistance) continue;
    const dx = currentDistance > 0.001 ? (b.x - a.x) / currentDistance : 0;
    const dy = currentDistance > 0.001 ? (b.y - a.y) / currentDistance : (Number(first.uid || 0) <= Number(second.uid || 0) ? -1 : 1);
    const push = (minDistance - currentDistance) / 2;
    const firstBounds = actorXBounds(first);
    const secondBounds = actorXBounds(second);
    const firstY = actorYBounds(first), secondY = actorYBounds(second);
    first.footX = clamp(a.x - dx * push, firstBounds.min, firstBounds.max);
    first.footY = clamp(a.y - dy * push, firstY.min, firstY.max);
    second.footX = clamp(b.x + dx * push, secondBounds.min, secondBounds.max);
    second.footY = clamp(b.y + dy * push, secondY.min, secondY.max);
    for (const actor of [first, second]) { actor.x = actor.footX; actor.y = actor.footY; }
  }
  // A stationary actor can arrive outside the encounter band through a skill
  // or restore path. Enforce the same bounds after movement and separation.
  for (const actor of ordered) {
    const point = actorFootPoint(actor), xBounds = actorXBounds(actor), yBounds = actorYBounds(actor);
    actor.footX = clamp(point.x, xBounds.min, xBounds.max);
    actor.footY = clamp(point.y, yBounds.min, yBounds.max);
    actor.x = actor.footX;
    actor.y = actor.footY;
  }
}

export function advanceContinuousCombatArena({ globals = {}, entities = [], seconds = 0 } = {}) {
  const heroes = entities.filter(actor => actor?.kind === 'hero' && isLiving(actor));
  if (globals.ContinuousCombatStage?.bossActive) delete globals.ContinuousCombatPatrolReturn;
  const returning = globals.ContinuousCombatPatrolReturn;
  if (returning) {
    // Boss settlement preserves all-living feet. Walk the squad back before
    // ordinary pursuit/clamping resumes; this phase never widens the patrol.
    const world = deriveCombatWorldBounds(), vertical = deriveCombatWorldVerticalBounds();
    for (const hero of heroes) {
      const target = returning.find(point => point.uid === hero.uid);
      if (!target) continue;
      advanceActorToward(hero, compensateActorTravelTarget(hero, target), {
        seconds, speed: SEARCH_SPEED, now: Number(globals.time || 0),
        minX: world.heroMinX, maxX: world.heroMaxX, minY: vertical.minY, maxY: vertical.maxY,
        preserveActionState: Number(hero.actionStateUntil || 0) > Number(globals.time || 0),
      });
      if (Math.hypot(hero.footX - target.footX, hero.footY - target.footY) <= 1e-6) {
        hero.x = hero.footX = target.footX;
        hero.y = hero.footY = target.footY;
      }
    }
    if (heroes.every(hero => {
      const target = returning.find(point => point.uid === hero.uid);
      return !target || Math.hypot(hero.footX - target.footX, hero.footY - target.footY) <= 1e-6;
    })) delete globals.ContinuousCombatPatrolReturn;
    return 0;
  }
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
  bounds.enemyMinX = worldBounds.heroMinX;
  const patrol = deriveCombatOrdinaryPatrolBounds();
  if (!bossEncounter) {
    bounds.heroMinX = patrol.minX;
    bounds.heroMaxX = patrol.maxX;
  }
  bounds.heroMinY = bossEncounter ? bounds.visibleTopY : patrol.minY;
  bounds.heroMaxY = bossEncounter ? bounds.visibleBottomY : patrol.maxY;
  const minY = bounds.heroMinY, maxY = bounds.heroMaxY;
  const patrolPoint = point => ({ x: clamp(point.x, bounds.heroMinX, bounds.heroMaxX), y: clamp(point.y, minY, maxY) });
  const startFormation = deriveCombatWorldStartFormation(heroes.length);
  heroes.forEach((hero, index) => {
    if (!Number.isFinite(Number(hero.footX))) {
      hero.footX = startFormation.heroX[index];
    }
    if (!Number.isFinite(Number(hero.footY)) && !Number.isFinite(Number(hero.y))) {
      hero.footY = Number(anchors.heroYs[index] ?? (minY + maxY) / 2) + Number(anchors.heroH || 0) / 2;
    }
    const point = patrolPoint(actorFootPoint(hero));
    hero.x = hero.footX = point.x;
    hero.y = hero.footY = point.y;
    hero.arenaEnabled = true;
  });
  for (const enemy of enemies) {
    if (!Number.isFinite(Number(enemy.footX))) { enemy.footX = Number(enemy.x || bounds.attackStartX); enemy.footY = Number(enemy.y || (minY + maxY) / 2); }
  }
  if (!heroes.length) return 0;
  const center = heroes.reduce((sum, hero) => sum + actorFootPoint(hero).x, 0) / heroes.length;
  const centerY = heroes.reduce((sum, hero) => sum + actorFootPoint(hero).y, 0) / heroes.length;
  // The leader picks the shared target and anchors the leash and regroup point.
  // Approach vectors stay centroid-based: a leader-relative vector rotates as
  // the leader reaches contact and walks the squad around its target. Boss
  // encounters keep the stage-owned centroid layout.
  const tuning = resolveCombatMovementTuning(globals);
  const leader = tuning.leaderAnchor && !bossEncounter ? resolveCombatLeader(heroes, tuning.leaderName) : null;
  const anchorX = leader ? actorFootPoint(leader).x : center;
  const anchorY = leader ? actorFootPoint(leader).y : centerY;
  const now = Number(globals.time || 0);
  const motionStart = new Map([...heroes, ...enemies].map(actor => [actor, {
    ...actorFootPoint(actor), locomotion: actor.locomotion, locomotionStartedAt: actor.locomotionStartedAt,
  }]));
  const recoveryReveal = heroes.some(hero => isActorRecoveryRevealActive(hero, now));
  let initialRoam = globals.ContinuousCombatInitialRoam;
  if (initialRoam && bossEncounter) {
    delete globals.ContinuousCombatInitialRoam;
    initialRoam = null;
  }
  if (initialRoam) {
    const enemyActions = globals.RealtimeEnemyActionsByUID || {};
    const enemyAttackInFlight = enemies.some(enemy => {
      const action = enemyActions[String(Number(enemy.uid || 0))];
      const targetsHero = heroes.some(hero => Number(hero.uid || 0) === Number(action?.targetUID || 0));
      const hasHeroImpact = (globals.CombatImpactVisuals || []).some(impact => Number(impact?.ownerUID || 0) === Number(enemy.uid || 0)
        && heroes.some(hero => Number(hero.uid || 0) === Number(impact?.targetUID || 0)));
      return (!!action?.active && targetsHero) || hasHeroImpact;
    });
    const actorInAttackReach = enemies.some(enemy => heroes.some(hero =>
      isActorTargetInRange(enemy, hero) || isActorTargetInRange(hero, enemy)));
    const distanceWalked = Number(initialRoam.direction || 0) * (center - Number(initialRoam.originX || 0));
    if (enemyAttackInFlight || actorInAttackReach
      || distanceWalked >= Number(initialRoam.distance || INITIAL_ROAM_WALK_DISTANCE) - FARA_TRAVEL_OFFSET - 8) {
      delete globals.ContinuousCombatInitialRoam;
      initialRoam = null;
    }
  }
  const initialRoamActive = !!initialRoam;
  if (!recoveryReveal) {
    const moat = deriveContinuousCombatSpawnMoat();
    const footprint = actorFootprintRadius({ kind: 'enemy' });
    for (const enemy of enemies) {
      if (!enemy.streamSolo || enemy.streamState !== 'roaming' || now < Number(enemy.actionStateUntil || 0)) continue;
      if (Math.hypot(actorFootPoint(enemy).x - center, actorFootPoint(enemy).y - centerY) <= tuning.detectionRadius) continue;
      const anchorX = Number(enemy.streamSoloAnchorX ?? enemy.footX);
      const anchorY = Number(enemy.streamSoloAnchorY ?? enemy.footY);
      const side = anchorX < moat.centerX ? -1 : 1;
      const sideMinX = side < 0 ? worldBounds.heroMinX : moat.centerX + moat.minimumEnemyCenterDistance + footprint;
      const sideMaxX = side < 0 ? moat.centerX - moat.minimumEnemyCenterDistance - footprint : worldBounds.heroMaxX;
      const phase = Number(enemy.streamSoloPhase || 0);
      const patrolLeg = Math.floor(Math.max(0, now) / 3);
      const patrolAngle = phase + patrolLeg * Math.PI / 2;
      const target = {
        kind: 'solo-patrol-anchor',
        hp: 1,
        footX: clamp(anchorX + Math.cos(patrolAngle) * 30, sideMinX, sideMaxX),
        footY: clamp(anchorY + Math.sin(patrolAngle) * 30, worldYBounds.minY + footprint, worldYBounds.maxY - footprint),
      };
      const before = actorFootPoint(enemy);
      const dx = target.footX - before.x, dy = target.footY - before.y;
      const targetDistance = Math.hypot(dx, dy);
      const approachTarget = targetDistance > 1e-6 ? {
        ...target,
        footX: target.footX + dx / targetDistance * (actorAttackReach(enemy) + actorFootprintRadius(target)),
        footY: target.footY + dy / targetDistance * (actorAttackReach(enemy) + actorFootprintRadius(target)),
      } : target;
      advanceActorToward(enemy, approachTarget, {
        seconds,
        speed: 24,
        now,
        minX: sideMinX,
        maxX: sideMaxX,
        minY: worldYBounds.minY + footprint,
        maxY: worldYBounds.maxY - footprint,
        preserveActionState: Number(enemy.actionStateUntil || 0) > now,
      });
      const next = actorFootPoint(enemy);
      const exceedsPatrolRadius = Math.hypot(next.x - anchorX, next.y - anchorY) > 40;
      const rejoinsAnotherEnemy = enemies.some(other => other !== enemy
        && Math.hypot(actorFootPoint(other).x - next.x, actorFootPoint(other).y - next.y) < 100);
      if (exceedsPatrolRadius || rejoinsAnotherEnemy) {
        enemy.footX = enemy.x = before.x;
        enemy.footY = enemy.y = before.y;
        enemy.locomotion = 'idle';
        enemy.locomotionStartedAt = now;
        enemy.actionState = 'idle';
      }
    }
  }
  const hasStragglers = heroes.some(hero => Math.hypot(actorFootPoint(hero).x - anchorX, actorFootPoint(hero).y - anchorY) > tuning.combatLeash);
  const groups = new Map();
  for (const enemy of enemies) {
    const groupId = Number(enemy.streamEngagementGroupId ?? enemy.streamSectorIndex ?? enemy.streamPackIndex ?? 0);
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
  const approachingPatrol = new Set();
  const isWithinLocalDetectionRange = enemy => approachingPatrol.has(enemy)
    || heroes.some(hero => distance(hero, enemy) <= tuning.detectionRadius);
  const orderedGroups = [...groups.entries()].sort((a, b) => groupDistance(a[1]) - groupDistance(b[1]));
  const activeStates = new Set(['in_range', 'engaged', 'retreating']);
  const localGroups = orderedGroups.filter(([, group]) => group.some(enemy =>
    (bossEncounter && activeStates.has(enemy.streamState))
      || selectContinuousEnemyTarget({ enemy, heroes, globals, requireInReach: true })
      || isWithinLocalDetectionRange(enemy)));
  // Search stops inside the patrol. Let the selected remote group close the
  // remaining gap once the squad reaches its legal approach point.
  if (!bossEncounter && !localGroups.length && orderedGroups.length) {
    const entry = orderedGroups[0];
    const point = patrolPoint(groupCenter(entry[1]));
    if (Math.hypot(point.x - center, point.y - centerY) <= SEARCH_STANDOFF
      + Math.max(...heroes.map(hero => actorAttackReach(hero) + actorFootprintRadius(hero)))) {
      entry[1].forEach(enemy => approachingPatrol.add(enemy));
      localGroups.push(entry);
    }
  }
  const activeGroups = localGroups.filter(([, group]) => group.some(enemy => activeStates.has(enemy.streamState)));
  const storedGroupId = Number(stage?.activeEncounterGroupId);
  const storedGroup = activeGroups.find(([groupId]) => groupId === storedGroupId);
  const committedGroup = storedGroup || activeGroups[0] || null;
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
  const sharedTarget = focusedEnemies.length ? nearest({ footX: anchorX, footY: anchorY }, focusedEnemies) : null;
  const targetPoint = sharedTarget ? actorFootPoint(sharedTarget) : null;
  const travelPoint = patrolPoint(targetPoint || nearestGroupCenter || { x: center + 1, y: centerY });
  const travelDeltaX = travelPoint.x - center, travelDeltaY = travelPoint.y - centerY;
  const travelLength = Math.hypot(travelDeltaX, travelDeltaY);
  const directionX = initialRoamActive ? Number(initialRoam.direction) : travelLength > 1e-6 ? travelDeltaX / travelLength : 1;
  const directionY = initialRoamActive ? 0 : travelLength > 1e-6 ? travelDeltaY / travelLength : 0;
  const targetDirection = Math.sign(directionX) || 1;
  const faraLeads = heroes.some(isFara);
  const formations = heroes.map((hero, index) => heroFormationSlot(hero, index, { faraLeads: faraLeads && !bossEncounter }));
  const frontline = heroes.filter((hero, index) => formations[index].frontline);
  const supports = heroes.filter((hero, index) => !formations[index].frontline);
  const progress = actor => {
    const point = actorFootPoint(actor);
    return (point.x - center) * directionX + (point.y - centerY) * directionY;
  };
  const sharedTargeting = tuning.leaderTargetBias >= 1;
  const regrouping = !bossEncounter && (sharedTargeting || !sharedTarget) && frontline.length > 0 && supports.length > 0
    && Math.min(...frontline.map(progress)) <= Math.max(...supports.map(progress)) + FRONTLINE_LEAD_GAP;
  const fara = faraLeads ? heroes.find(isFara) : null;
  const hondo = faraLeads ? heroes.find(isHondo) : null;
  const faraRoom = fara ? Math.min(
    directionX > 1e-6 ? (bounds.heroMaxX - actorFootPoint(fara).x) / directionX : directionX < -1e-6 ? (actorFootPoint(fara).x - bounds.heroMinX) / -directionX : Infinity,
    directionY > 1e-6 ? (maxY - actorFootPoint(fara).y) / directionY : directionY < -1e-6 ? (actorFootPoint(fara).y - minY) / -directionY : Infinity,
  ) : 0;
  const hondoYielding = !bossEncounter && fara && faraRoom > FRONTLINE_LEAD_GAP && hondo && progress(fara) <= progress(hondo) + FRONTLINE_LEAD_GAP
    && !(sharedTarget && isActorTargetInRange(hondo, sharedTarget));
  for (const enemy of focusedEnemies) if (enemy.streamState === 'roaming') enemy.streamState = 'in_range';
  for (const [index, hero] of heroes.entries()) {
    const formation = formations[index];
    if ((regrouping && !formation.frontline) || (hondoYielding && formation.hondo)) {
      const point = actorFootPoint(hero);
      if (Math.hypot(point.x - center, point.y - centerY) > tuning.combatLeash) {
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
    const heroPoint = actorFootPoint(hero);
    const leashed = !initialRoamActive && sharedTarget && leader && hero !== leader && !sharedTargeting
      && Math.hypot(heroPoint.x - anchorX, heroPoint.y - anchorY) > tuning.combatLeash;
    const target = initialRoamActive || leashed ? null : selectHeroMovementTarget(hero, focusedEnemies, sharedTarget, tuning.leaderTargetBias);
    if (target) {
      hero.arenaTargetUID = Number(target.uid || 0);
      // The shared target keeps the squad's approach vector; an independent
      // pick approaches along the hero's own line to it.
      const ownPoint = actorFootPoint(target);
      const ownDx = ownPoint.x - heroPoint.x, ownDy = ownPoint.y - heroPoint.y, ownLength = Math.hypot(ownDx, ownDy);
      const independent = target !== sharedTarget && ownLength > 1e-6;
      const contactDirX = independent ? ownDx / ownLength : directionX, contactDirY = independent ? ownDy / ownLength : directionY;
      const contactReach = Math.min(actorAttackReach(hero), formation.frontline ? FRONTLINE_CONTACT_DISTANCE : Infinity) + actorFootprintRadius(target);
      const alongOffset = formation.contactOffset - contactReach;
      const contactTarget = {
        ...target,
        footX: ownPoint.x + contactDirX * alongOffset - contactDirY * formation.rowOffset,
        footY: ownPoint.y + contactDirY * alongOffset + contactDirX * formation.rowOffset,
      };
      advanceActorToward(hero, compensateActorTravelTarget(hero, contactTarget), { seconds, speed: SEARCH_SPEED, now: Number(globals.time || 0), minX: bounds.heroMinX, maxX: bounds.heroMaxX, minY, maxY,
      preserveActionState: Number(hero.actionStateUntil || 0) > Number(globals.time || 0) });
    } else {
    const nextPoint = hasStragglers || leashed ? { x: anchorX, y: anchorY }
        : initialRoamActive ? { x: Number(initialRoam.targetX), y: centerY }
          : nearestGroupCenter ? patrolPoint(nearestGroupCenter) : { x: clamp(center + 160, bounds.heroMinX, bounds.heroMaxX), y: centerY };
      const deltaX = nextPoint.x - center, deltaY = nextPoint.y - centerY;
      const deltaLength = Math.hypot(deltaX, deltaY) || 1;
      const directionX = deltaLength > 1e-6 ? deltaX / deltaLength : targetDirection;
      const directionY = deltaLength > 1e-6 ? deltaY / deltaLength : 0;
      const approachDistance = initialRoamActive || hasStragglers || leashed || locallyDetected ? 0 : SEARCH_STANDOFF;
      const approachX = nextPoint.x - directionX * approachDistance;
      const approachY = nextPoint.y - directionY * approachDistance;
      const frontOffset = formation.travelOffset * tuning.travelSpacing;
      const sideOffset = formation.rowOffset * tuning.travelSpacing;
      const searchTarget = {
        footX: clamp(approachX + directionX * frontOffset - directionY * sideOffset, bounds.heroMinX, bounds.heroMaxX),
      footY: clamp(approachY + directionY * frontOffset + directionX * sideOffset, minY, maxY),
      };
      hero.arenaTargetUID = Number(sharedTarget?.uid || 0);
      advanceActorToward(hero, compensateActorTravelTarget(hero, searchTarget), { seconds, speed: SEARCH_SPEED, now: Number(globals.time || 0), minX: bounds.heroMinX, maxX: bounds.heroMaxX, minY, maxY,
        preserveActionState: Number(hero.actionStateUntil || 0) > Number(globals.time || 0) });
    }
  }
  let newlyEngaged = 0;
  for (const enemy of focusedEnemies) {
    if (enemy.streamState === 'retreating') continue;
    const inReachTarget = selectContinuousEnemyTarget({ enemy, heroes, globals, requireInReach: true });
    if (!bossEncounter && !inReachTarget && !isWithinLocalDetectionRange(enemy)) continue;
    const target = inReachTarget || selectContinuousEnemyTarget({ enemy, heroes, globals });
    if (!target) { enemy.locomotion = 'idle'; if (Number(enemy.actionStateUntil || 0) <= Number(globals.time || 0)) enemy.actionState = 'idle'; continue; }
    const isBoss = bossEncounter && enemy === boss;
    const enemyPoint = actorFootPoint(enemy);
    const outsidePatrol = enemyPoint.x < patrol.minX || enemyPoint.x > patrol.maxX
      || enemyPoint.y < patrol.minY || enemyPoint.y > patrol.maxY;
    // A ranged corner enemy must not stop beyond every bounded Hero's reach.
    // Keep its authored attack eligibility while letting it close this gap.
    const approachTarget = !bossEncounter && outsidePatrol && !heroes.some(hero => distance(hero, enemy) <= actorAttackReach(hero))
      ? compensateActorTravelTarget(enemy, { ...target, footX: actorFootPoint(target).x, footY: actorFootPoint(target).y })
      : target;
    advanceActorToward(enemy, approachTarget, { seconds, speed: Math.max(34, Number(enemy.streamWalkSpeed || 40)), now: Number(globals.time || 0), minX: isBoss ? bounds.bossMinX : worldBounds.heroMinX, maxX: isBoss ? bounds.bossMaxX : bounds.maxX, minY: isBoss ? bounds.bossMinY : bounds.visibleTopY, maxY: isBoss ? bounds.bossMaxY : bounds.visibleBottomY,
      preserveActionState: Number(enemy.actionStateUntil || 0) > Number(globals.time || 0) });
  }
  // StoneAge melee lines up along a boss's front edge instead of stacking.
  separateFootprints([...heroes, ...enemies], bounds, { heroSpacing: bossEncounter ? 1 : tuning.heroOverlap });
  for (const enemy of enemies) {
    if (enemy.streamState === 'retreating') continue;
    const target = selectContinuousEnemyTarget({ enemy, heroes, globals, requireInReach: true });
    if (!bossEncounter && !target && !isWithinLocalDetectionRange(enemy)) {
      if (Number(enemy.actionStateUntil || 0) <= Number(globals.time || 0)) {
        if (activeStates.has(enemy.streamState)) {
          enemy.streamState = 'roaming';
          enemy.arenaTargetUID = 0;
          enemy.arenaInReach = false;
          enemy.locomotion = 'idle';
          enemy.actionState = 'idle';
        } else if (!enemy.streamSolo) {
          enemy.arenaTargetUID = 0;
          enemy.arenaInReach = false;
          enemy.locomotion = 'idle';
          enemy.actionState = 'idle';
        }
      }
      continue;
    }
    if (target && isActorTargetInRange(enemy, target)) {
      if (enemy.streamState !== 'engaged') newlyEngaged += 1;
      enemy.streamState = 'engaged';
      enemy.arenaInReach = true;
    } else {
      if (enemy.streamState === 'engaged') enemy.streamState = 'in_range';
      enemy.arenaInReach = false;
    }
  }
  for (const actor of [...heroes, ...enemies]) {
    const start = motionStart.get(actor), point = actorFootPoint(actor);
    const locomotion = Math.hypot(point.x - start.x, point.y - start.y) > 0.001 ? 'walk' : 'idle';
    actor.locomotionStartedAt = locomotion === start.locomotion ? start.locomotionStartedAt : now;
    actor.locomotion = locomotion;
    if (Number(actor.actionStateUntil || 0) <= now) actor.actionState = locomotion;
  }
  return newlyEngaged;
}
