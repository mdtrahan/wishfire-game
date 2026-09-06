export const NARRATIVE_REFERENCE_WIDTH = 360;
export const NARRATIVE_REFERENCE_HEIGHT = 640;

export function computeNarrativeSceneViewport(viewWidth, viewHeight) {
  const width = Math.max(1, Number(viewWidth) || NARRATIVE_REFERENCE_WIDTH);
  const height = Math.max(1, Number(viewHeight) || NARRATIVE_REFERENCE_HEIGHT);
  const scale = Math.min(
    width / NARRATIVE_REFERENCE_WIDTH,
    height / NARRATIVE_REFERENCE_HEIGHT,
  );
  return {
    logicalWidth: NARRATIVE_REFERENCE_WIDTH,
    logicalHeight: NARRATIVE_REFERENCE_HEIGHT,
    scale,
    offsetX: (width - NARRATIVE_REFERENCE_WIDTH * scale) / 2,
    offsetY: (height - NARRATIVE_REFERENCE_HEIGHT * scale) / 2,
  };
}

export function transformNarrativeHitZones(hitZones, viewport) {
  return Object.fromEntries(Object.entries(hitZones).map(([key, rect]) => [
    key,
    {
      x: viewport.offsetX + rect.x * viewport.scale,
      y: viewport.offsetY + rect.y * viewport.scale,
      w: rect.w * viewport.scale,
      h: rect.h * viewport.scale,
    },
  ]));
}
