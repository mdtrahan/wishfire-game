import { attachHeroProgress, createHeroProgressStore, setHeroProgressLevel } from '../src/core/heroProgression.mjs';
import { validateLampEconomy } from '../src/core/lampGear.mjs';
import { EQUIPMENT_SAVE_KEY } from './equipmentStorage.mjs';
import { HERO_PROGRESS_SAVE_KEY } from './heroProgressStorage.js';
import { resetCombatSessionConditions } from './combatSessionReset.mjs';
import { armContinuousCombatBoss, buildContinuousCombatSpawnPlan, createContinuousCombatStageState, continuousCombatWavesForStage } from '../src/core/continuousCombatStage.mjs';
import { restoreHeroesToFullHP } from './questCombatSession.mjs';

export function parseDeveloperBossChapter(value) {
  const text = String(value ?? '').trim();
  const chapter = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(chapter) || chapter < 1) throw new Error('Enter a whole chapter number of 1 or higher.');
  return chapter;
}

export async function launchDeveloperBossBattle({ chapter: input, state, gameState, call, refresh, resumeBossActivity }) {
  const chapter = parseDeveloperBossChapter(input);
  if (gameState.storyEntry?.pending) throw new Error('Wait for the current transition to finish.');
  if (typeof refresh !== 'function' || typeof resumeBossActivity !== 'function' || !await refresh({ forceCombat: true })) throw new Error('Combat is not ready yet.');
  const g = state.globals;
  const next = createContinuousCombatStageState(g.EncounterSeed || 1, { region: chapter });
  next.wave = continuousCombatWavesForStage(chapter);
  const plan = buildContinuousCombatSpawnPlan(g.EnemyData, { ...next, bossActive: true });
  if (!plan.length || plan.some(({ row }) => ['HP', 'ATK', 'DEF', 'MAG', 'RES', 'SPD'].some(key => !Number.isFinite(row[key])))) throw new Error('Chapter exceeds the available boss combat data.');
  resetCombatSessionConditions(g, gameState, state.entities);
  restoreHeroesToFullHP({ state, call, reason: 'developer_boss_launch' });
  g.ContinuousCombatStageLoop = 1;
  const previousStage = g.ContinuousCombatStage;
  g.ContinuousCombatStage = next;
  try {
    if (!await resumeBossActivity()) throw new Error('The current screen cannot leave yet.');
  } catch (error) { g.ContinuousCombatStage = previousStage; throw error; }
  next.bossAvailable = true;
  if (!armContinuousCombatBoss(g, state.entities, call)) throw new Error('Boss battle could not start.');
  g.HeroProgressDirty = true;
  g.QaScenarioPaused = false;
  g.QaFixtureHoldTurn = false;
  return g.ContinuousCombatStage;
}

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
