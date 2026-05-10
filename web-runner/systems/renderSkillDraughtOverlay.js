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
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff7ed';
  ctx.font = '800 30px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Choose a Skill', viewW / 2, Math.max(70, viewH * 0.18));
  const gap = Math.max(10, Math.min(18, viewW * 0.03));
  const cardW = Math.min(260, (viewW - 48 - (gap * 2)) / 3);
  const cardH = Math.min(190, Math.max(168, viewH * 0.28));
  const totalW = (cardW * cards.length) + (gap * Math.max(0, cards.length - 1));
  const startX = (viewW - totalW) / 2;
  const y = Math.max(120, (viewH - cardH) / 2);
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
    return { x, y, w: cardW, h: cardH, index: Number(candidate.index ?? idx) };
  });
  ctx.restore();
}
