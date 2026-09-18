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
  sourceX,
  sourceY,
  sourceWidth,
  sourceHeight,
} = {}) {
  if (!ctx || !image) return null;
  const x = Number(drawX);
  const y = Number(drawY);
  const w = Number(width);
  const h = Number(height);
  const pivot = Number(pivotX);
  if (![x, y, w, h, pivot].every(Number.isFinite)) return null;
  const sourceRect = [sourceX, sourceY, sourceWidth, sourceHeight].map(Number);
  const hasSourceRect = sourceRect.every(Number.isFinite) && sourceRect[2] > 0 && sourceRect[3] > 0;
  const draw = () => {
    if (hasSourceRect) ctx.drawImage(image, sourceRect[0], sourceRect[1], sourceRect[2], sourceRect[3], x, y, w, h);
    else ctx.drawImage(image, x, y, w, h);
  };

  const mirrored = shouldMirrorCombatActorSprite(orientation);
  if (mirrored) {
    ctx.save();
    ctx.translate(pivot, 0);
    ctx.scale(-1, 1);
    ctx.translate(-pivot, 0);
    draw();
    ctx.restore();
  } else {
    draw();
  }

  return {
    mirrored,
    pivotX: pivot,
    drawBounds: { x, y, width: w, height: h },
  };
}
