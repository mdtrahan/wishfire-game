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
