import {actionCapacity} from '../src/core/actionSelection.mjs';
import {settleBattleEXP} from '../src/core/heroProgression.mjs';
import {heroDefinition,PROGRESSION} from '../src/core/heroDefinitions.mjs';
import {getHeroFlowState,getHeroSkillOptions,recordFlowThreshold,resolveRoleFlowAward} from '../src/core/personalFlow.mjs';
import {applyStatus,legalSkill,validTargets,resolveSkill,turnStart,turnEnd} from '../src/core/combatRules.mjs';
import {derivePresentationTurnBarrier} from '../src/core/turnGateController.mjs';
import {beginSessionLevelUpSettlement,updateSessionLevelUpSettlement} from './sessionLevelUpSettlementPresentation.mjs';
export {getHeroFlowState,getHeroSkillOptions};
export function getHeroCommandSlots(entities){const slots=Array(6).fill(null);for(const hero of entities){const i=Number(hero.heroDisplaySlot??hero.displaySlot??hero.heroIndex);if(hero?.kind==='hero'&&Number.isInteger(i)&&i>=0&&i<6)slots[i]=hero;}return slots;}
export function emitResolvedHealEvent(ctx, source, target, beforeHP, { allowRevive = false, presentation = 'minor' } = {}) {
 const before=Math.max(0,Number(beforeHP||0)),after=Math.max(0,Number(target?.hp||0));
 const delta=Math.max(0,after-before);
 if(!target||delta<=0||(!allowRevive&&before<=0)||!['hero','enemy'].includes(String(target.kind||'')))return 0;
 const g=ctx.state.globals,slot=Number(target.heroDisplaySlot??target.heroIndex??-1);
 const rest=target.kind==='hero'?(g.HeroRestFeetPosByUID?.[Number(target.uid||0)]||g.HeroRestBasePosByUID?.[Number(target.uid||0)]):null;
 const portraits=target.kind==='hero'?(g.HeroPortraitPosByIndex||g.HeroIconPosByIndex):null;
 const portrait=Array.isArray(portraits)&&slot>=0?portraits[slot]:null;
 const pos=[rest,portrait,target].find(candidate=>candidate&&Number.isFinite(Number(candidate.x))&&Number.isFinite(Number(candidate.y)))||target;
 const texts=Array.isArray(g.DamageTexts)?g.DamageTexts:[];const count=texts.length;
 ctx.callFunction('SpawnDamageText',delta,Number(pos?.x||0),Number(pos?.y||0),'heal',target.kind);
 const emitted=Array.isArray(g.DamageTexts)&&g.DamageTexts.length>count?g.DamageTexts.at(-1):null;
 const now = Number(g.time || 0), bloomReleaseAt = now + 1.5;
 if(emitted){emitted.targetUID=Number(target.uid||0);emitted.targetSlotIndex=slot;emitted.ownerUID=Number(source?.uid||target.uid||0);emitted.healPresentation=presentation==='major'?'major':'minor';emitted.notBefore=bloomReleaseAt;}
 const presentationReleaseAt = bloomReleaseAt + .18 + .7 + .45;
 g.TextAnimEndAt = Math.max(Number(g.TextAnimEndAt||0), presentationReleaseAt);
 g.ActionLockUntil = Math.max(Number(g.ActionLockUntil || 0), presentationReleaseAt);
 const actionOwnerUID = Number(g.ActionActorUID || g.ActionOwnerUID || 0);
 if (actionOwnerUID) {
  g.DeferAdvance = 1;
  g.AdvanceAfterAction = 1;
  g.ActionOwnerUID = actionOwnerUID;
 }
 const ownerUID = Number(source?.uid || 0), heroAction = g.HeroAction;
 if (ownerUID && heroAction?.active && Number(heroAction.uid || 0) === ownerUID && heroAction.state === 'ADVANCE') {
  const priorStartAfter = Math.max(now, Number(heroAction.presentationStartAfter || now));
  const delay = Math.max(0, presentationReleaseAt - priorStartAfter);
  heroAction.presentationStartAfter = Math.max(priorStartAfter, presentationReleaseAt);
  if (delay > 0) for (const hit of g.PendingHeroHits || []) {
   if (Number(hit?.heroUID || 0) === ownerUID && Number(hit.at || 0) >= now) hit.at = Number(hit.at || 0) + delay;
  }
 }
 return delta;
}
export function canUseHeroCommand(ctx,actorUID){
 const g=ctx.state.globals,hero=ctx.state.entities.find(a=>a.uid===actorUID&&a.kind==='hero'),roster=ctx.callFunction('GetEnemyRosterStability'),barrier=derivePresentationTurnBarrier({globals:g}),currentTurn=Number(ctx.callFunction('GetCurrentTurn'));
 const checks={heroExists:!!hero,heroLiving:Number(hero?.hp||0)>0,nativeBattleOpen:!g.NativeBattleEnded,runtimeReady:g.GamePhase==='RUNTIME',battleStartInactive:!g.BattleStartActive,idle:!g.IsPlayerBusy,turnPhase:Number(g.TurnPhase)===0,currentActor:currentTurn===Number(actorUID),rosterStable:roster?.stable===true,presentationClear:barrier.canClaimCombatAction};
 const allowed=Object.values(checks).every(Boolean);
 if(g.QaFixtureHoldTurn||g.QaFixtureExplicitAction)g.QaFixtureProcessTurnGate={...(g.QaFixtureProcessTurnGate||{}),reason:allowed?'hero-command-eligible':'hero-command-gate',commandChecks:checks,failedCommandChecks:Object.entries(checks).filter(([,value])=>!value).map(([key])=>key),sourceState:{nativeBattleStarted:!!g.NativeBattleStarted,nativeBattleEnded:!!g.NativeBattleEnded,gamePhase:String(g.GamePhase||''),battleStartActive:!!g.BattleStartActive,isPlayerBusy:!!g.IsPlayerBusy,actionInProgress:!!g.ActionInProgress,turnPhase:Number(g.TurnPhase||0),currentTurn,actorUID:Number(actorUID||0),canPickGems:Number(g.CanPickGems||0),deferAdvance:Number(g.DeferAdvance||0),pendingHeroHits:Array.isArray(g.PendingHeroHits)?g.PendingHeroHits.length:0,actionLockUntil:Number(g.ActionLockUntil||0),time:Number(g.time||0)},roster,barrier};
 return allowed;
}
export function rulesContext(ctx,roleEvents=null){
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
 return {actors:ctx.state.entities,state:g,flowRandom:()=>typeof g.FlowRandom==='function'?g.FlowRandom():Math.random(),random:()=>typeof g.RuntimeRandom==='function'?g.RuntimeRandom():Math.random(),
 calculateDamage:(a,t,mode)=>ctx.callFunction('CalculateDamage',a.uid,t.uid,mode),
 applyDamage:(a,t,amount,origin)=>{const before=t.hp;ctx.callFunction('ApplyDamageToTarget',t.uid,amount,{sourceUID:a.uid,nativeResolved:true,suppressPartySkillHitHooks:1,...origin});return before-t.hp;},
 onHeal:(source,target,delta,meta={})=>{if(delta>0)emitResolvedHealEvent(ctx,source,target,Math.max(0,Number(target?.hp||0)-Number(delta||0)),{allowRevive:true,presentation:meta.healPresentation==='minor'||meta.statusEffect==='hot'?'minor':['heal','revive'].includes(meta.effectType)?'major':'minor'});},
 onDamage:(source,target,delta,meta={})=>{if(roleEvents&&delta>0)roleEvents.push({type:'damage',sourceUID:Number(source?.uid||0),sourceKind:source?.kind,targetUID:Number(target?.uid||0),targetKind:target?.kind,delta:Number(delta||0),targetWasLiving:meta.targetWasLiving!==false});},
 onStatus:(source,target,effect,meta={})=>{if(roleEvents&&!meta.refreshed&&source?.kind==='hero')roleEvents.push({type:'status',sourceUID:Number(source.uid||0),targetUID:Number(target?.uid||0)});},
 onKO:actor=>{if(actor.kind==='enemy'){const battle=g.ProgressionBattle;if(battle){battle.defeated[actor.uid]=actor.expValue??PROGRESSION.enemyEXP;(battle.defeatedGold||={})[actor.uid]=Math.max(0,Math.floor(actor.goldValue??PROGRESSION.enemyGold));}}},
 isOver:()=>{
  const noLivingEnemy=!ctx.state.entities.some(a=>a.kind==='enemy'&&a.hp>0);
  const streamComplete=Number(g.ContinuousCombatStageLoop||0)!==1||Number(g.ContinuousCombatStageComplete||0)===1;
  const ended=noLivingEnemy&&streamComplete;
  if(ended)g.NativeBattleEnded=true;
  return ended;
 }};
}

function awardResolvedRoleFlow(ctx,events){
 if(Number(ctx?.state?.globals?.ContinuousCombatStageLoop||0)===1)return;
 const heroes=ctx.state.entities.filter(actor=>actor?.kind==='hero');
 const hostile=events.find(event=>event.type==='damage'&&event.sourceKind==='enemy'&&event.targetKind==='hero');
 for(const hero of heroes){
  const enemyDamage=events.some(event=>event.type==='damage'&&event.sourceUID===Number(hero.uid)&&event.targetKind==='enemy');
  const status=events.some(event=>event.type==='status'&&event.sourceUID===Number(hero.uid));
  const magicPressure=enemyDamage&&events.some(event=>event.type==='magic-action'&&event.sourceUID===Number(hero.uid));
  const award=resolveRoleFlowAward({heroes,hero,event:{source:'resolved-action',hostileHpDamage:hostile?.delta||0,hostileTargetUID:hostile?.targetUID||0,hostileTargetWasLiving:hostile?.targetWasLiving===true,enemyHpDamage:enemyDamage?1:0,newEligibleStatus:status,successfulMagicPressure:magicPressure},apply:true});
  if(!award)continue;
  const threshold=recordFlowThreshold(ctx.state.globals,hero,award.before,award.flow);
  if(threshold&&ctx.state.globals.QaLiveDestinyTrace){ctx.state.globals.QaLiveDestinyTrace.status='offer-pending';ctx.state.globals.QaLiveDestinyTrace.events.push({event:'natural-role-threshold',at:Number(ctx.state.globals.time||0),heroUID:Number(hero.uid||0),before:award.before,after:award.flow,token:threshold.token});}
  const audit=ctx.state.globals.FlowOrbAudit||{};
  ctx.state.globals.FlowOrbAudit={...audit,source:award.source,roleRecipientUID:award.recipientUID,roleValue:award.value,roleAwardCount:Number(audit.roleAwardCount||0)+1,pendingThresholdToken:threshold?.token||audit.pendingThresholdToken||''};
 }
}

function resolveRoleAction(ctx,source,skill,targetIds,origin={}){
 const events=[];const rules=rulesContext(ctx,events);const resolved=resolveSkill(rules,source,skill,targetIds,origin);
 if(resolved&&source?.kind==='hero'&&skill?.tags?.includes('magic'))events.push({type:'magic-action',sourceUID:Number(source.uid||0)});
 if(resolved)awardResolvedRoleFlow(ctx,events);
 return {resolved,rules,events};
}

export function buildCommandActions(ctx,hero,{queue=[],flow=false,targetUID}={}){
 const d=heroDefinition(hero);if(!d)return null;const entries=flow?[{skillId:d.special.skillId,targetIds:queue[0]?.targetIds||[targetUID]}]:queue.length?queue:[{skillId:d.basic.skillId,targetIds:[targetUID]}];
 if(entries.length>actionCapacity(hero))return null;
 const seen=new Set(),actions=[];
 for(const entry of entries){if(!entry||typeof entry!=='object')return null;const skill=[d.basic,...d.actives,d.special].find(s=>s.skillId===entry.skillId);if(!skill||!legalSkill(hero,skill)||(!flow&&skill.isFlowSpecial)||(flow&&(hero.flow||0)<skill.meterRequirement))return null;
 if(seen.has(skill.skillId)&&!skill.multiCast)return null;seen.add(skill.skillId);if(entries.length>1&&skill.skillId===d.basic.skillId)return null;
 const ids=entry.targetIds||[entry.targetId??targetUID];if(!validTargets(ctx.state.entities,hero,skill,ids).length)return null;actions.push({skillId:skill.skillId,targetIds:[...new Set(ids)],sequenceOrder:actions.length,skill});}
 return actions;
}
function nativeBasicAttackVfx(hero,action){
 const definition=heroDefinition(hero);if(action?.skill?.skillId!==definition?.basic?.skillId)return {};
 const name=String(definition?.name||hero?.name||'');
 return {attackVfxKind:name==='Runa'?'runa_bolt':name==='Kaja'?'kaja_orb':'impact',targetUID:Number(action.targetIds?.[0]||0),attackVfxTargetUIDs:[...(action.targetIds||[])]};
}
export function executeHeroCommand(ctx,command={}){
 const {actorUID}=command;if(!canUseHeroCommand(ctx,actorUID))return false;const hero=ctx.state.entities.find(a=>a.uid===actorUID),actions=buildCommandActions(ctx,hero,command);if(!actions)return false;
 const g=ctx.state.globals;if(ctx.callFunction('StartHeroLunge',actorUID)!==1)return false;
 hero.remainingActionSlots=0;
 const sequence={actorUID,actions,index:0,sessionId:g.CombatSessionId};g.NativeCommandSequence=sequence;
 g.PendingHeroHits=[{at:Number(g.time||0)+0.97,heroUID:actorUID,effectType:'native_command',sequence,...nativeBasicAttackVfx(hero,actions[0])}];g.AdvanceAfterAction=1;g.ActionOwnerUID=actorUID;return true;
}
export function cancelNativeSequence(ctx){const g=ctx.state.globals,s=g.NativeCommandSequence;if(!s)return;s.index=s.actions.length;delete g.NativeCommandSequence;}
export function resolveNativeCommandStep(ctx,hit){
 const g=ctx.state.globals,s=hit.sequence;if(!s||g.NativeCommandSequence!==s||s.sessionId!==g.CombatSessionId)return false;
 const actor=ctx.state.entities.find(a=>a.uid===s.actorUID);const rules=rulesContext(ctx);
 if(!actor||actor.hp<=0||rules.isOver()){cancelNativeSequence(ctx);return false;}
 const action=s.actions[s.index];const {resolved:executed,events}=resolveRoleAction(ctx,actor,action.skill,action.targetIds);
 if(executed){if(action.skill.skillId===heroDefinition(actor)?.basic?.skillId){hit.finalDmg=events.filter(event=>event.type==='damage'&&event.sourceUID===Number(actor.uid)&&action.targetIds.some(uid=>Number(uid)===Number(event.targetUID))).reduce((sum,event)=>sum+Number(event.delta||0),0);}if(action.skill.isFlowSpecial)actor.flow=0;ctx.callFunction('LogCombat',`${heroDefinition(actor).name}: ${action.skill.displayName}`);if(Object.keys(g.PendingDeaths||{}).length)ctx.callFunction('ResolvePendingEnemyDeaths');}
 s.index++;ctx.callFunction('UpdateHeroHPUI');ctx.callFunction('UpdateEnemyHPUI');
 if(actor.hp<=0||rules.isOver()){cancelNativeSequence(ctx);if(g.NativeBattleEnded)settleVictory(ctx);return true;}
 if(s.index<s.actions.length)g.PendingHeroHits.push({at:Number(g.time||0)+0.4,heroUID:s.actorUID,effectType:'native_command',sequence:s,...nativeBasicAttackVfx(actor,s.actions[s.index])});else delete g.NativeCommandSequence;
 return true;
}
export function nativeTurnStarted(ctx,actor){
 if(!actor)return;
 const rules=rulesContext(ctx);
 const serial=ctx.state.globals.TurnSerial||0;
 if(actor.hp>0&&actor.combatTurnSerial!==serial)actor.remainingActionSlots=actionCapacity(actor);
 turnStart(rules,actor,serial);
 if(actor.hp<=0&&actor.kind==='enemy')ctx.callFunction('KillEnemyByUID',actor.uid,actor.slotIndex??0);
 if(rules.isOver())settleVictory(ctx);
 ctx.callFunction('UpdateHeroHPUI');
}
export function nativeTurnEnded(ctx,actor){if(!actor||actor.nativeEndedSerial===ctx.state.globals.TurnSerial)return;actor.nativeEndedSerial=ctx.state.globals.TurnSerial;turnEnd(actor);}
export function resolveIncomingNativeHit(ctx,source,target,amount,options={}) {
 const before=Number(target?.hp||0);const {resolved:result,rules}=resolveRoleAction(ctx,source,{skillId:'enemy_attack',targetType:'enemy',tags:[options.magic?'magic':'physical'],effects:[{effectType:'damage',fixedDamage:amount,fixedTargetUID:target.uid}]},[target.uid]);
 if(!ctx.state.entities.some(actor=>actor?.kind==='hero'&&Number(actor.hp||0)>0))settleDefeat(ctx);
 else if(ctx.state.globals.NativeBattleEnded)settleVictory(ctx);
 return result;
}
export function resolveNativeEnemyArea(ctx,uid) {
 const source=ctx.state.entities.find(a=>a.uid===uid);if(!source)return false;
 const {resolved:result}=resolveRoleAction(ctx,source,{skillId:'enemy_magic_area',targetType:'allEnemies',tags:['magic'],effects:[{effectType:'damage'}]},ctx.state.entities.filter(a=>a.kind==='hero'&&a.hp>0).map(a=>a.uid));
 if(!ctx.state.entities.some(actor=>actor?.kind==='hero'&&Number(actor.hp||0)>0))settleDefeat(ctx);
 else if(ctx.state.globals.NativeBattleEnded)settleVictory(ctx);
 return result;
}

export function settleDefeat(ctx) {
 const g=ctx.state.globals;
 cancelNativeSequence(ctx);
 delete g.SessionLevelUpSettlement;
 g.NativeBattleEnded=true;
 if(g.ProgressionBattle){g.ProgressionBattle.outcome='defeat';g.ProgressionBattle.defeatSettled=true;g.ProgressionBattle.settled=true;g.ProgressionBattle.goldReward=0;g.ProgressionResults=[];}
 return true;
}

export function settleVictory(ctx) {
 const g=ctx.state.globals;
 if(!g.NativeBattleEnded||!g.ProgressionBattle||g.ProgressionBattle.settled||g.HeroProgress?.settledBattles?.includes(g.ProgressionBattle.id))return;
 cancelNativeSequence(ctx);
 const heroes=ctx.state.entities.filter(a=>a.kind==='hero');
 const participants=heroes.filter(hero=>g.ProgressionBattle.participants.includes(hero.heroInstanceKey||hero.baseHeroName||hero.name));
 g.ProgressionResults=settleBattleEXP(g.HeroProgress,g.ProgressionBattle,participants);
 beginSessionLevelUpSettlement(g,g.ProgressionResults,participants,Number(g.time||0));
 g.ProgressionBattle.outcome='victory';
 g.ProgressionBattle.goldReward=Object.values(g.ProgressionBattle.defeatedGold||{}).reduce((sum,value)=>sum+value,0);
 g.goldTotal=Number(g.goldTotal||0)+g.ProgressionBattle.goldReward;
 g.HeroProgressDirty=true;
}

export function settleContinuousCombatRewards(ctx) {
 const g=ctx.state.globals,battle=g.ProgressionBattle;
 if(!battle||battle.settled)return [];
 const heroes=ctx.state.entities.filter(actor=>actor?.kind==='hero');
 const participants=heroes.filter(hero=>battle.participants.includes(hero.heroInstanceKey||hero.baseHeroName||hero.name));
 const results=settleBattleEXP(g.HeroProgress,battle,participants);
 const gold=Object.values(battle.defeatedGold||{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0);
 g.goldTotal=Number(g.goldTotal||0)+gold;
 g.ProgressionResults=results;
 g.HeroProgressDirty=true;
 const serial=Number(g.ContinuousCombatRewardSerial||0)+1;
 g.ContinuousCombatRewardSerial=serial;
 g.ProgressionBattle={
  id:`continuous-${Number(g.CombatSessionId||0)}-${serial}`,
  participants:heroes.map(hero=>hero.heroInstanceKey),
  defeated:{},defeatedGold:{},settled:false,outcome:'active',
 };
 return results;
}
export function updateSessionLevelUpSettlementPresentation(ctx){return updateSessionLevelUpSettlement(ctx.state.globals,Number(ctx.state.globals.time||0));}
