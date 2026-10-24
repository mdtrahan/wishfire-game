import { HERO_FORMATION_SLOTS } from '../../../src/core/heroFormationGeometry.mjs';

export const FORMATION_SAVE_KEY = 'wishfire.heroFormation.v4';
export const FORMATION_LEGACY_SAVE_KEY = 'wishfire.heroFormation.v3';
export const FORMATION_COLUMNS = 4;
export const FORMATION_ROWS = 3;
export const FORMATION_PRESETS = 3;
export const FORMATION_SLOTS = HERO_FORMATION_SLOTS;
export const formationCell = (row, column) => FORMATION_SLOTS.find(slot => slot.row === row && slot.column === column)?.cell;
export const openFormationCells = () => FORMATION_SLOTS.map(slot => slot.cell);
// Preserve v3's horizontal ordering as closely as the new perimeter permits.
const V3_CELLS = [2, 0, 1, 5, 3, 6, 7, 4];

export function autoFormPreset(heroes = []) {
  return { leader: heroes[0]?.id || '', cells: Object.fromEntries(heroes.slice(0, 8).map((hero, cell) => [hero.id, cell])) };
}
function sanitizePreset(raw, heroes, legacy) {
  const fallback = autoFormPreset(heroes), cells = {}, used = new Set();
  for (const hero of heroes) {
    const value = raw?.cells?.[hero.id];
    if (!Number.isInteger(value) || value < 0 || value > 7) continue;
    const cell = legacy ? V3_CELLS[value] : value;
    if (!used.has(cell)) { cells[hero.id] = cell; used.add(cell); }
  }
  for (const hero of heroes) {
    if (hero.id in cells) continue;
    const cell = openFormationCells().find(candidate => !used.has(candidate));
    if (cell == null) break;
    cells[hero.id] = cell; used.add(cell);
  }
  return { leader: heroes.some(hero => hero.id === raw?.leader) ? raw.leader : fallback.leader, cells };
}
export function sanitizeHeroFormation(raw, heroes = []) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    version: 4,
    active: Math.max(0, Math.min(FORMATION_PRESETS - 1, (Number.isFinite(source.active) ? Math.floor(source.active) : 0))),
    presets: Array.from({ length: FORMATION_PRESETS }, (_, index) => sanitizePreset(source.presets?.[index], heroes, source.version === 3)),
  };
}
export function activeFormationPreset(state) { return state.presets[state.active]; }
export function formationOccupant(preset, cell) { return Object.keys(preset.cells).find(id => preset.cells[id] === cell) || ''; }
function updateActive(state, change) {
  return { ...state, presets: state.presets.map((preset, index) => index === state.active ? change({ ...preset, cells: { ...preset.cells } }) : preset) };
}
export function placeFormationHero(state, heroId, cell) {
  const preset = activeFormationPreset(state);
  if (!(heroId in preset.cells) || !openFormationCells().includes(cell)) return state;
  return updateActive(state, next => {
    const occupant = formationOccupant(next, cell);
    if (occupant && occupant !== heroId) next.cells[occupant] = next.cells[heroId];
    next.cells[heroId] = cell;
    return next;
  });
}
export function setFormationLeader(state, heroId) {
  return heroId in activeFormationPreset(state).cells ? updateActive(state, next => ({ ...next, leader: heroId })) : state;
}
export function autoFormActive(state, heroes = []) {
  return updateActive(state, next => ({ ...next, cells: autoFormPreset(heroes).cells }));
}
export function selectFormationPreset(state, index) {
  return Number.isInteger(index) && index >= 0 && index < FORMATION_PRESETS ? { ...state, active: index } : state;
}
export function copyFormationPresetTo(state, targets = []) {
  const source = activeFormationPreset(state), wanted = new Set(targets);
  const presets = state.presets.map((preset, index) => wanted.has(index) && index !== state.active ? { leader: source.leader, cells: { ...source.cells } } : preset);
  return presets.every((preset, index) => preset === state.presets[index]) ? state : { ...state, presets };
}
export function formationSuccession(preset) {
  return [preset.leader, ...Object.keys(preset.cells).filter(id => id !== preset.leader).sort((a, b) => preset.cells[a] - preset.cells[b])].filter(Boolean);
}
export function formationPlacement(preset) {
  return Object.fromEntries(Object.entries(preset.cells).map(([id, cell]) => [id, { ...FORMATION_SLOTS[cell] }]));
}
