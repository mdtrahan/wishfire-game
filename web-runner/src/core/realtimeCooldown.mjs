const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function realtimeCooldownSeconds(actor) {
  const speed = Math.max(1, finite(actor?.speed ?? actor?.spd ?? actor?.SPD, 1));
  if (Number(actor?.type || 0) === 0) return (0.5 + Math.max(0, Math.min(1, (speed - 8) / 4)) * 0.2) * 1.2;
  return Math.max(1.6, Math.min(5, 32 / speed));
}

const initialCooldownPhase = uid => (((Number(uid || 0) * 2654435761) >>> 0) / 0x100000000);

export function selectRealtimeReadyActor({ actors = [], readyAt = {}, now = 0, completedUID = 0, selectionEnabled = true } = {}) {
  const living = actors.filter(actor => Number(actor?.uid || 0) > 0 && Number(actor?.hp || 0) > 0);
  const nextReadyAt = {};
  const completedKey = String(Number(completedUID || 0));
  for (const actor of living) {
    const key = String(actor.uid);
    const prior = finite(readyAt[key], NaN);
    nextReadyAt[key] = Number.isFinite(prior)
      ? prior
      : Number(actor?.type || 0) === 0
        ? finite(now) + initialCooldownPhase(actor.uid) * 1.5
        : finite(now);
    if (key === completedKey) nextReadyAt[key] = finite(now) + realtimeCooldownSeconds(actor);
  }
  const selected = selectionEnabled && living
    .filter(actor => nextReadyAt[String(actor.uid)] <= finite(now))
    .sort((a, b) => nextReadyAt[String(a.uid)] - nextReadyAt[String(b.uid)] || Number(a.uid) - Number(b.uid))[0] || null;
  if (selected) nextReadyAt[String(selected.uid)] = Number.MAX_SAFE_INTEGER;
  return { selected, readyAt: nextReadyAt };
}

export function collectRealtimeReadyActors({ actors = [], readyAt = {}, now = 0, selectionEnabled = true } = {}) {
  const armed = selectRealtimeReadyActor({ actors, readyAt, now, selectionEnabled: false });
  const ready = selectionEnabled
    ? actors.filter(actor => Number(actor?.hp || 0) > 0 && armed.readyAt[String(actor.uid)] <= finite(now))
    : [];
  return { ready, readyAt: armed.readyAt };
}
