import {createHeroProgressStore} from '../src/core/heroProgression.mjs';
const KEY = 'orka.hero_progress.v2';
export function restoreHeroProgressFromStorage({fnContext}) {
  const g = fnContext.state.globals;
  if (g.HeroProgress) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    g.HeroProgress = createHeroProgressStore(raw ? JSON.parse(raw) : null);
  } catch (error) {
    g.HeroProgressStorageError = String(error);
    g.HeroProgress = createHeroProgressStore();
  }
}
export function persistHeroProgressIfDirty({stateGlobals:g}) {
  if (!g.HeroProgressDirty || g.HeroProgressStorageError) return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(g.HeroProgress));
    g.HeroProgressDirty = false;
    return true;
  } catch (error) { g.HeroProgressStorageError = String(error); return false; }
}
