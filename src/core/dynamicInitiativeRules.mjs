export const DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD = 100;
export const DYNAMIC_INITIATIVE_DEFAULT_MAX_TICKS = 10000;
export const DYNAMIC_INITIATIVE_DEFAULT_BURST_CAP = 2;
export const DYNAMIC_INITIATIVE_SHADOW_MODE = 'shadow_only';
export const DYNAMIC_INITIATIVE_HERO_OPENER = 'hero_opener';

const BLOCKED_STATUS_VALUES = new Set([
  'dead',
  'disabled',
  'stopped',
  'paralyzed',
  'stunned',
]);

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function positiveIntOr(value, fallback) {
  const normalized = Math.floor(numberOr(value, fallback));
  return normalized > 0 ? normalized : fallback;
}

function normalizeUID(value = 0) {
  return Math.floor(numberOr(value, 0));
}

function normalizeType(actor = {}) {
  if (actor?.type != null) return Number(actor.type || 0) === 1 ? 1 : 0;
  return String(actor?.kind || '').toLowerCase() === 'enemy' ? 1 : 0;
}

function normalizeName(actor = {}, uid = 0) {
  const raw = actor?.name ?? actor?.key ?? actor?.id ?? '';
  const name = String(raw || '').trim();
  return name || String(uid || '');
}

function effectiveSpeed(actor = {}) {
  return numberOr(actor?.effectiveSPD ?? actor?.spd ?? actor?.SPD ?? actor?.stats?.SPD, 0);
}

function actorHp(actor = {}) {
  return numberOr(actor?.hp ?? actor?.HP, 1);
}

function statusValueString(value) {
  if (value && typeof value === 'object') {
    return String(value.id ?? value.status ?? value.state ?? value.name ?? '').toLowerCase();
  }
  return String(value || '').toLowerCase();
}

function statusBlockedReason(actor = {}) {
  if (actor?.statusBlocked) return 'status_blocked';
  const values = [
    actor?.status,
    actor?.state,
    ...(Array.isArray(actor?.statuses) ? actor.statuses : []),
    ...(Array.isArray(actor?.statusEffects) ? actor.statusEffects : []),
  ].map(statusValueString).filter(Boolean);
  const blocked = values.find(value => BLOCKED_STATUS_VALUES.has(value));
  return blocked ? `status_blocked:${blocked}` : '';
}

function hasPendingDeath(pendingDeaths = null, uid = 0) {
  const key = String(uid);
  if (!pendingDeaths || uid <= 0) return false;
  if (pendingDeaths instanceof Set) return pendingDeaths.has(uid) || pendingDeaths.has(key);
  if (Array.isArray(pendingDeaths)) return pendingDeaths.some(value => normalizeUID(value) === uid);
  if (typeof pendingDeaths === 'object') {
    return Object.prototype.hasOwnProperty.call(pendingDeaths, key)
      || Object.prototype.hasOwnProperty.call(pendingDeaths, uid);
  }
  return false;
}

function skippedActor(actor = {}, stableIndex = 0, reason = 'invalid_actor') {
  const uid = normalizeUID(actor?.uid);
  const spd = effectiveSpeed(actor);
  return {
    uid,
    type: normalizeType(actor),
    spd,
    effectiveSPD: spd,
    hp: actorHp(actor),
    name: normalizeName(actor, uid),
    stableIndex,
    eligible: false,
    reason,
  };
}

export function normalizeDynamicInitiativeActor(actor = {}, {
  stableIndex = 0,
  pendingDeaths = null,
} = {}) {
  if (!actor || typeof actor !== 'object') return skippedActor({}, stableIndex, 'invalid_actor');
  const uid = normalizeUID(actor.uid);
  const spd = effectiveSpeed(actor);
  const normalized = {
    uid,
    type: normalizeType(actor),
    spd,
    effectiveSPD: spd,
    hp: actorHp(actor),
    name: normalizeName(actor, uid),
    stableIndex,
    eligible: false,
    reason: '',
  };

  if (uid <= 0) return { ...normalized, reason: 'invalid_uid' };
  if (hasPendingDeath(pendingDeaths, uid) || actor.pendingDeath || actor.pendingDeath === 1 || actor.deathPending) {
    return { ...normalized, reason: 'pending_death' };
  }
  if (normalized.hp <= 0 || actor.isAlive === false) return { ...normalized, reason: 'dead' };
  if (actor.ableToAct === false) return { ...normalized, reason: 'unable_to_act' };
  if (actor.disabled) return { ...normalized, reason: 'disabled' };
  if (actor.stunned) return { ...normalized, reason: 'stunned' };
  if (actor.stopped) return { ...normalized, reason: 'stopped' };
  if (actor.paralyzed) return { ...normalized, reason: 'paralyzed' };
  const blocked = statusBlockedReason(actor);
  if (blocked) return { ...normalized, reason: blocked };
  if (spd <= 0) return { ...normalized, reason: 'non_positive_speed' };

  return {
    ...normalized,
    eligible: true,
    reason: 'eligible',
  };
}

export function buildDynamicInitiativeRoster(actors = [], {
  pendingDeaths = null,
} = {}) {
  const eligible = [];
  const skipped = [];
  const source = Array.isArray(actors) ? actors : [];
  for (let i = 0; i < source.length; i += 1) {
    const actor = normalizeDynamicInitiativeActor(source[i], { stableIndex: i, pendingDeaths });
    if (actor.eligible) eligible.push(actor);
    else skipped.push(actor);
  }
  return { eligible, skipped };
}

function normalizeMeters(meters = {}, eligible = []) {
  const next = {};
  for (const actor of eligible) {
    const key = String(actor.uid);
    next[key] = Math.max(0, numberOr(meters?.[key] ?? meters?.[actor.uid], 0));
  }
  return next;
}

function readyCandidate(actor, meter = 0, threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD) {
  return {
    ...actor,
    meter,
    overflow: meter - threshold,
  };
}

function compareReadyCandidates(a = {}, b = {}) {
  const diff = (numberOr(b.overflow, 0) - numberOr(a.overflow, 0))
    || (numberOr(b.effectiveSPD, 0) - numberOr(a.effectiveSPD, 0))
    || (numberOr(a.stableIndex, 0) - numberOr(b.stableIndex, 0))
    || (numberOr(a.uid, 0) - numberOr(b.uid, 0));
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

function readyActors(actors = [], meters = {}, threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD) {
  return actors
    .map(actor => readyCandidate(actor, numberOr(meters[String(actor.uid)], 0), threshold))
    .filter(actor => actor.meter >= threshold)
    .sort(compareReadyCandidates);
}

function ticksToNextReady(actors = [], meters = {}, threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD, {
  excludeUID = 0,
} = {}) {
  let ticks = Infinity;
  for (const actor of actors) {
    if (excludeUID && Number(actor.uid || 0) === Number(excludeUID || 0)) continue;
    const meter = numberOr(meters[String(actor.uid)], 0);
    if (meter >= threshold) return 0;
    const spd = numberOr(actor.effectiveSPD, 0);
    if (spd <= 0) continue;
    ticks = Math.min(ticks, Math.ceil((threshold - meter) / spd));
  }
  return Number.isFinite(ticks) ? Math.max(1, ticks) : null;
}

function addTicksToMeters(meters = {}, eligible = [], ticks = 0) {
  const next = { ...meters };
  for (const actor of eligible) {
    const key = String(actor.uid);
    next[key] = Math.max(0, numberOr(next[key], 0) + (numberOr(actor.effectiveSPD, 0) * ticks));
  }
  return next;
}

function normalizeOpeningPolicy(openingPolicy = null, eligible = []) {
  if (!openingPolicy || String(openingPolicy.mode || '') !== DYNAMIC_INITIATIVE_HERO_OPENER) {
    return {
      policy: null,
      activeActors: eligible,
      heldActors: [],
    };
  }
  const eligibleHeroUIDs = new Set(
    eligible
      .filter(actor => Number(actor.type || 0) === 0)
      .map(actor => String(actor.uid)),
  );
  const rawRemaining = openingPolicy.remainingUIDs && typeof openingPolicy.remainingUIDs === 'object'
    ? openingPolicy.remainingUIDs
    : Object.fromEntries(Array.from(eligibleHeroUIDs).map(uid => [uid, true]));
  const remainingUIDs = {};
  for (const [uid, value] of Object.entries(rawRemaining)) {
    const normalizedUID = String(normalizeUID(uid));
    if (value && eligibleHeroUIDs.has(normalizedUID)) remainingUIDs[normalizedUID] = true;
  }
  const remainingSet = new Set(Object.keys(remainingUIDs));
  if (remainingSet.size === 0) {
    return {
      policy: { mode: DYNAMIC_INITIATIVE_HERO_OPENER, remainingUIDs, exhausted: true },
      activeActors: eligible,
      heldActors: [],
    };
  }
  const activeActors = eligible.filter(actor => remainingSet.has(String(actor.uid)));
  const heldActors = eligible.filter(actor => !remainingSet.has(String(actor.uid)));
  return {
    policy: { mode: DYNAMIC_INITIATIVE_HERO_OPENER, remainingUIDs, exhausted: false },
    activeActors,
    heldActors,
  };
}

function consumeOpeningPolicy(policy = null, uid = 0) {
  if (!policy || String(policy.mode || '') !== DYNAMIC_INITIATIVE_HERO_OPENER) return policy;
  const remainingUIDs = { ...(policy.remainingUIDs || {}) };
  delete remainingUIDs[String(normalizeUID(uid))];
  return {
    mode: DYNAMIC_INITIATIVE_HERO_OPENER,
    remainingUIDs,
    exhausted: Object.keys(remainingUIDs).length === 0,
  };
}

function selectReadyActor({
  ready = [],
  activeActors = [],
  lastActorUID = 0,
  consecutiveTurns = 0,
  maxConsecutiveTurns = DYNAMIC_INITIATIVE_DEFAULT_BURST_CAP,
  reasons = [],
} = {}) {
  const first = ready[0] || null;
  if (!first) return { actor: null, waitForAlternative: false };
  const lastUID = normalizeUID(lastActorUID);
  const cap = positiveIntOr(maxConsecutiveTurns, DYNAMIC_INITIATIVE_DEFAULT_BURST_CAP);
  const capReached = lastUID > 0
    && Number(first.uid || 0) === lastUID
    && Number(consecutiveTurns || 0) >= cap;
  if (!capReached) return { actor: first, waitForAlternative: false };

  const alternative = ready.find(actor => Number(actor.uid || 0) !== lastUID);
  if (alternative) {
    reasons.push({
      reason: 'burst_cap_select_alternative',
      cappedUID: lastUID,
      uid: alternative.uid,
      maxConsecutiveTurns: cap,
    });
    return { actor: alternative, waitForAlternative: false };
  }

  const hasAlternativeActor = activeActors.some(actor => Number(actor.uid || 0) !== lastUID);
  if (hasAlternativeActor) {
    reasons.push({
      reason: 'burst_cap_wait_for_alternative',
      cappedUID: lastUID,
      maxConsecutiveTurns: cap,
    });
    return { actor: null, waitForAlternative: true };
  }

  reasons.push({
    reason: 'burst_cap_single_actor_no_alternative',
    uid: first.uid,
    maxConsecutiveTurns: cap,
  });
  return { actor: first, waitForAlternative: false };
}

function dynamicTurnRecord(actor = {}, {
  meterBeforeAct = 0,
  threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  ticksElapsed = 0,
  consecutiveTurns = 1,
} = {}) {
  return {
    uid: Number(actor.uid || 0),
    type: Number(actor.type || 0),
    spd: Number(actor.effectiveSPD || actor.spd || 0),
    name: String(actor.name || actor.uid || ''),
    ticksElapsed,
    meterBeforeAct,
    overflowBeforeAct: meterBeforeAct - threshold,
    consecutiveTurns,
  };
}

export function selectDynamicInitiativeTurn({
  actors = [],
  meters = {},
  pendingDeaths = null,
  threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  maxTicks = DYNAMIC_INITIATIVE_DEFAULT_MAX_TICKS,
  maxConsecutiveTurns = DYNAMIC_INITIATIVE_DEFAULT_BURST_CAP,
  lastActorUID = 0,
  consecutiveTurns = 0,
  openingPolicy = null,
} = {}) {
  const normalizedThreshold = positiveIntOr(threshold, DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD);
  const normalizedMaxTicks = positiveIntOr(maxTicks, DYNAMIC_INITIATIVE_DEFAULT_MAX_TICKS);
  const roster = buildDynamicInitiativeRoster(actors, { pendingDeaths });
  let nextMeters = normalizeMeters(meters, roster.eligible);
  const opening = normalizeOpeningPolicy(openingPolicy, roster.eligible);
  const activeActors = opening.activeActors;
  const reasons = opening.heldActors.map(actor => ({
    reason: 'opening_policy_hold',
    uid: actor.uid,
    mode: DYNAMIC_INITIATIVE_HERO_OPENER,
  }));

  if (!roster.eligible.length || !activeActors.length) {
    return {
      actor: null,
      turn: null,
      meters: nextMeters,
      ticksElapsed: 0,
      skipped: roster.skipped,
      reasons: [
        ...reasons,
        { reason: roster.eligible.length ? 'no_active_opening_actor' : 'no_eligible_actor' },
      ],
      openingPolicy: opening.policy,
      lastActorUID: normalizeUID(lastActorUID),
      consecutiveTurns: Math.max(0, Math.floor(numberOr(consecutiveTurns, 0))),
    };
  }

  let ticksElapsed = 0;
  for (let guard = 0; guard < normalizedMaxTicks + activeActors.length + 1; guard += 1) {
    const ready = readyActors(activeActors, nextMeters, normalizedThreshold);
    if (ready.length <= 0) {
      const ticks = ticksToNextReady(activeActors, nextMeters, normalizedThreshold);
      if (ticks == null || ticksElapsed + ticks > normalizedMaxTicks) {
        return {
          actor: null,
          turn: null,
          meters: nextMeters,
          ticksElapsed,
          skipped: roster.skipped,
          reasons: [...reasons, { reason: 'max_ticks_without_ready_actor', maxTicks: normalizedMaxTicks }],
          openingPolicy: opening.policy,
          lastActorUID: normalizeUID(lastActorUID),
          consecutiveTurns: Math.max(0, Math.floor(numberOr(consecutiveTurns, 0))),
        };
      }
      nextMeters = addTicksToMeters(nextMeters, roster.eligible, ticks);
      ticksElapsed += ticks;
      continue;
    }

    const selected = selectReadyActor({
      ready,
      activeActors,
      lastActorUID,
      consecutiveTurns,
      maxConsecutiveTurns,
      reasons,
    });
    if (selected.waitForAlternative) {
      const ticks = ticksToNextReady(activeActors, nextMeters, normalizedThreshold, {
        excludeUID: lastActorUID,
      });
      if (ticks == null || ticksElapsed + ticks > normalizedMaxTicks) {
        return {
          actor: null,
          turn: null,
          meters: nextMeters,
          ticksElapsed,
          skipped: roster.skipped,
          reasons: [...reasons, { reason: 'burst_cap_no_alternative_before_tick_cap', maxTicks: normalizedMaxTicks }],
          openingPolicy: opening.policy,
          lastActorUID: normalizeUID(lastActorUID),
          consecutiveTurns: Math.max(0, Math.floor(numberOr(consecutiveTurns, 0))),
        };
      }
      nextMeters = addTicksToMeters(nextMeters, roster.eligible, ticks);
      ticksElapsed += ticks;
      continue;
    }

    const actor = selected.actor;
    const key = String(actor.uid);
    const meterBeforeAct = numberOr(nextMeters[key], 0);
    const nextConsecutiveTurns = Number(actor.uid || 0) === normalizeUID(lastActorUID)
      ? Math.max(0, Math.floor(numberOr(consecutiveTurns, 0))) + 1
      : 1;
    nextMeters[key] = Math.max(0, meterBeforeAct - normalizedThreshold);
    if (nextConsecutiveTurns > 1) {
      reasons.push({
        reason: 'speed_overflow_repeat',
        uid: actor.uid,
        consecutiveTurns: nextConsecutiveTurns,
      });
    }
    const nextOpeningPolicy = consumeOpeningPolicy(opening.policy, actor.uid);
    const turn = dynamicTurnRecord(actor, {
      meterBeforeAct,
      threshold: normalizedThreshold,
      ticksElapsed,
      consecutiveTurns: nextConsecutiveTurns,
    });
    return {
      actor: { ...actor },
      turn,
      meters: nextMeters,
      ticksElapsed,
      skipped: roster.skipped,
      reasons,
      openingPolicy: nextOpeningPolicy,
      lastActorUID: actor.uid,
      consecutiveTurns: nextConsecutiveTurns,
      threshold: normalizedThreshold,
      burstCap: positiveIntOr(maxConsecutiveTurns, DYNAMIC_INITIATIVE_DEFAULT_BURST_CAP),
    };
  }

  return {
    actor: null,
    turn: null,
    meters: nextMeters,
    ticksElapsed,
    skipped: roster.skipped,
    reasons: [...reasons, { reason: 'scheduler_guard_exhausted' }],
    openingPolicy: opening.policy,
    lastActorUID: normalizeUID(lastActorUID),
    consecutiveTurns: Math.max(0, Math.floor(numberOr(consecutiveTurns, 0))),
  };
}

function dedupeSkipped(skipped = []) {
  const seen = new Set();
  const out = [];
  for (const actor of skipped) {
    const key = `${actor.uid}:${actor.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(actor);
  }
  return out;
}

export function previewDynamicInitiativeTurns({
  actors = [],
  meters = {},
  pendingDeaths = null,
  threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  maxTicks = DYNAMIC_INITIATIVE_DEFAULT_MAX_TICKS,
  maxConsecutiveTurns = DYNAMIC_INITIATIVE_DEFAULT_BURST_CAP,
  turnCount = 8,
  openingPolicy = null,
  lastActorUID = 0,
  consecutiveTurns = 0,
} = {}) {
  const turns = [];
  const skipped = [];
  const reasons = [];
  const repeats = [];
  let nextMeters = { ...(meters || {}) };
  let nextOpeningPolicy = openingPolicy;
  let nextLastUID = normalizeUID(lastActorUID);
  let nextConsecutiveTurns = Math.max(0, Math.floor(numberOr(consecutiveTurns, 0)));
  const count = Math.max(0, Math.floor(numberOr(turnCount, 0)));

  for (let i = 0; i < count; i += 1) {
    const selected = selectDynamicInitiativeTurn({
      actors,
      meters: nextMeters,
      pendingDeaths,
      threshold,
      maxTicks,
      maxConsecutiveTurns,
      openingPolicy: nextOpeningPolicy,
      lastActorUID: nextLastUID,
      consecutiveTurns: nextConsecutiveTurns,
    });
    skipped.push(...selected.skipped);
    reasons.push(...selected.reasons);
    if (!selected.turn) break;
    turns.push(selected.turn);
    if (turns.length > 1 && turns[turns.length - 2].uid === selected.turn.uid) {
      repeats.push({
        uid: selected.turn.uid,
        fromIndex: turns.length - 2,
        toIndex: turns.length - 1,
        reason: 'speed_overflow_repeat',
      });
    }
    nextMeters = selected.meters;
    nextOpeningPolicy = selected.openingPolicy;
    nextLastUID = selected.lastActorUID;
    nextConsecutiveTurns = selected.consecutiveTurns;
  }

  return {
    turns,
    meters: nextMeters,
    skipped: dedupeSkipped(skipped),
    reasons,
    repeats,
    openingPolicy: nextOpeningPolicy,
    lastActorUID: nextLastUID,
    consecutiveTurns: nextConsecutiveTurns,
  };
}

function normalizeCurrentOrder(currentTeamPhaseOrder = [], actors = []) {
  const actorByUID = new Map(
    (Array.isArray(actors) ? actors : [])
      .map((actor, index) => {
        const normalized = normalizeDynamicInitiativeActor(actor, { stableIndex: index });
        return [normalized.uid, normalized];
      }),
  );
  return (Array.isArray(currentTeamPhaseOrder) ? currentTeamPhaseOrder : [])
    .map((entry, index) => {
      const uid = normalizeUID(typeof entry === 'object' ? entry?.uid : entry);
      const actor = actorByUID.get(uid) || {};
      return {
        uid,
        type: Number((typeof entry === 'object' ? entry?.type : actor.type) || 0),
        spd: Number((typeof entry === 'object' ? entry?.spd : actor.spd) || 0),
        name: String((typeof entry === 'object' ? entry?.name : actor.name) || uid || ''),
        index,
      };
    })
    .filter(entry => entry.uid > 0);
}

function ordersDiverge(currentOrder = [], proposedOrder = []) {
  if (currentOrder.length !== proposedOrder.length) return true;
  for (let i = 0; i < currentOrder.length; i += 1) {
    if (Number(currentOrder[i]?.uid || 0) !== Number(proposedOrder[i]?.uid || 0)) return true;
  }
  return false;
}

export function createDynamicInitiativeShadowAudit({
  actors = [],
  currentTeamPhaseOrder = [],
  meters = {},
  pendingDeaths = null,
  threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  maxTicks = DYNAMIC_INITIATIVE_DEFAULT_MAX_TICKS,
  maxConsecutiveTurns = DYNAMIC_INITIATIVE_DEFAULT_BURST_CAP,
  previewCount = 8,
  openingPolicy = null,
} = {}) {
  const currentOrder = normalizeCurrentOrder(currentTeamPhaseOrder, actors);
  const preview = previewDynamicInitiativeTurns({
    actors,
    meters,
    pendingDeaths,
    threshold,
    maxTicks,
    maxConsecutiveTurns,
    turnCount: previewCount,
    openingPolicy,
  });
  const proposedOrder = preview.turns;
  return {
    mode: DYNAMIC_INITIATIVE_SHADOW_MODE,
    liveModeUnchanged: true,
    currentModel: 'team_phase',
    proposedModel: 'dynamic_action_gauge',
    firstTurnPolicy: openingPolicy ? String(openingPolicy.mode || '') : '',
    currentOrder,
    proposedOrder,
    skipped: preview.skipped,
    repeats: preview.repeats,
    reasons: preview.reasons,
    meters: preview.meters,
    openingPolicy: preview.openingPolicy,
    divergesFromCurrentOrder: ordersDiverge(currentOrder, proposedOrder.slice(0, currentOrder.length)),
  };
}
