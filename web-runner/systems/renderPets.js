import * as renderSystem from './renderSystem.js';

export function renderPets(ctx, gameState, dims) {
  const { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage } = dims;
  const palette = { bg0: '#152314', bg1: '#314128', panel: '#eef4e7', panelEdge: '#b8c9a8', ink: '#243119', muted: '#5f7051', selected: '#dcecc9' };
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
  roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#ddead0', '#9cb581');
  ctx.fillStyle = palette.ink; ctx.font = '700 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);
  ctx.textAlign = 'left'; ctx.fillStyle = palette.ink; ctx.font = '700 18px Arial'; ctx.fillText('Pets Gallery (Scaffold)', panel.x + 14, panel.y + 58);
  ctx.fillStyle = palette.muted; ctx.font = '500 11px Arial'; ctx.fillText('Companion progression shell with stable milestone and deployment metadata.', panel.x + 14, panel.y + 76);
  const gallery = Array.isArray(gameState.petsLayout.gallery) ? gameState.petsLayout.gallery : [];
  const selectedIndex = Math.max(0, Math.min(gallery.length - 1, Number(gameState.petsLayout.selectedIndex || 0)));
  const cardHitZones = []; let cursorY = panel.y + 90;
  for (let i = 0; i < gallery.length; i += 1) {
    const pet = gallery[i] || {}; const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 58 };
    const discovered = Boolean(pet.discovered); const passive = pet.passiveHook || null;
    roundRect(card.x, card.y, card.w, card.h, 10, i === selectedIndex ? palette.selected : '#f4f8ef', '#c8d7bb');
    ctx.fillStyle = palette.ink; ctx.font = '700 13px Arial'; ctx.fillText(discovered ? String(pet.name || 'Unknown Pet') : 'Locked Pet', card.x + 10, card.y + 20);
    ctx.fillStyle = palette.muted; ctx.font = '600 10px Arial'; ctx.fillText(`Rarity: ${String(pet.rarity || 'Common')}`, card.x + 10, card.y + 35);
    const passiveText = passive ? `${String(passive.key || '')} ${String(passive.mode || '')} ${Number(passive.value || 0)} / ${Number(passive.cadenceTurns || 0)}t` : 'No passive hook';
    ctx.fillText(`Passive: ${passiveText}`, card.x + 136, card.y + 20); ctx.fillText(`Milestones: ${Number(pet.milestoneSlots || 0)} · Deploy: ${Number(pet.deploymentSlots || 0)}`, card.x + 136, card.y + 35);
    cardHitZones.push(card); cursorY += card.h + 8;
  }
  return { hitZones: { close, combatBack, cards: cardHitZones }, uiPatches: {} };
}
