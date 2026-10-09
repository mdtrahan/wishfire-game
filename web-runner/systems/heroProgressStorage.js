import {attachHeroProgress,createHeroProgressStore,settleBattleEXP} from '../src/core/heroProgression.mjs';
export const HERO_PROGRESS_SAVE_KEY = 'orka.hero_progress.v2';
const KEY = HERO_PROGRESS_SAVE_KEY;
export function restoreHeroProgressFromStorage({fnContext}) {
  const g = fnContext.state.globals;
  if (!g.HeroProgressStorageRestored) {
    try {
      const raw = window.localStorage.getItem(KEY);
      g.HeroProgress = createHeroProgressStore(raw ? JSON.parse(raw) : g.HeroProgress || null);
      for (const actor of fnContext.state.entities || []) if (actor?.kind === 'hero') attachHeroProgress(actor, g.HeroProgress);
      g.HeroProgressStorageRestored = true;
    } catch (error) {
      g.HeroProgressStorageError = String(error);
      g.HeroProgress ||= createHeroProgressStore();
    }
  }
  restorePendingGoldSettlements(g);
  restorePendingBattleRewards(g, fnContext.state.entities || []);
  persistHeroProgressIfDirty({ stateGlobals: g });
  bindRewardPersistence(g);
}
export function persistHeroProgressIfDirty({stateGlobals:g}) {
  if (!g.HeroProgress || g.HeroProgressStorageError) return false;
  const stage = g.ContinuousCombatStage;
  if (Number(g.ContinuousCombatStageLoop) === 1 && stage) {
    const checkpoint = { region: stage.region, stage: stage.stage, wave: stage.bossActive ? 1 : stage.wave, bossAvailable: !!stage.bossAvailable || !!stage.bossActive, clearedBosses: stage.clearedBosses, clearedPackMask: Number.isSafeInteger(stage.clearedPackMask) && stage.clearedPackMask >= 0 && stage.clearedPackMask <= 63 ? stage.clearedPackMask : 0 };
    if (JSON.stringify(checkpoint) !== JSON.stringify(g.HeroProgress.continuousStage)) {
      g.HeroProgress.continuousStage = checkpoint;
      g.HeroProgressDirty = true;
    }
  }
  if (capturePendingBattleRewards(g)) g.HeroProgressDirty = true;
  if (capturePendingGoldSettlements(g)) g.HeroProgressDirty = true;
  if (!g.HeroProgressDirty) return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(g.HeroProgress));
    g.HeroProgressDirty = false;
    return true;
  } catch (error) { g.HeroProgressStorageError = String(error); return false; }
}

export function confirmGoldSettlements({stateGlobals:g}) {
  const store = g.HeroProgress;
  if (!store?.pendingGoldSettlements) return false;
  const committed = new Set(g.SettledGoldRewardReceipts || []);
  let changed = false;
  for (const id of Object.keys(store.pendingGoldSettlements)) if (committed.has(id)) {
    delete store.pendingGoldSettlements[id];
    changed = true;
  }
  if (changed) g.HeroProgressDirty = true;
  return changed;
}

function capturePendingBattleRewards(g) {
  const battle = g.ProgressionBattle;
  const hasRewards = battle && !battle.settled && Object.keys(battle.defeated || {}).length > 0;
  const current = hasRewards ? {
    id: String(battle.id || ''),
    participants: [...(battle.participants || [])].map(String),
    defeated: { ...(battle.defeated || {}) },
    defeatedGold: { ...(battle.defeatedGold || {}) },
  } : null;
  const pending = g.HeroProgress.pendingBattleRewards || null;
  if (JSON.stringify(current) === JSON.stringify(pending)) return false;
  g.HeroProgress.pendingBattleRewards = current;
  return true;
}

function bindRewardPersistence(g) {
  const battle = g.ProgressionBattle;
  if (!battle || typeof battle !== 'object' || battle.persistPendingRewards) return;
  Object.defineProperty(battle, 'persistPendingRewards', {
    configurable: true,
    enumerable: false,
    value: () => {
      g.HeroProgressDirty = true;
      capturePendingBattleRewards(g);
      capturePendingGoldSettlements(g);
      return persistHeroProgressIfDirty({ stateGlobals: g });
    },
  });
}

function capturePendingGoldSettlements(g) {
  const store = g.HeroProgress;
  store.pendingGoldSettlements ||= {};
  let changed = false;
  for (const [id, amount] of Object.entries(g.PendingGoldSettlements || {})) {
    if (!Object.prototype.hasOwnProperty.call(store.pendingGoldSettlements, id)) {
      store.pendingGoldSettlements[id] = Math.max(0, Math.floor(Number(amount) || 0));
      changed = true;
    }
  }
  return changed;
}

function restorePendingGoldSettlements(g) {
  const receipts = g.HeroProgress?.pendingGoldSettlements || {};
  g.PendingGoldSettlements ||= {};
  g.RestoredGoldSettlementReceipts ||= {};
  for (const [id, amountValue] of Object.entries(receipts)) {
    const amount = Math.max(0, Math.floor(Number(amountValue) || 0));
    if (g.RestoredGoldSettlementReceipts[id]) continue;
    g.PendingGoldSettlements[id] = amount;
    g.goldTotal = Number(g.goldTotal || 0) + amount;
    g.RestoredGoldSettlementReceipts[id] = true;
  }
}

function restorePendingBattleRewards(g, actors) {
  const pending = g.HeroProgress?.pendingBattleRewards;
  if (!pending) return false;
  if (g.HeroProgress.settledBattles?.includes(pending.id)) {
    g.HeroProgress.pendingBattleRewards = null;
    g.HeroProgressDirty = true;
    return false;
  }
  const battle = { ...pending, outcome: 'recovered', settled: false };
  const heroes = actors.filter(actor => actor?.kind === 'hero' && pending.participants.includes(actor.heroInstanceKey || actor.baseHeroName || actor.name));
  const represented = new Set(heroes.map(hero => hero.heroInstanceKey || hero.baseHeroName || hero.name));
  for (const id of pending.participants) if (!represented.has(id) && g.HeroProgress.heroes[id]) heroes.push(g.HeroProgress.heroes[id]);
  const gold = Object.values(pending.defeatedGold || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const previousGold = Number(g.goldTotal || 0), previousReceipts = { ...(g.PendingGoldSettlements || {}) }, previousProgressReceipts = { ...(g.HeroProgress.pendingGoldSettlements || {}) };
  g.goldTotal = previousGold + gold;
  if (gold > 0) {
    (g.PendingGoldSettlements ||= {})[pending.id] = gold;
    (g.HeroProgress.pendingGoldSettlements ||= {})[pending.id] = gold;
    (g.RestoredGoldSettlementReceipts ||= {})[pending.id] = true;
  }
  try { settleBattleEXP(g.HeroProgress, battle, heroes); }
  catch (error) { g.goldTotal = previousGold; g.PendingGoldSettlements = previousReceipts; g.HeroProgress.pendingGoldSettlements = previousProgressReceipts; throw error; }
  g.HeroProgress.pendingBattleRewards = null;
  g.HeroProgressDirty = true;
  return true;
}
