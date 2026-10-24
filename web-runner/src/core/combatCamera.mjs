// Leader-follow combat camera (bd-ORKA-6i3). Pure state advance: the stage
// tick owns time, renderers only read the resolved centre. Boss presentation
// keeps its stage-owned framing and bypasses this helper.
import { actorFootPoint } from '../../../src/core/arenaCombatRules.mjs';
import { resolveCombatLeader, resolveCombatMovementTuning } from './combatMovementTuning.mjs';

// Beyond this jump (a restart, recovery or reload) the camera cuts instead of
// sliding across the arena.
const CAMERA_SNAP_DISTANCE = 400;
const CAST_DETECTION_WINDOW = 0.25;

const living = actor => actor && Number(actor.hp || 0) > 0;

export function advanceCombatCamera({ globals = {}, entities = [], seconds = 0 } = {}) {
  const heroes = (entities || []).filter(actor => actor?.kind === 'hero' && living(actor));
  if (!heroes.length) return globals.CombatCamera || null;
  const tuning = resolveCombatMovementTuning(globals);
  const now = Number(globals.time || 0);
  const centroidX = heroes.reduce((sum, hero) => sum + actorFootPoint(hero).x, 0) / heroes.length;
  const leader = resolveCombatLeader(heroes, tuning.leaderName);
  const anchorX = tuning.leaderAnchor && leader ? actorFootPoint(leader).x : centroidX;
  const previous = globals.CombatCamera;
  const camera = previous && Number.isFinite(Number(previous.x)) ? { ...previous } : { x: anchorX, lastFocusAt: -Infinity };

  // A non-leader cast that just started earns a short pull toward the caster.
  if (tuning.skillFocus > 0 && now - Number(camera.lastFocusAt ?? -Infinity) >= tuning.skillFocusCooldown) {
    const caster = heroes.find(hero => hero !== leader && hero.actionState === 'cast'
      && now - Number(hero.actionStateStartedAt ?? -Infinity) <= CAST_DETECTION_WINDOW);
    if (caster) {
      camera.focusUID = Number(caster.uid || 0);
      camera.focusUntil = now + tuning.skillFocusHold;
      camera.lastFocusAt = now;
    }
  }
  const focus = Number(camera.focusUntil || 0) > now
    ? heroes.find(hero => Number(hero.uid || 0) === Number(camera.focusUID || 0)) : null;
  if (!focus) { delete camera.focusUID; delete camera.focusUntil; }

  let desired = anchorX;
  if (focus) desired = anchorX + (actorFootPoint(focus).x - anchorX) * tuning.skillFocus;
  else {
    const offset = desired - Number(camera.x);
    desired = Math.abs(offset) <= tuning.cameraDeadZone ? Number(camera.x) : desired - Math.sign(offset) * tuning.cameraDeadZone;
  }
  if (Math.abs(desired - Number(camera.x)) > CAMERA_SNAP_DISTANCE || tuning.cameraSmoothing <= 0) camera.x = desired;
  else camera.x += (desired - camera.x) * (1 - Math.exp(-Math.max(0, Number(seconds) || 0) / tuning.cameraSmoothing));
  camera.leaderUID = Number(leader?.uid || 0);
  camera.updatedAt = now;
  globals.CombatCamera = camera;
  return camera;
}

export function resolveCombatCameraCenterX(globals = {}, fallbackX = 0) {
  const camera = globals?.CombatCamera;
  // Only the continuous stage loop advances this camera. Paused or stalled
  // ticks hold the last framing; other combat modes keep the squad centroid.
  const owned = Number(globals?.ContinuousCombatStageLoop || 0) === 1 && camera && Number.isFinite(Number(camera.x));
  return owned ? Number(camera.x) : fallbackX;
}
