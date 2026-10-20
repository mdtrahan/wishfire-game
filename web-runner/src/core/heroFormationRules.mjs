// Hero formation board (ORKA-9ee phase 2, goals/wishfire-hero-party-screen-plan.md).
// Pure and deterministic. StoneAge layout: two 2x2 grids side by side in one row.
// The board faces right: the rightmost column is the frontline and columns further left sit
// further back. The right grid is open; the left grid stays locked until a hero reaches
// FORMATION_SECOND_GRID_LEVEL. Combat mirrors the board when the party travels left, and an
// empty left grid adds no depth. A locked preset refuses moves and Auto-Form.

export const FORMATION_SAVE_KEY = 'wishfire.heroFormation.v3';
export const FORMATION_GRID_SIZE = 2;
export const FORMATION_GRIDS = 2;
export const FORMATION_COLUMNS = FORMATION_GRID_SIZE * FORMATION_GRIDS;
export const FORMATION_ROWS = FORMATION_GRID_SIZE;
export const FORMATION_PRESETS = 3;
export const FORMATION_SECOND_GRID_LEVEL = 30;
const FRONT_ROLES = new Set(['Tank', 'Damage']);

export const formationCell = (row, column) => row * FORMATION_COLUMNS + column;
export const formationColumn = cell => cell % FORMATION_COLUMNS;
export const formationRow = cell => Math.floor(cell / FORMATION_COLUMNS);
export const formationGrid = cell => Math.floor(formationColumn(cell) / FORMATION_GRID_SIZE);
// Depth from the front: 0 is the rightmost (frontline) column.
export const formationDepth = cell => FORMATION_COLUMNS - 1 - formationColumn(cell);
// Grid 1 (right) opens first; grid 0 (left) is the locked back grid.
export const formationGridOpen = (grid, unlockedGrids = 1) => grid >= FORMATION_GRIDS - Math.max(1, Math.min(FORMATION_GRIDS, unlockedGrids));

export function unlockedFormationGrids(highestHeroLevel = 1) {
  return Number(highestHeroLevel) >= FORMATION_SECOND_GRID_LEVEL ? 2 : 1;
}

// Open cells in fill order: frontline (rightmost) column first, top to bottom within a column.
export function openFormationCells(unlockedGrids = 1) {
  const columns = Math.max(1, Math.min(FORMATION_GRIDS, unlockedGrids)) * FORMATION_GRID_SIZE, cells = [];
  for (let depth = 0; depth < columns; depth++) for (let row = 0; row < FORMATION_ROWS; row++) cells.push(formationCell(row, FORMATION_COLUMNS - 1 - depth));
  return cells;
}

// Auto-Form: tankier heroes (Tank, Damage) fill the rightmost frontline first, ranged heroes follow,
// each in roster order, filling the right grid before the left one.
export function autoFormPreset(heroes = [], unlockedGrids = 1) {
  const ordered = [...heroes.filter(hero => FRONT_ROLES.has(hero.role)), ...heroes.filter(hero => !FRONT_ROLES.has(hero.role))];
  const open = openFormationCells(unlockedGrids), cells = {};
  ordered.forEach((hero, index) => { if (index < open.length) cells[hero.id] = open[index]; });
  return { leader: heroes[0]?.id || '', cells };
}

function sanitizePreset(raw, heroes, unlockedGrids) {
  const fallback = autoFormPreset(heroes, unlockedGrids), open = openFormationCells(unlockedGrids);
  const cells = {}, used = new Set();
  for (const hero of heroes) {
    const cell = Number(raw?.cells?.[hero.id]);
    if (open.includes(cell) && !used.has(cell)) { cells[hero.id] = cell; used.add(cell); }
  }
  for (const hero of heroes) {
    if (hero.id in cells) continue;
    const preferred = fallback.cells[hero.id];
    const cell = preferred != null && !used.has(preferred) ? preferred : open.find(candidate => !used.has(candidate));
    if (cell == null) continue;
    cells[hero.id] = cell; used.add(cell);
  }
  const leader = heroes.some(hero => hero.id === raw?.leader) ? raw.leader : fallback.leader;
  return { leader, cells, ...(raw?.locked === true ? { locked: true } : {}) };
}

// `heroes` is the canonical roster: [{ id, name, role }].
export function sanitizeHeroFormation(raw, heroes = [], unlockedGrids = 1) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const grids = Math.max(1, Math.min(FORMATION_GRIDS, Math.floor(Number(unlockedGrids) || 1)));
  const presets = Array.from({ length: FORMATION_PRESETS }, (_, index) => sanitizePreset(source.presets?.[index], heroes, grids));
  const active = Math.max(0, Math.min(FORMATION_PRESETS - 1, Math.floor(Number(source.active) || 0)));
  return { version: 3, active, unlockedGrids: grids, presets };
}

export function activeFormationPreset(state) { return state.presets[state.active]; }

export function formationOccupant(preset, cell) { return Object.keys(preset.cells).find(id => preset.cells[id] === cell) || ''; }

function updateActive(state, change) {
  const presets = state.presets.map((preset, index) => index === state.active ? change({ ...preset, cells: { ...preset.cells } }) : preset);
  return { ...state, presets };
}

export function setFormationLocked(state, locked) {
  return updateActive(state, next => { const { locked: _, ...rest } = next; return locked ? { ...rest, locked: true } : rest; });
}

// Moves a hero to an open cell; an occupied target swaps places. Locked cells refuse.
export function placeFormationHero(state, heroId, cell) {
  const preset = activeFormationPreset(state);
  if (preset.locked || !(heroId in preset.cells) || !openFormationCells(state.unlockedGrids).includes(cell)) return state;
  return updateActive(state, next => {
    const occupant = formationOccupant(next, cell);
    if (occupant && occupant !== heroId) next.cells[occupant] = next.cells[heroId];
    next.cells[heroId] = cell;
    return next;
  });
}

export function setFormationLeader(state, heroId) {
  if (!(heroId in activeFormationPreset(state).cells)) return state;
  return updateActive(state, next => ({ ...next, leader: heroId }));
}

export function autoFormActive(state, heroes = []) {
  if (activeFormationPreset(state).locked) return state;
  return updateActive(state, next => ({ ...next, cells: autoFormPreset(heroes, state.unlockedGrids).cells }));
}

export function selectFormationPreset(state, index) {
  const active = Math.floor(Number(index));
  return active >= 0 && active < FORMATION_PRESETS ? { ...state, active } : state;
}

// Copy duplicates the active preset into the next preset slot and switches to it.
export function copyFormationPreset(state) {
  const target = (state.active + 1) % FORMATION_PRESETS, source = activeFormationPreset(state);
  const presets = state.presets.map((preset, index) => index === target ? { leader: source.leader, cells: { ...source.cells } } : preset);
  if (state.presets[target].locked) return state;
  return { ...state, presets, active: target };
}

// Leader first, then front to back (right to left), top to bottom. Combat hands the lead down this order on KO.
export function formationSuccession(preset) {
  const order = id => formationDepth(preset.cells[id]) * FORMATION_ROWS + formationRow(preset.cells[id]);
  const others = Object.keys(preset.cells).filter(id => id !== preset.leader).sort((a, b) => order(a) - order(b));
  return preset.leader ? [preset.leader, ...others] : others;
}

// Combat placement per hero: depth 0 is the frontline column; row 0 is the upper lane.
// Depth is absolute from the front, so an empty back grid adds no space.
export function formationPlacement(preset) {
  return Object.fromEntries(Object.entries(preset.cells).map(([id, cell]) => [id, { depth: formationDepth(cell), row: formationRow(cell) }]));
}
