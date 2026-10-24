import { HERO_DEFINITIONS } from '../src/core/heroDefinitions.mjs';
import {
  FORMATION_SAVE_KEY, FORMATION_LEGACY_SAVE_KEY, sanitizeHeroFormation, activeFormationPreset, formationSuccession,
  placeFormationHero, setFormationLeader, autoFormActive, selectFormationPreset, copyFormationPresetTo, formationPlacement,
} from '../src/core/heroFormationRules.mjs';

export const formationRoster = () => Object.values(HERO_DEFINITIONS).map(definition => ({ id: definition.key, name: definition.name, role: definition.role }));
export function createHeroFormationStore({ globals, storage, reportError = console.error }) {
  const roster = formationRoster();
  let state, storageReady = true, saved, legacy;
  try {
    saved = storage?.getItem(FORMATION_SAVE_KEY);
    if (saved == null) legacy = storage?.getItem(FORMATION_LEGACY_SAVE_KEY);
  } catch (error) { storageReady = false; reportError('Formation load failed', error); }
  try {
    const raw = JSON.parse(saved ?? legacy ?? 'null');
    state = sanitizeHeroFormation(legacy != null && raw && typeof raw === 'object' ? { ...raw, version: 3 } : raw, roster);
  }
  catch (error) { reportError('Formation data corrupt', error); state = sanitizeHeroFormation(null, roster); }
  // Write a migrated copy, preserving the v3 source even when this write fails.
  if (saved == null && legacy != null && storageReady) {
    try { storage.setItem(FORMATION_SAVE_KEY, JSON.stringify(state)); }
    catch (error) { reportError('Formation migration save failed', error); }
  }
  const nameOf = id => roster.find(hero => hero.id === id)?.name || '';
  function publish() {
    const preset = activeFormationPreset(state);
    globals.HeroFormation = state;
    globals.HeroFormationLeader = nameOf(preset.leader);
    globals.HeroFormationOrder = formationSuccession(preset).map(nameOf);
    globals.HeroFormationPlacement = Object.fromEntries(Object.entries(formationPlacement(preset)).flatMap(([id, slot]) => [[id.toLowerCase(), slot], [nameOf(id).toLowerCase(), slot]]));
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
    roster, state: () => state,
    place: (heroId, cell) => apply(placeFormationHero(state, heroId, cell)),
    setLeader: heroId => apply(setFormationLeader(state, heroId)),
    autoForm: () => apply(autoFormActive(state, roster)),
    selectPreset: index => apply(selectFormationPreset(state, index)),
    copyPreset: targets => apply(copyFormationPresetTo(state, targets)),
    save: draft => apply(sanitizeHeroFormation(draft, roster)),
  };
}
