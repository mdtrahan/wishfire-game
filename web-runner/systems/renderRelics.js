import * as renderSystem from './renderSystem.js';

export function renderRelics(ctx, gameState, dims) {
  const { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage } = dims;
  const palette = { bg0: '#251532', bg1: '#3b2251', panel: '#f2e9f7', panelEdge: '#c3a8d3', ink: '#381d49', muted: '#705683', selected: '#ead7f5' };
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
  roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#eadff2', '#b796cb');
  ctx.fillStyle = palette.ink; ctx.font = '700 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);
  ctx.textAlign = 'left'; ctx.fillStyle = palette.ink; ctx.font = '700 18px Arial'; ctx.fillText('Relics Gallery (Scaffold)', panel.x + 14, panel.y + 58);
  ctx.fillStyle = palette.muted; ctx.font = '500 11px Arial'; ctx.fillText('Sibling progression gallery with deterministic relic metadata hooks.', panel.x + 14, panel.y + 76);
  const gallery = Array.isArray(gameState.relicsLayout.gallery) ? gameState.relicsLayout.gallery : [];
  const selectedIndex = Math.max(0, Math.min(gallery.length - 1, Number(gameState.relicsLayout.selectedIndex || 0)));
  const cardHitZones = []; let cursorY = panel.y + 90;
  for (let i = 0; i < gallery.length; i += 1) {
    const relic = gallery[i] || {}; const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 58 };
    const discovered = Boolean(relic.discovered); const passive = relic.passiveHook || null;
    roundRect(card.x, card.y, card.w, card.h, 10, i === selectedIndex ? palette.selected : '#f7f0fb', '#ceb9da');
    ctx.fillStyle = palette.ink; ctx.font = '700 13px Arial'; ctx.fillText(discovered ? String(relic.name || 'Unknown Relic') : 'Locked Relic', card.x + 10, card.y + 20);
    ctx.fillStyle = palette.muted; ctx.font = '600 10px Arial'; ctx.fillText(`Rarity: ${String(relic.rarity || 'Common')}`, card.x + 10, card.y + 35);
    const passiveText = passive ? `${String(passive.key || '')} ${String(passive.mode || '')} ${Number(passive.value || 0)}` : 'No passive hook';
    ctx.fillText(`Passive: ${passiveText}`, card.x + 136, card.y + 20); ctx.fillText(`Set: ${String(relic.setTag || 'none')}`, card.x + 136, card.y + 35);
    cardHitZones.push(card); cursorY += card.h + 8;
  }
  return { hitZones: { close, combatBack, cards: cardHitZones }, uiPatches: {} };
}
