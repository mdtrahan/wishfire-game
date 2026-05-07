import * as renderSystem from './renderSystem.js';

export function renderCollectibles(ctx, gameState, dims) {
  const { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage } = dims;
  const palette = { bg0: '#21182a', bg1: '#35233f', panel: '#efe7f4', panelEdge: '#bea8f0', ink: '#291936', muted: '#675274', selected: '#ecd8fb' };
  const roundRect = (x, y, w, h, r, fill, stroke) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2)); ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius); ctx.lineTo(x + w, y + h - radius); ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius); ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  const grad = ctx.createLinearGradient(0, 0, 0, viewHeight); grad.addColorStop(0, palette.bg0); grad.addColorStop(1, palette.bg1); ctx.fillStyle = grad; ctx.fillRect(0, 0, viewWidth, viewHeight);
  const panel = { x: 14, y: 16, w: Math.max(260, viewWidth - 28), h: Math.max(360, viewHeight - 34) };
  roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);
  const close = renderSystem.getHeroStyleCloseRect(viewWidth, viewHeight, heroLayoutSpec);
  const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
  renderSystem.drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
  roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#eadff0', '#b59ac4');
  ctx.fillStyle = palette.ink; ctx.font = '700 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);
  ctx.textAlign = 'left'; ctx.font = '700 18px Arial'; ctx.fillText('Collectibles Gallery (Scaffold)', panel.x + 14, panel.y + 58);
  ctx.fillStyle = palette.muted; ctx.font = '500 11px Arial'; ctx.fillText('Progression-gallery collectibles retained through the Vault rail.', panel.x + 14, panel.y + 76);
  const gallery = Array.isArray(gameState.collectiblesLayout.gallery) ? gameState.collectiblesLayout.gallery : [];
  const selectedIndex = Math.max(0, Math.min(gallery.length - 1, Number(gameState.collectiblesLayout.selectedIndex || 0)));
  const cardHitZones = []; let cursorY = panel.y + 90;
  for (let i = 0; i < gallery.length; i += 1) {
    const item = gallery[i] || {}; const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 58 };
    roundRect(card.x, card.y, card.w, card.h, 10, i === selectedIndex ? palette.selected : '#f8f1fb', '#d7c2df');
    ctx.fillStyle = palette.ink; ctx.font = '700 13px Arial'; ctx.fillText(item.discovered ? String(item.name || 'Unknown Collectible') : 'Locked Collectible', card.x + 10, card.y + 20);
    ctx.fillStyle = palette.muted; ctx.font = '600 10px Arial'; ctx.fillText(`Set: ${String(item.setTag || 'none')}`, card.x + 10, card.y + 35);
    cardHitZones.push(card); cursorY += card.h + 8;
  }
  return { hitZones: { close, combatBack, cards: cardHitZones }, uiPatches: {} };
}
