import { nextTeamPhaseType } from './schedulerRules.mjs';

const BLOCKED_STATUS_VALUES = new Set([
  'dead',
  'disabled',
  'stopped',
  'paralyzed',
  'stunned',
]);

function flag(value) {
  return value ? 1 : 0;
}

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizePhaseType(value = 0) {
  return Number(value || 0) === 1 ? 1 : 0;
}

function normalizeHp(value) {
  const normalized = Number(value);
  return Number.isNaN(normalized) ? 1 : normalized;
}

export function turnOrderStatusBlockedFromJs(actor = {}) {
  const values = [
    actor?.status,
    actor?.state,
    ...(Array.isArray(actor?.statuses) ? actor.statuses : []),
    ...(Array.isArray(actor?.statusEffects) ? actor.statusEffects : []),
  ];
  return values.some(value => BLOCKED_STATUS_VALUES.has(String(value || '').toLowerCase())) ? 1 : 0;
}

export function normalizeTurnOrderActor(actor = {}) {
  return {
    uid: numberOr(actor?.uid, 0),
    type: normalizePhaseType(actor?.type),
    spd: numberOr(actor?.spd ?? actor?.SPD ?? actor?.stats?.SPD, 0),
    extra: !!actor?.extra,
    hp: normalizeHp(actor?.hp ?? actor?.HP ?? 1),
    isAlive: actor?.isAlive === false ? 0 : 1,
    ableToAct: actor?.ableToAct === false ? 0 : 1,
    disabled: flag(actor?.disabled),
    stunned: flag(actor?.stunned),
    stopped: flag(actor?.stopped),
    paralyzed: flag(actor?.paralyzed),
    statusBlocked: actor?.statusBlocked == null
      ? turnOrderStatusBlockedFromJs(actor)
      : flag(Number(actor.statusBlocked || 0)),
  };
}

export function turnOrderActorInPhaseFromJs(actor = {}, phaseType = 0) {
  const normalized = normalizeTurnOrderActor(actor);
  if (normalized.uid <= 0) return 0;
  if (normalized.type !== normalizePhaseType(phaseType)) return 0;
  if (normalized.hp <= 0) return 0;
  if (normalized.isAlive !== 1) return 0;
  if (normalized.ableToAct !== 1) return 0;
  if (
    normalized.disabled === 1
    || normalized.stunned === 1
    || normalized.stopped === 1
    || normalized.paralyzed === 1
    || normalized.statusBlocked === 1
  ) {
    return 0;
  }
  return 1;
}

export function turnOrderPhaseTypeFromJs({
  requestedPhaseType = 0,
  requestedCount = 0,
} = {}) {
  const requested = normalizePhaseType(requestedPhaseType);
  if (Number(requestedCount || 0) > 0) return requested;
  return nextTeamPhaseType(requested);
}

export function compareTurnOrderSlotsFromJs(a = {}, b = {}) {
  const diff = (Number(b?.spd || 0) - Number(a?.spd || 0))
    || (Number(a?.type || 0) - Number(b?.type || 0))
    || (Number(a?.uid || 0) - Number(b?.uid || 0));
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

function sanitizeProjectedMembers(members = []) {
  if (!Array.isArray(members)) return [];
  return members
    .map(member => ({
      uid: numberOr(member?.uid, 0),
      type: normalizePhaseType(member?.type),
      spd: numberOr(member?.spd, 0),
      extra: !!member?.extra,
    }))
    .filter(member => member.uid > 0);
}

export function buildTurnOrderGroupFromJs(roster = [], requestedPhaseType = 0) {
  const normalizedRoster = Array.isArray(roster) ? roster.map(normalizeTurnOrderActor) : [];
  const requested = normalizePhaseType(requestedPhaseType);
  let phaseType = requested;
  let members = normalizedRoster
    .filter(actor => turnOrderActorInPhaseFromJs(actor, phaseType) === 1)
    .sort(compareTurnOrderSlotsFromJs);
  if (!members.length) {
    phaseType = nextTeamPhaseType(phaseType);
    members = normalizedRoster
      .filter(actor => turnOrderActorInPhaseFromJs(actor, phaseType) === 1)
      .sort(compareTurnOrderSlotsFromJs);
  }
  return {
    owner: 'fallback',
    phaseType,
    members: sanitizeProjectedMembers(members),
  };
}

export function resolveTurnOrderGroupProjection({
  source = 'unknown',
  roster = [],
  requestedPhaseType = 0,
  ownerHook = null,
} = {}) {
  const normalizedRoster = Array.isArray(roster) ? roster.map(normalizeTurnOrderActor) : [];
  const jsProjection = buildTurnOrderGroupFromJs(roster, requestedPhaseType);

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        source: String(source || 'unknown'),
        requestedPhaseType: normalizePhaseType(requestedPhaseType),
        roster: normalizedRoster,
        jsPhaseType: jsProjection.phaseType,
        jsMembers: jsProjection.members,
      });
      const phaseType = normalizePhaseType(result?.phaseType);
      const members = sanitizeProjectedMembers(result?.members);
      if (Array.isArray(result?.members)) {
        return {
          owner: String(result?.owner || 'rust'),
          phaseType,
          members,
          jsPhaseType: jsProjection.phaseType,
          jsMembers: jsProjection.members,
          roster: normalizedRoster,
        };
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable or unhealthy.
    }
  }

  return {
    ...jsProjection,
    jsPhaseType: jsProjection.phaseType,
    jsMembers: jsProjection.members,
    roster: normalizedRoster,
  };
}
