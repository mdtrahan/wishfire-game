import {
  COMBAT_ORIENTATION_RIGHT_WISE,
  normalizeCombatOrientation,
} from '../../src/core/combatOrientation.mjs';

export function shouldMirrorCombatActorSprite(orientation) {
  return normalizeCombatOrientation(orientation) === COMBAT_ORIENTATION_RIGHT_WISE;
}

export function drawCombatActorSprite(ctx, image, {
  drawX,
  drawY,
  width,
  height,
  pivotX,
  orientation,
} = {}) {
  if (!ctx || !image) return null;
  const x = Number(drawX);
  const y = Number(drawY);
  const w = Number(width);
  const h = Number(height);
  const pivot = Number(pivotX);
  if (![x, y, w, h, pivot].every(Number.isFinite)) return null;

  const mirrored = shouldMirrorCombatActorSprite(orientation);
  if (mirrored) {
    ctx.save();
    ctx.translate(pivot, 0);
    ctx.scale(-1, 1);
    ctx.translate(-pivot, 0);
    ctx.drawImage(image, x, y, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(image, x, y, w, h);
  }

  return {
    mirrored,
    pivotX: pivot,
    drawBounds: { x, y, width: w, height: h },
  };
}
