// Persists the hero formation board (ORKA-9ee phase 2) and publishes the active leader and
// succession order to globals for combat. Writes only on explicit player changes.
import { HERO_DEFINITIONS } from '../src/core/heroDefinitions.mjs';
import {
  FORMATION_SAVE_KEY, sanitizeHeroFormation, activeFormationPreset, formationSuccession,
  placeFormationHero, setFormationLeader, autoFormActive, selectFormationPreset, copyFormationPreset,
} from '../src/core/heroFormationRules.mjs';

export const formationRoster = () => Object.values(HERO_DEFINITIONS).map(definition => ({ id: definition.key, name: definition.name, role: definition.role }));

export function createHeroFormationStore({ globals, storage, reportError = console.error }) {
  const roster = formationRoster();
  let state, storageReady = true;
  try { state = sanitizeHeroFormation(JSON.parse(storage?.getItem(FORMATION_SAVE_KEY) || 'null'), roster); }
  catch (error) { storageReady = false; reportError('Formation load failed', error); state = sanitizeHeroFormation(null, roster); }
  const nameOf = id => roster.find(hero => hero.id === id)?.name || '';
  function publish() {
    const preset = activeFormationPreset(state);
    globals.HeroFormation = state;
    globals.HeroFormationLeader = nameOf(preset.leader);
    globals.HeroFormationOrder = formationSuccession(preset).map(nameOf);
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
    state: () => state,
    place: (heroId, cell) => apply(placeFormationHero(state, heroId, cell)),
    setLeader: heroId => apply(setFormationLeader(state, heroId)),
    autoForm: () => apply(autoFormActive(state, roster)),
    selectPreset: index => apply(selectFormationPreset(state, index)),
    copyPreset: () => apply(copyFormationPreset(state)),
  };
}
