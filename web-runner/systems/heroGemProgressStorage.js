const HERO_GEM_PROGRESS_STORAGE_KEY = 'orka.hero_gem_progress.v1';

export function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function readPersistedHeroGemProgress() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(HERO_GEM_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writePersistedHeroGemProgress(snapshot) {
  if (!canUseLocalStorage() || !snapshot || typeof snapshot !== 'object') return false;
  try {
    window.localStorage.setItem(HERO_GEM_PROGRESS_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function restoreHeroGemProgressFromStorage({ callFunctionWithContext, fnContext, syncFromGlobals }) {
  const snapshot = readPersistedHeroGemProgress();
  if (!snapshot) return false;
  callFunctionWithContext(fnContext, 'LoadHeroGemProgressSnapshot', snapshot);
  syncFromGlobals();
  return true;
}

export function persistHeroGemProgressIfDirty({
  stateGlobals,
  callFunctionWithContext,
  fnContext,
}) {
  if (!stateGlobals.HeroGemProgressDirty) return false;
  const snapshot = callFunctionWithContext(fnContext, 'GetHeroGemProgressSnapshot');
  const wrote = writePersistedHeroGemProgress(snapshot);
  if (wrote) {
    stateGlobals.HeroGemProgressDirty = 0;
    stateGlobals.HeroGemProgressPersistedAt = Date.now();
  }
  return wrote;
}
