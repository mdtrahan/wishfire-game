import * as renderSystem from './renderSystem.js';
import {
  DEFAULT_WORLD_MAP_GRID,
  getWorldMapCoordinateAtPoint,
  getWorldMapCellBounds,
  getWorldMapGridLines,
  indexToColumnLabel,
} from '../src/core/worldMapCoordinates.mjs';
import {
  WORLD_MAP_CAVE_IMAGE_SIZE,
  WORLD_MAP_CAVE_INSTANCES,
} from '../src/core/worldMapCaveInstances.mjs';
import {
  WORLD_MAP_PORTAL_IMAGE_HEIGHT,
  WORLD_MAP_PORTAL_IMAGE_WIDTH,
  WORLD_MAP_PORTAL_INSTANCES,
  WORLD_MAP_PORTAL_SHADOW,
} from '../src/core/worldMapPortalInstances.mjs';
import {
  WORLD_MAP_TOWER_IMAGE_HEIGHT,
  WORLD_MAP_TOWER_IMAGE_WIDTH,
  WORLD_MAP_TOWER_INSTANCES,
  WORLD_MAP_TOWER_RENDER_OFFSET_Y,
  resolveWorldMapTowerPoint,
} from '../src/core/worldMapTowerInstances.mjs';

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

export function drawWorldMapCaves(ctx, lastRender, caveImage, options = {}) {
  if (!lastRender || !caveImage) {
    return { count: 0, instances: [] };
  }
  const grid = options.grid || DEFAULT_WORLD_MAP_GRID;
  const imageSize = Math.max(1, Number(options.imageSize || WORLD_MAP_CAVE_IMAGE_SIZE));
  const caves = Array.isArray(options.instances) ? options.instances : WORLD_MAP_CAVE_INSTANCES;
  const xScale = lastRender.drawW / grid.width;
  const yScale = lastRender.drawH / grid.height;
  const rendered = [];

  ctx.save();
  ctx.beginPath();
  ctx.rect(lastRender.drawX, lastRender.drawY, lastRender.drawW, lastRender.drawH);
  ctx.clip();
  for (const cave of caves) {
    const bounds = getWorldMapCellBounds(cave?.coordinate, grid);
    if (!bounds) continue;
    const centerX = lastRender.drawX + bounds.centerX * xScale;
    const centerY = lastRender.drawY + bounds.centerY * yScale;
    const drawX = centerX - imageSize / 2;
    const drawY = centerY - imageSize / 2;
    ctx.drawImage(caveImage, drawX, drawY, imageSize, imageSize);
    rendered.push({
      id: cave.id,
      coordinate: bounds.coordinate,
      centerX,
      centerY,
      drawX,
      drawY,
      drawW: imageSize,
      drawH: imageSize,
    });
  }
  ctx.restore();

  return {
    count: rendered.length,
    imageSize,
    instances: rendered,
  };
}

export function drawWorldMapPortals(ctx, lastRender, portalImage, options = {}) {
  if (!lastRender || !portalImage) {
    return { count: 0, instances: [] };
  }
  const grid = options.grid || DEFAULT_WORLD_MAP_GRID;
  const imageWidth = Math.max(1, Number(options.imageWidth || WORLD_MAP_PORTAL_IMAGE_WIDTH));
  const imageHeight = Math.max(1, Number(options.imageHeight || WORLD_MAP_PORTAL_IMAGE_HEIGHT));
  const shadow = options.shadow || WORLD_MAP_PORTAL_SHADOW;
  const portals = Array.isArray(options.instances) ? options.instances : WORLD_MAP_PORTAL_INSTANCES;
  const xScale = lastRender.drawW / grid.width;
  const yScale = lastRender.drawH / grid.height;
  const rendered = [];

  ctx.save();
  ctx.beginPath();
  ctx.rect(lastRender.drawX, lastRender.drawY, lastRender.drawW, lastRender.drawH);
  ctx.clip();
  for (const portal of portals) {
    const bounds = getWorldMapCellBounds(portal?.coordinate, grid);
    if (!bounds) continue;
    const centerX = lastRender.drawX + bounds.centerX * xScale;
    const centerY = lastRender.drawY + bounds.centerY * yScale;
    const drawX = centerX - imageWidth / 2;
    const drawY = centerY - imageHeight / 2;
    if (shadow?.floorColor) {
      const floorBlur = Math.max(0, Number(shadow.floorBlur || 0));
      ctx.save();
      ctx.filter = floorBlur > 0 ? `blur(${floorBlur}px)` : 'none';
      ctx.fillStyle = shadow.floorColor;
      ctx.beginPath();
      ctx.ellipse(
        centerX,
        centerY + Number(shadow.floorOffsetY || 0),
        Math.max(1, Number(shadow.floorWidth || 1)) / 2,
        Math.max(1, Number(shadow.floorHeight || 1)) / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = shadow?.color || 'transparent';
    ctx.shadowBlur = Math.max(0, Number(shadow?.blur || 0));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Number(shadow?.offsetY || 0);
    ctx.drawImage(portalImage, drawX, drawY, imageWidth, imageHeight);
    ctx.restore();
    rendered.push({
      id: portal.id,
      coordinate: bounds.coordinate,
      centerX,
      centerY,
      drawX,
      drawY,
      drawW: imageWidth,
      drawH: imageHeight,
      shadow,
    });
  }
  ctx.restore();

  return {
    count: rendered.length,
    imageWidth,
    imageHeight,
    instances: rendered,
  };
}

function getWorldMapTowerImage(towerImages, variant) {
  if (!towerImages) return null;
  if (typeof towerImages === 'object' && !('width' in towerImages)) {
    return towerImages[variant] || null;
  }
  return towerImages;
}

export function drawWorldMapTowers(ctx, lastRender, towerImages, options = {}) {
  if (!lastRender || !towerImages) {
    return { count: 0, instances: [] };
  }
  const grid = options.grid || DEFAULT_WORLD_MAP_GRID;
  const imageWidth = Math.max(1, Number(options.imageWidth || WORLD_MAP_TOWER_IMAGE_WIDTH));
  const imageHeight = Math.max(1, Number(options.imageHeight || WORLD_MAP_TOWER_IMAGE_HEIGHT));
  const towers = Array.isArray(options.instances) ? options.instances : WORLD_MAP_TOWER_INSTANCES;
  const xScale = lastRender.drawW / grid.width;
  const yScale = lastRender.drawH / grid.height;
  const rendered = [];

  ctx.save();
  ctx.beginPath();
  ctx.rect(lastRender.drawX, lastRender.drawY, lastRender.drawW, lastRender.drawH);
  ctx.clip();
  for (const tower of towers) {
    const point = resolveWorldMapTowerPoint(tower, grid);
    if (!point) continue;
    const towerImage = getWorldMapTowerImage(towerImages, point.variant);
    if (!towerImage) continue;
    const centerX = lastRender.drawX + point.centerX * xScale;
    const centerY = lastRender.drawY + point.centerY * yScale + WORLD_MAP_TOWER_RENDER_OFFSET_Y;
    const drawX = centerX - imageWidth / 2;
    const drawY = centerY - imageHeight / 2;
    ctx.drawImage(towerImage, drawX, drawY, imageWidth, imageHeight);
    rendered.push({
      id: tower.id,
      coordinate: point.coordinate,
      anchorCoordinates: point.anchorCoordinates,
      placement: point.placement,
      variant: point.variant,
      centerX,
      centerY,
      drawX,
      drawY,
      drawW: imageWidth,
      drawH: imageHeight,
    });
  }
  ctx.restore();

  return {
    count: rendered.length,
    imageWidth,
    imageHeight,
    instances: rendered,
  };
}

export function renderMap(ctx, gameState, uiState, mapLayoutState, dims) {
  const viewWidth = Number(dims?.viewWidth || 0);
  const viewHeight = Number(dims?.viewHeight || 0);
  const panX = Number(mapLayoutState?.panX || 0);
  const mapBackgroundImage = dims?.mapBackgroundImage || null;
  const mapCaveImage = dims?.mapCaveImage || null;
  const mapPortalImage = dims?.mapPortalImage || null;
  const mapTowerImages = dims?.mapTowerImages || null;
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
    lastRender.caves = drawWorldMapCaves(ctx, lastRender, mapCaveImage, {
      grid: DEFAULT_WORLD_MAP_GRID,
    });
    lastRender.portals = drawWorldMapPortals(ctx, lastRender, mapPortalImage, {
      grid: DEFAULT_WORLD_MAP_GRID,
    });
    lastRender.towers = drawWorldMapTowers(ctx, lastRender, mapTowerImages, {
      grid: DEFAULT_WORLD_MAP_GRID,
    });
    lastRender.gridOverlay = drawWorldMapCoordinateGrid(ctx, lastRender, {
      visible: Boolean(mapLayoutState?.showCoordinateGrid),
      grid: DEFAULT_WORLD_MAP_GRID,
    });
  }

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
