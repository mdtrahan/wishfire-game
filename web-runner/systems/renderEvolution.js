import * as renderSystem from './renderSystem.js';

export function renderEvolution(ctx, gameState, dims) {
  const { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage } = dims;
  const palette = { bg0: '#15203a', bg1: '#233b64', panel: '#eef3fb', panelEdge: '#aec0df', ink: '#233759', muted: '#627999', selected: '#d9e6fb' };
  const roundRect = (x, y, w, h, r, fill, stroke) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2)); ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius); ctx.lineTo(x + w, y + h - radius); ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius); ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };
  ctx.clearRect(0, 0, viewWidth, viewHeight); const grad = ctx.createLinearGradient(0, 0, 0, viewHeight); grad.addColorStop(0, palette.bg0); grad.addColorStop(1, palette.bg1); ctx.fillStyle = grad; ctx.fillRect(0, 0, viewWidth, viewHeight);
  const panel = { x: 14, y: 16, w: Math.max(260, viewWidth - 28), h: Math.max(360, viewHeight - 34) };
  roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);
  const close = renderSystem.getHeroStyleCloseRect(viewWidth, viewHeight, heroLayoutSpec);
  const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
  renderSystem.drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
  roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#dde8f9', '#97add0');
  ctx.fillStyle = palette.ink; ctx.font = '700 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);
  ctx.textAlign = 'left'; ctx.fillStyle = palette.ink; ctx.font = '700 18px Arial'; ctx.fillText('Evolution Tree (Scaffold)', panel.x + 14, panel.y + 58);
  ctx.fillStyle = palette.muted; ctx.font = '500 11px Arial'; ctx.fillText('Seven-step soft-currency ladder with future hero research gate seams.', panel.x + 14, panel.y + 76);
  const ladder = Array.isArray(gameState.evolutionLayout.ladder) ? gameState.evolutionLayout.ladder : [];
  const selectedLevel = Math.max(0, Math.min(ladder.length - 1, Number(gameState.evolutionLayout.selectedLevel || 0)));
  const cardHitZones = []; let cursorY = panel.y + 90;
  for (let i = 0; i < ladder.length; i += 1) {
    const step = ladder[i] || {}; const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 52 };
    roundRect(card.x, card.y, card.w, card.h, 10, i === selectedLevel ? palette.selected : '#f5f8fe', '#c1cfe4');
    ctx.fillStyle = palette.ink; ctx.font = '700 12px Arial'; ctx.fillText(`Lv.${Number(step.level || i + 1)} · ${String(step.stat || 'Stat')}`, card.x + 10, card.y + 18);
    ctx.fillStyle = palette.muted; ctx.font = '600 10px Arial'; ctx.fillText(String(step.bonusText || 'Placeholder bonus'), card.x + 10, card.y + 34);
    ctx.fillText(`${String(step.softCurrency || 'Currency')} ${Number(step.cost || 0)} · ${String(step.status || 'preview-open')}`, card.x + 182, card.y + 34);
    cardHitZones.push(card); cursorY += card.h + 8;
  }
  const gates = Array.isArray(gameState.evolutionLayout.researchGates) ? gameState.evolutionLayout.researchGates : [];
  ctx.fillStyle = palette.ink; ctx.font = '700 11px Arial'; ctx.fillText('Future Skill-Research Gates', panel.x + 14, cursorY + 16);
  ctx.fillStyle = palette.muted; ctx.font = '600 10px Arial';
  gates.forEach((gate, idx) => {
    ctx.fillText(`${String(gate.hero || 'Hero')} · ${String(gate.node || 'Node')} · unlock Lv.${Number(gate.unlockLevel || 0)} · ${String(gate.state || 'future-research')}`, panel.x + 14, cursorY + 34 + (idx * 14));
  });
  return { hitZones: { close, combatBack, cards: cardHitZones }, uiPatches: {} };
}
