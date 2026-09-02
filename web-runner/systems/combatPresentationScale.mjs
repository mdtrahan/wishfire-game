export const MIN_COMBAT_FONT_PX = 4;

export function computeViewportFontSize(baseSize, layoutScale, minimum = MIN_COMBAT_FONT_PX) {
  const base = Math.max(1, Number(baseSize) || 1);
  const scale = Math.max(0.01, Number(layoutScale) || 1);
  return Math.max(minimum, Math.round(base * scale));
}

export function fitCanvasText(ctx, text, options = {}) {
  const value = String(text ?? '');
  const maximumWidth = Math.max(0, Number(options.maximumWidth) || 0);
  const minimum = Math.max(1, Number(options.minimum) || MIN_COMBAT_FONT_PX);
  const weight = options.weight ? `${options.weight} ` : '';
  const family = options.family || 'sans-serif';
  let fontSize = computeViewportFontSize(options.baseSize, options.layoutScale, minimum);

  const applyFont = () => {
    ctx.font = `${weight}${fontSize}px ${family}`;
  };
  applyFont();
  while (fontSize > minimum && maximumWidth > 0 && ctx.measureText(value).width > maximumWidth) {
    fontSize -= 1;
    applyFont();
  }

  const width = ctx.measureText(value).width;
  return {
    fontSize,
    width,
    maximumWidth,
    overflow: maximumWidth > 0 && width > maximumWidth + 0.5,
  };
}
