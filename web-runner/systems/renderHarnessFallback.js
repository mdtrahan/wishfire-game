export function renderHarnessFallback(ctx, layoutId, gameState, dims) {
  const { viewWidth, viewHeight, startupFingerprintLabel, freshCombatBootstrapped } = dims;
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = layoutId === 'storyMock' ? '#1557ff' : (layoutId === 'town' ? '#6d4b2f' : '#d52525');
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 18px Arial';
  ctx.textAlign = 'center';
  const load = gameState.startupLoad || {};
  const startupLoading = layoutId === 'storyMock' && !freshCombatBootstrapped;
  ctx.fillText(
    layoutId === 'storyMock'
      ? (startupLoading ? 'Story Mock (loading...)' : 'Story Mock (tap to enter town)')
      : layoutId === 'town'
        ? 'Town (tap to enter combat)'
        : 'Astral Overlay (click to return to combat)',
    viewWidth / 2,
    viewHeight / 2,
  );

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
    ctx.font = '600 10px Arial';
    ctx.fillStyle = '#d6d6d6';
    ctx.fillText(String(load.label || 'Loading assets...'), viewWidth / 2, barY - 8);
  }

  if (layoutId === 'storyMock') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '500 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(startupFingerprintLabel, 8, 14);
  } else if (layoutId === 'town') {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Party restored. Tap to continue back into combat.', viewWidth / 2, viewHeight / 2 + 24);
  }

  ctx.textAlign = 'left';
}
