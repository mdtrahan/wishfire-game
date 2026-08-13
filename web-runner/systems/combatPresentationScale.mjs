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

export function createCombatTextAudit({ key, group = '', text, x, y, width, maximumWidth, align = 'center' }) {
  const numericWidth = Math.max(0, Number(width) || 0);
  const anchorX = Number(x) || 0;
  const left = align === 'left' ? anchorX : (align === 'right' ? anchorX - numericWidth : anchorX - numericWidth / 2);
  return {
    key: String(key || ''),
    group: String(group || ''),
    text: String(text ?? ''),
    x: anchorX,
    y: Number(y) || 0,
    width: numericWidth,
    maximumWidth: Math.max(0, Number(maximumWidth) || 0),
    left,
    right: left + numericWidth,
  };
}
