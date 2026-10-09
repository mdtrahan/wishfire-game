import { activateContinuousCombatSpawnedEnemy, buildContinuousCombatSpawnPlan, getContinuousCombatPartyCP, recordContinuousCombatWavePackProgress, resetContinuousCombatAfterDefeat } from '../src/core/continuousCombatStage.mjs';
import { resetCombatSessionConditions } from './combatSessionReset.mjs';
import { resetActorPresentationAfterRestore } from '../src/core/actorPresentationState.mjs';
import { placeContinuousCombatHeroesInRecoveryHuddle } from '../src/core/arenaCombat.mjs';
import { cleanseDebuffs } from '../src/core/combatRules.mjs';
import { hasContinuousOrdinaryHeroKO } from './combatSimulationTick.mjs';

// Session lifecycle only. Damage, initiative and skill rules remain runtime-owned.
export function restoreHeroesToFullHP({ state, call }) {
  const now = Number(state.globals?.time || 0);
  for (const hero of state.entities.filter(e => e?.kind === 'hero')) {
    hero.hp = hero.maxHP;
    hero.isAlive = true;
    resetActorPresentationAfterRestore(hero, now);
    if (state.globals.PendingDeaths) delete state.globals.PendingDeaths[hero.uid];
  }
  call('UpdateHeroHPUI');
}

export function recoverContinuousOrdinaryDefeatIfNeeded({ state, session } = {}) {
  if (!hasContinuousOrdinaryHeroKO(state)) return false;
  return session?.recoverContinuousDefeat?.() || false;
}

export function createQuestCombatSession({ state, gameState, call, sync }) {
  return {
    // Player sessions replenish the existing enemy slots. Authored finite
    // encounters remain available to QA through their explicit setup hooks.
    prepare() { state.globals.QuestFiniteEncounter = 0; },
    isCleared() { return false; },
    recoverContinuousDefeat() {
      if (Number(state.globals.ContinuousCombatStageLoop || 0) !== 1) return false;
      const stageBeforeRecovery = state.globals.ContinuousCombatStage;
      if (recordContinuousCombatWavePackProgress(stageBeforeRecovery, state.entities)) state.globals.HeroProgressDirty = true;
      call('SettleContinuousCombatRewards');
      resetCombatSessionConditions(state.globals, gameState, state.entities);
      state.entities = state.entities.filter(actor => actor?.kind === 'hero');
      state.globals.EnemySlots = [];
      state.globals.EnemyDeathVisualHoldByUID = {};
      state.globals.PendingDeaths = {};
      resetContinuousCombatAfterDefeat(state.globals);
      restoreHeroesToFullHP({ state, call });
      const heroes = state.entities.filter(actor => actor?.kind === 'hero');
      for (const hero of heroes) cleanseDebuffs(hero);
      placeContinuousCombatHeroesInRecoveryHuddle({ globals: state.globals, heroes, now: Number(state.globals.time || 0) });
      const stageState = state.globals.ContinuousCombatStage;
      const plan = stageState.bossAvailable ? [] : buildContinuousCombatSpawnPlan(state.globals.EnemyData, stageState, { slotBase: 0, partyCP: getContinuousCombatPartyCP(state.entities), enemySize: Number(state.globals.EnemySize || 40) });
      stageState.spawnSerial = plan.length;
      stageState.spawnedPackMask = plan.reduce((mask, entry) => mask | (1 << entry.sectorIndex), 0);
      for (const entry of plan) {
        const enemy = call('SpawnEnemy', { ...entry.row, enemyRole: String(entry.row.enemyRole || entry.row.role || 'fodder') }, entry.slotIndex);
        activateContinuousCombatSpawnedEnemy(state.globals, enemy, entry);
      }
      state.globals.QuestFiniteEncounter = 1;
      state.globals.NativeBattleEnded = false;
      state.globals.NextUID = state.entities.reduce((max, actor) => Math.max(max, Number(actor?.uid || 0)), 0) + 1;
      state.globals.ActionInProgress = 0;
      state.globals.IsPlayerBusy = 0;
      state.globals.DeferAdvance = 0;
      gameState.combatFailExitRequested = false;
      call('UpdateEnemyHPUI');
      sync();
      return true;
    },
    resurrect() {
      const heroes = state.entities.filter(actor => actor?.kind === 'hero');
      const stage = state.globals.ContinuousCombatStage;
      if (Number(state.globals.ContinuousCombatStageLoop || 0) === 1 && recordContinuousCombatWavePackProgress(stage, state.entities)) state.globals.HeroProgressDirty = true;
      const needsContinuousHuddle = Number(state.globals.ContinuousCombatStageLoop || 0) === 1
        && heroes.some(hero => Number(hero.hp || 0) <= 0);
      restoreHeroesToFullHP({ state, call });
      if (needsContinuousHuddle) {
        placeContinuousCombatHeroesInRecoveryHuddle({ globals: state.globals, heroes, now: Number(state.globals.time || 0) });
      }
      state.globals.NativeBattleEnded = false;
      if (state.globals.ProgressionBattle) {
        state.globals.ProgressionBattle.outcome = 'active';
        state.globals.ProgressionBattle.defeatSettled = false;
        state.globals.ProgressionBattle.settled = false;
      }
      state.globals.ActionInProgress = 0;
      state.globals.IsPlayerBusy = 0;
      state.globals.DeferAdvance = 0;
      gameState.combatFailExitRequested = false;
      sync();
    },
  };
}
