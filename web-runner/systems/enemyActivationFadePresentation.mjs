export const ENEMY_ACTIVATION_FADE_SECONDS = 0.35;

export function createEnemyActivationFade() {
  const duration = ENEMY_ACTIVATION_FADE_SECONDS;
  const fadeByActor = new WeakMap();

  return (actor, activeTime) => {
    if (!actor || typeof actor !== 'object') return 1;
    const nowValue = Number(activeTime);
    const now = Number.isFinite(nowValue) ? nowValue : 0;
    const activationValue = actor.streamStartAt == null ? NaN : Number(actor.streamStartAt);
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
