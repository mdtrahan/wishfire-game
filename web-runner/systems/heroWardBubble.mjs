// Crimson Ward presentation: a semi-translucent red bubble around each warded hero. It reads
// the hero's own ward and timestamps only, so it always sits on the hero it protects.
const FADE_IN = .12, FADE_OUT = .28, HIT_PULSE = .18;

export function heroWardBubbleAlpha(globals, uid) {
  const visual = globals?.HeroWardVisualByUID?.[String(uid)];
  if (!visual) return 0;
  const now = Number(globals.time || 0), live = Number(globals.HeroWardHPByUID?.[String(uid)] || 0) > 0;
  if (live) return Math.max(0, Math.min(1, (now - Number(visual.startedAt || 0)) / FADE_IN));
  if (visual.endedAt == null) return 0;
  return Math.max(0, 1 - (now - Number(visual.endedAt)) / FADE_OUT);
}

export function drawHeroWardBubble(ctx, { globals, uid, centerX, centerY, radiusX, radiusY }) {
  const alpha = heroWardBubbleAlpha(globals, uid);
  if (!(alpha > 0) || !(radiusX > 0) || !(radiusY > 0)) return false;
  const visual = globals.HeroWardVisualByUID[String(uid)], now = Number(globals.time || 0);
  const hitT = visual.hitAt == null ? 0 : Math.max(0, 1 - (now - Number(visual.hitAt)) / HIT_PULSE);
  const pulse = 1 + Math.sin(hitT * Math.PI) * .06, rx = radiusX * pulse, ry = radiusY * pulse;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(centerX, centerY);
  ctx.scale(1, ry / rx);
  const fill = ctx.createRadialGradient(-rx * .3, -rx * .35, rx * .1, 0, 0, rx);
  fill.addColorStop(0, `rgba(255, 150, 150, ${.12 + hitT * .12})`);
  fill.addColorStop(.7, `rgba(220, 30, 50, ${.16 + hitT * .14})`);
  fill.addColorStop(1, `rgba(200, 20, 40, ${.34 + hitT * .2})`);
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = Math.max(1, rx * .04);
  ctx.strokeStyle = `rgba(255, 110, 120, ${.55 + hitT * .35})`;
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, rx * .78, Math.PI * 1.15, Math.PI * 1.45);
  ctx.lineWidth = Math.max(1, rx * .05); ctx.strokeStyle = 'rgba(255, 235, 235, .45)'; ctx.stroke();
  ctx.restore();
  return true;
}
