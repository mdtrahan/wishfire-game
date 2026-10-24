import {
  COMBAT_ORIENTATION_RIGHT_WISE,
  normalizeCombatOrientation,
} from '../../src/core/combatOrientation.mjs';

export function shouldMirrorCombatActorSprite(orientation, facing = null, nativeFacing = null) {
  const rightWise = normalizeCombatOrientation(orientation) === COMBAT_ORIENTATION_RIGHT_WISE;
  const worldFacing = facing === 'left' || facing === 'right' ? facing : null;
  const imageFacing = nativeFacing === 'left' || nativeFacing === 'right' ? nativeFacing : null;
  if (worldFacing && imageFacing) return (worldFacing !== imageFacing) !== rightWise;
  return rightWise;
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
  facing, nativeFacing,
} = {}) {
  if (!ctx || !image) return null;
  const x = Number(drawX), y = Number(drawY), w = Number(width), h = Number(height);
  const pivot = Number(pivotX);
  if (![x, y, w, h, pivot].every(Number.isFinite)) return null;
  const sourceRect = [sourceX, sourceY, sourceWidth, sourceHeight].map(Number);
  const hasSourceRect = sourceRect.every(Number.isFinite) && sourceRect[2] > 0 && sourceRect[3] > 0;
  const draw = () => {
    if (hasSourceRect) ctx.drawImage(image, sourceRect[0], sourceRect[1], sourceRect[2], sourceRect[3], x, y, w, h);
    else ctx.drawImage(image, x, y, w, h);
  };

  const mirrored = shouldMirrorCombatActorSprite(orientation, facing, nativeFacing);
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
