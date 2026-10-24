import { advanceActorToward, actorAttackReach, actorFootPoint, actorFootprintRadius, isActorTargetInRange } from '../../../src/core/arenaCombatRules.mjs';
import { COMBAT_BATTLEFIELD_ZOOM, deriveCombatFormationAnchors, deriveCombatOrdinaryPatrolBounds, deriveCombatWorldBounds, deriveCombatWorldStartFormation, deriveCombatWorldVerticalBounds } from '../../../src/core/combatOrientation.mjs';
import { previewSeededRng } from '../../../src/core/seededRngRules.mjs';
import { isActorRecoveryRevealActive, resetActorPresentationAfterRestore } from './actorPresentationState.mjs';
import { HERO_FORMATION_SLOTS, HERO_FORMATION_SLOT_DIAMETER, HERO_FORMATION_WIDTH, HERO_FORMATION_LEASH_RADIUS, constrainHeroSlotDrift } from '../../../src/core/heroFormationGeometry.mjs';

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

export function selectHeroMovementTarget(hero, candidates = []) { return nearest(hero, candidates.filter(isLiving)); }
export const CONTINUOUS_COMBAT_ENEMY_DETECTION_RADIUS = 460;
const SEARCH_SPEED = 78;
const INITIAL_ROAM_WALK_DISTANCE = 200;
const INITIAL_ROAM_SEED_DRAW = 0x764;
const RECOVERY_MOAT_DIAMETER_SCREEN_PX = 150;
const heroName = hero => String(hero?.baseHeroName || hero?.name || '').trim().toLowerCase();
function slotFor(hero, index, placement) {
  const placed = placement?.[String(hero?.heroInstanceKey || '').replace(/#1$/, '').toLowerCase()] || placement?.[heroName(hero)];
  return HERO_FORMATION_SLOTS[placed?.cell] || HERO_FORMATION_SLOTS[index % HERO_FORMATION_SLOTS.length];
}
export function deriveContinuousCombatRecoveryHuddle(heroes = [], heading = 1, placement = null) {
  const { centerX } = deriveCombatWorldStartFormation(heroes.length);
  const patrol = deriveCombatOrdinaryPatrolBounds(), centerY = (patrol.minY + patrol.maxY) / 2;
  return heroes.map((hero, index) => {
    const slot = slotFor(hero, index, placement);
    return { hero, x: centerX + slot.x, y: centerY + slot.y };
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
  const center = deriveContinuousCombatSpawnMoat();
  globals.ContinuousCombatFormation = { x: center.centerX, y: center.centerY };
  Object.assign(globals, { HeroLungeOffsetByUID: {}, HeroRestBasePosByUID: {}, HeroRestFeetPosByUID: {}, HeroIconPosByIndex: [],
    RealtimeHeroBasicScheduledActions: {}, RealtimeHeroFocusTargetUID: 0 });
  const direction = setContinuousCombatInitialRoam({ globals, attempt: Number(globals.ContinuousCombatRoamAttempt ?? -1) + 1 });
  for (const { hero, x, y } of deriveContinuousCombatRecoveryHuddle(heroes, direction, globals.HeroFormationPlacement)) {
    hero.x = hero.footX = hero.formationSlotX = x;
    hero.y = hero.footY = hero.formationSlotY = y;
    hero.arenaEnabled = true; hero.arenaTargetUID = 0;
    hero.facing = direction < 0 ? 'left' : 'right';
    for (const key of ['originX','originY','targetX','targetY','arenaDirectionX','arenaDirectionY']) delete hero[key];
    hero.recoveryFadeStartedAt = Number(now || 0);
    resetActorPresentationAfterRestore(hero, now);
  }
}
// Return preserves every slot offset. The next arena ticks translate the same center.
export function beginContinuousCombatPatrolReturn(globals, heroes) {
  if (!heroes.length) return;
  globals.ContinuousCombatPatrolReturn = true;
}
const movePoint = (from, to, amount) => {
  const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy);
  const fraction = distance > 0 ? Math.min(1, amount / distance) : 0;
  return { x: from.x + dx * fraction, y: from.y + dy * fraction };
};
function motion(actor, point, now, before) {
  actor.x = actor.footX = point.x; actor.y = actor.footY = point.y;
  const locomotion = Math.hypot(point.x - before.x, point.y - before.y) > 1e-6 ? 'walk' : 'idle';
  if (actor.locomotion !== locomotion) actor.locomotionStartedAt = now;
  actor.locomotion = locomotion;
  if (Number(actor.actionStateUntil || 0) <= now) actor.actionState = locomotion;
}
export function advanceContinuousCombatArena({ globals = {}, entities = [], seconds = 0 } = {}) {
  const roster = entities.filter(actor => actor?.kind === 'hero');
  const heroes = roster.filter(isLiving);
  if (!heroes.length) return 0;
  const enemies = entities.filter(actor => actor?.kind === 'enemy' && isLiving(actor)
    && ['roaming', 'in_range', 'engaged', 'retreating'].includes(actor.streamState));
  const world = deriveCombatWorldBounds(), patrol = deriveCombatOrdinaryPatrolBounds(), vertical = deriveCombatWorldVerticalBounds();
  const stage = globals.ContinuousCombatStage, bossEncounter = !!stage?.bossActive;
  const now = Number(globals.time || 0), dt = Math.max(0, Number(seconds) || 0);
  const slots = roster.map((hero, index) => slotFor(hero, index, globals.HeroFormationPlacement));
  let center = globals.ContinuousCombatFormation;
  const initializing = !center || !Number.isFinite(center.x) || !Number.isFinite(center.y);
  if (initializing) {
    const existing = roster.filter(hero => Number.isFinite(hero.footX) && Number.isFinite(hero.footY));
    center = existing.length ? existing.reduce((sum, hero) => {
      const slot = slots[roster.indexOf(hero)], foot = actorFootPoint(hero);
      return { x: sum.x + (foot.x - slot.x) / existing.length, y: sum.y + (foot.y - slot.y) / existing.length };
    }, { x: 0, y: 0 }) : { x: deriveCombatWorldStartFormation(0).centerX, y: (patrol.minY + patrol.maxY) / 2 };
  }
  const halfWidth = HERO_FORMATION_WIDTH / 2 + HERO_FORMATION_LEASH_RADIUS, halfHeight = HERO_FORMATION_SLOTS[6].y + HERO_FORMATION_LEASH_RADIUS;
  const bossActor = bossEncounter && enemies.find(enemy => String(enemy.combatRank || enemy.enemyRole || enemy.role || '').toLowerCase() === 'boss');
  const bossX = Number(stage?.bossWorldX ?? bossActor?.footX ?? center.x);
  const bossY = Number(stage?.bossWorldY ?? 290);
  const bounds = bossEncounter ? { minX: Math.max(world.heroMinX, bossX - world.visibleWorldWidth * .75), maxX: world.heroMaxX,
    minY: Math.max(vertical.minY, bossY - 180), maxY: Math.min(vertical.maxY, bossY + 180) } : patrol;
  const bounded = point => ({ x: clamp(point.x, bounds.minX + halfWidth, bounds.maxX - halfWidth),
    y: clamp(point.y, bounds.minY + halfHeight, bounds.maxY - halfHeight) });
  if (initializing && !globals.ContinuousCombatPatrolReturn) center = bounded(center);
  const nearestEnemy = nearest({ footX: center.x, footY: center.y }, enemies);
  if (stage) {
    const local = enemies.filter(enemy => heroes.some(hero => distance(hero, enemy) <= CONTINUOUS_COMBAT_ENEMY_DETECTION_RADIUS || isActorTargetInRange(enemy, hero)));
    const groupId = enemy => Number(enemy.streamEngagementGroupId ?? enemy.streamSectorIndex ?? enemy.uid);
    const retained = local.find(enemy => groupId(enemy) === Number(stage.activeEncounterGroupId) && enemy.streamState === 'retreating');
    const active = retained || nearest({footX:center.x,footY:center.y},local);
    if (active) stage.activeEncounterGroupId = groupId(active); else delete stage.activeEncounterGroupId;
  }
  let destination = { ...center }, roam = globals.ContinuousCombatInitialRoam;
  if (bossEncounter && roam) { delete globals.ContinuousCombatInitialRoam; roam = null; }
  if (roam) {
    const enemyActions = globals.RealtimeEnemyActionsByUID || {};
    const incoming = enemies.some(enemy => {
      const action = enemyActions[String(Number(enemy.uid || 0))];
      return action?.active && heroes.some(hero => Number(hero.uid) === Number(action.targetUID))
        || (globals.CombatImpactVisuals || []).some(impact => Number(impact.ownerUID) === Number(enemy.uid) && heroes.some(hero => Number(hero.uid) === Number(impact.targetUID)));
    });
    if (incoming) { delete globals.ContinuousCombatInitialRoam; roam = null; }
  }
  if (globals.ContinuousCombatPatrolReturn) {
    destination = bounded(center);
    if (Math.hypot(destination.x-center.x,destination.y-center.y)<1e-6) delete globals.ContinuousCombatPatrolReturn;
  } else if (roam) {
    destination = { x: Number(roam.targetX), y: center.y };
    if (Math.abs(destination.x-center.x)<1 || nearestEnemy && distance({footX:center.x,footY:center.y},nearestEnemy)<=2*HERO_FORMATION_WIDTH) delete globals.ContinuousCombatInitialRoam;
  } else if (nearestEnemy && !bossEncounter) {
    const target = actorFootPoint(nearestEnemy), dx = target.x-center.x, dy = target.y-center.y, length = Math.hypot(dx,dy);
    const stop = 2*HERO_FORMATION_WIDTH;
    destination = length>stop ? {x:target.x-dx/length*stop,y:target.y-dy/length*stop} : center;
  }
  destination = bounded(destination);
  const frozen = heroes.some(hero => isActorRecoveryRevealActive(hero, now));
  const next = frozen ? center : movePoint(center, destination, SEARCH_SPEED*dt);
  const movementFacing = Math.abs(next.x-center.x)>1e-6 ? (next.x>center.x?'right':'left') : globals.ContinuousCombatFormationFacing || (Number(roam?.direction)<0?'left':'right');
  globals.ContinuousCombatFormationFacing = movementFacing;
  globals.ContinuousCombatFormation = next;
  const homes = roster.map((hero,index)=>({hero,x:next.x+slots[index].x,y:next.y+slots[index].y,diameter:HERO_FORMATION_SLOT_DIAMETER}));
  for (const home of homes) {
    const hero = home.hero, before = actorFootPoint(hero);
    const oldSlot = { x: Number(hero.formationSlotX ?? before.x), y: Number(hero.formationSlotY ?? before.y) };
    const target = isLiving(hero) ? selectHeroMovementTarget(hero, enemies) : null;
    const targetPoint = target ? actorFootPoint(target) : home;
    const dx = targetPoint.x - home.x, dy = targetPoint.y - home.y, distance = Math.hypot(dx, dy) || 1;
    const driftGoal = { x: home.x + dx / distance * (target ? HERO_FORMATION_LEASH_RADIUS : 0), y: home.y + dy / distance * (target ? HERO_FORMATION_LEASH_RADIUS : 0) };
    const drift = movePoint({ x: home.x + before.x-oldSlot.x, y: home.y + before.y-oldSlot.y }, driftGoal, frozen ? 0 : 3.2 * dt);
    const point = constrainHeroSlotDrift({x:home.x,y:home.y},drift,homes.filter(other=>other.hero!==hero && isLiving(other.hero)));
    hero.formationSlotX = home.x; hero.formationSlotY = home.y;
    hero.formationSlotDiameter = HERO_FORMATION_SLOT_DIAMETER;
    hero.basicAttackScreenWidth = world.visibleWorldWidth;
    hero.arenaEnabled = true;
    motion(hero, point, now, before);
    if (!isLiving(hero)) continue;
    hero.arenaTargetUID = Number(target?.uid || 0);
    const facingDx = target ? actorFootPoint(target).x-point.x : 0;
    hero.facing = target && Math.abs(facingDx)>1e-6 ? (facingDx>0?'right':'left') : movementFacing;
  }
  if (!frozen) {
    const moat = deriveContinuousCombatSpawnMoat();
    const footprint = actorFootprintRadius({ kind: 'enemy' });
    for (const enemy of enemies) {
      if (!enemy.streamSolo || enemy.streamState !== 'roaming' || now < Number(enemy.actionStateUntil || 0)) continue;
      if (Math.hypot(actorFootPoint(enemy).x - next.x, actorFootPoint(enemy).y - next.y) <= CONTINUOUS_COMBAT_ENEMY_DETECTION_RADIUS) continue;
      const anchorX = Number(enemy.streamSoloAnchorX ?? enemy.footX);
      const anchorY = Number(enemy.streamSoloAnchorY ?? enemy.footY);
      const side = anchorX < moat.centerX ? -1 : 1;
      const sideMinX = side < 0 ? world.heroMinX : moat.centerX + moat.minimumEnemyCenterDistance + footprint;
      const sideMaxX = side < 0 ? moat.centerX - moat.minimumEnemyCenterDistance - footprint : world.heroMaxX;
      const phase = Number(enemy.streamSoloPhase || 0);
      const patrolLeg = Math.floor(Math.max(0, now) / 3);
      const patrolAngle = phase + patrolLeg * Math.PI / 2;
      const target = {
        kind: 'solo-patrol-anchor',
        hp: 1,
        footX: clamp(anchorX + Math.cos(patrolAngle) * 30, sideMinX, sideMaxX),
        footY: clamp(anchorY + Math.sin(patrolAngle) * 30, vertical.minY + footprint, vertical.maxY - footprint),
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
        seconds: dt,
        speed: 24,
        now,
        minX: sideMinX,
        maxX: sideMaxX,
        minY: vertical.minY + footprint,
        maxY: vertical.maxY - footprint,
        preserveActionState: Number(enemy.actionStateUntil || 0) > now,
      });
      const patrolNext = actorFootPoint(enemy);
      const exceedsPatrolRadius = Math.hypot(patrolNext.x - anchorX, patrolNext.y - anchorY) > 40;
      const rejoinsAnotherEnemy = enemies.some(other => other !== enemy
        && Math.hypot(actorFootPoint(other).x - patrolNext.x, actorFootPoint(other).y - patrolNext.y) < 100);
      if (exceedsPatrolRadius || rejoinsAnotherEnemy) {
        enemy.footX = enemy.x = before.x;
        enemy.footY = enemy.y = before.y;
        enemy.locomotion = 'idle';
        enemy.locomotionStartedAt = now;
        enemy.actionState = 'idle';
      }
    }
  }
  let newlyEngaged = 0;
  for (const enemy of enemies) {
    if (enemy.streamState === 'retreating' || frozen) continue;
    const target = selectContinuousEnemyTarget({ enemy, heroes, globals, requireInReach: true }) || selectContinuousEnemyTarget({ enemy, heroes, globals });
    if (!target) continue;
    const boss = bossEncounter && String(enemy.combatRank || enemy.enemyRole || enemy.role || '').toLowerCase() === 'boss';
    const before = actorFootPoint(enemy);
    if (boss) {
      const anchorX = Number.isFinite(stage.bossWorldX) ? stage.bossWorldX : before.x;
      const anchorY = Number.isFinite(stage.bossWorldY) ? stage.bossWorldY : 290;
      const bossBounds = { minX:anchorX,maxX:Math.min(world.heroMaxX-actorFootprintRadius(enemy),anchorX+32),
        minY:Math.max(vertical.minY,anchorY-32),maxY:Math.min(vertical.maxY,anchorY+32) };
      const phase = Math.floor(now/1.6)%4;
      const goal = { x:phase<2?bossBounds.maxX:bossBounds.minX, y:phase===0||phase===3?bossBounds.minY:bossBounds.maxY };
      const step = movePoint(before,goal,Math.max(34,Number(enemy.streamWalkSpeed)||40)*dt);
      motion(enemy,{x:clamp(step.x,bossBounds.minX,bossBounds.maxX),y:clamp(step.y,bossBounds.minY,bossBounds.maxY)},now,before);
      const dx = actorFootPoint(target).x-enemy.footX;
      if(Math.abs(dx)>1e-6)enemy.facing=dx>0?'right':'left';
    } else if (distance(enemy,target)<=CONTINUOUS_COMBAT_ENEMY_DETECTION_RADIUS || isActorTargetInRange(enemy,target) || enemy === nearestEnemy && Math.hypot(next.x-destination.x,next.y-destination.y)<1) {
      const outsidePatrol = before.x < patrol.minX || before.x > patrol.maxX || before.y < patrol.minY || before.y > patrol.maxY;
      const approach = outsidePatrol ? compensateActorTravelTarget(enemy, target) : target;
      advanceActorToward(enemy,approach,{seconds:dt,speed:Math.max(34,Number(enemy.streamWalkSpeed)||40),now,
        minX:world.heroMinX,maxX:world.heroMaxX,minY:vertical.minY,maxY:vertical.maxY,preserveActionState:Number(enemy.actionStateUntil||0)>now});
    } else {
      enemy.arenaInReach=false;enemy.arenaTargetUID=0;
      if(enemy.streamState!=='roaming'||!enemy.streamSolo){enemy.locomotion='idle';if(Number(enemy.actionStateUntil||0)<=now)enemy.actionState='idle';}
      enemy.streamState='roaming';continue;
    }
    enemy.arenaInReach = isActorTargetInRange(enemy,target);
    if (enemy.arenaInReach) { if(enemy.streamState!=='engaged')newlyEngaged++;enemy.streamState='engaged'; }
    else if(enemy.streamState==='engaged'||enemy.streamState==='roaming')enemy.streamState='in_range';
  }
  return newlyEngaged;
}
