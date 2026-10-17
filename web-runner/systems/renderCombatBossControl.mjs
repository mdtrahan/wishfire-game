import { CONTINUOUS_COMBAT_BOSS_TIME_LIMIT_SEC, continuousCombatBossTimeRemaining, continuousCombatWavesForStage, deriveContinuousCombatWavePackProgress } from '../src/core/continuousCombatStage.mjs';

const HUD = Object.freeze({ left: 127.5, top: 44, right: 232.5, bottom: 84 });
const FALLBACK = Object.freeze({ width: 360, height: 82, top: 2 });
let fallbackHost = null;
let fallbackChapter = null;
let fallbackButton = null;

export function combatProgressHudRect(worldToCanvas) {
  const topLeft = worldToCanvas(HUD.left, HUD.top);
  const bottomRight = worldToCanvas(HUD.right, HUD.bottom);
  return { x: topLeft.x, y: topLeft.y, w: bottomRight.x - topLeft.x, h: bottomRight.y - topLeft.y };
}

export function bossFallbackPresentation({ state, layoutId, overlayOpen = false, canLeave = true, phase = '', suppress = false } = {}) {
  const stage = state?.globals?.ContinuousCombatStage;
  const ready = stage?.bossAvailable === true || stage?.bossActive === true;
  const interrupted = layoutId !== 'combat' || overlayOpen;
  const manualRetryInCombat = layoutId === 'combat' && stage?.bossSummonRequired === true && stage?.bossActive !== true;
  const visible = ready && (interrupted || manualRetryInCombat) && !suppress && !['opening', 'defeat'].includes(phase);
  const region = Math.max(1, Number(stage?.region) || 1);
  return {
    visible,
    enabled: visible && canLeave,
    label: `Chapter ${region}`,
    bossActive: stage?.bossActive === true,
  };
}

export function bossFallbackRect(canvasRect) {
  const scale = Math.min(canvasRect.width / FALLBACK.width, canvasRect.height / 640);
  const width = FALLBACK.width * scale;
  const height = FALLBACK.height * scale;
  return {
    x: canvasRect.left + (canvasRect.width - width) / 2,
    y: canvasRect.top + (canvasRect.height - 640 * scale) / 2 + FALLBACK.top * scale,
    width,
    height,
    scale,
  };
}

function ensureFallbackHost() {
  if (fallbackHost || typeof document === 'undefined') return;
  fallbackHost = document.createElement('div');
  fallbackHost.id = 'combat-boss-fallback';
  fallbackHost.hidden = true;
  fallbackHost.style.cssText = 'position:fixed;z-index:10002;display:flex;flex-direction:column;align-items:center;transform-origin:top left;pointer-events:none;color:#fff5d7;text-align:center;font-family:system-ui,sans-serif;';
  fallbackChapter = document.createElement('div');
  fallbackChapter.className = 'combat-boss-fallback-chapter';
  fallbackChapter.style.cssText = 'height:18px;line-height:18px;font-size:13px;font-weight:900;color:#ffd957;text-shadow:0 2px 3px #17120b,0 0 5px #17120b;white-space:nowrap;';
  fallbackButton = document.createElement('button');
  fallbackButton.type = 'button';
  fallbackButton.setAttribute('aria-label', 'Summon Boss');
  fallbackButton.style.cssText = 'width:150px;height:64px;margin:0;padding:0;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:0;color:#fff5d7;font:900 12px/16px system-ui,sans-serif;text-shadow:0 2px 3px #17120b,0 0 5px #17120b;cursor:pointer;touch-action:manipulation;pointer-events:auto;';
  fallbackButton.innerHTML = '<svg aria-hidden="true" viewBox="-14 -14 28 28" width="44" height="44" style="overflow:visible;filter:drop-shadow(0 2px 3px #17120b)"><path d="M-8 -5 L-11 -11 -4 -8 Q0 -11 4 -8 L11 -11 8 -4 Q11 8 0 10 Q-11 8 -8 -5Z" fill="#d74c52" stroke="#6f2836" stroke-width="1.6" stroke-linejoin="round"/><path d="M-5 -2L-1 -1 -4 2Z M5 -2L1 -1 4 2Z" fill="#fff0bd"/><ellipse cx="0" cy="4.5" rx="2.2" ry="1.5" fill="#592531"/></svg><span>Summon Boss</span>';
  fallbackHost.append(fallbackChapter, fallbackButton);
  document.body.append(fallbackHost);
}

export function updateBossSummonFallback({ canvas, state, layoutId, overlayOpen = false, canLeave = true, phase = '', suppress = false, onSummonBoss = () => {}, redraw = () => {} } = {}) {
  const view = bossFallbackPresentation({ state, layoutId, overlayOpen, canLeave, phase, suppress });
  state?.globals && (state.globals.CombatBossFallbackVisible = view.visible);
  if (!view.visible || !canvas?.getBoundingClientRect || typeof document === 'undefined') {
    if (fallbackHost) { fallbackHost.hidden = true; fallbackHost.style.display = 'none'; }
    return { ...view, rect: null };
  }
  ensureFallbackHost();
  const rect = bossFallbackRect(canvas.getBoundingClientRect());
  fallbackHost.hidden = false;
  fallbackHost.style.display = 'flex';
  fallbackHost.style.left = `${rect.x}px`;
  fallbackHost.style.top = `${rect.y}px`;
  fallbackHost.style.transform = `scale(${rect.scale})`;
  fallbackHost.style.width = `${FALLBACK.width}px`;
  fallbackHost.style.height = `${FALLBACK.height}px`;
  fallbackChapter.textContent = view.label;
  fallbackButton.disabled = !view.enabled;
  fallbackButton.setAttribute('aria-label', `Summon Boss for ${view.label}`);
  fallbackButton.onclick = () => {
    if (fallbackButton.disabled) return;
    fallbackButton.disabled = true;
    Promise.resolve().then(onSummonBoss).catch(error => console.error('[BOSS_FALLBACK] resume failed', error)).finally(redraw);
  };
  return { ...view, rect };
}

function drawMonsterHead(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#6f2836';
  ctx.fillStyle = '#d74c52';
  ctx.beginPath();
  ctx.moveTo(-8, -5);
  ctx.lineTo(-11, -11);
  ctx.lineTo(-4, -8);
  ctx.quadraticCurveTo(0, -11, 4, -8);
  ctx.lineTo(11, -11);
  ctx.lineTo(8, -4);
  ctx.quadraticCurveTo(11, 8, 0, 10);
  ctx.quadraticCurveTo(-11, 8, -8, -5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff0bd';
  ctx.beginPath();
  ctx.moveTo(-5, -2); ctx.lineTo(-1, -1); ctx.lineTo(-4, 2); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, -2); ctx.lineTo(1, -1); ctx.lineTo(4, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#592531';
  ctx.beginPath();
  ctx.ellipse(0, 4.5, 2.2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCombatProgressHud(ctx, { state, images, worldToCanvas } = {}) {
  const progress = state?.globals?.ContinuousCombatStage;
  if (!progress || state?.globals?.CombatBossFallbackVisible) return null;

  const rect = combatProgressHudRect(worldToCanvas);
  const scale = rect.w / (HUD.right - HUD.left);
  const chapterX = rect.x + rect.w / 2;
  const chapterY = rect.y + 11 * scale;
  const trackX = rect.x + 11 * scale;
  const trackY = rect.y + 31 * scale;
  const bossX = rect.x + rect.w - 11 * scale;
  const bossSize = 16 * scale;
  const trackEnd = bossX;
  const trackWidth = trackEnd - trackX;
  const headSize = 16 * scale;
  const bossReady = progress.bossActive === true || progress.bossAvailable === true;
  const waveCount = continuousCombatWavesForStage(progress.region, progress.stage);
  const wave = Math.max(1, Math.min(waveCount, Math.floor(Number(progress.wave) || 1)));
  const completed = bossReady ? waveCount : wave - 1;
  const wavePacks = bossReady ? { fraction: 0 } : deriveContinuousCombatWavePackProgress(progress, state?.entities);
  const progressPosition = Math.min(waveCount, completed + wavePacks.fraction);
  const bossTimeRemainingSec = continuousCombatBossTimeRemaining(progress, state?.globals?.time);
  const bossTimeFraction = bossTimeRemainingSec == null ? null : bossTimeRemainingSec / Number(progress.bossTimeLimitSec || CONTINUOUS_COMBAT_BOSS_TIME_LIMIT_SEC);
  const label = `Chapter ${Math.max(1, Number(progress.region) || 1)}`;
  const portrait = images?.CombatProgressHondoHead;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `700 ${11 * scale}px system-ui, sans-serif`;
  ctx.lineWidth = Math.max(2, 2.2 * scale);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2d281d';
  ctx.fillStyle = '#ffd957';
  ctx.strokeText(label, chapterX, chapterY);
  ctx.fillText(label, chapterX, chapterY);

  const railHeight = 5 * scale;
  const railRadius = railHeight / 2;
  ctx.beginPath();
  ctx.moveTo(trackX + railRadius, trackY - railRadius);
  ctx.lineTo(trackEnd - railRadius, trackY - railRadius);
  ctx.arcTo(trackEnd, trackY - railRadius, trackEnd, trackY, railRadius);
  ctx.arcTo(trackEnd, trackY + railRadius, trackEnd - railRadius, trackY + railRadius, railRadius);
  ctx.lineTo(trackX + railRadius, trackY + railRadius);
  ctx.arcTo(trackX, trackY + railRadius, trackX, trackY, railRadius);
  ctx.arcTo(trackX, trackY - railRadius, trackX + railRadius, trackY - railRadius, railRadius);
  ctx.closePath();
  ctx.fillStyle = '#253338';
  ctx.fill();
  ctx.save();
  ctx.clip();
  const fillFraction = bossTimeFraction ?? progressPosition / waveCount;
  if (fillFraction > 0) {
    ctx.fillStyle = bossTimeFraction == null ? '#55d4be' : '#5dbbff';
    ctx.fillRect(trackX, trackY - railRadius, trackWidth * fillFraction, railHeight);
  }
  ctx.restore();
  ctx.lineWidth = Math.max(1, scale);
  ctx.strokeStyle = '#f6ecd0';
  ctx.stroke();
  ctx.lineWidth = Math.max(1, 20 / waveCount) * scale;
  for (let notch = 1; bossTimeFraction == null && notch < waveCount; notch += 1) {
    const x = trackX + trackWidth * notch / waveCount;
    ctx.beginPath();
    ctx.moveTo(x, trackY - railRadius * 1.5);
    ctx.lineTo(x, trackY + railRadius * 1.5);
    ctx.strokeStyle = progressPosition >= notch ? '#55d4be' : '#243237';
    ctx.stroke();
  }

  const markerX = Math.min(trackX + trackWidth * (progressPosition / waveCount), bossX - headSize - 2 * scale);
  const markerY = trackY;
  ctx.fillStyle = '#f4d55d';
  ctx.beginPath();
  ctx.arc(markerX, markerY, headSize * 0.57, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(markerX, markerY, headSize * 0.47, 0, Math.PI * 2);
  ctx.clip();
  if (portrait) {
    ctx.drawImage(portrait, markerX - headSize * 0.48, markerY - headSize * 0.48, headSize * 0.96, headSize * 0.96);
  }
  ctx.restore();
  drawMonsterHead(ctx, bossX, trackY, bossSize);
  ctx.restore();

  return { ...rect, label, labelX: chapterX, railCenterX: (trackX + trackEnd) / 2, completedWaves: completed, waveCount, waveProgress: wavePacks.fraction, progressPosition, bossReady, bossTimeRemainingSec };
}
