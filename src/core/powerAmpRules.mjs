export function createPowerAmpLifecycleMeta(lifecycleId = 0) {
  return {
    lifecycleId: Number(lifecycleId || 0),
    visualStarted: false,
    visualStartAt: 0,
    consumed: false,
    fadeStarted: false,
    fadeStartAt: 0,
    closed: false,
  };
}

export function normalizePowerAmpLifecycleMeta(existingMeta, lifecycleId = 0) {
  const normalizedLife = Number(lifecycleId || 0);
  if (existingMeta && Number(existingMeta.lifecycleId || 0) === normalizedLife) {
    return {
      lifecycleId: normalizedLife,
      visualStarted: !!existingMeta.visualStarted,
      visualStartAt: Number(existingMeta.visualStartAt || 0),
      consumed: !!existingMeta.consumed,
      fadeStarted: !!existingMeta.fadeStarted,
      fadeStartAt: Number(existingMeta.fadeStartAt || 0),
      closed: !!existingMeta.closed,
    };
  }
  return createPowerAmpLifecycleMeta(normalizedLife);
}

export function createPowerAmpArmedEntry(multiplier, turnNow, turnSerialNow, lifecycleId) {
  return {
    mult: 0,
    pendingMult: Number(multiplier || 0),
    lifecycleId: Number(lifecycleId || 0),
    state: 'pending_next_own_turn',
    armedAtTurn: Number(turnNow || 0),
    armedAtTurnSerial: Number(turnSerialNow || 0),
    activatedAtTurn: -1,
    activatedAtTurnSerial: -1,
    usedThisTurn: false,
  };
}

export function derivePowerAmpActivationEntry(entry, turnNow, turnSerialNow) {
  const source = entry ? { ...entry } : null;
  if (!source) return { activated: false, entry: null };
  if (source.state !== 'pending_next_own_turn') return { activated: false, entry: source };
  if (Number(turnSerialNow || 0) <= Number(source.armedAtTurnSerial || 0)) {
    return { activated: false, entry: source };
  }
  const nextEntry = {
    ...source,
    state: 'active_this_turn',
    mult: Number(source.pendingMult || source.mult || 0),
    activatedAtTurn: Number(turnNow || 0),
    activatedAtTurnSerial: Number(turnSerialNow || 0),
    usedThisTurn: false,
  };
  return { activated: true, entry: nextEntry };
}

export function derivePowerAmpVisualState({ existingVisual, existingMeta, now, mult, lifecycleId }) {
  const normalizedLife = Number(lifecycleId || 0);
  const safeNow = Number(now || 0);
  const meta = normalizePowerAmpLifecycleMeta(existingMeta, normalizedLife);
  if (meta.fadeStarted) {
    return {
      meta,
      visual: existingVisual || null,
      seeded: false,
      startAt: Number(meta.visualStartAt || 0),
      lifecycleId: normalizedLife,
    };
  }
  const activeVisual = existingVisual && Number(existingVisual.lifecycleId || 0) === normalizedLife
    ? { ...existingVisual }
    : null;
  if (activeVisual && normalizedLife > 0) {
    activeVisual.mult = mult;
    meta.visualStarted = true;
    meta.visualStartAt = Number(activeVisual.startAt || meta.visualStartAt || safeNow);
    return {
      meta,
      visual: activeVisual,
      seeded: false,
      startAt: Number(activeVisual.startAt || 0),
      lifecycleId: normalizedLife,
    };
  }
  const startAt = meta.visualStarted ? Number(meta.visualStartAt || 0) : safeNow;
  meta.visualStarted = true;
  meta.visualStartAt = startAt;
  return {
    meta,
    visual: { mult, startAt, lifecycleId: normalizedLife },
    seeded: startAt === safeNow,
    startAt,
    lifecycleId: normalizedLife,
  };
}

export function derivePowerAmpConsumeState(entry, existingMeta) {
  const sourceEntry = entry ? { ...entry } : null;
  if (!sourceEntry || sourceEntry.state !== 'active_this_turn') {
    return { canConsume: false, multiplier: 0, entry: sourceEntry, meta: normalizePowerAmpLifecycleMeta(existingMeta, sourceEntry?.lifecycleId || 0) };
  }
  const meta = normalizePowerAmpLifecycleMeta(existingMeta, sourceEntry.lifecycleId);
  const mult = Number(sourceEntry.mult || 0);
  if (!mult || sourceEntry.usedThisTurn || meta.consumed) {
    return { canConsume: false, multiplier: 0, entry: sourceEntry, meta };
  }
  sourceEntry.usedThisTurn = true;
  meta.consumed = true;
  return {
    canConsume: true,
    multiplier: mult,
    entry: sourceEntry,
    meta,
  };
}

export function derivePowerAmpCloseDecision(entry, existingMeta) {
  const sourceEntry = entry ? { ...entry } : null;
  if (!sourceEntry) {
    return {
      shouldClose: false,
      alreadyClosed: false,
      mult: 0,
      lifecycleId: 0,
      shouldFade: false,
      meta: null,
    };
  }
  const lifecycleId = Number(sourceEntry.lifecycleId || 0);
  const meta = normalizePowerAmpLifecycleMeta(existingMeta, lifecycleId);
  const mult = Number(sourceEntry.mult || sourceEntry.pendingMult || 0);
  if (meta.closed) {
    return {
      shouldClose: true,
      alreadyClosed: true,
      mult,
      lifecycleId,
      shouldFade: false,
      meta,
    };
  }
  const nextMeta = { ...meta };
  if (mult <= 0) nextMeta.closed = true;
  return {
    shouldClose: true,
    alreadyClosed: false,
    mult,
    lifecycleId,
    shouldFade: mult > 0,
    meta: nextMeta,
  };
}

export function derivePowerAmpFadeState({ existingMeta, now, mult, lifecycleId, duration }) {
  const normalizedLife = Number(lifecycleId || 0);
  const safeNow = Number(now || 0);
  const safeDuration = Number(duration || 0);
  const meta = normalizePowerAmpLifecycleMeta(existingMeta, normalizedLife);
  if (meta.fadeStarted) {
    return {
      meta,
      fade: null,
      started: false,
      startAt: Number(meta.fadeStartAt || 0),
      lifecycleId: normalizedLife,
    };
  }
  meta.fadeStarted = true;
  meta.fadeStartAt = safeNow;
  meta.closed = true;
  return {
    meta,
    fade: { mult, startAt: safeNow, duration: safeDuration, lifecycleId: normalizedLife },
    started: true,
    startAt: safeNow,
    lifecycleId: normalizedLife,
  };
}

export function derivePowerAmpRenderState({
  entry,
  visual,
  fade,
  existingMeta,
  now,
  defaultFadeDuration,
  scalePeak = 1.3,
}) {
  const lifecycleId = Number(visual?.lifecycleId || entry?.lifecycleId || fade?.lifecycleId || 0);
  const meta = normalizePowerAmpLifecycleMeta(existingMeta, lifecycleId);
  const safeNow = Number(now || 0);
  const storeMult = Number(entry?.mult || 0);
  const active = !!visual || storeMult > 0;
  const fadeDuration = Number(fade?.duration || defaultFadeDuration || 0);
  const fadeStartAt = Number(fade?.startAt || meta.fadeStartAt || 0);
  const fadeActive = !!(!active && fade && safeNow < fadeStartAt + fadeDuration);
  const mult = Number(visual?.mult || storeMult || fade?.mult || entry?.pendingMult || 0);
  const visualStartAt = Number(visual?.startAt || meta.visualStartAt || safeNow);
  let heroScale = 1;
  let scaleState = 'normal';
  if (active) {
    const tIn = Math.max(0, Math.min(1, (safeNow - visualStartAt) / 0.18));
    const eIn = 1 - Math.pow(1 - tIn, 2);
    heroScale = 1 + (Number(scalePeak || 1.3) - 1) * eIn;
    scaleState = 'active';
  } else if (fadeActive) {
    const fadeT = Math.max(0, Math.min(1, (safeNow - fadeStartAt) / fadeDuration));
    heroScale = 1 + (Number(scalePeak || 1.3) - 1) * (1 - fadeT);
    scaleState = 'fade';
  }
  return {
    active,
    fadeActive,
    mult,
    lifecycleId,
    visualStartAt,
    fadeStartAt,
    fadeDuration,
    heroScale,
    scaleState,
    meta,
  };
}
