export function getAppViewport(win = window) {
  const docEl = win.document && win.document.documentElement;
  const visualViewport = win.visualViewport;
  const width = Math.max(1, Math.floor(
    Number(visualViewport && visualViewport.width) ||
    Number(win.innerWidth) ||
    Number(docEl && docEl.clientWidth) ||
    360,
  ));
  const height = Math.max(1, Math.floor(
    Number(visualViewport && visualViewport.height) ||
    Number(win.innerHeight) ||
    Number(docEl && docEl.clientHeight) ||
    640,
  ));
  return { width, height };
}

export function computeContainedStageSize({ viewportWidth, viewportHeight, layoutW, layoutH }) {
  const sourceW = Math.max(1, Number(layoutW) || 360);
  const sourceH = Math.max(1, Number(layoutH) || 640);
  const viewportW = Math.max(1, Number(viewportWidth) || sourceW);
  const viewportH = Math.max(1, Number(viewportHeight) || sourceH);
  const ratio = sourceW / sourceH;
  let width = Math.min(viewportW, viewportH * ratio);
  let height = width / ratio;
  if (height > viewportH) {
    height = viewportH;
    width = height * ratio;
  }
  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
  };
}

export function resizeCanvasToContainedViewport({ canvas, layoutW, layoutH, win = window }) {
  const viewport = getAppViewport(win);
  const stage = computeContainedStageSize({
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    layoutW,
    layoutH,
  });
  const dpr = Math.max(1, Number(win.devicePixelRatio) || 1);
  canvas.style.width = `${stage.width}px`;
  canvas.style.height = `${stage.height}px`;
  canvas.width = Math.max(1, Math.round(stage.width * dpr));
  canvas.height = Math.max(1, Math.round(stage.height * dpr));
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const logicalW = canvas.width / dpr;
  const logicalH = canvas.height / dpr;
  const scaleX = logicalW / Math.max(1, Number(layoutW) || 360);
  const scaleY = logicalH / Math.max(1, Number(layoutH) || 640);
  const layoutScale = Math.min(scaleX, scaleY);

  return {
    dpr,
    layoutScale,
    layoutOffsetX: (logicalW - (Number(layoutW) || 360) * layoutScale) / 2,
    layoutOffsetY: (logicalH - (Number(layoutH) || 640) * layoutScale) / 2,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    stageWidth: stage.width,
    stageHeight: stage.height,
  };
}

export function addAppViewportResizeListener(handler, win = window) {
  win.addEventListener('resize', handler);
  const visualViewport = win.visualViewport;
  if (visualViewport && typeof visualViewport.addEventListener === 'function') {
    visualViewport.addEventListener('resize', handler);
  }
  return () => {
    win.removeEventListener('resize', handler);
    if (visualViewport && typeof visualViewport.removeEventListener === 'function') {
      visualViewport.removeEventListener('resize', handler);
    }
  };
}

export function createAppViewportRuntime({
  canvas,
  layoutW,
  layoutH,
  onMetrics,
  onResize,
  win = window,
} = {}) {
  function resizeCanvas() {
    const metrics = resizeCanvasToContainedViewport({ canvas, layoutW, layoutH, win });
    if (typeof onMetrics === 'function') onMetrics(metrics);
    if (typeof win !== 'undefined') {
      win.__orkaAppViewport = metrics;
    }
    return metrics;
  }

  resizeCanvas();

  const handleWindowResize = () => {
    const metrics = resizeCanvas();
    if (typeof onResize === 'function') onResize(metrics);
  };

  return {
    resizeCanvas,
    handleWindowResize,
    teardown: addAppViewportResizeListener(handleWindowResize, win),
  };
}
