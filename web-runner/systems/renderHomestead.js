import * as renderSystem from './renderSystem.js';

export function renderHomestead(ctx, gameState, dims) {
  const { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage } = dims;
  const palette = { bg0: '#1f2f1c', bg1: '#31472d', panel: '#eef3e5', panelEdge: '#b2c3a4', ink: '#25321f', muted: '#64745a', selected: '#dce9cc' };
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
  roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#e1ead6', '#94a985');
  ctx.fillStyle = palette.ink; ctx.font = '700 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);
  ctx.textAlign = 'left'; ctx.fillStyle = palette.ink; ctx.font = '700 18px Arial'; ctx.fillText('Homestead Builder (Scaffold)', panel.x + 14, panel.y + 58);
  ctx.fillStyle = palette.muted; ctx.font = '500 11px Arial'; ctx.fillText('Lore-safe scene shell for future building/emitter systems.', panel.x + 14, panel.y + 76);
  const scene = gameState.homesteadLayout.scene || { slots: [], placeholderEmissions: [] };
  const slots = Array.isArray(scene.slots) ? scene.slots : [];
  const selectedSlot = Math.max(0, Math.min(slots.length - 1, Number(gameState.homesteadLayout.selectedSlot || 0)));
  const slotHitZones = []; let cursorY = panel.y + 90;
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i] || {}; const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 52 };
    roundRect(card.x, card.y, card.w, card.h, 10, i === selectedSlot ? palette.selected : '#f4f8ef', '#c4d2b8');
    ctx.fillStyle = palette.ink; ctx.font = '700 12px Arial'; ctx.fillText(String(slot.id || `slot-${i + 1}`), card.x + 10, card.y + 18);
    ctx.fillStyle = palette.muted; ctx.font = '600 10px Arial'; ctx.fillText(`Type: ${String(slot.kind || 'unknown')}`, card.x + 10, card.y + 34);
    ctx.fillText(`State: ${String(slot.buildState || 'empty')} (${slot.unlocked ? 'unlocked' : 'locked'})`, card.x + 170, card.y + 34);
    slotHitZones.push(card); cursorY += card.h + 8;
  }
  const emissions = Array.isArray(scene.placeholderEmissions) ? scene.placeholderEmissions : [];
  ctx.fillStyle = palette.ink; ctx.font = '700 11px Arial'; ctx.fillText('Placeholder Emissions', panel.x + 14, cursorY + 16);
  ctx.fillStyle = palette.muted; ctx.font = '600 10px Arial';
  emissions.forEach((entry, idx) => {
    ctx.fillText(`${String(entry.key || 'unknown')}: +${Number(entry.value || 0)} every ${Number(entry.cadenceSeconds || 0)}s`, panel.x + 14, cursorY + 34 + (idx * 14));
  });
  return { hitZones: { close, combatBack, slots: slotHitZones }, uiPatches: {} };
}
