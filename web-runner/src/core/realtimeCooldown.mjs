const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function realtimeCooldownSeconds(actor) {
  const speed = Math.max(1, finite(actor?.speed ?? actor?.spd ?? actor?.SPD, 1));
  return Math.max(1.6, Math.min(5, 32 / speed));
}

const initialCooldownPhase = uid => (((Number(uid || 0) * 2654435761) >>> 0) / 0x100000000);

export function selectRealtimeReadyActor({ actors = [], readyAt = {}, now = 0, completedUID = 0 } = {}) {
  const living = actors.filter(actor => Number(actor?.uid || 0) > 0 && Number(actor?.hp || 0) > 0);
  const nextReadyAt = {};
  const completedKey = String(Number(completedUID || 0));
  for (const actor of living) {
    const key = String(actor.uid);
    const prior = finite(readyAt[key], NaN);
    nextReadyAt[key] = Number.isFinite(prior)
      ? prior
      : finite(now) + 0.2 + initialCooldownPhase(actor.uid) * realtimeCooldownSeconds(actor);
    if (key === completedKey) nextReadyAt[key] = finite(now) + realtimeCooldownSeconds(actor);
  }
  const selected = living
    .filter(actor => nextReadyAt[String(actor.uid)] <= finite(now))
    .sort((a, b) => nextReadyAt[String(a.uid)] - nextReadyAt[String(b.uid)] || Number(a.uid) - Number(b.uid))[0] || null;
  if (selected) nextReadyAt[String(selected.uid)] = Number.MAX_SAFE_INTEGER;
  return { selected, readyAt: nextReadyAt };
}
