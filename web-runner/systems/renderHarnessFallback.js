export function computeFittedCanvasFontSize({ preferredPx, minimumPx, measuredWidth, maximumWidth }) {
  const preferred = Math.max(1, Number(preferredPx) || 1);
  const minimum = Math.min(preferred, Math.max(1, Number(minimumPx) || 1));
  const measured = Math.max(0, Number(measuredWidth) || 0);
  const maximum = Math.max(1, Number(maximumWidth) || 1);
  if (measured <= maximum || measured === 0) return preferred;
  return Math.max(minimum, preferred * (maximum / measured));
}

export function fitCanvasText(ctx, text, maximumWidth) {
  const value = String(text || '');
  const maximum = Math.max(1, Number(maximumWidth) || 1);
  if (!ctx || typeof ctx.measureText !== 'function' || ctx.measureText(value).width <= maximum) return value;
  const ellipsis = '…';
  let end = value.length;
  while (end > 0 && ctx.measureText(`${value.slice(0, end)}${ellipsis}`).width > maximum) end -= 1;
  return end > 0 ? `${value.slice(0, end)}${ellipsis}` : ellipsis;
}

function setFittedCanvasFont(ctx, text, { weight, preferredPx, minimumPx, family, maximumWidth }) {
  ctx.font = `${weight} ${preferredPx}px ${family}`;
  const measuredWidth = typeof ctx.measureText === 'function' ? ctx.measureText(text).width : 0;
  const fittedPx = computeFittedCanvasFontSize({ preferredPx, minimumPx, measuredWidth, maximumWidth });
  ctx.font = `${weight} ${fittedPx}px ${family}`;
  return fittedPx;
}

export function renderHarnessFallback(ctx, layoutId, gameState, dims) {
  const { viewWidth, viewHeight, startupFingerprintLabel, freshCombatBootstrapped } = dims;
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = layoutId === 'storyMock' ? '#1557ff' : (layoutId === 'town' ? '#6d4b2f' : '#d52525');
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  const load = gameState.startupLoad || {};
  const startupLoading = layoutId === 'storyMock' && !freshCombatBootstrapped;
  const headline = layoutId === 'storyMock'
    ? (startupLoading ? 'Story Mock (loading...)' : 'Story Mock (tap to enter town)')
    : layoutId === 'town'
      ? 'Town (tap to enter combat)'
      : 'Astral Overlay (click to return to combat)';
  setFittedCanvasFont(ctx, headline, {
    weight: 600,
    preferredPx: 18,
    minimumPx: 11,
    family: 'Arial',
    maximumWidth: Math.max(1, viewWidth - 16),
  });
  ctx.fillText(headline, viewWidth / 2, viewHeight / 2);

  if (startupLoading) {
    const progress = Math.max(0, Math.min(1, Number(load.progress || 0)));
    const barW = Math.min(280, Math.floor(viewWidth * 0.78));
    const barH = 18;
    const barX = Math.floor((viewWidth - barW) / 2);
    const barY = Math.max(24, viewHeight - 66);
    ctx.fillStyle = '#6a665b';
    ctx.fillRect(barX, barY, barW, barH);
    const fillW = Math.max(0, Math.round((barW - 4) * progress));
    if (fillW > 0) {
      ctx.fillStyle = '#63c3ff';
      ctx.fillRect(barX + 2, barY + 2, fillW, barH - 4);
    }
    ctx.fillStyle = '#f2f2f2';
    ctx.font = '700 11px Arial';
    ctx.fillText(`${Math.round(progress * 100)}%`, viewWidth / 2, barY + barH / 2 + 3);
    const loadingLabel = String(load.label || 'Loading assets...');
    setFittedCanvasFont(ctx, loadingLabel, {
      weight: 600,
      preferredPx: 10,
      minimumPx: 8,
      family: 'Arial',
      maximumWidth: Math.max(1, viewWidth - 16),
    });
    ctx.fillStyle = '#d6d6d6';
    ctx.fillText(loadingLabel, viewWidth / 2, barY - 8);
  }

  if (layoutId === 'storyMock') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '500 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(fitCanvasText(ctx, startupFingerprintLabel, Math.max(1, viewWidth - 16)), 8, 14);
  } else if (layoutId === 'town') {
    const recoveryLabel = 'Party restored. Tap to continue back into combat.';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    setFittedCanvasFont(ctx, recoveryLabel, {
      weight: 600,
      preferredPx: 12,
      minimumPx: 8,
      family: 'Arial',
      maximumWidth: Math.max(1, viewWidth - 16),
    });
    ctx.textAlign = 'center';
    ctx.fillText(recoveryLabel, viewWidth / 2, viewHeight / 2 + 24);
  }

  ctx.textAlign = 'left';
}
