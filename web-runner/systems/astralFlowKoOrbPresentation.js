const ASTRAL_FLOW_ORB_SPILL_SEC = 0.24;
const ASTRAL_FLOW_ORB_BOUNCE_ONE_SEC = 0.18;
const ASTRAL_FLOW_ORB_BOUNCE_TWO_SEC = 0.16;
const ASTRAL_FLOW_ORB_BOUNCE_THREE_SEC = 0.14;
const ASTRAL_FLOW_ORB_FLY_SEC = 0.46;
const ASTRAL_FLOW_ORB_DISSOLVE_SEC = 0.18;
const ASTRAL_FLOW_ORB_TOTAL_SEC = ASTRAL_FLOW_ORB_SPILL_SEC
  + ASTRAL_FLOW_ORB_BOUNCE_ONE_SEC
  + ASTRAL_FLOW_ORB_BOUNCE_TWO_SEC
  + ASTRAL_FLOW_ORB_BOUNCE_THREE_SEC
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

function getOrbSpillX(index, count, radius) {
  const safeCount = Math.max(1, count | 0);
  if (safeCount <= 1) return 0;
  const midpoint = (safeCount - 1) / 2;
  const normalized = midpoint > 0 ? (index - midpoint) / midpoint : 0;
  if (Math.abs(normalized) < 0.01) return 0;
  const direction = normalized < 0 ? -1 : 1;
  const edgeWeight = Math.abs(normalized);
  return direction * (16 + radius * 2.4 + edgeWeight * 18);
}

function lerpPoint(from, to, t) {
  const eased = clamp01(t);
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
  };
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
      const stagger = index * 0.025;
      const scale = Math.max(0.4, numberOr(scales[index], 1));
      const radius = 4.6 * scale;
      const spillX = getOrbSpillX(index, scales.length, radius);
      orbs.push({
        source,
        ground,
        spillX,
        target,
        radius,
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
  const spillX = numberOr(orb?.spillX, 0);
  const firstContact = { x: ground.x + spillX * 0.48, y: ground.y };
  const secondContact = { x: ground.x + spillX * 0.74, y: ground.y };
  const thirdContact = { x: ground.x + spillX * 0.94, y: ground.y };
  const launchContact = { x: ground.x + spillX, y: ground.y };

  if (elapsed <= ASTRAL_FLOW_ORB_SPILL_SEC) {
    const t = easeOutQuad(elapsed / ASTRAL_FLOW_ORB_SPILL_SEC);
    const point = lerpPoint(source, firstContact, t);
    return {
      phase: 'spill',
      x: point.x,
      y: point.y,
      radius,
      alpha: 1,
    };
  }

  const bounceOneElapsed = elapsed - ASTRAL_FLOW_ORB_SPILL_SEC;
  if (bounceOneElapsed <= ASTRAL_FLOW_ORB_BOUNCE_ONE_SEC) {
    const t = clamp01(bounceOneElapsed / ASTRAL_FLOW_ORB_BOUNCE_ONE_SEC);
    const point = lerpPoint(firstContact, secondContact, t);
    return {
      phase: 'bounce-1',
      x: point.x,
      y: point.y - Math.sin(t * Math.PI) * radius * 2.5,
      radius,
      alpha: 1,
    };
  }

  const bounceTwoElapsed = bounceOneElapsed - ASTRAL_FLOW_ORB_BOUNCE_ONE_SEC;
  if (bounceTwoElapsed <= ASTRAL_FLOW_ORB_BOUNCE_TWO_SEC) {
    const t = clamp01(bounceTwoElapsed / ASTRAL_FLOW_ORB_BOUNCE_TWO_SEC);
    const point = lerpPoint(secondContact, thirdContact, t);
    return {
      phase: 'bounce-2',
      x: point.x,
      y: point.y - Math.sin(t * Math.PI) * radius * 1.65,
      radius,
      alpha: 1,
    };
  }

  const bounceThreeElapsed = bounceTwoElapsed - ASTRAL_FLOW_ORB_BOUNCE_TWO_SEC;
  if (bounceThreeElapsed <= ASTRAL_FLOW_ORB_BOUNCE_THREE_SEC) {
    const t = clamp01(bounceThreeElapsed / ASTRAL_FLOW_ORB_BOUNCE_THREE_SEC);
    const point = lerpPoint(thirdContact, launchContact, t);
    return {
      phase: 'bounce-3',
      x: point.x,
      y: point.y - Math.sin(t * Math.PI) * radius * 0.95,
      radius,
      alpha: 1,
    };
  }

  const flyElapsed = bounceThreeElapsed - ASTRAL_FLOW_ORB_BOUNCE_THREE_SEC;
  if (flyElapsed <= ASTRAL_FLOW_ORB_FLY_SEC) {
    const t = easeInOutQuad(flyElapsed / ASTRAL_FLOW_ORB_FLY_SEC);
    return {
      phase: 'fly',
      x: launchContact.x + (target.x - launchContact.x) * t,
      y: launchContact.y + (target.y - launchContact.y) * t,
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

function hasPendingAttackPresentation(globals) {
  if (!globals || typeof globals !== 'object') return false;
  const now = numberOr(globals.time, 0);
  if (Array.isArray(globals.PendingHeroHits) && globals.PendingHeroHits.length > 0) return true;
  if (Array.isArray(globals.ChainStrikeVisuals) && globals.ChainStrikeVisuals.length > 0) return true;
  if (Array.isArray(globals.ArcanePulseVisuals) && globals.ArcanePulseVisuals.length > 0) return true;
  if (globals.HeroAction && globals.HeroAction.active) return true;
  if (globals.EnemyAction && globals.EnemyAction.active) return true;
  if (numberOr(globals.TextAnimEndAt, 0) > now) return true;
  if (Array.isArray(globals.DamageTexts) && globals.DamageTexts.length > 0) return true;
  return false;
}

export function prepareAstralFlowKoOrbPresentation({
  state,
  worldToCanvas,
  callFunctionWithContext,
  fnContext,
} = {}) {
  const globals = state?.globals;
  if (!globals) return { active: false };
  let presentation = globals.AstralFlowKoOrbPresentationState || null;
  if (!presentation && Array.isArray(globals.AstralFlowKoOrbQueue) && globals.AstralFlowKoOrbQueue.length) {
    if (hasPendingAttackPresentation(globals)) {
      globals.AstralFlowKoOrbPresentationPending = 1;
      return { active: false, pending: true };
    }
    if (typeof callFunctionWithContext === 'function') {
      callFunctionWithContext(fnContext, 'BeginAstralFlowKoOrbEnemyDeaths');
    }
    presentation = createAstralFlowKoOrbPresentation({ globals, worldToCanvas });
    if (presentation) {
      globals.AstralFlowKoOrbPresentationState = presentation;
      globals.AstralFlowKoOrbPresentationActive = 1;
      globals.AstralFlowKoOrbPresentationPending = 0;
    }
  }
  if (presentation) return { active: true, prepared: true };
  return { active: false };
}

export function updateAndRenderAstralFlowKoOrbPresentation({
  ctx,
  state,
  callFunctionWithContext,
  fnContext,
} = {}) {
  const globals = state?.globals;
  if (!globals) return { active: false };
  const presentation = globals.AstralFlowKoOrbPresentationState || null;
  if (!presentation && Array.isArray(globals.AstralFlowKoOrbQueue) && globals.AstralFlowKoOrbQueue.length) {
    globals.AstralFlowKoOrbPresentationPending = 1;
    return { active: false, pending: true };
  }
  if (!presentation) return { active: false };

  const now = numberOr(globals.time, 0);
  globals.ActionLockUntil = Math.max(numberOr(globals.ActionLockUntil, 0), presentation.endAt);
  if (now >= presentation.endAt) {
    if (!presentation.deliveryFrameDrawn) {
      presentation.deliveryFrameDrawn = 1;
      globals.ActionLockUntil = Math.max(numberOr(globals.ActionLockUntil, 0), now + 0.05);
      drawAstralFlowKoOrbPresentation(ctx, presentation, presentation.endAt);
      return { active: true, completed: false, deliveryFrameDrawn: true };
    }
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
