import {dropEnemyFlowOrbs} from './flowOrbs.mjs';
import {COMBAT_TUNING as T,heroDefinition} from './heroDefinitions.mjs';
import {unlockedPassives} from './heroProgression.mjs';
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const debuffs=new Set(['atkDown','defDown','magDown','resDown','spdDown','blind','silence','dot']);
export const statuses=actor=>actor.statuses||(actor.statuses=[]);
export const hasStatus=(actor,id)=>statuses(actor).some(s=>s.statusEffect===id);
export function effectiveStat(actor,key,base=actor.stats?.[key]||1){
 let multiplier=1;for(const s of statuses(actor)){if(s.statusEffect===key.toLowerCase()+'Up')multiplier+=s.magnitude;if(s.statusEffect===key.toLowerCase()+'Down')multiplier-=s.magnitude;}
 for(const p of unlockedPassives(actor))if(p.effect===key&&p.conditions?.criticalHP&&actor.hp/actor.maxHP<=T.criticalHP)multiplier+=p.magnitude;
 return Math.max(1,Math.floor(base*multiplier));
}
export function legalSkill(actor,skill){return !!skill&&actor.hp>0&&(actor.currentLevel||1)>=(skill.unlockLevel||1)&&(!hasStatus(actor,'silence')||!skill.tags?.includes('magic')||skill.ignoresSilence);}
export function validTargets(actors,actor,skill,ids){
 const type=skill.targetType;if(!['allAllies','allEnemies'].includes(type)&&new Set(ids||[]).size>1)return [];return [...new Set(ids||[])].map(uid=>actors.find(a=>a.uid===uid)).filter(t=>t&&(
 type==='self'?t.uid===actor.uid&&t.hp>0:type==='deadAlly'?t.kind===actor.kind&&t.hp<=0:
 ['ally','allAllies'].includes(type)?t.kind===actor.kind&&t.hp>0:t.kind===(actor.kind==='hero'?'enemy':'hero')&&t.hp>0));
}
export function targetCandidates(actors,actor,skill){return actors.filter(a=>validTargets(actors,actor,skill,[a.uid]).length);}
export function applyStatus(ctx,source,target,effect,origin={}){
 ctx.state.statusOrder ||= 0;
 const list=statuses(target),existing=list.find(s=>s.statusEffect===effect.statusEffect && (!['cover','barrier'].includes(effect.statusEffect) || s.sourceUID===source.uid));const magnitude=effect.magnitude||0,duration=effect.duration||1;
 if(effect.chance!=null&&ctx.random()>=effect.chance)return false;
 const resistance=target.statusResistance?.[effect.statusEffect]||0;if(resistance>0&&ctx.random()<resistance)return false;
 const refreshed=!existing||existing.duration<duration;
 if(existing){
  existing.duration=duration;
  if(effect.stackable)existing.magnitude+=magnitude;
  else if(magnitude>existing.magnitude){existing.magnitude=magnitude;existing.sourceUID=source.uid;existing.flowOwnerUID=origin.flowOwnerUID;existing.excludedFlowUIDs=origin.excludedFlowUIDs;existing.snapshotPotency=effect.snapshotPotency;}
  if(['provoke','cover'].includes(effect.statusEffect)){existing.appliedOrder=++ctx.state.statusOrder;existing.sourceUID=source.uid;}
 }else{
  const entry={...effect,magnitude,duration,sourceUID:source.uid,flowOwnerUID:origin.flowOwnerUID,excludedFlowUIDs:origin.excludedFlowUIDs,appliedOrder:++ctx.state.statusOrder};
  if(effect.statusEffect==='barrier')entry.remaining=Math.floor(target.maxHP*magnitude);
  if(['dot','hot'].includes(effect.statusEffect))entry.snapshotPotency=effect.snapshotPotency??Math.max(1,Math.floor(effectiveStat(source,'MAG')*(effect.potency||1)));
  list.push(entry);
 }
 return refreshed;
}
export function resolveKO(actor){if(actor.hp>0)return false;actor.hp=0;actor.isAlive=false;actor.statuses=statuses(actor).filter(s=>s.persistsThroughKO);return true;}
export function turnEnd(actor){actor.statuses=statuses(actor).map(s=>({...s,duration:s.duration-1})).filter(s=>s.duration>0);}
export function turnStart(ctx,actor,serial){
 if(!actor||actor.hp<=0||actor.combatTurnSerial===serial)return false;actor.combatTurnSerial=serial;
 let damage=0,healing=0;const periodic=statuses(actor).filter(s=>['dot','hot'].includes(s.statusEffect)&&(!s.requiresCasterActive||ctx.actors.find(a=>a.uid===s.sourceUID)?.hp>0));
 for(const s of periodic)if(s.statusEffect==='dot')damage+=s.snapshotPotency;else healing+=s.snapshotPotency;
 actor.hp=clamp(actor.hp+healing-damage,0,actor.maxHP);
 if(actor.hp===0){const last=periodic.filter(s=>s.statusEffect==='dot').at(-1);if(last&&actor.kind==='enemy')dropEnemyFlowOrbs(ctx,actor,{flowOwnerUID:last.flowOwnerUID,excludedFlowUIDs:last.excludedFlowUIDs});resolveKO(actor);ctx.onKO?.(actor);return false;}
 actor.sp=clamp((actor.sp||0)+(heroDefinition(actor)?.passiveSPRegenPerTurn||0),0,actor.spMax||0);
 return true;
}
function damageTarget(ctx,source,target,amount,origin){
 const before=target.hp;let remaining=Math.max(0,amount);
 for(const s of statuses(target).slice().sort((a,b)=>a.appliedOrder-b.appliedOrder)){
  let prevented=0;if(s.statusEffect==='damageCut')prevented=remaining*clamp(s.magnitude,0,1);
  if(s.statusEffect==='barrier'){prevented=Math.min(remaining,s.remaining||0);s.remaining-=prevented;}
  remaining-=prevented;
 }
 const dealt=ctx.applyDamage(source,target,Math.max(0,Math.floor(remaining)),origin);
 const actual=Math.min(before,Math.max(0,Number(dealt)||before-target.hp));
 if(target.hp<=0){if(target.kind==='enemy')dropEnemyFlowOrbs(ctx,target,origin);resolveKO(target);ctx.onKO?.(target);}
 return actual;
}
function accuracy(ctx,source,target,skill,origin){
 const blind=skill.tags?.includes('physical')&&!skill.ignoresBlind?statuses(source).find(s=>s.statusEffect==='blind')?.magnitude||0:0;
 if(ctx.random()>=clamp((skill.accuracy??T.accuracy)-blind,0,1))return false;
 const evasion=clamp(target.evasion||T.evasion,0,1);if(evasion&&ctx.random()<evasion){return false;}return true;
}
export function resolveSkill(ctx,source,skill,targetIds,origin={}){
 if(!legalSkill(source,skill))return false;
 let targets=validTargets(ctx.actors,source,skill,targetIds);if(!targets.length&&skill.retargetOnInvalid)targets=targetCandidates(ctx.actors,source,skill).slice(0,1);if(!targets.length)return false;
 const meta={...origin,flowOwnerUID:skill.isFlowSpecial?source.uid:origin.flowOwnerUID,excludedFlowUIDs:[...new Set([...(origin.excludedFlowUIDs||[]),origin.flowOwnerUID,...(skill.isFlowSpecial?[source.uid]:[])].filter(uid=>uid!=null))]};
 const defenders=new Map();
 if(source.kind==='enemy'&&skill.targetType==='enemy'&&!skill.ignoresProvoke){const provocations=ctx.actors.filter(a=>a.kind!==source.kind&&a.hp>0).flatMap(a=>statuses(a).filter(s=>s.statusEffect==='provoke').map(s=>({a,s}))).sort((a,b)=>b.s.appliedOrder-a.s.appliedOrder);if(provocations.length)targets=[provocations[0].a];}
 for(const original of targets){
  if(ctx.isOver?.())break;
  let defender=original,coverChosen=false,hitOK;
  for(const effect of skill.effects||[]){
   if(ctx.isOver?.())break;
   const recipient=effect.recipient==='self'?source:original;
   if(effect.effectType==='damage'){
    for(let hit=0;hit<(effect.hits||1);hit++){
     if(ctx.isOver?.())break;
     if(defender.hp<=0)defender=original;if(defender.hp<=0)break;
     if(hitOK===undefined||skill.accuracyPerHit)hitOK=accuracy(ctx,source,original,skill,meta);if(!hitOK)continue;
     if(!coverChosen){coverChosen=true;if(skill.targetType==='enemy'){
      const covers=statuses(original).filter(s=>s.statusEffect==='cover').map(s=>({s,a:ctx.actors.find(a=>a.uid===s.sourceUID&&a.hp>0&&a.uid!==original.uid)})).filter(c=>c.a).sort((a,b)=>b.s.appliedOrder-a.s.appliedOrder);
      if(covers.length){defender=covers[0].a;if(covers[0].s.coverCanEvade&&!accuracy(ctx,source,defender,{...skill,accuracy:1,ignoresBlind:true},meta))continue;}
     }}
     const amount=((defender===original&&(!effect.fixedTargetUID||defender.uid===effect.fixedTargetUID)?effect.fixedDamage:undefined)??ctx.calculateDamage(source,defender,skill.tags?.includes('magic')?'magic':'melee'))*(effect.potency??1);
     damageTarget(ctx,source,defender,amount,meta);defenders.set(defender.uid,defender);
    }
   }else if(effect.effectType==='status'&&recipient.hp>0)applyStatus(ctx,source,recipient,effect,meta);
   else if(['heal','revive'].includes(effect.effectType)){
    const before=recipient.hp;if(effect.effectType==='revive'?before===0:before>0){recipient.hp=clamp(before+(effect.amount??Math.floor(recipient.maxHP*(effect.potency??0.25))),0,recipient.maxHP);recipient.isAlive=recipient.hp>0;
}
   }else if(effect.effectType==='cleanse')recipient.statuses=statuses(recipient).filter(s=>!debuffs.has(s.statusEffect));
   else if(effect.effectType==='dispel')recipient.statuses=statuses(recipient).filter(s=>debuffs.has(s.statusEffect));
   else if(effect.effectType==='restoreSP')recipient.sp=clamp((recipient.sp||0)+effect.amount,0,recipient.spMax);
  }
 }
 if(!meta.isCounter&&!ctx.isOver?.()){
  const counters=[...defenders.values()].filter(a=>a.hp>0&&hasStatus(a,'counter')).sort((a,b)=>effectiveStat(b,'SPD')-effectiveStat(a,'SPD')||a.uid-b.uid);
  for(const actor of counters){if(ctx.isOver?.())break;if(actor.hp<=0||source.hp<=0||!hasStatus(actor,'counter'))continue;
   const status=statuses(actor).find(s=>s.statusEffect==='counter');resolveSkill(ctx,actor,{skillId:'counter',targetType:'enemy',tags:['physical'],effects:[{effectType:'damage',potency:status.magnitude||T.counterPotency}]},[source.uid],{isCounter:true,flowOwnerUID:status.flowOwnerUID??meta.flowOwnerUID,excludedFlowUIDs:[...(meta.excludedFlowUIDs||[]),...(status.excludedFlowUIDs||[])]});
  }
 }
 return true;
}
