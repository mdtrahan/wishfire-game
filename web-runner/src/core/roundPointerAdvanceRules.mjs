export const ROUND_POINTER_CONTINUE_MEMBER = 0;
export const ROUND_POINTER_COMPLETE_GROUP = 1;
export const ROUND_POINTER_COMPLETE_ROUND = 2;

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function phaseType(value = 0) {
  return Number(value || 0) === 1 ? 1 : 0;
}

export function roundPointerAdvanceFromJs({
  roundMemberIndex = 0,
  groupMemberCount = 0,
  roundGroupIndex = 0,
  groupCount = 0,
  teamPhaseType = 0,
} = {}) {
  const nextMemberIndex = Math.max(0, Math.trunc(numberOr(roundMemberIndex, 0))) + 1;
  const memberCount = Math.max(0, Math.trunc(numberOr(groupMemberCount, 0)));
  const currentGroupIndex = Math.max(0, Math.trunc(numberOr(roundGroupIndex, 0)));
  const totalGroups = Math.max(0, Math.trunc(numberOr(groupCount, 0)));
  const nextGroupIndex = currentGroupIndex + 1;
  const groupComplete = nextMemberIndex >= memberCount ? 1 : 0;
  const roundComplete = groupComplete && nextGroupIndex >= totalGroups ? 1 : 0;
  const code = roundComplete
    ? ROUND_POINTER_COMPLETE_ROUND
    : (groupComplete ? ROUND_POINTER_COMPLETE_GROUP : ROUND_POINTER_CONTINUE_MEMBER);

  return {
    owner: 'fallback',
    code,
    nextMemberIndex,
    groupComplete,
    nextGroupIndex,
    roundComplete,
    nextTeamPhaseType: phaseType(teamPhaseType) === 1 ? 0 : 1,
  };
}

export function resolveRoundPointerAdvance({
  source = 'unknown',
  roundMemberIndex = 0,
  groupMemberCount = 0,
  roundGroupIndex = 0,
  groupCount = 0,
  teamPhaseType = 0,
  ownerHook = null,
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    roundMemberIndex: Math.max(0, Math.trunc(numberOr(roundMemberIndex, 0))),
    groupMemberCount: Math.max(0, Math.trunc(numberOr(groupMemberCount, 0))),
    roundGroupIndex: Math.max(0, Math.trunc(numberOr(roundGroupIndex, 0))),
    groupCount: Math.max(0, Math.trunc(numberOr(groupCount, 0))),
    teamPhaseType: phaseType(teamPhaseType),
  };
  const jsDecision = roundPointerAdvanceFromJs(normalized);

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsCode: jsDecision.code,
        jsNextMemberIndex: jsDecision.nextMemberIndex,
        jsGroupComplete: jsDecision.groupComplete,
        jsNextGroupIndex: jsDecision.nextGroupIndex,
        jsRoundComplete: jsDecision.roundComplete,
        jsNextTeamPhaseType: jsDecision.nextTeamPhaseType,
      });
      const code = Number(result?.code);
      const nextMemberIndex = Number(result?.nextMemberIndex);
      if (Number.isFinite(code) && Number.isFinite(nextMemberIndex)) {
        return {
          owner: String(result?.owner || 'rust'),
          code,
          nextMemberIndex,
          groupComplete: Number(result?.groupComplete || 0) ? 1 : 0,
          nextGroupIndex: Math.max(0, Math.trunc(numberOr(result?.nextGroupIndex, 0))),
          roundComplete: Number(result?.roundComplete || 0) ? 1 : 0,
          nextTeamPhaseType: phaseType(result?.nextTeamPhaseType),
          jsDecision,
        };
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable or unhealthy.
    }
  }

  return {
    ...jsDecision,
    jsDecision,
  };
}
