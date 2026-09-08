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
  let resultDialog=null, acknowledgedBattle=null;
  function showResults() {
    const g=state.globals;
    if(acknowledgedBattle===g.ProgressionBattle?.id)return true;
    if(resultDialog)return false;
    resultDialog=document.createElement('dialog');
    resultDialog.setAttribute('aria-label','Battle progression');
    Object.assign(resultDialog.style,{background:'#10141a',color:'#fff',border:'1px solid #8996a6',borderRadius:'8px',maxWidth:'min(420px,90vw)',maxHeight:'80vh',overflow:'auto'});
    const heading=document.createElement('h2');heading.textContent='Victory';resultDialog.append(heading);
    for(const result of g.ProgressionResults||[]) {
      const row=document.createElement('section');
      const title=document.createElement('h3');title.textContent=`${result.hero} · +${result.exp} EXP`;row.append(title);
      const text=document.createElement('p');text.textContent=`Level ${result.fromLevel}${result.toLevel!==result.fromLevel?` → ${result.toLevel}`:''}`;row.append(text);
      if(result.toLevel>result.fromLevel){const growth=document.createElement('p');growth.textContent=Object.entries({HP:result.maxHPAfter-result.maxHPBefore,...Object.fromEntries(Object.entries(result.statsAfter).map(([key,value])=>[key,value-result.statsBefore[key]]))}).filter(([,value])=>value).map(([key,value])=>`${key} +${value}`).join(' · ');row.append(growth);}
      if(result.unlocks.length){const unlocks=document.createElement('p');unlocks.textContent='Unlocked: '+result.unlocks.join(', ');row.append(unlocks);}resultDialog.append(row);
    }
    const done=document.createElement('button');done.textContent='Continue';done.style.minHeight='44px';done.onclick=()=>{acknowledgedBattle=g.ProgressionBattle.id;resultDialog.close();resultDialog.remove();resultDialog=null;};resultDialog.append(done);
    resultDialog.addEventListener('cancel',event=>event.preventDefault());document.body.append(resultDialog);resultDialog.showModal();done.focus();return false;
  }
  return {
    prepare() { state.globals.QuestFiniteEncounter = 1; },
    isCleared() {
      return state.globals.QuestFiniteEncounter === 1
        && state.globals.NativeBattleEnded === true
        && showResults();
    },
    resurrect() {
      restoreHeroesToFullHP({ state, call });
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
