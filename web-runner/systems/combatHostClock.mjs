import { advanceLampCombatProgress } from '../src/core/lampGear.mjs';

function bagProgressBlockedByMenu() {
  return typeof document !== 'undefined' && (document.hidden || [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open],[aria-modal="true"]')].some(node => node.getClientRects().length > 0));
}

export function createCombatHostClock({isBagProgressBlocked=bagProgressBlockedByMenu}={}) {
  let bagClock = null;
  function advanceHostTime({ state, dt, activeSeconds = dt, presentationSeconds = dt }) {
      state.globals.time = Number(state.globals.time || 0) + dt;
      const battle = state.globals.ProgressionBattle;
      if (activeSeconds > 0 && battle?.persistPendingRewards && !battle.settled && !isBagProgressBlocked()) {
        const progress = advanceLampCombatProgress(bagClock, { battleId: battle.id, seconds: activeSeconds, data: state.globals.Equipment, pending: state.globals.HeroProgress?.pendingBagKillRewards });
        bagClock = progress.clock;
        for (const reward of progress.rewards) battle.persistPendingRewards(reward);
      }
      return true;
  }
  return { advanceHostTime };
}

export function shouldFreezeCombatSimulation(state, gameState = {}) {
  const globals = state?.globals || {};
  const bossTransition = globals.ContinuousCombatStage;
  return !!(
    globals.DevToolingPaused ||
    globals.QaScenarioPaused ||
    globals.QaFixtureHoldTurn ||
    gameState?.storyEntry?.combatPaused ||
    gameState?.storyEntry?.phase === 'defeat' ||
    (bossTransition?.bossActive === true && Number(bossTransition.bossTransitionEndsAtMs || 0) > Date.now())
  );
}

export function advanceBattleStartSimulation({ state, runCombatStep }) {
  const g = state.globals;
  if (!g.BattleStartActive || Number(g.time || 0) < Number(g.BattleStartFadeEndsAt ?? 2.4)) return false;
  g.BattleStartActive = 0;
  g.BattleStartClearedForSession = 1;
  if (!g.BattleStartProcessStarted) {
    g.BattleStartProcessStarted = 1;
    g.IsPlayerBusy = 0;
  }
  return true;
}
