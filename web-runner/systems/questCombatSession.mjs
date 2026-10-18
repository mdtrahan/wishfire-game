import { CONTINUOUS_COMBAT_BOSS_TIME_LIMIT_SEC, activateContinuousCombatSpawnedEnemy, buildContinuousCombatSpawnPlan, getContinuousCombatPartyCP, recordContinuousCombatWavePackProgress, resetContinuousCombatAfterDefeat } from '../src/core/continuousCombatStage.mjs';
import { resetCombatSessionConditions } from './combatSessionReset.mjs';
import { resetActorPresentationAfterRestore } from '../src/core/actorPresentationState.mjs';
import { placeContinuousCombatHeroesInRecoveryHuddle } from '../src/core/arenaCombat.mjs';
import { cleanseDebuffs } from '../src/core/combatRules.mjs';
import { hasContinuousOrdinaryHeroKO } from './combatSimulationTick.mjs';
import { recordBalanceCombatEvent } from '../src/core/balanceTelemetry.mjs';

// Session lifecycle only. Damage, initiative and skill rules remain runtime-owned.
export function restoreHeroesToFullHP({ state, call, reason = 'manual' }) {
  const now = Number(state.globals?.time || 0);
  for (const hero of state.entities.filter(e => e?.kind === 'hero')) {
    const hpBefore = Number(hero.hp || 0);
    hero.hp = hero.maxHP;
    recordBalanceCombatEvent(state.globals, { type: 'recovery', reason, recoveryIndex: Number(state.globals.ContinuousCombatStage?.defeatRecoveries || 0), targetUID: Number(hero.uid || 0), sourceUID: 0, amount: Math.max(0, Number(hero.hp || 0) - hpBefore), hpBefore, hpAfter: Number(hero.hp || 0) });
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
    hasPendingBossVictory() {
      const stage = state.globals.ContinuousCombatStage;
      if (Number(state.globals.ContinuousCombatStageLoop || 0) !== 1 || stage?.bossActive !== true
        || !Number.isSafeInteger(stage.bossUID) || stage.bossUID <= 0) return false;
      return !state.entities.some(actor => actor?.kind === 'enemy' && Number(actor.hp || 0) > 0);
    },
    surrenderBossAttempt(reason = 'boss_surrender') {
      const stage = state.globals.ContinuousCombatStage;
      if (Number(state.globals.ContinuousCombatStageLoop || 0) !== 1 || stage?.bossActive !== true) return false;
      const bossUIDs = new Set(state.entities.filter(actor => actor?.kind === 'enemy'
        && String(actor.combatRank || actor.enemyRole || actor.role || '').toLowerCase() === 'boss')
        .map(actor => String(actor.uid)));
      if (Number.isSafeInteger(stage.bossUID) && stage.bossUID > 0) bossUIDs.add(String(stage.bossUID));
      const battle = state.globals.ProgressionBattle;
      if (reason === 'boss_timeout') {
        const boss = state.entities.find(actor => Number(actor?.uid || 0) === Number(stage.bossUID || 0));
        stage.lastBossTimeout = {
          time: Number(state.globals.time || 0),
          elapsedSec: Math.max(0, Number(state.globals.time || 0) - Number(stage.bossTimerStartedAt || 0)),
          timeLimitSec: CONTINUOUS_COMBAT_BOSS_TIME_LIMIT_SEC,
          bossHp: Number(boss?.hp || 0),
          bossMaxHp: Number(boss?.maxHP || 0),
          heroes: state.entities.filter(actor => actor?.kind === 'hero').map(actor => ({ uid: Number(actor.uid || 0), name: String(actor.name || ''), hp: Number(actor.hp || 0), maxHp: Number(actor.maxHP || 0) })),
        };
      }
      let removedReward = false;
      for (const uid of bossUIDs) {
        if (battle?.defeated && Object.hasOwn(battle.defeated, uid)) { delete battle.defeated[uid]; removedReward = true; }
        if (battle?.defeatedGold && Object.hasOwn(battle.defeatedGold, uid)) { delete battle.defeatedGold[uid]; removedReward = true; }
      }
      if (removedReward) battle.persistPendingRewards?.();
      stage.bossUID = null;
      // Abandon scheduled hits and actions before the recovery settlement can observe the boss.
      resetCombatSessionConditions(state.globals, gameState, state.entities);
      state.globals.NativeBattleEnded = false;
      stage.bossSummonRequired = true;
      if (reason === 'boss_timeout') {
        stage.bossTimeouts = Number(stage.bossTimeouts || 0) + 1;
        stage.lastBossOutcome = 'timeout';
      }
      return this.recoverContinuousDefeat(reason);
    },
    recoverContinuousDefeat(reason = 'continuous_defeat') {
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
      restoreHeroesToFullHP({ state, call, reason });
      const heroes = state.entities.filter(actor => actor?.kind === 'hero');
      for (const hero of heroes) cleanseDebuffs(hero);
      placeContinuousCombatHeroesInRecoveryHuddle({ globals: state.globals, heroes, now: Number(state.globals.time || 0) });
      const stageState = state.globals.ContinuousCombatStage;
      const plan = stageState.bossAvailable && !stageState.bossSummonRequired ? [] : buildContinuousCombatSpawnPlan(state.globals.EnemyData, stageState, { slotBase: 0, partyCP: getContinuousCombatPartyCP(state.entities), enemySize: Number(state.globals.EnemySize || 40) });
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
      restoreHeroesToFullHP({ state, call, reason: 'resurrect' });
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
