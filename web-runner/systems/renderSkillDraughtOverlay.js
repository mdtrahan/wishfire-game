function drawWrappedText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  let line = '';
  let drawn = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !line) {
      line = next;
      continue;
    }
    ctx.fillText(line, x, y + (drawn * lineH), maxW);
    drawn += 1;
    if (drawn >= maxLines) return drawn;
    line = word;
  }
  if (line && drawn < maxLines) {
    ctx.fillText(line, x, y + (drawn * lineH), maxW);
    drawn += 1;
  }
  return drawn;
}

export function renderSkillDraughtOverlay({ ctx, canvas, dpr = 1, state, draught }) {
  if (!ctx || !canvas || !state || !state.globals) return;
  if (!Number(draught && draught.open || 0)) {
    state.globals.SkillDraughtHitZones = [];
    return;
  }
  const candidates = Array.isArray(draught.candidates) ? draught.candidates : [];
  const cards = candidates.slice(0, 3);
  const viewW = canvas.width / dpr;
  const viewH = canvas.height / dpr;
  const layoutScale = Math.min(viewW / 360, viewH / 640);
  const offsetX = (viewW - (360 * layoutScale)) / 2;
  const offsetY = (viewH - (640 * layoutScale)) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.translate(offsetX, offsetY);
  ctx.scale(layoutScale, layoutScale);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff7ed';
  ctx.font = '800 30px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Choose a Skill', 180, 115.2);
  const cardW = 96.8;
  const cardH = 179.2;
  const strokeSafeInset = 26;
  const gap = (360 - (strokeSafeInset * 2) - (cardW * 3)) / 2;
  const totalW = (cardW * cards.length) + (gap * Math.max(0, cards.length - 1));
  const startX = (360 - totalW) / 2;
  const y = (640 - cardH) / 2;
  state.globals.SkillDraughtHitZones = cards.map((candidate, idx) => {
    const x = startX + (idx * (cardW + gap));
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111827';
    ctx.font = `${cardW < 130 ? 700 : 800} ${cardW < 130 ? 12 : 17}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const titleLines = drawWrappedText(ctx, String(candidate.name || candidate.title || 'Skill'), x + 14, y + 30, cardW - 28, 15, 2);
    ctx.font = `500 ${cardW < 130 ? 11 : 13}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    drawWrappedText(ctx, String(candidate.description || ''), x + 14, y + 56 + (titleLines > 1 ? 10 : 0), cardW - 28, 17, 5);
    return {
      x: offsetX + (x * layoutScale),
      y: offsetY + (y * layoutScale),
      w: cardW * layoutScale,
      h: cardH * layoutScale,
      index: Number(candidate.index ?? idx),
    };
  });
  ctx.restore();
}
