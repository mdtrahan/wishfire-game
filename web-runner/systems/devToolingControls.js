import { attachHeroProgress, createHeroProgressStore, setHeroProgressLevel } from '../src/core/heroProgression.mjs';
import { validateLampEconomy } from '../src/core/lampGear.mjs';
import { EQUIPMENT_SAVE_KEY } from './equipmentStorage.mjs';
import { HERO_PROGRESS_SAVE_KEY } from './heroProgressStorage.js';
import { resetCombatSessionConditions } from './combatSessionReset.mjs';

export async function applyDeveloperLevel({ state, gameState, call, storage, locks, level }) {
  if (!locks) throw new Error('This browser cannot safely save progression presets.');
  return locks.request(EQUIPMENT_SAVE_KEY, () => {
    const g=state.globals, raw=storage.getItem(EQUIPMENT_SAVE_KEY);
    const bank=raw?validateLampEconomy(JSON.parse(raw)).partyEXP:0;
    const next=setHeroProgressLevel(createHeroProgressStore(g.HeroProgress), level, bank);
    storage.setItem(HERO_PROGRESS_SAVE_KEY, JSON.stringify(next));
    g.HeroProgress=next;g.HeroProgressDirty=false;g.HeroProgressStorageError='';
    resetCombatSessionConditions(g, gameState, state.entities);
    for (const hero of state.entities.filter(a=>a?.kind==='hero')) attachHeroProgress(hero,next);
    call('UpdateHeroHPUI');
    return next;
  });
}

// Preserve a recoverable snapshot and clear only this game's namespaces.
export function resetDeveloperGame(storage) {
  const backupKey='wishfire.qa.reset-backup.v1';
  const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(k=>k!==backupKey&&/^(orka\.|wishfire\.)/.test(k));
  const saved=Object.fromEntries(keys.map(k=>[k,storage.getItem(k)]));
  storage.setItem(backupKey,JSON.stringify(saved));
  try { for (const key of keys) storage.removeItem(key); }
  catch (error) { for (const [key,value] of Object.entries(saved)) storage.setItem(key,value); throw error; }
  return keys.length;
}

export function getAutoplayButtonLabel(autoplayActive) {
  return autoplayActive ? 'Stop AutoPlay' : 'AutoPlay';
}

export async function handleRestartClick({
  closeDevToolingModal,
  devToolingRefreshHandler,
  updateDevToolingStatus,
}) {
  closeDevToolingModal({ restorePauseSnapshot: true });

  if (typeof devToolingRefreshHandler === 'function') {
    const restarted = await devToolingRefreshHandler({ resetGame: true });
    if (!restarted) {
      updateDevToolingStatus('Game restart unavailable');
    }
  }
}
