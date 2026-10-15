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

export function combatActorVisualScale({ actorUID, effects, now = 0 } = {}) {
  return Number(effects?.[String(actorUID)]?.shrink?.expiresAt) > now ? 0.7 : 1;
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
  actorUID, effects, now = 0,
  facing, nativeFacing,
} = {}) {
  if (!ctx || !image) return null;
  const shrink = combatActorVisualScale({ actorUID, effects, now });
  const x = Number(drawX)+(Number(width)*(1-shrink)/2);
  const y = Number(drawY)+Number(height)*(1-shrink);
  const w = Number(width)*shrink;
  const h = Number(height)*shrink;
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
