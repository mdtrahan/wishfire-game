import {
  DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  DYNAMIC_INITIATIVE_HERO_OPENER,
  buildDynamicInitiativeRoster,
} from './dynamicInitiativeRules.mjs';
import {
  runDynamicInitiativeTraceHarness,
} from './dynamicInitiativeRuntimeShadow.mjs';

export const DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID = 'battle-1001-speed-proof';
export const DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID = 1001;
export const DYNAMIC_INITIATIVE_AUTHORITY_SEED = 1001;
export const DYNAMIC_INITIATIVE_AUTHORITY_MAX_ACTIONS = 96;
export const DYNAMIC_INITIATIVE_AUTHORITY_MAX_STARVATION_ACTIONS = 16;
export const DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP = 5000;
export const DYNAMIC_INITIATIVE_AUTHORITY_PROOF_DAMAGE_STAT = 1;

export const DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER = Object.freeze({
  id: DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID,
  battleId: DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID,
  seed: DYNAMIC_INITIATIVE_AUTHORITY_SEED,
  threshold: DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD,
  actors: Object.freeze([
    Object.freeze({ uid: 1, type: 0, name: 'Falie', speed: 9, hp: DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP }),
    Object.freeze({ uid: 2, type: 0, name: 'Huun', speed: 20, hp: DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP }),
    Object.freeze({ uid: 3, type: 0, name: 'Runa', speed: 11, hp: DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP }),
    Object.freeze({ uid: 4, type: 0, name: 'Kojonn', speed: 14, hp: DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP }),
    Object.freeze({ uid: 101, type: 1, name: 'Skeleton', speed: 22, hp: DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP }),
    Object.freeze({ uid: 102, type: 1, name: 'Gobloc', speed: 17, hp: DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP }),
    Object.freeze({ uid: 103, type: 1, name: 'Troll', speed: 5, hp: DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP }),
  ]),
});

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

function normalizeSpeed(actor = {}) {
  return numberOr(actor?.speed ?? actor?.effectiveSpeed ?? actor?.effectiveSPD ?? actor?.spd ?? actor?.SPD ?? actor?.stats?.SPD, 0);
}

function normalizeHp(actor = {}) {
  return numberOr(actor?.hp ?? actor?.HP, 0);
}

function normalizeName(actor = {}, uid = 0) {
  const raw = String(actor?.name ?? actor?.key ?? actor?.id ?? '').trim();
  return raw || String(uid || '');
}

function normalizeActorRef(actor = null) {
  if (!actor || typeof actor !== 'object') return null;
  const uid = normalizeUID(actor.uid);
  if (!(uid > 0)) return null;
  return {
    uid,
    type: normalizeType(actor.type),
    name: normalizeName(actor, uid),
  };
}

function normalizeActorForEncounter(actor = {}) {
  const uid = normalizeUID(actor?.uid);
  return {
    uid,
    type: normalizeType(actor?.type),
    name: normalizeName(actor, uid),
    speed: normalizeSpeed(actor),
    hp: normalizeHp(actor),
  };
}

function flagEnabled(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'on' || text === 'enabled';
}

function configuredBattleId(globals = {}) {
  return normalizeUID(
    globals.DynamicInitiativeAuthorityBattleId
      ?? globals.BattleId
      ?? globals.BattleUID
      ?? globals.EncounterUID
      ?? globals.EncounterId
      ?? 0,
  );
}

function configuredSeed(globals = {}) {
  return normalizeUID(
    globals.DynamicInitiativeAuthoritySeed
      ?? globals.EncounterSeed
      ?? globals.RuntimeRandomSeed
      ?? 0,
  );
}

function encounterActorList() {
  return DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.actors.map(normalizeActorForEncounter);
}

function encounterIdentityKey(actor = {}, { includeHp = false } = {}) {
  const parts = [
    normalizeType(actor.type),
    normalizeName(actor, actor.uid),
    normalizeSpeed(actor),
  ];
  if (includeHp) parts.push(normalizeHp(actor));
  return parts.join('|');
}

function actorIdentityMatches(actual = {}, expected = {}, { includeHp = false } = {}) {
  return encounterIdentityKey(actual, { includeHp }) === encounterIdentityKey(expected, { includeHp });
}

function rosterMatchesLockedEncounterSubset(normalizedActors = [], expectedActors = []) {
  if (normalizedActors.length <= 0) return false;
  const usedExpectedIndexes = new Set();
  for (const actor of normalizedActors) {
    const expectedIndex = expectedActors.findIndex((expectedActor, index) => (
      !usedExpectedIndexes.has(index)
      && actorIdentityMatches(actor, expectedActor, { includeHp: false })
    ));
    if (expectedIndex < 0) return false;
    usedExpectedIndexes.add(expectedIndex);
  }
  return true;
}

function rosterMatchesAuthorityEncounter(actors = [], { allowSubset = false } = {}) {
  const expected = encounterActorList();
  const normalizedActors = (Array.isArray(actors) ? actors : [])
    .map(normalizeActorForEncounter)
    .filter(actor => actor.uid > 0);
  if (allowSubset) return rosterMatchesLockedEncounterSubset(normalizedActors, expected);
  if (normalizedActors.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (!actorIdentityMatches(normalizedActors[index], expected[index], { includeHp: false })) return false;
  }
  return true;
}

export function isDynamicInitiativeAuthorityExperimentEnabled({
  globals = {},
  actors = [],
} = {}) {
  if (!flagEnabled(globals.DynamicInitiativeAuthorityEnabled)) return false;
  if (String(globals.DynamicInitiativeAuthorityExperimentId || '') !== DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID) {
    return false;
  }
  if (configuredSeed(globals) !== DYNAMIC_INITIATIVE_AUTHORITY_SEED) return false;
  if (configuredBattleId(globals) !== DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID) return false;
  const locked = Number(globals.DynamicInitiativeAuthorityEncounterLocked || 0) === 1;
  return rosterMatchesAuthorityEncounter(actors, { allowSubset: locked });
}

function abortResult(reason, {
  prediction = {},
  expectedActor = null,
  actualActor = null,
  selectedActor = null,
  details = {},
} = {}) {
  const actionSerial = Math.max(0, Math.floor(numberOr(prediction?.actionSerial, 0)));
  const abortMessage = [
    'Dynamic Initiative authority abort',
    `reason=${reason}`,
    `actionSerial=${actionSerial}`,
    selectedActor ? `selected=${selectedActor.name || selectedActor.uid}` : '',
    actualActor ? `actual=${actualActor.name || actualActor.uid}` : '',
  ].filter(Boolean).join(' ');
  return {
    ok: false,
    reason,
    actionSerial,
    expectedActor,
    actualActor,
    selectedActor,
    abortMessage,
    details,
  };
}

function readyUIDsFromProgress(progress = {}, threshold = DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD) {
  const ready = [];
  for (const [uid, value] of Object.entries(progress || {})) {
    if (numberOr(value, 0) >= threshold) ready.push(normalizeUID(uid));
  }
  return ready.filter(uid => uid > 0);
}

function nextStarvationWatch(previousState = {}, prediction = {}, selectedUID = 0, maxStarvationActions = DYNAMIC_INITIATIVE_AUTHORITY_MAX_STARVATION_ACTIONS) {
  const threshold = Math.max(1, Math.floor(numberOr(prediction.threshold, DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD)));
  const ready = readyUIDsFromProgress(prediction.progressBeforeSelection || {}, threshold);
  const previous = previousState.starvationWatch && typeof previousState.starvationWatch === 'object'
    ? previousState.starvationWatch
    : {};
  const next = {};
  for (const uid of ready) {
    if (uid === selectedUID) continue;
    next[String(uid)] = numberOr(previous[String(uid)], 0) + 1;
  }
  for (const [uid, count] of Object.entries(next)) {
    if (count > maxStarvationActions) {
      return {
        ok: false,
        watch: next,
        starvedUID: normalizeUID(uid),
        count,
      };
    }
  }
  return { ok: true, watch: next };
}

function validateCadenceEvents(cadenceEvents = []) {
  const events = Array.isArray(cadenceEvents) ? cadenceEvents : [];
  const names = new Set(events.map(event => String(event?.event || event?.kind || '')));
  for (const required of ['action_completed', 'turn_serial_increment', 'pending_death_resolution']) {
    if (!names.has(required)) return required;
  }
  return null;
}

export function validateDynamicInitiativeAuthoritySelection({
  prediction = {},
  actors = [],
  liveActor = null,
  cadenceEvents = [],
  previousState = {},
  maxActions = DYNAMIC_INITIATIVE_AUTHORITY_MAX_ACTIONS,
  maxStarvationActions = DYNAMIC_INITIATIVE_AUTHORITY_MAX_STARVATION_ACTIONS,
} = {}) {
  const selectedActor = normalizeActorRef(prediction?.selectedActor);
  if (!selectedActor) return abortResult('no_selected_actor', { prediction });

  const actionSerial = Math.max(0, Math.floor(numberOr(prediction?.actionSerial, 0)));
  if (Number(previousState.lastActionSerial || -1) === actionSerial) {
    return abortResult('duplicate_action_serial', { prediction, selectedActor });
  }
  if (numberOr(previousState.actionCount, 0) >= Math.max(1, Math.floor(numberOr(maxActions, DYNAMIC_INITIATIVE_AUTHORITY_MAX_ACTIONS)))) {
    return abortResult('max_action_count_exceeded', { prediction, selectedActor });
  }
  const missingCadenceEvent = validateCadenceEvents(cadenceEvents);
  if (missingCadenceEvent) {
    return abortResult('cadence_mismatch', {
      prediction,
      selectedActor,
      details: { missingCadenceEvent },
    });
  }

  const roster = buildDynamicInitiativeRoster(actors, { pendingDeaths: prediction.pendingDeaths || null });
  const eligible = roster.eligible.find(actor => actor.uid === selectedActor.uid && actor.type === selectedActor.type);
  if (!eligible) {
    const skip = roster.skipped.find(actor => actor.uid === selectedActor.uid);
    return abortResult('selected_actor_ineligible', {
      prediction,
      selectedActor,
      details: { skippedReason: skip?.reason || 'not_in_eligible_roster' },
    });
  }

  const actualActor = normalizeActorRef(liveActor);
  if (actualActor && (actualActor.uid !== selectedActor.uid || actualActor.type !== selectedActor.type)) {
    return abortResult('actual_actor_mismatch', {
      prediction,
      expectedActor: selectedActor,
      actualActor,
      selectedActor,
    });
  }

  const starvation = nextStarvationWatch(previousState, prediction, selectedActor.uid, maxStarvationActions);
  if (!starvation.ok) {
    return abortResult('starvation_detected', {
      prediction,
      selectedActor,
      details: {
        starvedUID: starvation.starvedUID,
        count: starvation.count,
      },
    });
  }

  return {
    ok: true,
    reason: 'ok',
    actionSerial,
    selectedActor,
    actualActor: actualActor || selectedActor,
    nextState: {
      actionCount: numberOr(previousState.actionCount, 0) + 1,
      lastActionSerial: actionSerial,
      lastSelectedUID: selectedActor.uid,
      starvationWatch: starvation.watch,
    },
  };
}

function progressValue(progress = {}, uid = 0) {
  return numberOr(progress[String(uid)], 0);
}

function thresholdSubtractionFor(prediction = {}) {
  const actor = normalizeActorRef(prediction.selectedActor);
  if (!actor) return null;
  const threshold = Math.max(1, Math.floor(numberOr(prediction.threshold, DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD)));
  const before = progressValue(prediction.progressBeforeSelection || {}, actor.uid);
  const after = progressValue(prediction.progressAfterSelection || {}, actor.uid);
  return {
    uid: actor.uid,
    before,
    threshold,
    after,
    applied: before >= threshold && after === before - threshold,
  };
}

function traceActorsFromPrediction(prediction = {}) {
  const source = Array.isArray(prediction.actors) && prediction.actors.length
    ? prediction.actors
    : DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.actors;
  return source.map(normalizeActorRef).filter(Boolean);
}

function completeTraceProgress(progress = {}, actors = []) {
  const out = {};
  for (const actor of actors) {
    out[String(actor.uid)] = numberOr(progress[String(actor.uid)], 0);
  }
  return out;
}

export function createDynamicInitiativeAuthorityTrace({
  prediction = {},
  validation = {},
  cadenceEvents = [],
  pendingDeaths = null,
} = {}) {
  const selectedActor = normalizeActorRef(prediction.selectedActor);
  const actors = traceActorsFromPrediction(prediction);
  return {
    mode: 'authority_experiment',
    experimentId: DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID,
    battleId: DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID,
    seed: DYNAMIC_INITIATIVE_AUTHORITY_SEED,
    actionSerial: Math.max(0, Math.floor(numberOr(prediction.actionSerial, 0))),
    actors,
    selectedActor,
    actualActor: normalizeActorRef(validation.actualActor) || selectedActor,
    progressBeforeSelection: completeTraceProgress(prediction.progressBeforeSelection || {}, actors),
    progressAfterSelection: completeTraceProgress(prediction.progressAfterSelection || {}, actors),
    thresholdSubtraction: thresholdSubtractionFor(prediction),
    initiativeAdvanceCount: Math.max(0, Math.floor(numberOr(prediction.initiativeAdvanceCount, 0))),
    selectionReason: String(prediction.selectionReason || 'unknown'),
    whyActorWon: String(prediction.selectionReason || 'unknown'),
    openingPolicy: prediction.openingPolicy || null,
    cadenceEvents: Array.isArray(cadenceEvents) ? cadenceEvents.slice() : [],
    eligibilitySkips: Array.isArray(prediction.eligibilitySkips) ? prediction.eligibilitySkips.slice() : [],
    pendingDeathExclusions: Array.isArray(prediction.pendingDeathExclusions) ? prediction.pendingDeathExclusions.slice() : [],
    pendingDeaths: pendingDeaths && typeof pendingDeaths === 'object' ? { ...pendingDeaths } : pendingDeaths,
    schedulerDecisions: Array.isArray(prediction.reasons) ? prediction.reasons.slice() : [],
    validation: {
      ok: !!validation.ok,
      reason: String(validation.reason || ''),
      abortMessage: validation.abortMessage || '',
    },
  };
}

function actorName(actor = {}, fallbackUID = 0) {
  return normalizeName(actor, fallbackUID || actor?.uid || 0);
}

function actorsForTrace(trace = {}) {
  const byUID = new Map();
  const add = (actor) => {
    const normalized = normalizeActorRef(actor);
    if (normalized && !byUID.has(normalized.uid)) byUID.set(normalized.uid, normalized);
  };
  for (const actor of Array.isArray(trace.actors) ? trace.actors : []) add(actor);
  for (const actor of DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.actors) add(actor);
  add(trace.selectedActor);
  add(trace.actualActor);
  for (const uid of Object.keys(trace.progressBeforeSelection || {})) {
    if (!byUID.has(Number(uid))) byUID.set(Number(uid), { uid: Number(uid), type: 0, name: String(uid) });
  }
  return Array.from(byUID.values()).filter(actor => (
    Object.prototype.hasOwnProperty.call(trace.progressBeforeSelection || {}, String(actor.uid))
    || Object.prototype.hasOwnProperty.call(trace.progressAfterSelection || {}, String(actor.uid))
    || actor.uid === trace.selectedActor?.uid
  ));
}

function formatProgressLines(trace = {}, key = 'progressBeforeSelection') {
  const progress = trace[key] || {};
  return actorsForTrace(trace)
    .filter(actor => Object.prototype.hasOwnProperty.call(progress, String(actor.uid)))
    .map(actor => `${actorName(actor, actor.uid)} ${progressValue(progress, actor.uid)}`);
}

function formatEvent(event = {}) {
  const name = String(event.event || event.kind || 'unknown');
  const details = Object.entries(event)
    .filter(([key]) => key !== 'event' && key !== 'kind')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  return details ? `- ${name} ${details}` : `- ${name}`;
}

export function formatDynamicInitiativeAuthorityTrace(trace = {}) {
  const selected = normalizeActorRef(trace.selectedActor);
  const thresholdSubtraction = trace.thresholdSubtraction || null;
  const lines = [
    `Battle ${DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID}`,
    `Authority Experiment ${DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID}`,
    `Action ${String(Math.max(0, Math.floor(numberOr(trace.actionSerial, 0)))).padStart(2, '0')}`,
    `Acting unit: ${selected ? actorName(selected, selected.uid) : 'None'}`,
    'Progress before selection:',
    ...formatProgressLines(trace, 'progressBeforeSelection'),
    `Why this actor won: ${String(trace.whyActorWon || trace.selectionReason || 'unknown')}`,
    `Initiative advances: ${Math.max(0, Math.floor(numberOr(trace.initiativeAdvanceCount, 0)))}`,
  ];
  if (thresholdSubtraction) {
    const actor = selected || { uid: thresholdSubtraction.uid };
    if (thresholdSubtraction.applied) {
      lines.push(`Threshold subtraction: ${actorName(actor, thresholdSubtraction.uid)} ${thresholdSubtraction.before} - ${thresholdSubtraction.threshold} = ${thresholdSubtraction.after}`);
    } else {
      lines.push(`Threshold subtraction: not applied for ${actorName(actor, thresholdSubtraction.uid)} (${thresholdSubtraction.before} < ${thresholdSubtraction.threshold})`);
    }
  }
  lines.push('Progress after selection:');
  lines.push(...formatProgressLines(trace, 'progressAfterSelection'));
  lines.push('Cadence events:');
  if (Array.isArray(trace.cadenceEvents) && trace.cadenceEvents.length) {
    lines.push(...trace.cadenceEvents.map(formatEvent));
  } else {
    lines.push('- none');
  }
  lines.push('Pending deaths:');
  const pendingDeathKeys = trace.pendingDeaths && typeof trace.pendingDeaths === 'object'
    ? Object.keys(trace.pendingDeaths)
    : [];
  lines.push(pendingDeathKeys.length ? pendingDeathKeys.join(',') : 'none');
  if (Array.isArray(trace.eligibilitySkips) && trace.eligibilitySkips.length) {
    lines.push('Eligibility skips:');
    for (const skip of trace.eligibilitySkips) {
      lines.push(`- ${actorName(skip, skip.uid)} ${String(skip.reason || 'unknown')}`);
    }
  }
  lines.push(`Validation: ${trace.validation?.ok ? 'ok' : String(trace.validation?.reason || 'unknown')}`);
  return lines.join('\n');
}

export function runDynamicInitiativeAuthorityExperimentHarness({
  actionCount = 8,
} = {}) {
  const openingPolicy = {
    mode: DYNAMIC_INITIATIVE_HERO_OPENER,
    remainingUIDs: { 1: true },
  };
  const harness = runDynamicInitiativeTraceHarness({
    battleId: DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID,
    actors: DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.actors,
    progress: {},
    openingPolicy,
    threshold: DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.threshold,
    actionCount,
  });
  let previousState = { actionCount: 0 };
  const traces = [];
  for (const prediction of harness.traces) {
    const selectedUID = prediction.selectedActor?.uid || 0;
    const threshold = Math.max(1, Math.floor(numberOr(prediction.threshold, DYNAMIC_INITIATIVE_DEFAULT_THRESHOLD)));
    const before = progressValue(prediction.progressBeforeSelection || {}, selectedUID);
    const after = progressValue(prediction.progressAfterSelection || {}, selectedUID);
    const thresholdApplied = selectedUID > 0 && before >= threshold && after === before - threshold;
    const cadenceEvents = [
      { event: 'action_completed', actionSerial: prediction.actionSerial },
      { event: 'turn_serial_increment', turnSerial: prediction.actionSerial },
      { event: 'pending_death_resolution', before: 0, after: 0 },
      { event: 'progress_applied', threshold: prediction.threshold },
      thresholdApplied
        ? { event: 'threshold_subtracted', uid: selectedUID }
        : { event: 'threshold_not_subtracted', uid: selectedUID, reason: 'opening_policy' },
    ];
    const validation = validateDynamicInitiativeAuthoritySelection({
      prediction,
      actors: DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.actors,
      cadenceEvents,
      previousState,
    });
    if (validation.ok) previousState = validation.nextState;
    traces.push(createDynamicInitiativeAuthorityTrace({
      prediction,
      validation,
      cadenceEvents,
      pendingDeaths: null,
    }));
  }
  return {
    traces,
    text: traces.map(formatDynamicInitiativeAuthorityTrace).join('\n\n'),
  };
}
