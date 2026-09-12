import {actionCapacity} from '../src/core/actionSelection.mjs';
import {settleBattleEXP} from '../src/core/heroProgression.mjs';
import {heroDefinition,PROGRESSION} from '../src/core/heroDefinitions.mjs';
import {getHeroFlowState,getHeroSkillOptions} from '../src/core/personalFlow.mjs';
import {legalSkill,validTargets,resolveSkill,turnStart,turnEnd} from '../src/core/combatRules.mjs';
import {derivePresentationTurnBarrier} from '../src/core/turnGateController.mjs';
import {acknowledgeSessionLevelUpEntry,clearSessionLevelUpQueue,createSessionLevelUpQueue,currentSessionLevelUpEntry,pauseSessionLevelUpQueue,resumeSessionLevelUpQueue} from '../src/core/sessionLevelUpQueue.mjs';
export {getHeroFlowState,getHeroSkillOptions};
export function getHeroCommandSlots(entities){const slots=Array(6).fill(null);for(const hero of entities){const i=Number(hero.heroDisplaySlot??hero.displaySlot??hero.heroIndex);if(hero?.kind==='hero'&&Number.isInteger(i)&&i>=0&&i<6)slots[i]=hero;}return slots;}
export function canUseHeroCommand(ctx,actorUID){const g=ctx.state.globals,hero=ctx.state.entities.find(a=>a.uid===actorUID&&a.kind==='hero');return !!hero&&hero.hp>0&&!g.NativeBattleEnded&&g.GamePhase==='RUNTIME'&&!g.BattleStartActive&&!g.IsPlayerBusy&&Number(g.TurnPhase)===0&&Number(ctx.callFunction('GetCurrentTurn'))===actorUID&&ctx.callFunction('GetEnemyRosterStability')?.stable===true&&derivePresentationTurnBarrier({globals:g}).canClaimCombatAction;}
export function rulesContext(ctx){
 const g=ctx.state.globals;g.statusOrder=g.statusOrder||0;
 const heroPresentationPosition = target => {
  const index = Number(target?.heroDisplaySlot ?? target?.heroIndex ?? -1);
  const positions = Array.isArray(g.HeroPortraitPosByIndex) ? g.HeroPortraitPosByIndex : g.HeroIconPosByIndex;
  const positioned = Number.isInteger(index) && index >= 0 && Array.isArray(positions) ? positions[index] : null;
  if (positioned && Number.isFinite(Number(positioned.x)) && Number.isFinite(Number(positioned.y))) {
   return {x:Number(positioned.x),y:Number(positioned.y)};
  }
  return {x:Number(target?.x||0),y:Number(target?.y||0)};
 };
 const ensureCardBarrierVisual = target => {
  if(!target||target.kind!=='hero')return null;
  const now=Number(g.time||0),uid=Number(target.uid||0);if(!(uid>0))return null;
  const visuals=g.PartyWardBarrierVisualsByUID&&typeof g.PartyWardBarrierVisualsByUID==='object'?g.PartyWardBarrierVisualsByUID:(g.PartyWardBarrierVisualsByUID={});
  const prior=visuals[uid]&&typeof visuals[uid]==='object'?visuals[uid]:{};
  visuals[uid]={uid,source:'hero_turn_card',state:'fadeIn',fadeInStartedAt:now,fadeInDuration:.12,fadeOutDuration:.28,baseAlpha:.82,hitUntil:Number(prior.hitUntil||0),refreshCount:Math.max(1,Number(prior.refreshCount||0)+1)};
  g.PartyWardBarrierAssetPath='images/falie_ward_84x62.png';g.PartyWardBarrierOffsetWorldX=22;g.PartyWardBarrierWidth=84;g.PartyWardBarrierHeight=62;g.PartyWardBarrierBaseAlpha=.82;
  return visuals[uid];
 };
 return {actors:ctx.state.entities,state:g,flowRandom:()=>typeof g.FlowRandom==='function'?g.FlowRandom():Math.random(),random:()=>typeof g.RuntimeRandom==='function'?g.RuntimeRandom():Math.random(),
 calculateDamage:(a,t,mode)=>ctx.callFunction('CalculateDamage',a.uid,t.uid,mode),
 applyDamage:(a,t,amount,origin)=>{const before=t.hp;ctx.callFunction('ApplyDamageToTarget',t.uid,amount,{sourceUID:a.uid,nativeResolved:true,suppressPartySkillHitHooks:1,...origin});return before-t.hp;},
 onHeal:(source,target,delta)=>{if(source?.kind==='hero'&&target?.kind==='hero'&&delta>0){const pos=heroPresentationPosition(target);const texts=Array.isArray(g.DamageTexts)?g.DamageTexts:null;const before=texts?.length||0;ctx.callFunction('SpawnDamageText',delta,pos.x,pos.y,'heal','hero');const emitted=Array.isArray(g.DamageTexts)&&g.DamageTexts.length>before?g.DamageTexts[g.DamageTexts.length-1]:null;if(emitted){emitted.targetUID=Number(target.uid||0);emitted.targetSlotIndex=Number(target.heroDisplaySlot??target.heroIndex??-1);}}},
 onStatus:(source,target,effect)=>{if(source?.kind==='hero'&&target?.kind==='hero'&&effect?.statusEffect==='barrier')ensureCardBarrierVisual(target);},
 onKO:actor=>{if(actor.kind==='enemy'){const battle=g.ProgressionBattle;if(battle){battle.defeated[actor.uid]=actor.expValue??PROGRESSION.enemyEXP;(battle.defeatedGold||={})[actor.uid]=Math.max(0,Math.floor(actor.goldValue??PROGRESSION.enemyGold));}}},
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
  if(s.kind==='hero_turn_card'){
  const targetIds=Array.isArray(s.targetIds)?s.targetIds:[];
  const resolved=resolveSkill(rules,actor,s.skill,targetIds);
  if(resolved)ctx.callFunction('LogCombat',`${heroDefinition(actor).name}: ${s.card?.name || s.cardId || 'Hero action'}`);
  delete g.NativeCommandSequence;
  ctx.callFunction('UpdateHeroHPUI');ctx.callFunction('UpdateEnemyHPUI');
  if(actor.hp<=0||rules.isOver()){if(g.NativeBattleEnded)settleVictory(ctx);return true;}
  return resolved;
 }
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
 if(!ctx.state.entities.some(actor=>actor?.kind==='hero'&&Number(actor.hp||0)>0))settleDefeat(ctx);
 else if(ctx.state.globals.NativeBattleEnded)settleVictory(ctx);
 return result;
}
export function resolveNativeEnemyArea(ctx,uid) {
 const source=ctx.state.entities.find(a=>a.uid===uid);if(!source)return false;
 const result=resolveSkill(rulesContext(ctx),source,{skillId:'enemy_magic_area',targetType:'allEnemies',tags:['magic'],effects:[{effectType:'damage'}]},ctx.state.entities.filter(a=>a.kind==='hero'&&a.hp>0).map(a=>a.uid));
 if(!ctx.state.entities.some(actor=>actor?.kind==='hero'&&Number(actor.hp||0)>0))settleDefeat(ctx);
 else if(ctx.state.globals.NativeBattleEnded)settleVictory(ctx);
 return result;
}

function clearHeroTurnCardFan(g) {
 g.HeroTurnCardFanOpen=0;g.HeroTurnCardFanHeroUID=0;g.HeroTurnCardFanCards=[];g.HeroTurnCardFanSelectedCardId='';g.HeroTurnCardFanTargetUID=0;g.HeroTurnCardFanPendingCardIndex=-1;g.HeroTurnCardFanPendingCardId='';g.HeroTurnCardFanPendingTarget=0;g.HeroTurnCardFanPendingTargetKind='';g.HeroTurnCardFanPendingExcludeSelf=0;
}

export function settleDefeat(ctx) {
 const g=ctx.state.globals;
 clearHeroTurnCardFan(g);
 cancelNativeSequence(ctx);
 g.SessionLevelUpQueue=clearSessionLevelUpQueue();
 g.NativeBattleEnded=true;
 if(g.ProgressionBattle){g.ProgressionBattle.outcome='defeat';g.ProgressionBattle.defeatSettled=true;g.ProgressionBattle.settled=true;g.ProgressionBattle.goldReward=0;g.ProgressionResults=[];}
 return true;
}

export function settleVictory(ctx) {
 const g=ctx.state.globals;
 clearHeroTurnCardFan(g);
 if(!g.NativeBattleEnded||!g.ProgressionBattle||g.ProgressionBattle.settled||g.HeroProgress?.settledBattles?.includes(g.ProgressionBattle.id))return;
 cancelNativeSequence(ctx);
 const heroes=ctx.state.entities.filter(a=>a.kind==='hero');
 const participants=heroes.filter(hero=>g.ProgressionBattle.participants.includes(hero.heroInstanceKey||hero.baseHeroName||hero.name));
 g.ProgressionResults=settleBattleEXP(g.HeroProgress,g.ProgressionBattle,participants);
 g.SessionLevelUpQueue=createSessionLevelUpQueue({heroes:participants,progressionResults:g.ProgressionResults});
 g.ProgressionBattle.outcome='victory';
 g.ProgressionBattle.goldReward=Object.values(g.ProgressionBattle.defeatedGold||{}).reduce((sum,value)=>sum+value,0);
 g.goldTotal=Number(g.goldTotal||0)+g.ProgressionBattle.goldReward;
 g.HeroProgressDirty=true;
}
export function getSessionLevelUpQueueState(ctx){return ctx.state.globals.SessionLevelUpQueue||clearSessionLevelUpQueue();}
export function getCurrentSessionLevelUpEntry(ctx){return currentSessionLevelUpEntry(getSessionLevelUpQueueState(ctx));}
export function pauseSessionLevelUpRewards(ctx){const g=ctx.state.globals;g.SessionLevelUpQueue=pauseSessionLevelUpQueue(getSessionLevelUpQueueState(ctx));return g.SessionLevelUpQueue;}
export function resumeSessionLevelUpRewards(ctx){const g=ctx.state.globals;g.SessionLevelUpQueue=resumeSessionLevelUpQueue(getSessionLevelUpQueueState(ctx));return g.SessionLevelUpQueue;}
export function acknowledgeSessionLevelUpReward(ctx){const g=ctx.state.globals;g.SessionLevelUpQueue=acknowledgeSessionLevelUpEntry(getSessionLevelUpQueueState(ctx));return g.SessionLevelUpQueue;}
