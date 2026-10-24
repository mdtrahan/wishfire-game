import { sampleActorClip } from './actorClipPlayback.mjs';
import { shouldMirrorCombatActorSprite } from './combatActorSpritePresentation.mjs';

const ACTOR_KEYS = Object.freeze({
  Fara: 'fara', Falie: 'fara', Hondo: 'hondo', Huun: 'hondo', Runa: 'runa', Kaja: 'kaja', Kojonn: 'kaja',
  Gobloc: 'gobloc', 'High Gobloc': 'highgobloc', Orc: 'orc', 'High Orc': 'highorc', Lizardo: 'lizardo',
  Djinn: 'djinn', Marid: 'marid', Skeleton: 'skeleton', Troll: 'troll', Chimerilass: 'chimerilass',
});
const CLIP_STATES = new Set(['idle', 'walk', 'basic', 'cast', 'hurt', 'spawn']);

export function actorPuppetKey(actor) {
  // Presentation aliases may be present on a roster entry even when they are
  // not an actor key. Keep searching the runtime identity fields so that the
  // canonical combat identity still reaches its clip.
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
  const actors = new Map();
  let frameNow;
  const painted = new Set();
  const protect = () => loadClip.protect?.([...actors.values()].flatMap(slot => [slot.ready?.key, slot.key]).filter(Boolean));
  return {
    beginFrame() { painted.clear(); },
    endFrame() {
      for (const id of actors.keys()) if (!painted.has(id)) actors.delete(id);
      protect();
    },
    frameFor(actor, now, orientation) {
      if (!Number.isFinite(now)) return null;
      if (frameNow !== now) {
        for (const [id, slot] of actors) {
          if (now < frameNow || slot.seen !== frameNow) actors.delete(id);
        }
        frameNow = now;
      }
      const actorKey = actorPuppetKey(actor);
      if (!actorKey) { protect(); return null; }
      const state = actorPuppetState(actor, now);
      const activeAction = actor?.actionStateUntil > now && (actor?.actionState !== 'ko' || state === 'ko');
      const worldFacing = (activeAction && actor?.kind !== 'hero' ? actor?.actionFacing : actor?.facing) === 'left' ? 'left' : 'right';
      const facing = actorScreenFacing(worldFacing, orientation);
      const key = `${actorKey}/${state}/${facing}`;
      // Runtime UIDs identify instances; simple preview callers share their actor key.
      const id = actor.uid ?? actor.UID ?? actorKey;
      painted.add(id);
      let slot = actors.get(id);
      if (!slot) { slot = { seen: now }; actors.set(id, slot); }
      slot.seen = now;
      // Finish one initial puppet load before chasing changing action/facing keys.
      // Otherwise a moving actor can invalidate every request before ever appearing.
      if (!slot.shown && slot.ready) {
        const { clip, state, facing } = slot.ready;
        slot.shown = { frame: sampleActorClip(clip, 0), clip, state, facing };
      }
      if (slot.key !== key && (slot.shown || !slot.pending)) { slot.key = key; slot.pending = null; }
      const cached = loadClip.peek?.(actorKey, state, facing);
      if (cached) slot.ready = { key, clip: cached, state, facing };
      protect();
      if (slot.ready?.key !== key && !slot.pending) {
        const request = Promise.resolve().then(() => loadClip(actorKey, state, facing));
        slot.pending = request;
        request.then(clip => {
          if (actors.get(id) !== slot || slot.key !== key || slot.pending !== request) return;
          slot.pending = null;
          if (clip) slot.ready = { key, clip, state, facing };
          protect();
        }).catch(() => { if (slot.pending === request) slot.pending = null; });
      }
      const ready = slot.ready;
      const clip = ready?.clip;
      // A replacement's clock/facing must never resample the outgoing pose.
      // Keep the image last presented until the requested clip is ready.
      if (ready?.key !== key) return slot.shown ?? null;
      if (actor.isPuppetDefeat && slot.defeatClipKey !== key) {
        // This is a presentation copy, already removed from the simulation.
        actor.actionStateStartedAt = now;
        actor.puppetDefeatEndsAt = now + clip.durationMs / 1000;
        actor.actionStateUntil = actor.puppetDefeatEndsAt;
        slot.defeatClipKey = key;
      }
      const frame = clip && sampleActorClip(clip, actorClipAgeMs(actor, state, clip, now));
      slot.shown = frame ? { frame, clip, state, facing } : null;
      return slot.shown;
    },
    retention() { return { displayedActors: actors.size, ...loadClip.retention?.() }; },
  };
}

// Canvas rect of a puppet frame anchored at its feet; shared by the sprite and its overlays.
export function actorPuppetFrameRect(presentation, { footX, footY, height } = {}) {
  const clip = presentation?.clip;
  if (!presentation?.frame || !clip || !Number.isFinite(footX) || !Number.isFinite(footY) || !Number.isFinite(height) || height <= 0) return null;
  const scale = height / (clip.canvas.referenceHeight ?? clip.canvas.height);
  return { drawX: footX - clip.footOrigin.x * scale, drawY: footY - clip.footOrigin.y * scale, width: clip.canvas.width * scale, height: clip.canvas.height * scale };
}

export function drawActorPuppetFrame(ctx, presentation, options = {}) {
  const rect = ctx ? actorPuppetFrameRect(presentation, options) : null;
  if (!rect) return null;
  ctx.drawImage(presentation.frame, rect.drawX, rect.drawY, rect.width, rect.height);
  return rect;
}
