export const DEFAULT_WORLD_MAP_GRID = Object.freeze({
  id: 'genielands-v1',
  width: 1549,
  height: 1361,
  columns: 16,
  rows: 24,
  rowPad: 2,
});

function normalizeGrid(grid = DEFAULT_WORLD_MAP_GRID) {
  return {
    id: String(grid.id || DEFAULT_WORLD_MAP_GRID.id),
    width: Math.max(1, Number(grid.width || DEFAULT_WORLD_MAP_GRID.width)),
    height: Math.max(1, Number(grid.height || DEFAULT_WORLD_MAP_GRID.height)),
    columns: Math.max(1, Math.floor(Number(grid.columns || DEFAULT_WORLD_MAP_GRID.columns))),
    rows: Math.max(1, Math.floor(Number(grid.rows || DEFAULT_WORLD_MAP_GRID.rows))),
    rowPad: Math.max(1, Math.floor(Number(grid.rowPad || DEFAULT_WORLD_MAP_GRID.rowPad))),
  };
}

function clampNumber(value, min, max) {
  if (max < min) return (min + max) / 2;
  return Math.max(min, Math.min(max, value));
}

export function indexToColumnLabel(index) {
  let value = Math.floor(Number(index));
  if (!Number.isFinite(value) || value < 0) return null;
  let label = '';
  value += 1;
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

export function columnLabelToIndex(label) {
  const normalized = String(label || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return null;
  let value = 0;
  for (const char of normalized) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }
  return value - 1;
}

export function normalizeWorldMapCoordinate(coordinate, grid = DEFAULT_WORLD_MAP_GRID) {
  const spec = normalizeGrid(grid);
  const match = String(coordinate || '').trim().toUpperCase().match(/^([A-Z]+)\s*0*([0-9]+)$/);
  if (!match) return null;
  const column = match[1];
  const columnIndex = columnLabelToIndex(column);
  const row = Number(match[2]);
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= spec.columns) return null;
  if (!Number.isInteger(row) || row < 1 || row > spec.rows) return null;
  return `${column}${String(row).padStart(spec.rowPad, '0')}`;
}

export function getWorldMapCell(coordinate, grid = DEFAULT_WORLD_MAP_GRID) {
  const spec = normalizeGrid(grid);
  const normalized = normalizeWorldMapCoordinate(coordinate, spec);
  if (!normalized) return null;
  const match = normalized.match(/^([A-Z]+)([0-9]+)$/);
  const column = match[1];
  const row = Number(match[2]);
  return {
    coordinate: normalized,
    column,
    columnIndex: columnLabelToIndex(column),
    row,
    rowIndex: row - 1,
  };
}

export function getWorldMapCellBounds(coordinate, grid = DEFAULT_WORLD_MAP_GRID) {
  const spec = normalizeGrid(grid);
  const cell = getWorldMapCell(coordinate, spec);
  if (!cell) return null;
  const width = spec.width / spec.columns;
  const height = spec.height / spec.rows;
  const x = cell.columnIndex * width;
  const y = cell.rowIndex * height;
  return {
    ...cell,
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

export function getWorldMapCoordinateAtPoint(x, y, grid = DEFAULT_WORLD_MAP_GRID) {
  const spec = normalizeGrid(grid);
  const px = Number(x);
  const py = Number(y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  if (px < 0 || py < 0 || px >= spec.width || py >= spec.height) return null;
  const columnIndex = Math.min(spec.columns - 1, Math.floor(px / (spec.width / spec.columns)));
  const rowIndex = Math.min(spec.rows - 1, Math.floor(py / (spec.height / spec.rows)));
  const column = indexToColumnLabel(columnIndex);
  return `${column}${String(rowIndex + 1).padStart(spec.rowPad, '0')}`;
}

export function getWorldMapGridLines(grid = DEFAULT_WORLD_MAP_GRID) {
  const spec = normalizeGrid(grid);
  const cellWidth = spec.width / spec.columns;
  const cellHeight = spec.height / spec.rows;
  return {
    vertical: Array.from({ length: spec.columns + 1 }, (_, index) => index * cellWidth),
    horizontal: Array.from({ length: spec.rows + 1 }, (_, index) => index * cellHeight),
  };
}

export function resolveWorldMapSafeZoomCenter(coordinate, options = {}) {
  const spec = normalizeGrid(options.grid || DEFAULT_WORLD_MAP_GRID);
  const requested = getWorldMapCellBounds(coordinate, spec);
  if (!requested) return null;

  const viewWidth = Math.max(1, Number(options.viewWidth || 0));
  const viewHeight = Math.max(1, Number(options.viewHeight || 0));
  const drawW = Math.max(viewWidth, Number(options.drawW || 0));
  const drawH = Math.max(viewHeight, Number(options.drawH || 0));
  const xScale = drawW / spec.width;
  const yScale = drawH / spec.height;
  const cellW = spec.width / spec.columns;
  const cellH = spec.height / spec.rows;
  const halfWorldW = viewWidth / Math.max(1, xScale) / 2;
  const halfWorldH = viewHeight / Math.max(1, yScale) / 2;
  const minCenterX = halfWorldW;
  const maxCenterX = spec.width - halfWorldW;
  const minCenterY = halfWorldH;
  const maxCenterY = spec.height - halfWorldH;
  const epsilon = 0.000001;
  const minColumnIndex = Math.max(0, Math.ceil((minCenterX / cellW) - 0.5 - epsilon));
  const maxColumnIndex = Math.min(spec.columns - 1, Math.floor((maxCenterX / cellW) - 0.5 + epsilon));
  const minRowIndex = Math.max(0, Math.ceil((minCenterY / cellH) - 0.5 - epsilon));
  const maxRowIndex = Math.min(spec.rows - 1, Math.floor((maxCenterY / cellH) - 0.5 + epsilon));
  const centerColumnIndex = Math.round(clampNumber(requested.columnIndex, minColumnIndex, maxColumnIndex));
  const centerRowIndex = Math.round(clampNumber(requested.rowIndex, minRowIndex, maxRowIndex));
  const centerCoordinate = `${indexToColumnLabel(centerColumnIndex)}${String(centerRowIndex + 1).padStart(spec.rowPad, '0')}`;
  const center = getWorldMapCellBounds(centerCoordinate, spec);
  const centerX = center ? center.centerX : clampNumber(requested.centerX, minCenterX, maxCenterX);
  const centerY = center ? center.centerY : clampNumber(requested.centerY, minCenterY, maxCenterY);
  const drawX = clampNumber((viewWidth / 2) - (centerX * xScale), viewWidth - drawW, 0);
  const drawY = clampNumber((viewHeight / 2) - (centerY * yScale), viewHeight - drawH, 0);

  return {
    requestedCoordinate: requested.coordinate,
    centerCoordinate,
    clamped: centerCoordinate !== requested.coordinate,
    centerX,
    centerY,
    drawX,
    drawY,
    safeColumnRange: { min: minColumnIndex, max: maxColumnIndex },
    safeRowRange: { min: minRowIndex, max: maxRowIndex },
  };
}
