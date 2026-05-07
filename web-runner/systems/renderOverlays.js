export function drawStartupLoadingFrame({ ctx, canvas, phase, progress, label }) {
  const drawRoundedRect = (x, y, rw, rh, radius, fill, stroke = null) => {
    const rr = Math.max(0, Math.min(radius, rw / 2, rh / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, rw, rh, rr);
    } else {
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + rw - rr, y);
      ctx.quadraticCurveTo(x + rw, y, x + rw, y + rr);
      ctx.lineTo(x + rw, y + rh - rr);
      ctx.quadraticCurveTo(x + rw, y + rh, x + rw - rr, y + rh);
      ctx.lineTo(x + rr, y + rh);
      ctx.quadraticCurveTo(x, y + rh, x, y + rh - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
    }
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  };

  const w = canvas.width;
  const h = canvas.height;
  const normalizedProgress = Math.max(0, Math.min(1, Number(progress || 0)));
  const phaseLabel = String(phase || 'Initializing runtime...');
  const loadingLabel = String(label || 'Loading assets...');

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const logoY = Math.round(h * 0.32);
  ctx.fillStyle = '#3f3f3f';
  ctx.font = '900 26px Arial Black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Puzzle RPG', w / 2, logoY);

  ctx.fillStyle = '#7a7a7a';
  ctx.font = '700 12px Arial';
  ctx.fillText(loadingLabel, w / 2, logoY + 28);

  const barW = Math.min(300, Math.floor(w * 0.7));
  const barH = 18;
  const barX = Math.floor((w - barW) / 2);
  const barY = Math.floor(h * 0.56);
  drawRoundedRect(barX, barY, barW, barH, 9, '#6a665b', null);
  const fillW = Math.max(0, Math.round((barW - 4) * normalizedProgress));
  if (fillW > 0) {
    drawRoundedRect(barX + 2, barY + 2, fillW, barH - 4, 7, '#63c3ff', null);
  }

  ctx.fillStyle = '#f2f2f2';
  ctx.font = '700 11px Arial';
  ctx.fillText(`${Math.round(normalizedProgress * 100)}%`, w / 2, barY + barH / 2 + 0.5);
  ctx.font = '600 10px Arial';
  ctx.fillStyle = '#8f8f8f';
  ctx.fillText(phaseLabel, w / 2, barY + 26);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}
