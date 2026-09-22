import { continuousCombatBossControlState } from '../src/core/continuousCombatStage.mjs';

const CONTROL = Object.freeze({ x: 125, y: 25, w: 50, h: 50 });
const COLOR = '#f7c948';

export function combatBossControlRect() { return { ...CONTROL }; }

export function drawCombatBossControl(ctx, { state, images } = {}) {
  const progress = state?.globals?.ContinuousCombatStage;
  const image = images?.CombatBossButton;
  if (!progress || !image) return null;
  const controlState = continuousCombatBossControlState(progress);
  if (controlState === 'locked') return null;
  const status = controlState === 'available'
    ? 'READY'
    : controlState === 'locked'
      ? `WAVE ${Math.max(1, Number(progress.wave || 1))}/4`
      : controlState.toUpperCase();
  ctx.save();
  ctx.drawImage(image, CONTROL.x, CONTROL.y, CONTROL.w, CONTROL.h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(CONTROL.x - 1, CONTROL.y - 1, CONTROL.w + 2, CONTROL.h + 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 9px system-ui';
  ctx.fillStyle = '#20242a';
  ctx.fillRect(CONTROL.x - 1, CONTROL.y - 13, CONTROL.w + 2, 11);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`${Math.max(1, Number(progress.region || 1))}-${Math.max(1, Number(progress.stage || 1))}`, CONTROL.x + CONTROL.w / 2, CONTROL.y - 7);
  ctx.fillStyle = '#20242a';
  ctx.fillRect(CONTROL.x - 1, CONTROL.y + CONTROL.h + 2, CONTROL.w + 2, 11);
  ctx.fillStyle = COLOR;
  ctx.fillText(status, CONTROL.x + CONTROL.w / 2, CONTROL.y + CONTROL.h + 7);
  ctx.restore();
  return { ...CONTROL, state: controlState, status };
}
