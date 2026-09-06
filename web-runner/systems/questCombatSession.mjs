// Session lifecycle only. Damage, initiative and skill rules remain runtime-owned.
export function createQuestCombatSession({ state, gameState, call, sync }) {
  return {
    prepare() { state.globals.QuestFiniteEncounter = 1; },
    isCleared() {
      return state.globals.QuestFiniteEncounter === 1
        && !state.entities.some(e => e?.kind === 'enemy')
        && !(state.globals.AstralFlowKoOrbQueue?.length)
        && !state.globals.AstralFlowKoOrbPresentationActive;
    },
    resurrect() {
      for (const hero of state.entities.filter(e => e?.kind === 'hero')) {
        hero.hp = hero.maxHP;
        hero.isAlive = true;
        if (state.globals.PendingDeaths) delete state.globals.PendingDeaths[hero.uid];
      }
      call('UpdateHeroHPUI');
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
