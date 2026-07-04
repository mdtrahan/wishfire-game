import {
  DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  DYNAMIC_INITIATIVE_HERO_OPENER,
  applyDynamicInitiativeActionCompleted,
  buildDynamicInitiativeRoster,
  selectDynamicInitiativeTurn,
} from './dynamicInitiativeRules.mjs';

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizeUID(value = 0) {
  return Math.floor(numberOr(value, 0));
}

function normalizeType(value = 0) {
  return Number(value || 0) === 1 ? 1 : 0;
}

function actorName(actor = {}, uid = 0) {
  const name = String(actor?.name ?? actor?.key ?? actor?.id ?? '').trim();
  return name || String(uid || '');
}

function normalizeActorRef(actor = null) {
  if (!actor || typeof actor !== 'object') return null;
  const uid = normalizeUID(actor.uid);
  if (!(uid > 0)) return null;
  return {
    uid,
    type: normalizeType(actor.type),
    name: actorName(actor, uid),
  };
}

function orderedProgress(progress = {}, actors = []) {
  const out = {};
  for (const actor of actors) {
    const uid = normalizeUID(actor?.uid);
    if (!(uid > 0)) continue;
    if (!Object.prototype.hasOwnProperty.call(progress || {}, String(uid))) continue;
    out[String(uid)] = numberOr(progress[String(uid)], 0);
  }
  return out;
}

function cloneProgress(progress = {}) {
  const out = {};
  for (const [uid, value] of Object.entries(progress || {})) {
    const normalizedUID = normalizeUID(uid);
    if (normalizedUID > 0) out[String(normalizedUID)] = Math.max(0, numberOr(value, 0));
  }
  return out;
}

function consumeCompletedOpeningActor(openingPolicy = null, completedActor = null) {
  if (!openingPolicy || String(openingPolicy.mode || '') !== DYNAMIC_INITIATIVE_HERO_OPENER) {
    return { openingPolicy: openingPolicy || null, consumed: false };
  }
  const uid = normalizeUID(completedActor?.uid);
  const remainingUIDs = { ...(openingPolicy.remainingUIDs || {}) };
  const key = String(uid);
  const consumed = uid > 0 && !!remainingUIDs[key];
  if (consumed) delete remainingUIDs[key];
  return {
    openingPolicy: {
      mode: DYNAMIC_INITIATIVE_HERO_OPENER,
      remainingUIDs,
      exhausted: Object.keys(remainingUIDs).length === 0,
    },
    consumed,
  };
}

function readyCandidates(actors = [], progress = {}, threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD) {
  return buildDynamicInitiativeRoster(actors).eligible
    .map(actor => ({
      ...actor,
      progress: numberOr(progress[String(actor.uid)], 0),
    }))
    .filter(actor => actor.progress >= threshold);
}

function canAdvanceInitiative(eligible = []) {
  return (Array.isArray(eligible) ? eligible : [])
    .some(actor => numberOr(actor?.speed ?? actor?.effectiveSpeed ?? actor?.spd, 0) > 0);
}

function classifySelectionReason({ selected = null, actors = [], progress = {}, threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD, openingPolicyTurn = false } = {}) {
  if (!selected) return 'no_ready_actor';
  if (openingPolicyTurn) return 'opening_policy';

  const candidates = readyCandidates(actors, progress, threshold);
  const selectedProgress = numberOr(progress[String(selected.uid)], 0);
  const highestProgress = Math.max(...candidates.map(actor => numberOr(actor.progress, 0)), selectedProgress);
  if (selectedProgress > Math.max(...candidates.filter(actor => actor.uid !== selected.uid).map(actor => numberOr(actor.progress, 0)), -Infinity)) {
    return 'highest_progress';
  }

  const progressTied = candidates.filter(actor => numberOr(actor.progress, 0) === highestProgress);
  const selectedType = normalizeType(selected.type);
  if (progressTied.some(actor => normalizeType(actor.type) !== selectedType) && selectedType === 0) {
    return 'tie_hero_over_enemy';
  }

  const sameSide = progressTied.filter(actor => normalizeType(actor.type) === selectedType);
  const selectedSpeed = numberOr(selected.speed ?? selected.effectiveSpeed, 0);
  if (selectedSpeed > Math.max(...sameSide.filter(actor => actor.uid !== selected.uid).map(actor => numberOr(actor.speed ?? actor.effectiveSpeed, 0)), -Infinity)) {
    return 'tie_speed';
  }

  return 'tie_stable_order';
}

function normalizeOpeningPolicyForTrace(policy = null, consumed = false) {
  if (!policy) return null;
  return {
    mode: String(policy.mode || ''),
    remainingUIDs: { ...(policy.remainingUIDs || {}) },
    exhausted: !!policy.exhausted,
    completedActorConsumed: !!consumed,
  };
}

export function advanceDynamicInitiativeShadow({
  battleId = 0,
  actionSerial = 0,
  actors = [],
  completedActor = null,
  progress = {},
  openingPolicy = null,
  pendingDeaths = null,
  threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
} = {}) {
  const rosterBefore = buildDynamicInitiativeRoster(actors, { pendingDeaths });
  const actorOrder = rosterBefore.eligible;
  const progressBeforeAdvance = orderedProgress(cloneProgress(progress), actorOrder);
  const completed = normalizeActorRef(completedActor);
  const consumedOpening = consumeCompletedOpeningActor(openingPolicy, completed);
  let advanced = applyDynamicInitiativeActionCompleted({
    actors,
    progress: progressBeforeAdvance,
    pendingDeaths,
  });
  let initiativeAdvanceCount = 1;
  let progressBeforeSelection = orderedProgress(advanced.progress, advanced.eligible);
  let selected = selectDynamicInitiativeTurn({
    actors,
    progress: progressBeforeSelection,
    pendingDeaths,
    threshold,
    openingPolicy: consumedOpening.openingPolicy,
  });
  while (!selected.turn && canAdvanceInitiative(advanced.eligible) && initiativeAdvanceCount < 1000) {
    advanced = applyDynamicInitiativeActionCompleted({
      actors,
      progress: progressBeforeSelection,
      pendingDeaths,
    });
    initiativeAdvanceCount += 1;
    progressBeforeSelection = orderedProgress(advanced.progress, advanced.eligible);
    selected = selectDynamicInitiativeTurn({
      actors,
      progress: progressBeforeSelection,
      pendingDeaths,
      threshold,
      openingPolicy: consumedOpening.openingPolicy,
    });
  }
  const selectedActor = normalizeActorRef(selected.actor);
  const progressAfterSelection = orderedProgress(selected.progress, advanced.eligible);
  const openingPolicyTurn = !!selected.turn?.openingPolicyTurn;
  const selectionReason = classifySelectionReason({
    selected: selected.actor,
    actors,
    progress: progressBeforeSelection,
    threshold,
    openingPolicyTurn,
  });
  const trace = {
    battleId: normalizeUID(battleId),
    actionSerial: Math.max(0, Math.floor(numberOr(actionSerial, 0))),
    actors: advanced.eligible.map(actor => normalizeActorRef(actor)).filter(Boolean),
    completedActor: completed,
    progressBeforeAdvance,
    initiativeAdvanceCount,
    progressBeforeSelection,
    progressAfterSelection,
    selectedActor,
    selectionReason,
    threshold: Math.max(1, Math.floor(numberOr(threshold, DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD))),
    openingPolicy: normalizeOpeningPolicyForTrace(selected.openingPolicy, consumedOpening.consumed),
    eligibilitySkips: advanced.skipped,
    pendingDeathExclusions: advanced.skipped.filter(actor => actor.reason === 'pending_death'),
    reasons: selected.reasons || [],
  };
  return {
    nextState: {
      progress: progressAfterSelection,
      openingPolicy: selected.openingPolicy || null,
    },
    trace,
  };
}

export function compareDynamicInitiativeShadowSelection(trace = {}, liveActor = null) {
  const expected = normalizeActorRef(trace?.selectedActor);
  const live = normalizeActorRef(liveActor);
  const matches = !!expected && !!live && expected.uid === live.uid && expected.type === live.type;
  return {
    matches,
    expected,
    live,
    reason: matches ? 'match' : 'selection_mismatch',
    actionSerial: Math.max(0, Math.floor(numberOr(trace?.actionSerial, 0))),
  };
}

function formatActorLine(actor = {}, progress = {}) {
  const uid = normalizeUID(actor?.uid);
  return `${actorName(actor, uid)} ${numberOr(progress[String(uid)], 0)}`;
}

function orderedTraceActors(trace = {}) {
  const byUID = new Map();
  const add = (actor) => {
    const normalized = normalizeActorRef(actor);
    if (normalized && !byUID.has(normalized.uid)) byUID.set(normalized.uid, normalized);
  };
  for (const actor of Array.isArray(trace.actors) ? trace.actors : []) add(actor);
  add(trace.completedActor);
  add(trace.selectedActor);
  for (const uid of Object.keys(trace.progressBeforeSelection || {})) {
    if (!byUID.has(Number(uid))) byUID.set(Number(uid), { uid: Number(uid), type: 0, name: String(uid) });
  }
  return Array.from(byUID.values());
}

export function formatDynamicInitiativeTrace(trace = {}) {
  const lines = [];
  if (Number(trace.battleId || 0) > 0) lines.push(`Battle ${Number(trace.battleId || 0)}`);
  lines.push(`Action ${String(Math.max(0, Math.floor(numberOr(trace.actionSerial, 0)))).padStart(2, '0')}`);
  if (trace.completedActor) lines.push(`Completed: ${actorName(trace.completedActor, trace.completedActor.uid)}`);
  lines.push('Progress before selection:');
  const actors = orderedTraceActors(trace);
  for (const actor of actors) {
    if (Object.prototype.hasOwnProperty.call(trace.progressBeforeSelection || {}, String(actor.uid))) {
      lines.push(formatActorLine(actor, trace.progressBeforeSelection));
    }
  }
  lines.push(`Selected: ${trace.selectedActor ? actorName(trace.selectedActor, trace.selectedActor.uid) : 'None'}`);
  lines.push(`Reason: ${String(trace.selectionReason || 'unknown')}`);
  lines.push('Progress after selection:');
  for (const actor of actors) {
    if (Object.prototype.hasOwnProperty.call(trace.progressAfterSelection || {}, String(actor.uid))) {
      lines.push(formatActorLine(actor, trace.progressAfterSelection));
    }
  }
  return lines.join('\n');
}

export function runDynamicInitiativeTraceHarness({
  battleId = 0,
  actors = [],
  progress = {},
  openingPolicy = null,
  pendingDeaths = null,
  threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  actionCount = 1,
} = {}) {
  const traces = [];
  let nextProgress = cloneProgress(progress);
  let nextOpeningPolicy = openingPolicy || null;
  const count = Math.max(0, Math.floor(numberOr(actionCount, 0)));

  for (let i = 0; i < count; i += 1) {
    const roster = buildDynamicInitiativeRoster(actors, { pendingDeaths });
    const progressBeforeSelection = orderedProgress(nextProgress, roster.eligible);
    let selected = selectDynamicInitiativeTurn({
      actors,
      progress: progressBeforeSelection,
      pendingDeaths,
      threshold,
      openingPolicy: nextOpeningPolicy,
    });
    let initiativeAdvanceCount = 0;
    let nextSelectionProgress = progressBeforeSelection;
    let nextRoster = roster;
    while (!selected.turn && canAdvanceInitiative(nextRoster.eligible) && initiativeAdvanceCount < 1000) {
      const advanced = applyDynamicInitiativeActionCompleted({
        actors,
        progress: nextSelectionProgress,
        pendingDeaths,
      });
      initiativeAdvanceCount += 1;
      nextRoster = { eligible: advanced.eligible, skipped: advanced.skipped };
      nextSelectionProgress = orderedProgress(advanced.progress, advanced.eligible);
      selected = selectDynamicInitiativeTurn({
        actors,
        progress: nextSelectionProgress,
        pendingDeaths,
        threshold,
        openingPolicy: nextOpeningPolicy,
      });
    }
    if (!selected.turn) break;
    const selectedActor = normalizeActorRef(selected.actor);
    const progressAfterSelection = orderedProgress(selected.progress, nextRoster.eligible);
    const trace = {
      battleId: normalizeUID(battleId),
      actionSerial: i + 1,
      actors: nextRoster.eligible.map(actor => normalizeActorRef(actor)).filter(Boolean),
      completedActor: null,
      progressBeforeAdvance: progressBeforeSelection,
      initiativeAdvanceCount,
      progressBeforeSelection: nextSelectionProgress,
      progressAfterSelection,
      selectedActor,
      selectionReason: classifySelectionReason({
        selected: selected.actor,
        actors,
        progress: nextSelectionProgress,
        threshold,
        openingPolicyTurn: !!selected.turn?.openingPolicyTurn,
      }),
      threshold,
      openingPolicy: normalizeOpeningPolicyForTrace(selected.openingPolicy, false),
      eligibilitySkips: selected.skipped,
      pendingDeathExclusions: selected.skipped.filter(actor => actor.reason === 'pending_death'),
      reasons: selected.reasons || [],
    };
    traces.push(trace);
    const advanced = applyDynamicInitiativeActionCompleted({
      actors,
      progress: progressAfterSelection,
      pendingDeaths,
    });
    nextProgress = advanced.progress;
    nextOpeningPolicy = selected.openingPolicy || null;
  }

  return {
    traces,
    progress: nextProgress,
    openingPolicy: nextOpeningPolicy,
    text: traces.map(formatDynamicInitiativeTrace).join('\n\n'),
  };
}
