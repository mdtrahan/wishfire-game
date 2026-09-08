import {actionCapacity} from '../src/core/actionSelection.mjs';
import {settleBattleEXP} from '../src/core/heroProgression.mjs';
import {heroDefinition,PROGRESSION} from '../src/core/heroDefinitions.mjs';
import {getHeroFlowState,getHeroSkillOptions} from '../src/core/personalFlow.mjs';
import {legalSkill,validTargets,resolveSkill,turnStart,turnEnd} from '../src/core/combatRules.mjs';
import {derivePresentationTurnBarrier} from '../src/core/turnGateController.mjs';
export {getHeroFlowState,getHeroSkillOptions};
export function getHeroCommandSlots(entities){const slots=Array(6).fill(null);for(const hero of entities){const i=Number(hero.heroDisplaySlot??hero.displaySlot??hero.heroIndex);if(hero?.kind==='hero'&&Number.isInteger(i)&&i>=0&&i<6)slots[i]=hero;}return slots;}
export function canUseHeroCommand(ctx,actorUID){const g=ctx.state.globals,hero=ctx.state.entities.find(a=>a.uid===actorUID&&a.kind==='hero');return !!hero&&hero.hp>0&&!g.NativeBattleEnded&&g.GamePhase==='RUNTIME'&&!g.BattleStartActive&&!g.IsPlayerBusy&&Number(g.TurnPhase)===0&&Number(ctx.callFunction('GetCurrentTurn'))===actorUID&&ctx.callFunction('GetEnemyRosterStability')?.stable===true&&derivePresentationTurnBarrier({globals:g}).canClaimCombatAction;}
export function rulesContext(ctx){
 const g=ctx.state.globals;g.statusOrder=g.statusOrder||0;
 return {actors:ctx.state.entities,state:g,flowRandom:()=>typeof g.FlowRandom==='function'?g.FlowRandom():Math.random(),random:()=>typeof g.RuntimeRandom==='function'?g.RuntimeRandom():Math.random(),
 calculateDamage:(a,t,mode)=>ctx.callFunction('CalculateDamage',a.uid,t.uid,mode),
 applyDamage:(a,t,amount,origin)=>{const before=t.hp;ctx.callFunction('ApplyDamageToTarget',t.uid,amount,{sourceUID:a.uid,nativeResolved:true,suppressPartySkillHitHooks:1,...origin});return before-t.hp;},
 onKO:actor=>{if(actor.kind==='enemy'){const battle=g.ProgressionBattle;if(battle)battle.defeated[actor.uid]=actor.expValue??PROGRESSION.enemyEXP;}},
 isOver:()=>{
  const ended=!ctx.state.entities.some(a=>a.kind==='enemy'&&a.hp>0);
  if(ended)g.NativeBattleEnded=true;
  return ended;
 }};
}
export function buildCommandActions(ctx,hero,{queue=[],flow=false,targetUID}={}){
 const d=heroDefinition(hero);if(!d)return null;const entries=flow?[{skillId:d.special.skillId,targetIds:queue[0]?.targetIds||[targetUID]}]:queue.length?queue:[{skillId:d.basic.skillId,targetIds:[targetUID]}];
 if(entries.length>actionCapacity(hero))return null;
 const seen=new Set(),actions=[];
 for(const entry of entries){if(!entry||typeof entry!=='object')return null;const skill=[d.basic,...d.actives,d.special].find(s=>s.skillId===entry.skillId);if(!skill||!legalSkill(hero,skill)||(!flow&&skill.isFlowSpecial)||(flow&&(hero.flow||0)<skill.meterRequirement))return null;
 if(seen.has(skill.skillId)&&!skill.multiCast)return null;seen.add(skill.skillId);if(entries.length>1&&skill.skillId===d.basic.skillId)return null;
 const ids=entry.targetIds||[entry.targetId??targetUID];if(!validTargets(ctx.state.entities,hero,skill,ids).length)return null;actions.push({skillId:skill.skillId,targetIds:[...new Set(ids)],spCost:skill.spCost,sequenceOrder:actions.length,skill});}
 if(actions.reduce((sum,a)=>sum+a.spCost,0)>(hero.sp||0))return null;return actions;
}
export function executeHeroCommand(ctx,command={}){
 const {actorUID}=command;if(!canUseHeroCommand(ctx,actorUID))return false;const hero=ctx.state.entities.find(a=>a.uid===actorUID),actions=buildCommandActions(ctx,hero,command);if(!actions)return false;
 const g=ctx.state.globals;if(ctx.callFunction('StartHeroLunge',actorUID)!==1)return false;
 hero.remainingActionSlots=0;hero.reservedSP=0;
 hero.sp-=actions.reduce((sum,a)=>sum+a.spCost,0);
 const sequence={actorUID,actions,index:0,sessionId:g.CombatSessionId};g.NativeCommandSequence=sequence;
 g.PendingHeroHits=[{at:Number(g.time||0)+0.97,heroUID:actorUID,effectType:'native_command',sequence}];g.AdvanceAfterAction=1;g.ActionOwnerUID=actorUID;return true;
}
export function cancelNativeSequence(ctx){const g=ctx.state.globals,s=g.NativeCommandSequence;if(!s)return;const actor=ctx.state.entities.find(a=>a.uid===s.actorUID);if(actor)actor.sp=Math.min(actor.spMax,(actor.sp||0)+s.actions.slice(s.index).reduce((sum,a)=>sum+a.spCost,0));s.index=s.actions.length;delete g.NativeCommandSequence;}
export function resolveNativeCommandStep(ctx,hit){
 const g=ctx.state.globals,s=hit.sequence;if(!s||g.NativeCommandSequence!==s||s.sessionId!==g.CombatSessionId)return false;
 const actor=ctx.state.entities.find(a=>a.uid===s.actorUID);const rules=rulesContext(ctx);
 if(!actor||actor.hp<=0||rules.isOver()){cancelNativeSequence(ctx);return false;}
 const action=s.actions[s.index];const executed=resolveSkill(rules,actor,action.skill,action.targetIds);
 if(executed){if(action.skill.isFlowSpecial)actor.flow=0;ctx.callFunction('LogCombat',`${heroDefinition(actor).name}: ${action.skill.displayName}`);}
 else actor.sp=Math.min(actor.spMax,actor.sp+action.spCost);
 s.index++;ctx.callFunction('UpdateHeroHPUI');ctx.callFunction('UpdateEnemyHPUI');
 if(actor.hp<=0||rules.isOver()){cancelNativeSequence(ctx);if(g.NativeBattleEnded)settleVictory(ctx);return true;}
 if(s.index<s.actions.length)g.PendingHeroHits.push({...hit,at:Number(g.time||0)+0.4});else delete g.NativeCommandSequence;
 return true;
}
export function nativeTurnStarted(ctx,actor){
 if(!actor)return;
 const rules=rulesContext(ctx);
 const serial=ctx.state.globals.TurnSerial||0;
 if(actor.hp>0&&actor.combatTurnSerial!==serial){actor.remainingActionSlots=actionCapacity(actor);actor.reservedSP=0;}
 turnStart(rules,actor,serial);
 if(actor.hp<=0&&actor.kind==='enemy')ctx.callFunction('KillEnemyByUID',actor.uid,actor.slotIndex??0);
 if(rules.isOver())settleVictory(ctx);
 ctx.callFunction('UpdateHeroHPUI');
}
export function nativeTurnEnded(ctx,actor){if(!actor||actor.nativeEndedSerial===ctx.state.globals.TurnSerial)return;actor.nativeEndedSerial=ctx.state.globals.TurnSerial;turnEnd(actor);}
export function resolveIncomingNativeHit(ctx,source,target,amount,options={}) {
 const rules=rulesContext(ctx);const result=resolveSkill(rules,source,{skillId:'enemy_attack',targetType:'enemy',tags:[options.magic?'magic':'physical'],effects:[{effectType:'damage',fixedDamage:amount,fixedTargetUID:target.uid}]},[target.uid]);
 if(ctx.state.globals.NativeBattleEnded)settleVictory(ctx);
 return result;
}
export function resolveNativeEnemyArea(ctx,uid) {
 const source=ctx.state.entities.find(a=>a.uid===uid);if(!source)return false;
 const result=resolveSkill(rulesContext(ctx),source,{skillId:'enemy_magic_area',targetType:'allEnemies',tags:['magic'],effects:[{effectType:'damage'}]},ctx.state.entities.filter(a=>a.kind==='hero'&&a.hp>0).map(a=>a.uid));
 if(ctx.state.globals.NativeBattleEnded)settleVictory(ctx);
 return result;
}

export function settleVictory(ctx) {
 const g=ctx.state.globals;
 if(!g.NativeBattleEnded||!g.ProgressionBattle||g.ProgressionBattle.settled)return;
 cancelNativeSequence(ctx);
 g.ProgressionResults=settleBattleEXP(g.HeroProgress,g.ProgressionBattle,ctx.state.entities.filter(a=>a.kind==='hero'));
 g.HeroProgressDirty=true;
}
