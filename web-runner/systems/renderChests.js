import * as renderSystem from './renderSystem.js';

export function renderChests(ctx, gameState, dims) {
  const { viewWidth, viewHeight, heroLayoutSpec, closeWinOvalImage } = dims;
  const palette = { bg0: '#2a1f0e', bg1: '#4a3820', panel: '#f4ecd6', panelEdge: '#c7b489', ink: '#3c2a12', muted: '#7b6641', selected: '#f1ddad' };
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
  renderSystem.drawHeroStyleCloseControl(ctx, close, closeWinOvalImage, palette.ink);
  const combatBack = { x: panel.x + panel.w - 120, y: panel.y + 12, w: 108, h: 28 };
  roundRect(combatBack.x, combatBack.y, combatBack.w, combatBack.h, 9, '#efe3c4', '#b89f6f');
  ctx.fillStyle = palette.ink; ctx.font = '700 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('Back To Combat', combatBack.x + combatBack.w / 2, combatBack.y + 18);
  ctx.textAlign = 'left'; ctx.fillStyle = palette.ink; ctx.font = '700 18px Arial'; ctx.fillText('Vault', panel.x + 14, panel.y + 58);
  ctx.fillStyle = palette.muted; ctx.font = '500 11px Arial'; ctx.fillText('Tier tabs and dopamine-progress reward shell.', panel.x + 14, panel.y + 76);

  const retentionButtons = Array.isArray(gameState.chestsLayout.retentionButtons) ? gameState.chestsLayout.retentionButtons : [];
  const retentionHitZones = []; let retentionY = panel.y + 88;
  for (const entry of retentionButtons) {
    const rect = { x: panel.x + 12, y: retentionY, w: panel.w - 24, h: 36 };
    roundRect(rect.x, rect.y, rect.w, rect.h, 8, String(entry.fill || '#f3ddaa'), String(entry.stroke || '#8d6d2a'));
    ctx.fillStyle = String(entry.text || '#2f2412'); ctx.font = '700 12px Arial'; ctx.textAlign = 'left'; ctx.fillText(String(entry.title || ''), rect.x + 10, rect.y + 16);
    ctx.font = '500 10px Arial'; ctx.fillText(String(entry.subtitle || ''), rect.x + 10, rect.y + 30);
    retentionHitZones.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, targetLayout: String(entry.targetLayout || ''), id: String(entry.id || '') });
    retentionY += 44;
  }

  const tabs = Array.isArray(gameState.chestsLayout.tabs) ? gameState.chestsLayout.tabs : [];
  const activeTab = String(gameState.chestsLayout.activeTab || '');
  const tabHitZones = []; const tabY = retentionY + 4;
  const tabW = Math.max(62, Math.floor((panel.w - 24 - (tabs.length - 1) * 8) / Math.max(1, tabs.length)));
  tabs.forEach((tab, idx) => {
    const rect = { x: panel.x + 12 + idx * (tabW + 8), y: tabY, w: tabW, h: 28 };
    const isActive = String(tab.id || '') === activeTab;
    roundRect(rect.x, rect.y, rect.w, rect.h, 8, isActive ? palette.selected : '#f8f1dd', '#ccb88d');
    ctx.fillStyle = palette.ink; ctx.font = '700 10px Arial'; ctx.textAlign = 'center';
    ctx.fillText(String(tab.label || tab.id || ''), rect.x + rect.w / 2, rect.y + 18);
    tabHitZones.push({ ...rect, id: String(tab.id || '') });
  });
  ctx.textAlign = 'left';

  const progress = gameState.chestsLayout.progress || { current: 0, target: 1, milestoneReward: 'Tier Chest' };
  const progressWrap = { x: panel.x + 12, y: tabY + 40, w: panel.w - 24, h: 44 };
  roundRect(progressWrap.x, progressWrap.y, progressWrap.w, progressWrap.h, 10, '#f8f1dd', '#ccb88d');
  const meter = { x: progressWrap.x + 10, y: progressWrap.y + 24, w: progressWrap.w - 20, h: 12 };
  const pct = Math.max(0, Math.min(1, Number(progress.current || 0) / Math.max(1, Number(progress.target || 1))));
  ctx.fillStyle = '#e0d5bb'; ctx.fillRect(meter.x, meter.y, meter.w, meter.h); ctx.fillStyle = '#d2a739'; ctx.fillRect(meter.x, meter.y, meter.w * pct, meter.h); ctx.strokeStyle = '#a98a45'; ctx.strokeRect(meter.x, meter.y, meter.w, meter.h);
  ctx.fillStyle = palette.ink; ctx.font = '600 10px Arial';
  ctx.fillText(`Progress ${Number(progress.current || 0)}/${Number(progress.target || 0)} · Milestone: ${String(progress.milestoneReward || '')}`, progressWrap.x + 10, progressWrap.y + 16);

  const rewards = (gameState.chestsLayout.rewardsByTab || {})[activeTab] || [];
  const rewardHitZones = []; let rewardY = progressWrap.y + progressWrap.h + 10;
  rewards.forEach((reward, idx) => {
    const rect = { x: panel.x + 12, y: rewardY, w: panel.w - 24, h: 36 };
    roundRect(rect.x, rect.y, rect.w, rect.h, 8, '#fff8e8', '#d7c7a2');
    ctx.fillStyle = palette.ink; ctx.font = '600 11px Arial'; ctx.fillText(String(reward || `Reward ${idx + 1}`), rect.x + 10, rect.y + 22);
    rewardHitZones.push(rect); rewardY += 44;
  });

  return { hitZones: { close, combatBack, retentionButtons: retentionHitZones, tabs: tabHitZones, rewards: rewardHitZones }, uiPatches: {} };
}
