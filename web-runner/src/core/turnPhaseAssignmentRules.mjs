function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeTurnTypeCode(value) {
  return Number(value || 0) === 0 ? 0 : 1;
}

export function turnPhaseFromJs(input = {}) {
  const payload = input && typeof input === 'object' ? input : {};
  const turnType = hasOwn(payload, 'turnType') ? payload.turnType : 0;
  const turnTypeCode = hasOwn(payload, 'turnTypeCode')
    ? normalizeTurnTypeCode(payload.turnTypeCode)
    : (turnType === 0 ? 0 : 1);

  return {
    owner: 'fallback',
    turnTypeCode,
    turnPhase: turnTypeCode === 0 ? 0 : 2,
  };
}

export function resolveTurnPhaseAssignment(input = {}) {
  const payload = input && typeof input === 'object' ? input : {};
  const source = hasOwn(payload, 'source') ? payload.source : 'unknown';
  const turnType = hasOwn(payload, 'turnType') ? payload.turnType : 0;
  const ownerHook = hasOwn(payload, 'ownerHook') ? payload.ownerHook : null;
  const jsDecision = turnPhaseFromJs({ turnType });
  const normalized = {
    source: String(source || 'unknown'),
    turnTypeCode: jsDecision.turnTypeCode,
  };

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsTurnPhase: jsDecision.turnPhase,
      });
      const turnPhase = Number(result?.turnPhase);
      if (Number.isFinite(turnPhase)) {
        return {
          owner: String(result?.owner || 'rust'),
          turnTypeCode: normalized.turnTypeCode,
          turnPhase,
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
