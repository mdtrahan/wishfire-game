import { renderNarrativeScene, renderStoryChapterMap } from './renderNarrativeScene.js';

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

export function wrapCanvasText(ctx, text, maximumWidth, maximumLines = 3) {
  const value = String(text || '').trim();
  const maximum = Math.max(1, Number(maximumWidth) || 1);
  const lineLimit = Math.max(1, Math.floor(Number(maximumLines) || 1));
  if (!value) return { lines: [''], truncated: false };
  if (ctx.measureText(value).width <= maximum) return { lines: [value], truncated: false };
  const words = value.split(/\s+/);
  const lines = [];
  let current = '';
  for (let index = 0; index < words.length; index += 1) {
    const candidate = current ? `${current} ${words[index]}` : words[index];
    if (ctx.measureText(candidate).width <= maximum) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = words[index];
    if (lines.length === lineLimit - 1) {
      const remainder = [current, ...words.slice(index + 1)].join(' ');
      const fitted = fitCanvasText(ctx, remainder, maximum);
      lines.push(fitted);
      return { lines, truncated: fitted !== remainder };
    }
  }
  if (current) lines.push(current);
  return { lines: lines.slice(0, lineLimit), truncated: lines.length > lineLimit };
}

function setFittedCanvasFont(ctx, text, { weight, preferredPx, minimumPx, family, maximumWidth, layoutScale = 1 }) {
  const scale = Math.max(0.1, Number(layoutScale) || 1);
  const scaledPreferredPx = Math.max(1, preferredPx * scale);
  const scaledMinimumPx = Math.max(1, minimumPx * scale);
  ctx.font = `${weight} ${scaledPreferredPx}px ${family}`;
  const measuredWidth = typeof ctx.measureText === 'function' ? ctx.measureText(text).width : 0;
  const fittedPx = computeFittedCanvasFontSize({
    preferredPx: scaledPreferredPx,
    minimumPx: scaledMinimumPx,
    measuredWidth,
    maximumWidth,
  });
  ctx.font = `${weight} ${fittedPx}px ${family}`;
  return fittedPx;
}

function drawCenteredTextLayout(ctx, textLayout, centerX, centerY, fontPx) {
  const lineHeight = Math.max(1, fontPx * 1.2);
  const firstBaseline = centerY - ((textLayout.lines.length - 1) * lineHeight) / 2;
  textLayout.lines.forEach((line, index) => ctx.fillText(line, centerX, firstBaseline + index * lineHeight));
}

export function renderHarnessFallback(ctx, layoutId, gameState, dims) {
  const { viewWidth, viewHeight, startupFingerprintLabel, freshCombatBootstrapped } = dims;
  if (layoutId === 'storyMock' && freshCombatBootstrapped) {
    return gameState.storyEntry?.phase !== 'opening'
      ? renderStoryChapterMap(ctx, gameState, dims)
      : renderNarrativeScene(ctx, gameState, dims, gameState.storyEntry?.content);
  }
  const layoutScale = Math.max(0.1, Number(dims.layoutScale) || 1);
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = layoutId === 'storyMock' ? '#1557ff' : (layoutId === 'town' ? '#6d4b2f' : '#d52525');
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  const load = gameState.startupLoad || {};
  const startupLoading = layoutId === 'storyMock' && !freshCombatBootstrapped;
  const headline = layoutId === 'storyMock'
    ? 'Loading Chapter 1...'
    : layoutId === 'town'
      ? 'Town (tap to enter combat)'
      : 'Astral Overlay (click to return to combat)';
  const edgePadding = Math.max(1, 8 * layoutScale);
  const headlineMaximumWidth = Math.max(1, viewWidth - edgePadding * 2);
  const headlineFontPx = setFittedCanvasFont(ctx, headline, {
    weight: 600,
    preferredPx: 18,
    minimumPx: 11,
    family: 'Arial',
    maximumWidth: headlineMaximumWidth,
    layoutScale,
  });
  const headlineLayout = wrapCanvasText(ctx, headline, headlineMaximumWidth, 2);
  drawCenteredTextLayout(ctx, headlineLayout, viewWidth / 2, viewHeight / 2, headlineFontPx);

  if (startupLoading) {
    const progress = Math.max(0, Math.min(1, Number(load.progress || 0)));
    const barW = Math.min(280 * layoutScale, Math.floor(viewWidth * 0.78));
    const barH = 18 * layoutScale;
    const barX = Math.floor((viewWidth - barW) / 2);
    const barY = Math.max(24 * layoutScale, viewHeight - 66 * layoutScale);
    ctx.fillStyle = '#6a665b';
    ctx.fillRect(barX, barY, barW, barH);
    const fillW = Math.max(0, Math.round((barW - 4) * progress));
    if (fillW > 0) {
      ctx.fillStyle = '#63c3ff';
      ctx.fillRect(barX + 2, barY + 2, fillW, barH - 4);
    }
    ctx.fillStyle = '#f2f2f2';
    ctx.font = `700 ${11 * layoutScale}px Arial`;
    ctx.fillText(`${Math.round(progress * 100)}%`, viewWidth / 2, barY + barH / 2 + 3 * layoutScale);
    const loadingLabel = String(load.label || 'Loading assets...');
    const loadingMaximumWidth = Math.max(1, viewWidth - edgePadding * 2);
    const loadingFontPx = setFittedCanvasFont(ctx, loadingLabel, {
      weight: 600,
      preferredPx: 10,
      minimumPx: 8,
      family: 'Arial',
      maximumWidth: loadingMaximumWidth,
      layoutScale,
    });
    ctx.fillStyle = '#d6d6d6';
    const loadingLayout = wrapCanvasText(ctx, loadingLabel, loadingMaximumWidth, 2);
    drawCenteredTextLayout(ctx, loadingLayout, viewWidth / 2, barY - 8 * layoutScale, loadingFontPx);
  }

  if (layoutId === 'storyMock') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `500 ${10 * layoutScale}px monospace`;
    ctx.textAlign = 'left';
    const fingerprintMaximumWidth = Math.max(1, viewWidth - edgePadding * 2);
    const fingerprintText = fitCanvasText(ctx, startupFingerprintLabel, fingerprintMaximumWidth);
    ctx.fillText(fingerprintText, edgePadding, 14 * layoutScale);
  } else if (layoutId === 'town') {
    const recoveryLabel = 'Party restored. Tap to continue back into combat.';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const recoveryMaximumWidth = Math.max(1, viewWidth - edgePadding * 2);
    const recoveryFontPx = setFittedCanvasFont(ctx, recoveryLabel, {
      weight: 600,
      preferredPx: 12,
      minimumPx: 8,
      family: 'Arial',
      maximumWidth: recoveryMaximumWidth,
      layoutScale,
    });
    ctx.textAlign = 'center';
    const recoveryLayout = wrapCanvasText(ctx, recoveryLabel, recoveryMaximumWidth, 3);
    drawCenteredTextLayout(ctx, recoveryLayout, viewWidth / 2, viewHeight / 2 + 24 * layoutScale, recoveryFontPx);
  }

  ctx.textAlign = 'left';
}
