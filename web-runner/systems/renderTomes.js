import * as renderSystem from './renderSystem.js';

export function renderTomes(ctx, gameState, dims) {
  const { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage } = dims;
  const palette = {
    bg0: '#1f1629',
    bg1: '#372342',
    panel: '#f0e7d1',
    panelEdge: '#c1b28f',
    ink: '#2b1e12',
    muted: '#6a5d49',
    selected: '#ffe7a6',
  };
  const roundRect = (x, y, w, h, r, fill, stroke) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
  grad.addColorStop(0, palette.bg0);
  grad.addColorStop(1, palette.bg1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const panelPad = 14;
  const panel = {
    x: panelPad,
    y: 16,
    w: Math.max(260, viewWidth - panelPad * 2),
    h: Math.max(360, viewHeight - 34),
  };
  roundRect(panel.x, panel.y, panel.w, panel.h, 14, palette.panel, palette.panelEdge);

  const close = renderSystem.getHeroStyleCloseRect(viewWidth, viewHeight, heroLayoutSpec);
  const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
  renderSystem.drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
  roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#ece3cb', '#baa980');
  ctx.fillStyle = palette.ink;
  ctx.font = '700 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);

  ctx.textAlign = 'left';
  ctx.fillStyle = palette.ink;
  ctx.font = '700 18px Arial';
  ctx.fillText('Tomes Gallery (Scaffold)', panel.x + 14, panel.y + 58);
  ctx.fillStyle = palette.muted;
  ctx.font = '500 11px Arial';
  ctx.fillText('Discovery source: map locale. Buff and optional enemy debuff metadata only.', panel.x + 14, panel.y + 76);

  const gallery = Array.isArray(gameState.tomesLayout.gallery) ? gameState.tomesLayout.gallery : [];
  const selectedIndex = Math.max(0, Math.min(gallery.length - 1, Number(gameState.tomesLayout.selectedIndex || 0)));
  const cardHitZones = [];
  let cursorY = panel.y + 90;
  const cardGap = 8;
  for (let i = 0; i < gallery.length; i += 1) {
    const tome = gallery[i] || {};
    const card = { x: panel.x + 12, y: cursorY, w: panel.w - 24, h: 58 };
    const discovered = Boolean(tome.discovered);
    const buff = tome.buffSlot || null;
    const debuff = tome.enemyDebuffSlot || null;
    roundRect(card.x, card.y, card.w, card.h, 10, i === selectedIndex ? palette.selected : '#f7f1e2', '#c9b88f');
    ctx.fillStyle = palette.ink;
    ctx.font = '700 13px Arial';
    ctx.fillText(discovered ? String(tome.name || 'Unknown Tome') : 'Locked Tome', card.x + 10, card.y + 20);
    ctx.fillStyle = palette.muted;
    ctx.font = '600 10px Arial';
    ctx.fillText(`Rarity: ${String(tome.rarity || 'Common')}`, card.x + 10, card.y + 35);
    const buffText = buff
      ? `${String(buff.stat || '')} ${String(buff.mode || '')} ${Number(buff.value || 0)} / ${Number(buff.cadenceTurns || 0)}t`
      : 'No buff slot';
    const debuffText = debuff
      ? `${String(debuff.stat || '')} ${String(debuff.mode || '')} ${Number(debuff.value || 0)}`
      : 'No enemy debuff';
    ctx.fillText(`Buff: ${buffText}`, card.x + 136, card.y + 20);
    ctx.fillText(`Debuff: ${debuffText}`, card.x + 136, card.y + 35);
    cardHitZones.push(card);
    cursorY += card.h + cardGap;
  }

  return {
    hitZones: {
      close,
      combatBack,
      cards: cardHitZones,
    },
    uiPatches: {},
  };
}
