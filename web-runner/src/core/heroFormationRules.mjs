// Hero formation board (ORKA-9ee phase 2, goals/wishfire-hero-party-screen-plan.md).
// Pure and deterministic. A 4-column x 3-row board (front, middle, back) with three presets.
// Combat reads the active preset's leader and succession order; board rows do not move
// combat geometry yet, so the authored role formation stays unchanged.

export const FORMATION_SAVE_KEY = 'wishfire.heroFormation.v1';
export const FORMATION_COLUMNS = 4;
export const FORMATION_ROWS = 3;
export const FORMATION_PRESETS = 3;
export const FORMATION_ROW_LABELS = Object.freeze(['Front', 'Middle', 'Back']);
const FRONT_ROLES = new Set(['Tank', 'Damage']);

const cellIndex = (row, column) => row * FORMATION_COLUMNS + column;
const validCell = cell => Number.isInteger(cell) && cell >= 0 && cell < FORMATION_COLUMNS * FORMATION_ROWS;

// Auto-Form: tanks and damage dealers take the front row, mages and supports the back,
// each row centred in roster order. Matches the authored combat role formation.
export function autoFormPreset(heroes = []) {
  const front = heroes.filter(hero => FRONT_ROLES.has(hero.role)), back = heroes.filter(hero => !FRONT_ROLES.has(hero.role));
  const cells = {};
  for (const [row, members] of [[0, front], [FORMATION_ROWS - 1, back]]) {
    const start = Math.max(0, Math.floor((FORMATION_COLUMNS - members.length) / 2));
    members.forEach((hero, offset) => { cells[hero.id] = cellIndex(row, Math.min(FORMATION_COLUMNS - 1, start + offset)); });
  }
  return { leader: heroes[0]?.id || '', cells };
}

function sanitizePreset(raw, heroes) {
  const fallback = autoFormPreset(heroes);
  const cells = {}, used = new Set();
  for (const hero of heroes) {
    const cell = Number(raw?.cells?.[hero.id]);
    if (validCell(cell) && !used.has(cell)) { cells[hero.id] = cell; used.add(cell); }
  }
  for (const hero of heroes) {
    if (hero.id in cells) continue;
    let cell = fallback.cells[hero.id];
    if (used.has(cell)) cell = [...Array(FORMATION_COLUMNS * FORMATION_ROWS).keys()].find(candidate => !used.has(candidate));
    cells[hero.id] = cell; used.add(cell);
  }
  const leader = heroes.some(hero => hero.id === raw?.leader) ? raw.leader : fallback.leader;
  return { leader, cells };
}

// `heroes` is the canonical roster: [{ id, name, role }].
export function sanitizeHeroFormation(raw, heroes = []) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const presets = Array.from({ length: FORMATION_PRESETS }, (_, index) => sanitizePreset(source.presets?.[index], heroes));
  const active = Math.max(0, Math.min(FORMATION_PRESETS - 1, Math.floor(Number(source.active) || 0)));
  return { version: 1, active, presets };
}

export function activeFormationPreset(state) { return state.presets[state.active]; }

export function formationOccupant(preset, cell) { return Object.keys(preset.cells).find(id => preset.cells[id] === cell) || ''; }

function updateActive(state, change) {
  const presets = state.presets.map((preset, index) => index === state.active ? change({ leader: preset.leader, cells: { ...preset.cells } }) : preset);
  return { ...state, presets };
}

// Moves a hero to a cell; an occupied target swaps places.
export function placeFormationHero(state, heroId, cell) {
  const preset = activeFormationPreset(state);
  if (!(heroId in preset.cells) || !validCell(cell)) return state;
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
  return updateActive(state, next => ({ leader: next.leader, cells: autoFormPreset(heroes).cells }));
}

export function selectFormationPreset(state, index) {
  const active = Math.floor(Number(index));
  return active >= 0 && active < FORMATION_PRESETS ? { ...state, active } : state;
}

// Copy duplicates the active preset into the next preset slot and switches to it.
export function copyFormationPreset(state) {
  const target = (state.active + 1) % FORMATION_PRESETS, source = activeFormationPreset(state);
  const presets = state.presets.map((preset, index) => index === target ? { leader: source.leader, cells: { ...source.cells } } : preset);
  return { ...state, presets, active: target };
}

// Leader first, then front to back, left to right. Combat hands the lead down this order on KO.
export function formationSuccession(preset) {
  const others = Object.keys(preset.cells).filter(id => id !== preset.leader).sort((a, b) => preset.cells[a] - preset.cells[b]);
  return preset.leader ? [preset.leader, ...others] : others;
}
