export function drawHeroStatGlyph(ctx, emoji, cx, cy, scale) {
  const glyph = String(emoji || 'O');
  const size = Math.max(12, Math.round(Number(scale || 1) * 22));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText(glyph, cx, cy + 1);
  ctx.restore();
}

export function traceDiamondShapePath(ctx, rect) {
  const cx = rect.x + (rect.w / 2);
  const cy = rect.y + (rect.h / 2);
  ctx.moveTo(cx, rect.y);
  ctx.lineTo(rect.x + rect.w, cy);
  ctx.lineTo(cx, rect.y + rect.h);
  ctx.lineTo(rect.x, cy);
  ctx.closePath();
}

export function getHeroStyleCloseRect(viewWidth, viewHeight, heroLayoutSpec) {
  const artW = Number(heroLayoutSpec?.artboard?.w || 360);
  const artH = Number(heroLayoutSpec?.artboard?.h || 640);
  const fitScale = Math.min(viewWidth / artW, viewHeight / artH);
  const artOffsetX = (viewWidth - (artW * fitScale)) * 0.5;
  const artOffsetY = (viewHeight - (artH * fitScale)) * 0.5;
  const r = Number(heroLayoutSpec?.close?.r || 15) * fitScale;
  const cx = artOffsetX + (Number(heroLayoutSpec?.close?.cx || 180) * fitScale);
  const cy = artOffsetY + (Number(heroLayoutSpec?.close?.cy || 608) * fitScale);
  return { x: cx - r, y: cy - r, w: r * 2, h: r * 2, r };
}

export function drawHeroStyleCloseControl(ctx, closeRect, closeOvalImage = null, ink = '#111') {
  if (!closeRect) return;
  const cx = closeRect.x + (closeRect.w / 2);
  const cy = closeRect.y + (closeRect.h / 2);
  const radius = closeRect.r || (closeRect.w / 2);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#d9d9d9';
  ctx.fill();
  if (closeOvalImage) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(closeOvalImage, closeRect.x, closeRect.y, closeRect.w, closeRect.h);
    ctx.restore();
  }
  ctx.fillStyle = ink;
  ctx.font = `700 ${Math.max(12, Math.round(closeRect.h * 0.55))}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('X', cx, cy + 1);
  ctx.textBaseline = 'alphabetic';
}
