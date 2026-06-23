const ASTRAL_FLOW_ORB_DROP_SEC = 0.28;
const ASTRAL_FLOW_ORB_BOUNCE_SEC = 0.22;
const ASTRAL_FLOW_ORB_FLY_SEC = 0.46;
const ASTRAL_FLOW_ORB_DISSOLVE_SEC = 0.18;
const ASTRAL_FLOW_ORB_TOTAL_SEC = ASTRAL_FLOW_ORB_DROP_SEC
  + ASTRAL_FLOW_ORB_BOUNCE_SEC
  + ASTRAL_FLOW_ORB_FLY_SEC
  + ASTRAL_FLOW_ORB_DISSOLVE_SEC;

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, numberOr(value, 0)));
}

function easeOutQuad(t) {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x);
}

function easeInOutQuad(t) {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function roundTime(value) {
  return Math.round(numberOr(value, 0) * 100) / 100;
}

function getMeterTarget(globals) {
  const rect = globals?.AstralFlowAmpBarCanvas;
  if (!rect || typeof rect !== 'object') return null;
  const x = numberOr(rect.x, NaN);
  const y = numberOr(rect.y, NaN);
  const w = numberOr(rect.w, NaN);
  const h = numberOr(rect.h, NaN);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  return {
    x: x + w * 0.5,
    y: y + h * 0.5,
    color: String(rect.color || '#1e7bd6'),
  };
}

function toCanvasPoint(point, worldToCanvas) {
  const x = numberOr(point?.x, 0);
  const y = numberOr(point?.y, 0);
  if (typeof worldToCanvas !== 'function') return { x, y };
  const converted = worldToCanvas(x, y) || {};
  return {
    x: numberOr(converted.x, x),
    y: numberOr(converted.y, y),
  };
}

export function createAstralFlowKoOrbPresentation({ globals, worldToCanvas } = {}) {
  const queue = Array.isArray(globals?.AstralFlowKoOrbQueue) ? globals.AstralFlowKoOrbQueue : [];
  const target = getMeterTarget(globals);
  if (!queue.length || !target) return null;
  const startedAt = numberOr(globals.time, 0);
  const orbs = [];
  for (const event of queue) {
    const source = toCanvasPoint(event?.source, worldToCanvas);
    const ground = toCanvasPoint(event?.ground || event?.source, worldToCanvas);
    const scales = Array.isArray(event?.orbScales) ? event.orbScales : [];
    const color = String(event?.color || target.color || '#1e7bd6');
    for (let index = 0; index < scales.length; index += 1) {
      const spread = (index - (scales.length - 1) / 2) * 8;
      const stagger = index * 0.025;
      const scale = Math.max(0.4, numberOr(scales[index], 1));
      orbs.push({
        source: { x: source.x + spread * 0.25, y: source.y },
        ground: { x: ground.x + spread, y: ground.y },
        target,
        radius: 4.6 * scale,
        color,
        stagger,
      });
    }
  }
  if (!orbs.length) return null;
  return {
    startedAt,
    duration: ASTRAL_FLOW_ORB_TOTAL_SEC,
    endAt: roundTime(startedAt + ASTRAL_FLOW_ORB_TOTAL_SEC),
    orbs,
  };
}

export function getAstralFlowKoOrbFrame(orb, now, startedAt) {
  const elapsed = Math.max(0, numberOr(now, 0) - numberOr(startedAt, 0) - numberOr(orb?.stagger, 0));
  const source = orb?.source || { x: 0, y: 0 };
  const ground = orb?.ground || source;
  const target = orb?.target || ground;
  const radius = Math.max(1, numberOr(orb?.radius, 4));

  if (elapsed <= ASTRAL_FLOW_ORB_DROP_SEC) {
    const t = easeOutQuad(elapsed / ASTRAL_FLOW_ORB_DROP_SEC);
    return {
      phase: 'drop',
      x: source.x + (ground.x - source.x) * t,
      y: source.y + (ground.y - source.y) * t,
      radius,
      alpha: 1,
    };
  }

  const bounceElapsed = elapsed - ASTRAL_FLOW_ORB_DROP_SEC;
  if (bounceElapsed <= ASTRAL_FLOW_ORB_BOUNCE_SEC) {
    const t = clamp01(bounceElapsed / ASTRAL_FLOW_ORB_BOUNCE_SEC);
    return {
      phase: 'bounce',
      x: ground.x,
      y: ground.y - Math.sin(t * Math.PI) * radius * 2.4,
      radius,
      alpha: 1,
    };
  }

  const flyElapsed = bounceElapsed - ASTRAL_FLOW_ORB_BOUNCE_SEC;
  if (flyElapsed <= ASTRAL_FLOW_ORB_FLY_SEC) {
    const t = easeInOutQuad(flyElapsed / ASTRAL_FLOW_ORB_FLY_SEC);
    return {
      phase: 'fly',
      x: ground.x + (target.x - ground.x) * t,
      y: ground.y + (target.y - ground.y) * t,
      radius: radius * (1 - 0.25 * t),
      alpha: 1,
    };
  }

  const dissolveElapsed = flyElapsed - ASTRAL_FLOW_ORB_FLY_SEC;
  const t = clamp01(dissolveElapsed / ASTRAL_FLOW_ORB_DISSOLVE_SEC);
  return {
    phase: 'dissolve',
    x: target.x,
    y: target.y,
    radius: radius * (0.75 + 0.5 * t),
    alpha: 1 - t,
  };
}

export function drawAstralFlowKoOrbPresentation(ctx, presentation, now) {
  if (!ctx || !presentation || !Array.isArray(presentation.orbs)) return;
  for (const orb of presentation.orbs) {
    const frame = getAstralFlowKoOrbFrame(orb, now, presentation.startedAt);
    if (frame.alpha <= 0 || frame.radius <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, frame.alpha));
    ctx.fillStyle = orb.color || '#1e7bd6';
    ctx.beginPath();
    ctx.arc(frame.x, frame.y, frame.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function updateAndRenderAstralFlowKoOrbPresentation({
  ctx,
  state,
  worldToCanvas,
  callFunctionWithContext,
  fnContext,
} = {}) {
  const globals = state?.globals;
  if (!globals) return { active: false };
  let presentation = globals.AstralFlowKoOrbPresentationState || null;
  if (!presentation && Array.isArray(globals.AstralFlowKoOrbQueue) && globals.AstralFlowKoOrbQueue.length) {
    presentation = createAstralFlowKoOrbPresentation({ globals, worldToCanvas });
    if (presentation) {
      globals.AstralFlowKoOrbPresentationState = presentation;
      globals.AstralFlowKoOrbPresentationActive = 1;
      globals.AstralFlowKoOrbPresentationPending = 0;
    }
  }
  if (!presentation) return { active: false };

  const now = numberOr(globals.time, 0);
  globals.ActionLockUntil = Math.max(numberOr(globals.ActionLockUntil, 0), presentation.endAt);
  if (now >= presentation.endAt) {
    if (typeof callFunctionWithContext === 'function') {
      callFunctionWithContext(fnContext, 'CompleteAstralFlowKoOrbRewards');
    }
    globals.AstralFlowKoOrbPresentationState = null;
    globals.AstralFlowKoOrbPresentationActive = 0;
    return { active: false, completed: true };
  }

  drawAstralFlowKoOrbPresentation(ctx, presentation, now);
  return { active: true, completed: false };
}
