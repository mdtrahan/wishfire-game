import { sampleActorClip } from './actorClipPlayback.mjs';
import { combatActorVisualScale, shouldMirrorCombatActorSprite } from './combatActorSpritePresentation.mjs';

const ACTOR_KEYS = Object.freeze({ Fara: 'fara', Falie: 'fara', Gobloc: 'gobloc' });
const CLIP_STATES = new Set(['idle', 'walk', 'basic', 'cast', 'hurt', 'ko', 'spawn']);

export function actorPuppetKey(actor) {
  // Presentation aliases may be present on a roster entry even when they are
  // not an actor key. Keep searching the runtime identity fields so that the
  // canonical combat identity still reaches the pilot clip.
  for (const value of [actor?.portraitName, actor?.baseHeroName, actor?.name]) {
    const key = ACTOR_KEYS[String(value || '').trim()];
    if (key) return key;
  }
  return null;
}

export function actorPuppetState(actor, now) {
  if (Number(actor?.hp) <= 0) return 'ko';
  const actionState = String(actor?.actionState || '');
  if (CLIP_STATES.has(actionState) && Number(actor?.actionStateUntil || 0) > now) return actionState;
  return actor?.locomotion === 'walk' ? 'walk' : 'idle';
}

export function actorClipAgeMs(actor, state, clip, now) {
  if (state === 'idle' || state === 'walk') return Math.max(0, (now - Number(actor?.locomotionStartedAt ?? actor?.actionStateStartedAt ?? 0)) * 1000);
  const startedAt = Number(actor?.actionStateStartedAt);
  const impactAt = Number(actor?.actionImpactAt);
  const until = Number(actor?.actionStateUntil);
  const started = Number.isFinite(startedAt) ? startedAt : now;
  const elapsed = Math.max(0, (now - started) * 1000);
  const actionDuration = Math.max(1, (until - started) * 1000);
  const impactDuration = Math.max(0, (impactAt - started) * 1000);
  const marker = state === 'basic' ? Number(clip?.impactTimeMs) : (state === 'cast' ? Number(clip?.releaseTimeMs) : NaN);
  if (!Number.isFinite(marker)) return elapsed;
  if (state === 'cast' && impactDuration === 0) return marker + (elapsed * Math.max(0, clip.durationMs - marker) / actionDuration);
  if (impactDuration <= 0 || elapsed >= impactDuration) {
    const recovery = Math.max(1, actionDuration - impactDuration);
    return marker + ((elapsed - impactDuration) * Math.max(0, clip.durationMs - marker) / recovery);
  }
  return elapsed * marker / impactDuration;
}

export function actorScreenFacing(worldFacing, orientation) {
  const facing = worldFacing === 'left' ? 'left' : 'right';
  return shouldMirrorCombatActorSprite(orientation) ? (facing === 'left' ? 'right' : 'left') : facing;
}

export function createActorPuppetPresentation({ loadClip }) {
  const resolved = new Map();
  const requested = new Set();
  return {
    frameFor(actor, now, orientation) {
      const actorKey = actorPuppetKey(actor);
      if (!actorKey || !Number.isFinite(now)) return null;
      const state = actorPuppetState(actor, now);
      const worldFacing = (actor?.actionStateUntil > now ? actor?.actionFacing : actor?.facing) === 'left' ? 'left' : 'right';
      const facing = actorScreenFacing(worldFacing, orientation);
      const key = `${actorKey}/${state}/${facing}`;
      if (!requested.has(key)) {
        requested.add(key);
        Promise.resolve(loadClip(actorKey, state, facing)).then((clip) => { if (clip) resolved.set(key, clip); }).catch(() => {});
      }
      const clip = resolved.get(key);
      const frame = clip && sampleActorClip(clip, actorClipAgeMs(actor, state, clip, now));
      return frame ? { frame, clip, state, facing } : null;
    },
  };
}

export function drawActorPuppetFrame(ctx, presentation, { footX, footY, height, actorUID, effects, now = 0 } = {}) {
  const clip = presentation?.clip;
  if (!ctx || !presentation?.frame || !clip || !Number.isFinite(footX) || !Number.isFinite(footY) || !Number.isFinite(height) || height <= 0) return null;
  const visualScale = combatActorVisualScale({ actorUID, effects, now });
  const scaledHeight = height * visualScale;
  const scale = scaledHeight / clip.canvas.height;
  const width = clip.canvas.width * scale;
  const drawX = footX - clip.footOrigin.x * scale;
  const drawY = footY - clip.footOrigin.y * scale;
  ctx.drawImage(presentation.frame, drawX, drawY, width, scaledHeight);
  return { drawX, drawY, width, height: scaledHeight, visualScale };
}
