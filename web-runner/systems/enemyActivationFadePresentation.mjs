import { ACTOR_RECOVERY_REVEAL_SECONDS } from '../src/core/actorPresentationState.mjs';

export const ENEMY_ACTIVATION_FADE_SECONDS = ACTOR_RECOVERY_REVEAL_SECONDS;

export function paintWithActivationAlpha(ctx, alpha, paint) {
  if (!ctx || typeof paint !== 'function') return undefined;
  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, Number(alpha) || 0));
  try { return paint(); }
  finally { ctx.restore(); }
}

export function createEnemyActivationFade() {
  const duration = ENEMY_ACTIVATION_FADE_SECONDS;
  const fadeByActor = new WeakMap();

  return (actor, activeTime) => {
    if (!actor || typeof actor !== 'object') return 1;
    const nowValue = Number(activeTime);
    const now = Number.isFinite(nowValue) ? nowValue : 0;
    const startValue = actor.recoveryFadeStartedAt ?? actor.streamStartAt;
    const activationValue = startValue == null ? NaN : Number(startValue);
    const hasActivationTime = Number.isFinite(activationValue);
    const activationTime = hasActivationTime ? activationValue : null;
    let fade = fadeByActor.get(actor);

    if (!fade || fade.activationTime !== activationTime) {
      fade = { activationTime, startedAt: hasActivationTime ? activationValue : now };
      fadeByActor.set(actor, fade);
    }

    const progress = Math.max(0, Math.min(1, (now - fade.startedAt) / duration));
    return progress * progress * (3 - 2 * progress);
  };
}
