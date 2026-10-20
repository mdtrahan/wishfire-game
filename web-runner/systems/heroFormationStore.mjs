// Persists the hero formation board (ORKA-9ee phase 2) and publishes the active leader and
// succession order to globals for combat. Writes only on explicit player changes.
import { HERO_DEFINITIONS } from '../src/core/heroDefinitions.mjs';
import {
  FORMATION_SAVE_KEY, sanitizeHeroFormation, activeFormationPreset, formationSuccession,
  placeFormationHero, setFormationLeader, autoFormActive, selectFormationPreset, copyFormationPreset,
  unlockedFormationGrids, formationPlacement,
} from '../src/core/heroFormationRules.mjs';

export const formationRoster = () => Object.values(HERO_DEFINITIONS).map(definition => ({ id: definition.key, name: definition.name, role: definition.role }));

export function createHeroFormationStore({ globals, storage, reportError = console.error }) {
  const roster = formationRoster();
  const grids = () => unlockedFormationGrids(Math.max(1, ...roster.map(hero => Number(globals.HeroProgress?.heroes?.[hero.id]?.currentLevel) || 1)));
  let state, storageReady = true;
  try { state = sanitizeHeroFormation(JSON.parse(storage?.getItem(FORMATION_SAVE_KEY) || 'null'), roster, grids()); }
  catch (error) { storageReady = false; reportError('Formation load failed', error); state = sanitizeHeroFormation(null, roster, grids()); }
  const nameOf = id => roster.find(hero => hero.id === id)?.name || '';
  function publish() {
    const preset = activeFormationPreset(state), placement = formationPlacement(preset);
    globals.HeroFormation = state;
    globals.HeroFormationLeader = nameOf(preset.leader);
    globals.HeroFormationOrder = formationSuccession(preset).map(nameOf);
    // Keyed by lowercase save key and display name so combat actors resolve either alias.
    globals.HeroFormationPlacement = Object.fromEntries(Object.entries(placement).flatMap(([id, slot]) => [[id.toLowerCase(), slot], [nameOf(id).toLowerCase(), slot]]));
  }
  // The right grid unlocks with hero level; re-sanitize in memory (no write) when that changes.
  function current() {
    const unlocked = grids();
    if (unlocked !== state.unlockedGrids) { state = sanitizeHeroFormation(state, roster, unlocked); publish(); }
    return state;
  }
  function apply(next) {
    if (next === state || JSON.stringify(next) === JSON.stringify(state)) return { ok: true, state };
    if (!storageReady || !storage) return { ok: false, reason: 'save_failed', state };
    try { storage.setItem(FORMATION_SAVE_KEY, JSON.stringify(next)); }
    catch (error) { reportError('Formation save failed', error); return { ok: false, reason: 'save_failed', state }; }
    state = next; publish();
    return { ok: true, state };
  }
  publish();
  return {
    roster,
    state: current,
    place: (heroId, cell) => apply(placeFormationHero(current(), heroId, cell)),
    setLeader: heroId => apply(setFormationLeader(current(), heroId)),
    autoForm: () => apply(autoFormActive(current(), roster)),
    selectPreset: index => apply(selectFormationPreset(current(), index)),
    copyPreset: () => apply(copyFormationPreset(current())),
  };
}
