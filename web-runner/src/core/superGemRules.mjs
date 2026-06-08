const SUPER_GEM_COLORS = new Set([1, 2, 3, 4, 5]);

function keyOf(r, c) {
  return `${r},${c}`;
}

export function superGemArea(size) {
  const n = Number(size || 0);
  return n > 0 ? (n * n) : 0;
}

export function isRainbowFamilyColor(color) {
  return SUPER_GEM_COLORS.has(Number(color));
}

export function buildColorGrid(gems = [], rows = 0, cols = 0) {
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
  for (const gem of gems) {
    if (!gem) continue;
    const r = Number(gem.cellR);
    const c = Number(gem.cellC);
    if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
    if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
    grid[r][c] = Number(gem.color);
  }
  return grid;
}

function squareCells(anchorR, anchorC, size) {
  const cells = [];
  for (let r = anchorR; r < anchorR + size; r += 1) {
    for (let c = anchorC; c < anchorC + size; c += 1) {
      cells.push({ r, c });
    }
  }
  return cells;
}

function classifySquare(colorGrid, cells, size) {
  if (Number(size) !== 2) return null;
  const colors = [];
  for (const cell of cells) {
    const color = colorGrid[cell.r]?.[cell.c];
    if (!Number.isFinite(color)) return null;
    colors.push(Number(color));
  }
  if (!colors.length) return null;
  const first = colors[0];
  if (SUPER_GEM_COLORS.has(first) && colors.every((v) => v === first)) {
    return { type: 'uniform', baseColor: first };
  }
  return null;
}

export function detectSuperGemClusters(colorGrid, rows, cols) {
  const taken = new Set();
  const result = [];
  let nextId = 1;
  for (const size of [2]) {
    for (let r = 0; r <= rows - size; r += 1) {
      for (let c = 0; c <= cols - size; c += 1) {
        const cells = squareCells(r, c, size);
        if (cells.some((cell) => taken.has(keyOf(cell.r, cell.c)))) continue;
        const cls = classifySquare(colorGrid, cells, size);
        if (!cls) continue;
        const id = `sg-${nextId++}`;
        for (const cell of cells) taken.add(keyOf(cell.r, cell.c));
        result.push({
          id,
          size,
          area: superGemArea(size),
          anchorR: r,
          anchorC: c,
          type: cls.type,
          baseColor: cls.baseColor,
          family: String(cls.baseColor),
          cells,
        });
      }
    }
  }
  return result;
}

export function buildSuperGemCellMap(superGems = []) {
  const map = new Map();
  for (const sg of superGems) {
    for (const cell of (sg.cells || [])) {
      map.set(keyOf(cell.r, cell.c), sg.id);
    }
  }
  return map;
}

export function pickRainbowColor(rng = Math.random) {
  const palette = [1, 2, 3, 4, 5];
  const idx = Math.floor((Number(rng()) || 0) * palette.length) % palette.length;
  return palette[idx];
}

export function decomposeSuperGem(superGem, survivingCells = [], rng = Math.random) {
  if (!superGem || !Array.isArray(survivingCells)) return [];
  if (superGem.type === 'uniform') {
    return survivingCells.map((cell) => ({ ...cell, color: Number(superGem.baseColor) }));
  }
  return survivingCells.map((cell) => ({ ...cell, color: pickRainbowColor(rng) }));
}
