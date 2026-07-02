import * as renderSystem from './renderSystem.js';
import {
  DEFAULT_WORLD_MAP_GRID,
  getWorldMapCoordinateAtPoint,
  getWorldMapGridLines,
  indexToColumnLabel,
} from '../src/core/worldMapCoordinates.mjs';

function drawLine(ctx, fromX, fromY, toX, toY) {
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}

export function drawWorldMapCoordinateGrid(ctx, lastRender, options = {}) {
  if (!options.visible || !lastRender) return { visible: false };
  const grid = options.grid || DEFAULT_WORLD_MAP_GRID;
  const xScale = lastRender.drawW / grid.width;
  const yScale = lastRender.drawH / grid.height;
  const lines = getWorldMapGridLines(grid);

  ctx.save();
  ctx.beginPath();
  ctx.rect(lastRender.drawX, lastRender.drawY, lastRender.drawW, lastRender.drawH);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
  ctx.lineWidth = 1;
  for (const worldX of lines.vertical) {
    const x = lastRender.drawX + worldX * xScale;
    drawLine(ctx, x, lastRender.drawY, x, lastRender.drawY + lastRender.drawH);
  }
  for (const worldY of lines.horizontal) {
    const y = lastRender.drawY + worldY * yScale;
    drawLine(ctx, lastRender.drawX, y, lastRender.drawX + lastRender.drawW, y);
  }

  const cellW = lastRender.drawW / grid.columns;
  const cellH = lastRender.drawH / grid.rows;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.font = `${Math.max(8, Math.min(12, Math.round(cellH * 0.34)))}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let columnIndex = 0; columnIndex < grid.columns; columnIndex += 1) {
    const column = indexToColumnLabel(columnIndex);
    for (let rowIndex = 0; rowIndex < grid.rows; rowIndex += 1) {
      const coordinate = `${column}${String(rowIndex + 1).padStart(grid.rowPad, '0')}`;
      const x = lastRender.drawX + columnIndex * cellW + cellW / 2;
      const y = lastRender.drawY + rowIndex * cellH + cellH / 2;
      ctx.fillText(coordinate, x, y);
    }
  }
  ctx.restore();

  return {
    visible: true,
    gridId: grid.id,
    columns: grid.columns,
    rows: grid.rows,
  };
}

export function renderMap(ctx, gameState, uiState, mapLayoutState, dims) {
  const viewWidth = Number(dims?.viewWidth || 0);
  const viewHeight = Number(dims?.viewHeight || 0);
  const panX = Number(mapLayoutState?.panX || 0);
  const warMeter = Math.max(0, Math.min(1, Number(mapLayoutState?.warMeter || 0)));
  const mapBackgroundImage = dims?.mapBackgroundImage || null;
  const heroLayoutSpec = dims?.heroLayoutSpec || null;
  const closeWinOvalImage = dims?.closeWinOvalImage || null;

  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = '#1f2d3d';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  let panBounds = { minX: 0, maxX: 0 };
  let clampedPanX = panX;
  let lastRender = null;

  const drawParallax = (img, scale, alpha) => {
    if (!img) return;
    const w = img.width * scale;
    const h = img.height * scale;
    const halfSpillX = Math.max(0, (w - viewWidth) / 2);
    const minPanX = -halfSpillX;
    const maxPanX = halfSpillX;
    panBounds = { minX: minPanX, maxX: maxPanX };
    clampedPanX = Math.max(minPanX, Math.min(maxPanX, panX));
    const x = ((viewWidth - w) / 2) + clampedPanX;
    const y = 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    lastRender = {
      fitMode: 'vertical',
      viewWidth,
      viewHeight,
      drawW: w,
      drawH: h,
      drawX: x,
      drawY: y,
      panX: clampedPanX,
      panY: 0,
      panBounds: { minX: minPanX, maxX: maxPanX },
      towerOverlayRendered: false,
    };
  };

  const verticalFitScale = mapBackgroundImage ? (viewHeight / mapBackgroundImage.height) : 1;
  drawParallax(mapBackgroundImage, verticalFitScale, 0.95);
  if (lastRender) {
    const xScale = lastRender.drawW / DEFAULT_WORLD_MAP_GRID.width;
    const yScale = lastRender.drawH / DEFAULT_WORLD_MAP_GRID.height;
    const centerWorldX = (viewWidth / 2 - lastRender.drawX) / xScale;
    const centerWorldY = (viewHeight / 2 - lastRender.drawY) / yScale;
    lastRender.centerCoordinate = getWorldMapCoordinateAtPoint(centerWorldX, centerWorldY);
    lastRender.gridOverlay = drawWorldMapCoordinateGrid(ctx, lastRender, {
      visible: Boolean(mapLayoutState?.showCoordinateGrid),
      grid: DEFAULT_WORLD_MAP_GRID,
    });
  }

  const meterPad = 14;
  const meterW = Math.max(180, viewWidth - (meterPad * 2));
  const meterH = 16;
  const meterX = meterPad;
  const meterY = 14;
  ctx.fillStyle = '#0f1722';
  ctx.fillRect(meterX, meterY, meterW, meterH);
  ctx.fillStyle = '#cf3d2e';
  ctx.fillRect(meterX + 2, meterY + 2, Math.max(0, (meterW - 4) * warMeter), meterH - 4);
  ctx.strokeStyle = '#d6dbe3';
  ctx.lineWidth = 1;
  ctx.strokeRect(meterX, meterY, meterW, meterH);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`War Meter ${Math.round(warMeter * 100)}%`, meterX + 6, meterY + 12);

  const closeHit = renderSystem.getHeroStyleCloseRect(viewWidth, viewHeight, heroLayoutSpec);
  renderSystem.drawHeroStyleCloseControl(ctx, closeHit, closeWinOvalImage, '#111');

  ctx.fillStyle = '#ffffff';
  ctx.font = '500 14px Arial';
  ctx.fillText('Map Layout (drag to pan)', 14, viewHeight - 18);

  return {
    panBounds,
    clampedPanX,
    closeHit,
    lastRender,
    localeHits: {
      tomesLocaleHit: null,
      artifactsLocaleHit: null,
      mountsLocaleHit: null,
      relicsLocaleHit: null,
      collectiblesLocaleHit: null,
      homesteadLocaleHit: null,
    },
  };
}
