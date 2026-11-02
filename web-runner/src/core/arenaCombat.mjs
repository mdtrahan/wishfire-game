import { COMBAT_BATTLEFIELD_ZOOM, deriveCombatOrdinaryPatrolBounds, deriveCombatWorldStartFormation } from "../../../src/core/combatOrientation.mjs";
import { previewSeededRng } from "../../../src/core/seededRngRules.mjs";
import { resetActorPresentationAfterRestore } from "./actorPresentationState.mjs";
import { HERO_FORMATION_SLOTS } from "../../../src/core/heroFormationGeometry.mjs";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const INITIAL_ROAM_WALK_DISTANCE = 200;
const INITIAL_ROAM_SEED_DRAW = 1892;
const RECOVERY_MOAT_DIAMETER_SCREEN_PX = 150;
const formationSlots = (heroes) => heroes.map((_, index) => HERO_FORMATION_SLOTS[index]);
function deriveContinuousCombatRecoveryHuddle(heroes = [], heading = 1) {
  const { centerX } = deriveCombatWorldStartFormation(heroes.length);
  const patrol = deriveCombatOrdinaryPatrolBounds(), centerY = (patrol.minY + patrol.maxY) / 2;
  const slots = formationSlots(heroes);
  return heroes.map((hero, index) => {
    const slot = slots[index];
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
    attempt: roamAttempt
  };
  return direction;
}
function deriveContinuousCombatSpawnMoat() {
  const formation = deriveCombatWorldStartFormation(0);
  const vertical = deriveCombatOrdinaryPatrolBounds();
  return {
    centerX: formation.centerX,
    centerY: (vertical.minY + vertical.maxY) / 2,
    minimumEnemyCenterDistance: RECOVERY_MOAT_DIAMETER_SCREEN_PX / (2 * COMBAT_BATTLEFIELD_ZOOM)
  };
}
function placeContinuousCombatHeroesInRecoveryHuddle({ globals = {}, heroes = [], now = 0 } = {}) {
  delete globals.ContinuousCombatPatrolReturn;
  const center = deriveContinuousCombatSpawnMoat();
  globals.ContinuousCombatFormation = { x: center.centerX, y: center.centerY };
  Object.assign(globals, {
    HeroLungeOffsetByUID: {},
    HeroRestBasePosByUID: {},
    HeroRestFeetPosByUID: {},
    HeroIconPosByIndex: [],
    RealtimeHeroBasicScheduledActions: {},
    RealtimeHeroFocusTargetUID: 0
  });
  const direction = setContinuousCombatInitialRoam({ globals, attempt: Number(globals.ContinuousCombatRoamAttempt ?? -1) + 1 });
  for (const { hero, x, y } of deriveContinuousCombatRecoveryHuddle(heroes, direction)) {
    hero.x = hero.footX = hero.formationSlotX = x;
    hero.y = hero.footY = hero.formationSlotY = y;
    hero.arenaEnabled = true;
    hero.arenaTargetUID = 0;
    hero.facing = direction < 0 ? "left" : "right";
    for (const key of ["originX", "originY", "targetX", "targetY", "arenaDirectionX", "arenaDirectionY"]) delete hero[key];
    hero.recoveryFadeStartedAt = Number(now || 0);
    resetActorPresentationAfterRestore(hero, now);
  }
}
export {
  deriveContinuousCombatSpawnMoat,
  placeContinuousCombatHeroesInRecoveryHuddle
};
