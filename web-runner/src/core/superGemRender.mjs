export function getCellWorldBounds(boardGeometry, cellC, cellR) {
  if (boardGeometry && typeof boardGeometry.getCellWorldBounds === 'function') {
    return boardGeometry.getCellWorldBounds(cellC, cellR);
  }
  const cellSize = Number(boardGeometry?.cellSize || 0);
  const gap = Number(boardGeometry?.gap || 0);
  const gx = Number(boardGeometry?.gx || 0);
  const gy = Number(boardGeometry?.gy || 0);
  return {
    x: gx + (cellC * (cellSize + gap)),
    y: gy + (cellR * (cellSize + gap)),
    w: cellSize,
    h: cellSize,
  };
}

function getLiveGemFootprint(superGem, gems = []) {
  const cells = Array.isArray(superGem?.cells) ? superGem.cells : [];
  const matched = cells
    .map((cell) => gems.find((gem) => gem && gem.cellR === cell.r && gem.cellC === cell.c))
    .filter(Boolean);
  if (!matched.length) return null;
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let minTop = Infinity;
  let maxBottom = -Infinity;
  for (const gem of matched) {
    const width = Number(gem.width || 0);
    const height = Number(gem.height || 0);
    const x = Number(gem.x || 0);
    const y = Number(gem.y || 0);
    minLeft = Math.min(minLeft, x - (width * 0.5));
    maxRight = Math.max(maxRight, x + (width * 0.5));
    minTop = Math.min(minTop, y - (height * 0.5));
    maxBottom = Math.max(maxBottom, y + (height * 0.5));
  }
  if (!Number.isFinite(minLeft) || !Number.isFinite(maxRight) || !Number.isFinite(minTop) || !Number.isFinite(maxBottom)) {
    return null;
  }
  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
  };
}

export function getSuperGemRenderRect({ superGem, gems = [], boardGeometry, layoutScale, worldToCanvas }) {
  if (!superGem || !Array.isArray(superGem.cells) || !superGem.cells.length) return null;
  const liveFootprint = getLiveGemFootprint(superGem, gems);
  if (liveFootprint && typeof worldToCanvas === 'function') {
    const topLeft = worldToCanvas(liveFootprint.left, liveFootprint.top);
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: liveFootprint.width * layoutScale,
      h: liveFootprint.height * layoutScale,
    };
  }
  const rows = superGem.cells.map((cell) => Number(cell.r));
  const cols = superGem.cells.map((cell) => Number(cell.c));
  const minR = Math.min(...rows);
  const minC = Math.min(...cols);
  const maxR = Math.max(...rows);
  const maxC = Math.max(...cols);
  const topLeft = getCellWorldBounds(boardGeometry, minC, minR);
  const bottomRight = getCellWorldBounds(boardGeometry, maxC, maxR);
  if (!topLeft || !bottomRight || typeof worldToCanvas !== 'function') return null;
  const x = topLeft.x;
  const y = topLeft.y;
  const w = ((bottomRight.x - topLeft.x) + topLeft.w) * layoutScale;
  const h = ((bottomRight.y - topLeft.y) + topLeft.h) * layoutScale;
  const p = worldToCanvas(x, y);
  return { x: p.x, y: p.y, w, h };
}

export function getSuperGemRenderImage({
  superGem,
  superGemFrameImages,
  superGemRainbowImage,
}) {
  const superFrames = Array.isArray(superGemFrameImages) ? superGemFrameImages : [];
  const colorKey = Number.isFinite(Number(superGem?.baseColor)) ? Number(superGem.baseColor) : 3;
  const image = superGem?.type === 'rainbow'
    ? (superGemRainbowImage || superFrames[colorKey] || null)
    : (superFrames[colorKey] || null);
  return image || null;
}
