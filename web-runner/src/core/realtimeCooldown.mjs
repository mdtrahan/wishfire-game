const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const palBaseSpeed = Object.freeze({ Cat: 0.75, Waterdrop: 0.60, Deer: 0.65, Snail: 0.60, PiyoBat: 0.90, Eclair: 1.00, SkullServant: 0.80 });
const heroPal = Object.freeze({ Falie: 'Waterdrop', Kojonn: 'Deer', Runa: 'Cat', Huun: 'Eclair' });

export function heroBasicAttackRate(actor) {
  const speed = Math.max(0.01, finite(actor?.speed ?? actor?.spd ?? actor?.SPD ?? actor?.stats?.SPD, 8));
  // The current roster's SPD 8-12 spans the estimated main-character S 1.0-1.5 band.
  const mainSpeed = speed / 8;
  const mainRate = 30 / (0.99 * (2 + Math.ceil(30 / mainSpeed)));
  const palBase = palBaseSpeed[heroPal[actor?.baseHeroName || actor?.name]] || 0;
  const palRate = Math.max(0, palBase + finite(actor?.palFlatSpeedBonus)) * 1.45 * Math.max(0, finite(actor?.palSpeedModifier, 1));
  return (mainRate + palRate) * 0.7;
}

export function realtimeCooldownSeconds(actor) {
  if (Number(actor?.type || 0) === 0) return 1 / heroBasicAttackRate(actor);
  const bossInterval = String(actor?.enemyRole || '').toLowerCase() === 'boss'
    ? Number(actor?.attackPattern?.intervalSeconds) : 0;
  if (Number.isFinite(bossInterval) && bossInterval > 0) return bossInterval;
  return actor?.attackDelivery === 'ranged' ? 5 : 1.6;
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
        ? finite(now) + realtimeCooldownSeconds(actor) + initialCooldownPhase(actor.uid) * 1.5
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
  if (!selectionEnabled) return { ready: [], readyAt: {} };
  const armed = selectRealtimeReadyActor({ actors, readyAt, now, selectionEnabled: false });
  const ready = actors.filter(actor => Number(actor?.hp || 0) > 0 && armed.readyAt[String(actor.uid)] <= finite(now))
    .sort((a, b) => armed.readyAt[String(a.uid)] - armed.readyAt[String(b.uid)] || Number(a.uid) - Number(b.uid));
  return { ready: ready.slice(0, 1), readyAt: armed.readyAt };
}
