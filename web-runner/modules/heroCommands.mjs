import {actionCapacity} from '../src/core/actionSelection.mjs';
import {clearSessionLevelBuffState} from '../../src/core/sessionLevelBuffOffers.mjs';
import {settleBattleEXP} from '../src/core/heroProgression.mjs';
import {heroDefinition,PROGRESSION} from '../src/core/heroDefinitions.mjs';
import {getHeroFlowState,getHeroSkillOptions} from '../src/core/personalFlow.mjs';
import {applyStatus,effectiveStat,legalSkill,statuses,validTargets,resolveSkill,turnStart,turnEnd} from '../src/core/combatRules.mjs';
import {derivePresentationTurnBarrier} from '../src/core/turnGateController.mjs';
import {acknowledgeSessionLevelUpEntry,clearSessionLevelUpQueue,createSessionLevelUpQueue,currentSessionLevelUpEntry,pauseSessionLevelUpQueue,resumeSessionLevelUpQueue} from '../src/core/sessionLevelUpQueue.mjs';
import {beginSessionLevelUpSettlement,chooseSessionLevelUpBuff as choosePresentedSessionLevelUpBuff,getActiveSessionLevelUpBuffCards,getSessionLevelUpBuffPresentation,updateSessionLevelUpSettlement} from './sessionLevelUpBuffPresentation.mjs';
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

const sessionBuffHeroId = hero => String(hero?.heroInstanceKey ?? hero?.uid ?? '');
const sessionRandom = globals => typeof globals?.RuntimeRandom === 'function' ? Number(globals.RuntimeRandom()) : Math.random();
const hasEffect = (globals, hero, effectId) => getActiveSessionLevelUpBuffCards(globals, hero).some(card => card.effectId === effectId);
function sessionBuffCounter(globals, hero, effectId) {
 const state=globals.SessionLevelBuffState?.heroes?.[sessionBuffHeroId(hero)];if(!state)return 0;
 const counters=state.triggerCountersByEffectId||(state.triggerCountersByEffectId={});counters[effectId]=Math.max(0,Number(counters[effectId]||0))+1;return counters[effectId];
}
export function applySessionLevelBuffsAtBattleStart(ctx,rules){
 const g=ctx.state.globals,session=Number(g.CombatSessionId||0);if(g.SessionLevelBuffCombatSessionId===session)return;
 g.SessionLevelBuffCombatSessionId=session;
 for(const hero of ctx.state.entities.filter(actor=>actor?.kind==='hero')){
  const cards=getActiveSessionLevelUpBuffCards(g,hero);
  const statBonus={},maxHpMultipliers=[],shields=[];
  for(const card of cards){const formula=card.formula||{};
   if(formula.surface==='stat_percent'&&formula.stat!=='max_hp')statBonus[String(formula.stat).toLowerCase()]=(statBonus[String(formula.stat).toLowerCase()]||0)+Number(formula.percent||0);
   if(formula.surface==='stat_percent'&&formula.stat==='max_hp')maxHpMultipliers.push(1+Number(formula.percent||0));
   if(formula.surface==='bargain_percent'){statBonus[String(formula.benefitStat).toLowerCase()]=(statBonus[String(formula.benefitStat).toLowerCase()]||0)+Number(formula.benefitPercent||0);maxHpMultipliers.push(1+Number(formula.penaltyPercent||0));}
   if(formula.surface==='shield_percent_max_hp')shields.push(Number(formula.percent||0));
  }
  for(const [stat,magnitude] of Object.entries(statBonus))applyStatus(rules,hero,hero,{effectType:'status',statusEffect:`${stat}Up`,magnitude,duration:9999});
  if(maxHpMultipliers.length){hero.maxHP=Math.max(1,Math.floor(maxHpMultipliers.reduce((value,multiplier)=>value*multiplier,Math.max(1,Number(hero.maxHP||1)))));hero.hp=Math.min(hero.maxHP,hero.hp);}
  for(const magnitude of shields)applyStatus(rules,hero,hero,{effectType:'status',statusEffect:'barrier',magnitude,duration:9999});
 }
}
export function resolveSessionLevelBasicEffects(ctx,rules,hero,targetIds){
 const g=ctx.state.globals,target=ctx.state.entities.find(actor=>Number(actor.uid)===Number(targetIds?.[0])&&actor.hp>0);
 if(!target)return;
 for(const card of getActiveSessionLevelUpBuffCards(g,hero)){const formula=card.formula||{};
  if(formula.surface==='cadence_magic_damage'&&sessionBuffCounter(g,hero,card.effectId)%Math.max(1,Number(formula.everyCompletedBasics||1))===0)resolveSkill(rules,hero,{skillId:'session_spectral_orb',targetType:'enemy',tags:['magic'],effects:[{effectType:'damage',fixedDamage:Number(formula.amount||0)}]},[target.uid],{sessionBuffExtraHit:true});
  if(formula.surface==='heal_percent_max_hp'&&sessionRandom(g)<Number(formula.chance||0))resolveSkill(rules,hero,{skillId:'session_inner_flow',targetType:'self',tags:['magic'],effects:[{effectType:'heal',recipient:'self',potency:Number(formula.percent||0)}]},[hero.uid],{sessionBuffExtraHit:true});
  if(formula.surface==='status_on_basic'&&sessionRandom(g)<Number(formula.chance||0))resolveSkill(rules,hero,{skillId:'session_saffron_mark',targetType:'enemy',tags:['magic'],effects:[{effectType:'status',statusEffect:String(formula.statusId||'mark'),magnitude:1,duration:Number(formula.durationTurns||1)}]},[target.uid],{sessionBuffExtraHit:true});
  if(formula.surface==='bounce_percent_damage'&&sessionRandom(g)<Number(formula.chance||0)){const bounce=ctx.state.entities.find(actor=>actor?.kind==='enemy'&&actor.hp>0&&actor.uid!==target.uid)||target;resolveSkill(rules,hero,{skillId:'session_mirage_chain',targetType:'enemy',tags:['physical'],effects:[{effectType:'damage',potency:Number(formula.damagePercent||0)}]},[bounce.uid],{sessionBuffExtraHit:true});}
 }
}
export function resolveSessionLevelCounter(ctx,rules,hero,source){
 const card=getActiveSessionLevelUpBuffCards(ctx.state.globals,hero).find(candidate=>candidate.formula?.surface==='counter_percent_atk');if(!card||hero.hp<=0||source?.hp<=0||sessionRandom(ctx.state.globals)>=Number(card.formula.chance||0))return false;
 return resolveSkill(rules,hero,{skillId:'session_glass_reprisal',targetType:'enemy',tags:['physical'],effects:[{effectType:'damage',potency:Number(card.formula.damagePercent||0)},{effectType:'heal',recipient:'self',potency:Number(card.formula.healPercentMaxHp||0)}]},[source.uid],{sessionBuffExtraHit:true,isCounter:true});
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
 if(executed){if(action.skill.skillId===heroDefinition(actor)?.basic?.skillId)resolveSessionLevelBasicEffects(ctx,rules,actor,action.targetIds);if(action.skill.isFlowSpecial)actor.flow=0;ctx.callFunction('LogCombat',`${heroDefinition(actor).name}: ${action.skill.displayName}`);}
 else actor.sp=Math.min(actor.spMax,actor.sp+action.spCost);
 s.index++;ctx.callFunction('UpdateHeroHPUI');ctx.callFunction('UpdateEnemyHPUI');
 if(actor.hp<=0||rules.isOver()){cancelNativeSequence(ctx);if(g.NativeBattleEnded)settleVictory(ctx);return true;}
 if(s.index<s.actions.length)g.PendingHeroHits.push({...hit,at:Number(g.time||0)+0.4});else delete g.NativeCommandSequence;
 return true;
}
export function nativeTurnStarted(ctx,actor){
 if(!actor)return;
 const rules=rulesContext(ctx);
 applySessionLevelBuffsAtBattleStart(ctx,rules);
 const serial=ctx.state.globals.TurnSerial||0;
 if(actor.hp>0&&actor.combatTurnSerial!==serial){actor.remainingActionSlots=actionCapacity(actor);actor.reservedSP=0;}
 turnStart(rules,actor,serial);
 if(actor.hp<=0&&actor.kind==='enemy')ctx.callFunction('KillEnemyByUID',actor.uid,actor.slotIndex??0);
 if(rules.isOver())settleVictory(ctx);
 ctx.callFunction('UpdateHeroHPUI');
}
export function nativeTurnEnded(ctx,actor){if(!actor||actor.nativeEndedSerial===ctx.state.globals.TurnSerial)return;actor.nativeEndedSerial=ctx.state.globals.TurnSerial;turnEnd(actor);}
export function resolveIncomingNativeHit(ctx,source,target,amount,options={}) {
 const rules=rulesContext(ctx),before=Number(target?.hp||0);const result=resolveSkill(rules,source,{skillId:'enemy_attack',targetType:'enemy',tags:[options.magic?'magic':'physical'],effects:[{effectType:'damage',fixedDamage:amount,fixedTargetUID:target.uid}]},[target.uid]);
 if(result&&target?.kind==='hero'&&target.hp>0&&Number(target.hp||0)<before)resolveSessionLevelCounter(ctx,rules,target,source);
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
 delete g.SessionLevelUpSettlement;delete g.SessionLevelUpOffersByQueueIndex;
 g.SessionLevelBuffState=clearSessionLevelBuffState();delete g.SessionLevelBuffCombatSessionId;
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
 beginSessionLevelUpSettlement(g,g.ProgressionResults,participants,Number(g.time||0));
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
export function getSessionLevelUpBuffOffer(ctx){return getSessionLevelUpBuffPresentation(ctx.state.globals,ctx.state.entities,ctx.state.globals.SessionLevelProgress||{});}
export function chooseSessionLevelUpBuff(ctx,cardId){return choosePresentedSessionLevelUpBuff(ctx.state.globals,ctx.state.entities,cardId,Number(ctx.state.globals.time||0));}
export function updateSessionLevelUpSettlementPresentation(ctx){return updateSessionLevelUpSettlement(ctx.state.globals,Number(ctx.state.globals.time||0));}
