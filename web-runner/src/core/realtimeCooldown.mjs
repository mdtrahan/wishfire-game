import { HERO_DEFINITIONS, heroDefinition } from './heroDefinitions.mjs';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function heroBasicAttackRate(actor) {
  return 1 / (heroDefinition(actor)?.baseAttackInterval ?? HERO_DEFINITIONS.Falie.baseAttackInterval);
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

export function scheduleRealtimeActions({ actors = [], clocks = {}, now = 0, frameSeconds = 1 / 60 } = {}) {
  const time = finite(now);
  const frame = Math.max(0, finite(frameSeconds, 1 / 60));
  const nextClocks = {};
  const candidates = [];
  for (const actor of actors) {
    const uid = Number(actor?.uid || 0);
    if (uid <= 0 || Number(actor?.hp || 0) <= 0) continue;
    const key = String(uid), previous = clocks[key] || {};
    const isHero = actor?.kind === 'hero' || (actor?.kind !== 'enemy' && Number(actor?.type) === 0);
    const defaultInterval = realtimeCooldownSeconds({ ...actor, type: actor?.type ?? (isHero ? 0 : 1) });
    const basicInterval = Math.max(0.001, finite(actor?.basicIntervalSeconds, defaultInterval));
    const basicReadyAt = finite(previous.basicReadyAt, finite(actor?.basicReadyAt, time));
    const skillReadyAt = { ...(previous.skillReadyAt || {}) };
    const clock = {
      basicReadyAt,
      castUntil: finite(previous.castUntil, finite(actor?.castUntil)),
      basicServicedSinceSkill: !!previous.basicServicedSinceSkill,
      skillReadyAt,
    };
    nextClocks[key] = clock;
    if (clock.castUntil > time) continue;

    const basicDue = actor?.basicEligible !== false && basicReadyAt <= time;
    const skills = (Array.isArray(actor?.skills) ? actor.skills : [])
      .map((skill, index) => ({ skill, index, id: String(skill?.id ?? index) }))
      .map(entry => {
        if (!Object.prototype.hasOwnProperty.call(skillReadyAt, entry.id)) skillReadyAt[entry.id] = finite(entry.skill?.readyAt, time);
        return { ...entry, dueAt: finite(skillReadyAt[entry.id], time) };
      })
      .filter(({ skill }) => skill && skill.eligible !== false && skill.enabled !== false)
      .filter(entry => entry.dueAt <= time)
      .sort((a, b) => finite(a.skill.priority, a.index) - finite(b.skill.priority, b.index) || a.index - b.index);

    let action = null;
    if (basicDue && (!clock.basicServicedSinceSkill || skills.length === 0)) {
      action = { kind: 'basic', dueAt: basicReadyAt, interval: basicInterval };
    } else if (skills.length) {
      const next = skills[0];
      action = { kind: 'skill', dueAt: next.dueAt, skillId: next.id, skill: next.skill };
    } else if (basicDue) {
      action = { kind: 'basic', dueAt: basicReadyAt, interval: basicInterval };
    }
    if (action) candidates.push({ actor, uid, isHero, action });
  }

  const heroBasics = candidates.filter(entry => entry.isHero && entry.action.kind === 'basic')
    .sort((a, b) => a.action.dueAt - b.action.dueAt || a.uid - b.uid);
  const staggerByUID = new Map(heroBasics.map((entry, index) => [entry.uid, index * frame]));
  const actions = candidates.map(({ actor, uid, action }) => {
    const startAt = time + (staggerByUID.get(uid) || 0);
    const clock = nextClocks[String(uid)];
    const castSeconds = Math.max(0, finite(action.skill?.castSeconds, finite(actor?.basicCastSeconds)));
    clock.castUntil = startAt + castSeconds;
    if (action.kind === 'basic') {
      clock.basicReadyAt = action.dueAt + action.interval;
      clock.basicServicedSinceSkill = true;
    } else {
      const cooldown = Math.max(0, finite(action.skill?.cooldownSeconds));
      clock.skillReadyAt[action.skillId] = startAt + cooldown;
      clock.basicServicedSinceSkill = false;
    }
    return {
      uid,
      kind: action.kind,
      ...(action.kind === 'skill' ? { skillId: action.skillId } : {}),
      dueAt: action.dueAt,
      startAt,
      castUntil: clock.castUntil,
      projectileFlightSeconds: Math.max(0, finite(action.skill?.projectileFlightSeconds, finite(actor?.projectileFlightSeconds))),
    };
  }).sort((a, b) => a.dueAt - b.dueAt || a.uid - b.uid);

  return { actions, clocks: nextClocks };
}
