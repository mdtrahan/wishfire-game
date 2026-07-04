export const DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD = 100;
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

function positiveThreshold(value = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD) {
  const normalized = Math.floor(numberOr(value, DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD));
  return normalized > 0 ? normalized : DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD;
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

function actorSpeed(actor = {}) {
  return numberOr(actor?.effectiveSpeed ?? actor?.speed ?? actor?.effectiveSPD ?? actor?.spd ?? actor?.SPD ?? actor?.stats?.SPD, 0);
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

function actorProjection(actor = {}, stableIndex = 0, reason = 'invalid_actor') {
  const uid = normalizeUID(actor?.uid);
  const speed = actorSpeed(actor);
  return {
    uid,
    type: normalizeType(actor),
    speed,
    effectiveSpeed: speed,
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
  if (!actor || typeof actor !== 'object') return actorProjection({}, stableIndex, 'invalid_actor');
  const normalized = actorProjection(actor, stableIndex, '');

  if (normalized.uid <= 0) return { ...normalized, reason: 'invalid_uid' };
  if (hasPendingDeath(pendingDeaths, normalized.uid) || actor.pendingDeath || actor.pendingDeath === 1 || actor.deathPending) {
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
  if (normalized.speed <= 0) return { ...normalized, reason: 'non_positive_speed' };

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

function normalizeProgress(progress = {}, eligible = []) {
  const next = {};
  for (const actor of eligible) {
    const key = String(actor.uid);
    next[key] = Math.max(0, numberOr(progress?.[key] ?? progress?.[actor.uid], 0));
  }
  return next;
}

function candidateFor(actor = {}, progressValue = 0, threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD) {
  return {
    ...actor,
    progress: progressValue,
    progressBeforeAct: progressValue,
    overflowBeforeAct: progressValue - threshold,
  };
}

function compareCandidates(a = {}, b = {}) {
  const diff = (numberOr(b.progress, 0) - numberOr(a.progress, 0))
    || (numberOr(a.type, 0) - numberOr(b.type, 0))
    || (numberOr(b.speed, 0) - numberOr(a.speed, 0))
    || (numberOr(a.stableIndex, 0) - numberOr(b.stableIndex, 0))
    || (numberOr(a.uid, 0) - numberOr(b.uid, 0));
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

function readyActors(actors = [], progress = {}, threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD) {
  return actors
    .map(actor => candidateFor(actor, numberOr(progress[String(actor.uid)], 0), threshold))
    .filter(actor => actor.progress >= threshold)
    .sort(compareCandidates);
}

function normalizeOpeningPolicy(openingPolicy = null, eligible = []) {
  if (!openingPolicy || String(openingPolicy.mode || '') !== DYNAMIC_INITIATIVE_HERO_OPENER) {
    return {
      policy: null,
      candidates: [],
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
      candidates: [],
      heldActors: [],
    };
  }
  const candidates = eligible.filter(actor => remainingSet.has(String(actor.uid)));
  const heldActors = eligible.filter(actor => !remainingSet.has(String(actor.uid)));
  return {
    policy: { mode: DYNAMIC_INITIATIVE_HERO_OPENER, remainingUIDs, exhausted: false },
    candidates,
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

function dynamicTurnRecord(actor = {}, {
  progressBeforeAct = 0,
  threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  openingPolicyTurn = false,
} = {}) {
  return {
    uid: Number(actor.uid || 0),
    type: Number(actor.type || 0),
    speed: Number(actor.speed || 0),
    name: String(actor.name || actor.uid || ''),
    progressBeforeAct,
    overflowBeforeAct: progressBeforeAct - threshold,
    threshold,
    openingPolicyTurn: !!openingPolicyTurn,
  };
}

export function applyDynamicInitiativeActionCompleted({
  actors = [],
  progress = {},
  pendingDeaths = null,
} = {}) {
  const roster = buildDynamicInitiativeRoster(actors, { pendingDeaths });
  const nextProgress = normalizeProgress(progress, roster.eligible);
  for (const actor of roster.eligible) {
    const key = String(actor.uid);
    nextProgress[key] = Math.max(0, numberOr(nextProgress[key], 0) + numberOr(actor.speed, 0));
  }
  return {
    progress: nextProgress,
    eligible: roster.eligible,
    skipped: roster.skipped,
    reasons: [],
  };
}

export function selectDynamicInitiativeTurn({
  actors = [],
  progress = {},
  pendingDeaths = null,
  threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  openingPolicy = null,
} = {}) {
  const normalizedThreshold = positiveThreshold(threshold);
  const roster = buildDynamicInitiativeRoster(actors, { pendingDeaths });
  const nextProgress = normalizeProgress(progress, roster.eligible);
  const opening = normalizeOpeningPolicy(openingPolicy, roster.eligible);
  const reasons = opening.heldActors.map(actor => ({
    reason: 'opening_policy_hold',
    uid: actor.uid,
    mode: DYNAMIC_INITIATIVE_HERO_OPENER,
  }));

  if (!roster.eligible.length) {
    return {
      actor: null,
      turn: null,
      progress: nextProgress,
      skipped: roster.skipped,
      reasons: [{ reason: 'no_eligible_actor' }],
      openingPolicy: opening.policy,
      threshold: normalizedThreshold,
    };
  }

  if (opening.candidates.length > 0) {
    const openingCandidates = opening.candidates
      .map(actor => candidateFor(actor, numberOr(nextProgress[String(actor.uid)], 0), normalizedThreshold))
      .sort(compareCandidates);
    const actor = openingCandidates[0];
    const nextOpeningPolicy = consumeOpeningPolicy(opening.policy, actor.uid);
    return {
      actor: { ...actor },
      turn: dynamicTurnRecord(actor, {
        progressBeforeAct: numberOr(nextProgress[String(actor.uid)], 0),
        threshold: normalizedThreshold,
        openingPolicyTurn: true,
      }),
      progress: nextProgress,
      skipped: roster.skipped,
      reasons,
      openingPolicy: nextOpeningPolicy,
      threshold: normalizedThreshold,
    };
  }

  const ready = readyActors(roster.eligible, nextProgress, normalizedThreshold);
  if (!ready.length) {
    return {
      actor: null,
      turn: null,
      progress: nextProgress,
      skipped: roster.skipped,
      reasons: [...reasons, { reason: 'no_ready_actor' }],
      openingPolicy: opening.policy,
      threshold: normalizedThreshold,
    };
  }

  const actor = ready[0];
  const key = String(actor.uid);
  const progressBeforeAct = numberOr(nextProgress[key], 0);
  nextProgress[key] = progressBeforeAct - normalizedThreshold;
  return {
    actor: { ...actor },
    turn: dynamicTurnRecord(actor, {
      progressBeforeAct,
      threshold: normalizedThreshold,
      openingPolicyTurn: false,
    }),
    progress: nextProgress,
    skipped: roster.skipped,
    reasons,
    openingPolicy: opening.policy,
    threshold: normalizedThreshold,
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
  progress = {},
  pendingDeaths = null,
  threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  turnCount = 8,
  openingPolicy = null,
} = {}) {
  const turns = [];
  const skipped = [];
  const reasons = [];
  let nextProgress = { ...(progress || {}) };
  let nextOpeningPolicy = openingPolicy;
  const count = Math.max(0, Math.floor(numberOr(turnCount, 0)));

  for (let i = 0; i < count; i += 1) {
    const selected = selectDynamicInitiativeTurn({
      actors,
      progress: nextProgress,
      pendingDeaths,
      threshold,
      openingPolicy: nextOpeningPolicy,
    });
    skipped.push(...selected.skipped);
    reasons.push(...selected.reasons);
    if (!selected.turn) break;
    turns.push(selected.turn);
    nextProgress = selected.progress;
    nextOpeningPolicy = selected.openingPolicy;
    const advanced = applyDynamicInitiativeActionCompleted({
      actors,
      progress: nextProgress,
      pendingDeaths,
    });
    nextProgress = advanced.progress;
    skipped.push(...advanced.skipped);
    reasons.push(...advanced.reasons);
  }

  return {
    turns,
    progress: nextProgress,
    skipped: dedupeSkipped(skipped),
    reasons,
    openingPolicy: nextOpeningPolicy,
    threshold: positiveThreshold(threshold),
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
        speed: Number((typeof entry === 'object' ? entry?.speed : actor.speed) || 0),
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
  progress = {},
  pendingDeaths = null,
  threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  previewCount = 8,
  openingPolicy = null,
} = {}) {
  const currentOrder = normalizeCurrentOrder(currentTeamPhaseOrder, actors);
  const preview = previewDynamicInitiativeTurns({
    actors,
    progress,
    pendingDeaths,
    threshold,
    turnCount: previewCount,
    openingPolicy,
  });
  const proposedOrder = preview.turns;
  return {
    mode: DYNAMIC_INITIATIVE_SHADOW_MODE,
    liveModeUnchanged: true,
    currentModel: 'team_phase',
    proposedModel: 'dynamic_progress',
    firstTurnPolicy: openingPolicy ? String(openingPolicy.mode || '') : '',
    currentOrder,
    proposedOrder,
    skipped: preview.skipped,
    reasons: preview.reasons,
    progress: preview.progress,
    openingPolicy: preview.openingPolicy,
    threshold: preview.threshold,
    divergesFromCurrentOrder: ordersDiverge(currentOrder, proposedOrder.slice(0, currentOrder.length)),
  };
}
