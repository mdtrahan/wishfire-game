const HUD = Object.freeze({ left: 127.5, top: 4, right: 232.5, bottom: 44 });

export function combatProgressHudRect(worldToCanvas) {
  const topLeft = worldToCanvas(HUD.left, HUD.top);
  const bottomRight = worldToCanvas(HUD.right, HUD.bottom);
  return { x: topLeft.x, y: topLeft.y, w: bottomRight.x - topLeft.x, h: bottomRight.y - topLeft.y };
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
  if (!progress) return null;

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
  const bossReady = progress.bossAvailable === true || progress.bossActive === true;
  const wave = Math.max(1, Math.min(4, Math.floor(Number(progress.wave) || 1)));
  const completed = bossReady ? 4 : wave - 1;
  const label = `Chapter ${Math.max(1, Number(progress.region) || 1)}-${Math.max(1, Number(progress.stage) || 1)}`;
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
  if (completed > 0) {
    ctx.fillStyle = '#55d4be';
    ctx.fillRect(trackX, trackY - railRadius, trackWidth * completed / 4, railHeight);
  }
  ctx.restore();
  ctx.lineWidth = Math.max(1, scale);
  ctx.strokeStyle = '#f6ecd0';
  ctx.stroke();
  ctx.lineWidth = Math.max(2, 2 * scale) * 1.5;
  for (let notch = 1; notch < 4; notch += 1) {
    const x = trackX + trackWidth * notch / 4;
    ctx.beginPath();
    ctx.moveTo(x, trackY - railRadius * 1.5);
    ctx.lineTo(x, trackY + railRadius * 1.5);
    ctx.strokeStyle = completed >= notch ? '#55d4be' : '#243237';
    ctx.stroke();
  }

  const markerX = Math.min(trackX + trackWidth * (completed / 4), bossX - headSize - 2 * scale);
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

  return { ...rect, label, labelX: chapterX, railCenterX: (trackX + trackEnd) / 2, completedWaves: completed, bossReady };
}
