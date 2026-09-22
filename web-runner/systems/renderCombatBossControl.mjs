import { continuousCombatBossControlState } from '../src/core/continuousCombatStage.mjs';

const CONTROL = Object.freeze({ centerX: 150, centerY: 50, w: 50, h: 50 });
const COLOR = '#f7c948';

export function combatBossControlRect(worldToCanvas) {
  const center = worldToCanvas(CONTROL.centerX, CONTROL.centerY);
  return { x: center.x - CONTROL.w / 2, y: center.y - CONTROL.h / 2, w: CONTROL.w, h: CONTROL.h };
}

export function drawCombatBossControl(ctx, { state, images, worldToCanvas } = {}) {
  const progress = state?.globals?.ContinuousCombatStage;
  const image = images?.CombatBossButton;
  if (!progress || !image) return null;
  const controlState = continuousCombatBossControlState(progress);
  if (controlState === 'locked') return null;
  const rect = combatBossControlRect(worldToCanvas);
  const status = controlState === 'available'
    ? 'READY'
    : controlState === 'locked'
      ? `WAVE ${Math.max(1, Number(progress.wave || 1))}/4`
      : controlState.toUpperCase();
  ctx.save();
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 9px system-ui';
  ctx.fillStyle = '#20242a';
  ctx.fillRect(rect.x - 1, rect.y - 13, rect.w + 2, 11);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`${Math.max(1, Number(progress.region || 1))}-${Math.max(1, Number(progress.stage || 1))}`, rect.x + rect.w / 2, rect.y - 7);
  ctx.fillStyle = '#20242a';
  ctx.fillRect(rect.x - 1, rect.y + rect.h + 2, rect.w + 2, 11);
  ctx.fillStyle = COLOR;
  ctx.fillText(status, rect.x + rect.w / 2, rect.y + rect.h + 7);
  ctx.restore();
  return { ...rect, state: controlState, status };
}
