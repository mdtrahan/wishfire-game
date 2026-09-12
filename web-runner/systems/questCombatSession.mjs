// Session lifecycle only. Damage, initiative and skill rules remain runtime-owned.
export function restoreHeroesToFullHP({ state, call }) {
  for (const hero of state.entities.filter(e => e?.kind === 'hero')) {
    hero.hp = hero.maxHP;
    hero.isAlive = true;
    if (state.globals.PendingDeaths) delete state.globals.PendingDeaths[hero.uid];
  }
  call('UpdateHeroHPUI');
}

export function createQuestCombatSession({ state, gameState, call, sync }) {
  return {
    prepare() { state.globals.QuestFiniteEncounter = 1; },
    isCleared() {
      return state.globals.QuestFiniteEncounter === 1
        && state.globals.NativeBattleEnded === true
        && state.globals.SessionLevelUpQueue?.status !== 'active'
        && !state.globals.SessionLevelUpSettlement
        && !state.globals.FlowOrbs?.length
        && state.globals.ProgressionBattle?.outcome === 'victory';
    },
    resurrect() {
      restoreHeroesToFullHP({ state, call });
      state.globals.NativeBattleEnded = false;
      if (state.globals.ProgressionBattle) {
        state.globals.ProgressionBattle.outcome = 'active';
        state.globals.ProgressionBattle.defeatSettled = false;
        state.globals.ProgressionBattle.settled = false;
      }
      call('RebuildTurnOrderPreserveCurrent');
      state.globals.ActionInProgress = 0;
      state.globals.IsPlayerBusy = 0;
      state.globals.DeferAdvance = 0;
      gameState.combatFailExitRequested = false;
      sync();
      call('ProcessTurn');
    },
  };
}
