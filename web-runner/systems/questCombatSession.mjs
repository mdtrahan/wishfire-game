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
    if (g.ProgressionBattle?.outcome !== 'victory') return false;
    if(acknowledgedBattle===g.ProgressionBattle?.id)return true;
    if(resultDialog || g.FlowOrbs?.length)return false;
    resultDialog=document.createElement('dialog');
    resultDialog.setAttribute('aria-label','Battle progression');
    resultDialog.id='battle-results';
    const canvas=document.querySelector('#view');
    const shade=document.createElement('div');shade.id='battle-results-shade';shade.setAttribute('aria-hidden','true');
    Object.assign(shade.style,{position:'fixed',background:'rgba(0,0,0,0.4)',zIndex:'2147483646',pointerEvents:'none'});
    const backdropStyle=document.createElement('style');backdropStyle.textContent='#battle-results::backdrop{background:transparent}';
    document.head.append(backdropStyle);document.body.append(shade);
    Object.assign(resultDialog.style,{position:'fixed',inset:'auto',margin:'0',boxSizing:'border-box',background:'#10141a',color:'#fff',border:'1px solid #8996a6',maxWidth:'none',maxHeight:'none',minWidth:'0',minHeight:'0',overflowY:'auto',overflowX:'hidden',overflowWrap:'anywhere'});
    const positionResults=()=>{
      const rect=canvas.getBoundingClientRect(),scale=rect.width/360;
      Object.assign(shade.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
      Object.assign(resultDialog.style,{left:`${rect.left+rect.width*.1}px`,top:`${rect.top+rect.height*.1}px`,width:`${rect.width*.8}px`,height:`${rect.height*.8}px`,padding:`${12*scale}px`,borderRadius:`${8*scale}px`,fontSize:`${16*scale}px`});
    };
    positionResults();
    const observer=new ResizeObserver(positionResults);observer.observe(canvas);
    window.addEventListener('resize',positionResults);
    resultDialog.addEventListener('close',()=>{observer.disconnect();window.removeEventListener('resize',positionResults);shade.remove();backdropStyle.remove();},{once:true});
    const heading=document.createElement('h2');heading.textContent='Victory';resultDialog.append(heading);
    const gold=document.createElement('p');gold.textContent=`+${g.ProgressionBattle?.goldReward||0} Gold`;resultDialog.append(gold);
    for(const result of g.ProgressionResults||[]) {
      const row=document.createElement('section');
      const title=document.createElement('h3');title.textContent=`${result.hero} · +${result.exp} EXP`;row.append(title);
      const text=document.createElement('p');text.textContent=`Level ${result.fromLevel}${result.toLevel!==result.fromLevel?` → ${result.toLevel}`:''}`;row.append(text);
      if(result.toLevel>result.fromLevel){const growth=document.createElement('p');growth.textContent=Object.entries({HP:result.maxHPAfter-result.maxHPBefore,...Object.fromEntries(Object.entries(result.statsAfter).map(([key,value])=>[key,value-result.statsBefore[key]]))}).filter(([,value])=>value).map(([key,value])=>`${key} +${value}`).join(' · ');row.append(growth);}
      if(result.unlocks.length){const unlocks=document.createElement('p');unlocks.textContent='Unlocked: '+result.unlocks.join(', ');row.append(unlocks);}resultDialog.append(row);
    }
    const done=document.createElement('button');done.textContent='Continue';done.style.cssText='font:inherit;min-height:2.75em;padding:.5em 1em';done.onclick=()=>{acknowledgedBattle=g.ProgressionBattle.id;resultDialog.close();resultDialog.remove();resultDialog=null;};resultDialog.append(done);
    resultDialog.addEventListener('cancel',event=>event.preventDefault());document.body.append(resultDialog);resultDialog.showModal();done.focus();return false;
  }
  return {
    prepare() { state.globals.QuestFiniteEncounter = 1; },
    isCleared() {
      return state.globals.QuestFiniteEncounter === 1
        && state.globals.NativeBattleEnded === true
        && state.globals.SessionLevelUpQueue?.status !== 'active'
        && !state.globals.SessionLevelUpSettlement
        && state.globals.ProgressionBattle?.outcome === 'victory'
        && showResults();
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
