import { heroDefinition, heroKey, heroSkillUnlocked } from './heroDefinitions.mjs';
import { enemiesInSkillShape, isHeroSupportTargetInRange, selectRealtimeHeroSkillTarget } from './realtimeHeroTargeting.mjs';
import { isActorTargetInRange } from '../../../src/core/heroAttackTargetingRules.mjs';
import { activeCombatEffect, incomingReduction, resolveBasicInterval, projectCombatStat } from '../../../src/core/combatModifierRules.mjs';
import { ensureSkillBattle, realtimeCombatStat, actorCombatModifiers, skillModifiers } from './realtimeSkillState.mjs';
export { realtimeCombatStat } from './realtimeSkillState.mjs';
const nowOf = g => Number(g.time || 0);
const living = a => Number(a?.hp || 0)>0;
const actor = (ctx,uid)=>ctx.state.entities.find(a=>Number(a.uid)===Number(uid));
const point = a=>({x:Number(a?.footX ?? a?.x ?? 0),y:Number(a?.footY ?? a?.y ?? 0)});
const targetableEnemy = target => living(target) && target?.streamState !== 'approaching';
const effects = g=>g.RealtimeSkillEffects ||= {};
export function realtimeEffect(g,uid,id) {
  const record=effects(g)[String(uid)]?.[id];
  return activeCombatEffect(record,nowOf(g))?record:null;
}
const grant = (g,source,target,id,seconds,extra={}) => {
  (effects(g)[String(target.uid)] ||= {})[id]={sourceUID:source.uid,appliedAt:nowOf(g),expiresAt:nowOf(g)+seconds,...extra};
};
const damage = (ctx,source,target,pct,mode)=>{
  if(!living(source)||!targetableEnemy(target))return 0;
  const amount=ctx.callFunction('CalculateDamage',source.uid,target.uid,mode,pct);
  return ctx.callFunction('ApplyDamageToTarget',target.uid,amount,{sourceUID:source.uid,suppressPartySkillHitHooks:1,actionKind:'skill'}) || 0;
};
const rawDamage = (ctx,source,target,raw,mode)=>{
  // Ongoing effects already committed their source eligibility at cast time.
  // Their tick lifetime belongs to the effect record, including Blight's
  // existing source-KO behavior.
  if(!targetableEnemy(target))return 0;
  return ctx.callFunction('ApplyRealtimeRawDamage',source.uid,target.uid,raw,mode) || 0;
};
const heal = (ctx,source,target,pct,revive=false)=>ctx.callFunction('HealRealtimeActor',source.uid,target.uid,pct,revive) || 0;
export const REALTIME_SKILL_ELEMENTS = {challenge_bolt:'mark',iron_resolve:'bloom',brace:'metal',retaliation_burst:'earth',shield_slam:'wind',crimson_ward:'blood',destiny:'bloom',cover:'light',ambush:'dark',cheap_shot:'metal',razor_sweep:'wind',piercing_throw:'metal',finish_the_job:'blood',split:'wind',arcane_pulse:'wind',overrun:'metal',frost_reversal:'ice',hex_beacon:'dark',burn_sigil:'fire',null_field:'void',return_gate:'arcane',faze:'dark',chain_strike:'lightning',cataclysm:'fire',wishgrant:'light',quickload:'lightning',shared_tempo:'wind',patchwork:'bloom',fortunes_blessing:'mark',magic_fruit:'bloom',grow:'light',shrink:'arcane',sanctuary:'bloom'};
export function realtimeBasicInterval(g,hero,ordinary) { return resolveBasicInterval(ordinary,effects(g)[String(hero.uid)],nowOf(g)); }
export function realtimeProvokeTarget(ctx,enemy,preferred) {
  const source=actor(ctx,realtimeEffect(ctx.state.globals,enemy?.uid,'provoke')?.sourceUID);
  return living(source)&&source.kind==='hero'?source:preferred;
}
export function realtimeCoverTarget(ctx,target) {
  const source=actor(ctx,realtimeEffect(ctx.state.globals,target?.uid,'cover')?.sourceUID);
  return living(source)&&source.kind==='hero'&&source.uid!==target.uid?source:target;
}
export function realtimeIncomingDamage(ctx,target,source,amount) {
  const g=ctx.state.globals;
  if(Number(g.ContinuousCombatStageLoop)!==1||target?.kind!=='hero'||source?.kind!=='enemy')return amount;
  const entries=effects(g)[String(target.uid)] || {}, cut=incomingReduction(entries,nowOf(g));
  const brace=realtimeEffect(g,target.uid,'brace');
  if(brace && --brace.charges<=0)delete entries.brace;
  return Math.max(0,Math.floor(amount*(1-cut)));
}
export function realtimeMagicBlocked(g,enemy) { return Number(g.ContinuousCombatStageLoop)===1 && !!realtimeEffect(g,enemy?.uid,'null_field'); }
export function castRealtimeHeroSkill(ctx,heroUID,skill,selection,displacement={}) {
  const g=ctx.state.globals, source=actor(ctx,heroUID);
  if(!living(source)||!skill||!selection||!heroSkillUnlocked(source,skill))return false;
  const battle=ensureSkillBattle(ctx), now=nowOf(g);
  // The action queue owns poll cooldowns. Commit rechecks live conditions and recipients.
  const fresh=selectRealtimeHeroSkillTarget({skill,hero:source,heroes:ctx.state.entities.filter(a=>a.kind==='hero'),enemies:ctx.state.entities.filter(a=>a.kind==='enemy'),globals:g,effects:effects(g),zones:g.RealtimeSkillZones,now,event:selection.event,
    statReader:(a,stat)=>ctx.callFunction('GetEffectiveStat',a,stat)});
  if(!fresh)return false;
  source.actionState='cast';
  source.actionFacing=source.facing;
  source.actionStateStartedAt=now;
  source.actionImpactAt=now;
  source.actionStateUntil=now+0.42;
  const targets=fresh.targetUIDs.map(uid=>actor(ctx,uid)).filter(Boolean), target=actor(ctx,fresh.targetUID);
  const spec=skill.effectSpec, mode=heroKey(source)==='Runa'?'magic':'melee';
  let feedback='';
  switch(spec.kind) {
    case 'damage': case 'damagePush': case 'damageRetreat': case 'damageDelay': case 'damageProvoke': case 'finisher':
      for(const victim of targets) {
        damage(ctx,source,victim,spec.damagePct,mode);
        if(!living(victim))continue;
        if(spec.kind==='damagePush' && victim.combatRank!=='boss')displacement.push?.(victim,skill.pushDistance,now,source);
        if(spec.kind==='damageRetreat' && victim.combatRank!=='boss')displacement.reverse?.(victim,now,skill.durationSeconds,source);
        if(spec.kind==='damageProvoke')grant(g,source,victim,'provoke',skill.durationSeconds);
        if(spec.kind==='damageDelay') {
          const clocks=g.RealtimeEnemyActionReadyAt ||= {}, key=String(victim.uid);
          clocks[key]=Math.max(now,Number(clocks[key] || now))+skill.attackDelaySeconds;
          const ongoing=g.RealtimeEnemyActionsByUID?.[key]; if(ongoing?.active)ongoing.nextReadyAt=Math.max(Number(ongoing.nextReadyAt || now),clocks[key]);
        }
      }
      if(spec.kind==='finisher' && !living(target))for(const enemy of enemiesInSkillShape(ctx.state.entities.filter(a=>a.kind==='enemy'),{kind:'circle',center:fresh.point,radius:skill.splashRadius}))damage(ctx,source,enemy,skill.splashPct,mode);
      break;
    case 'split': {
      const budget=Math.floor(ctx.callFunction('GetEffectiveStat',source,'ATK')*spec.damagePct/100),part=Math.floor(budget/targets.length);
      targets.forEach((victim,index)=>rawDamage(ctx,source,victim,part+(index<budget%targets.length?1:0),'melee')); break;
    }
    case 'chain':
      if(!(fresh.event.rawDamage>0))return false;
      for(const victim of targets)rawDamage(ctx,source,victim,Number(fresh.event.rawDamage || 0)*spec.bouncePct/100,'magic'); break;
    case 'heal':
      if(!targets.reduce((total,victim)=>total+heal(ctx,source,victim,spec.healPctMaxHP),0))return false; break;
    case 'sanctuary': {
      for(const victim of targets) {
        if(!living(victim)) { ensureSkillBattle(ctx); heal(ctx,source,victim,30,true); }
        else heal(ctx,source,victim,20);
      }
      break;
    }
    case 'ward':
      g.PartyTempHPShield=Math.floor(targets.reduce((sum,a)=>sum+Number(a.maxHP),0)*.18);
      if(g.PartyTempHPShield<=0)return false;
      g.PartyTempHPShieldTargetUIDs=targets.map(a=>Number(a.uid));
      g.PartyTempHPShieldSourceUID=source.uid; ctx.callFunction('StartRealtimeWardPresentation'); break;
    case 'fruit':
      battle.magicFruitUsed=1;
      battle.fruitUIDs=ctx.state.entities.filter(a=>a.kind==='hero'&&living(a)&&isHeroSupportTargetInRange(source,a)).map(a=>Number(a.uid));
      ensureSkillBattle(ctx); heal(ctx,source,target,32); break;
    case 'grow':
      battle.growTier=Math.min(3,Number(battle.growTier)+1);
      for(const victim of targets)(battle.growTiersByUID ||= {})[String(victim.uid)]=battle.growTier;
      ensureSkillBattle(ctx); ctx.callFunction('UpdateHeroHPUI'); break;
    case 'brace':
      grant(g,source,source,'brace',skill.durationSeconds,{charges:skill.charges,damageCutPct:skill.damageCutPct}); break;
    case 'cover':
      for(const victim of targets)grant(g,source,victim,'cover',skill.durationSeconds,{damageCutPct:victim.uid===source.uid?skill.damageCutPct:0}); break;
    case 'modifier':
      if(skill.randomStats) {
        const random=Number(g.RuntimeRandom());
        if(skill.randomStats[Math.floor(random*skill.randomStats.length)]!==fresh.effectChoice)throw new Error('Combat RNG preview diverged from its owner');
        feedback=` (${fresh.effectChoice} +25%)`;
      }
      for(const victim of targets)grant(g,source,victim,spec.effectId,skill.durationSeconds,{modifiers:skillModifiers(spec.effectId,fresh.effectChoice),data:{stat:fresh.effectChoice}});
      break;
    case 'quickload': case 'tempo': case 'null':
      for(const victim of targets)grant(g,source,victim,skill.skillId,skill.durationSeconds);
      if(spec.kind==='quickload') {
        const clock=g.RealtimeHeroBasicClocks?.[String(target.uid)]; if(clock)clock.basicReadyAt=Math.min(Number(clock.basicReadyAt || now+.4),now+.4);
      }
      break;
    case 'regen': case 'blight':
      for(const victim of targets)grant(g,source,victim,spec.kind==='blight'?'blight':skill.skillId,skill.durationSeconds,{nextTickAt:now+spec.intervalSeconds,ticksRemaining:spec.ticks,data:{...spec}}); break;
    case 'teleport':
      if(!displacement.teleport?.(target,skill.teleportDistance,now,source))return false; break;
    case 'zone':
      (g.RealtimeSkillZones ||= []).push({kind:skill.skillId,sourceUID:source.uid,point:fresh.point,radius:skill.radius,appliedAt:now,expiresAt:now+skill.durationSeconds,nextTickAt:now+1,damagePct:spec.damagePct}); break;
    default: throw new Error(`Unknown skill effect: ${spec.kind}`);
  }
  g.LastRealtimeHeroSkill={heroUID:source.uid,skillId:skill.skillId,at:now,targetUID:target?.uid || 0,feedback};
  for(const recipient of targets)(g.CombatImpactRequests ||= []).push({at:now,heroUID:source.uid,targetUID:recipient.uid,...(recipient.kind==='enemy'?{point:point(recipient)}:{}),skillId:skill.skillId,elementalSlug:REALTIME_SKILL_ELEMENTS[skill.skillId],damage:spec.damagePct || 0});
  ctx.callFunction('LogCombat',`${heroDefinition(source).name}: ${skill.displayName}${feedback}`);
  return true;
}
export function cleanupRealtimeSkillActors(ctx) {
  const g=ctx.state.globals;
  for(const [uid,entries] of Object.entries(effects(g))) {
    const target=actor(ctx,uid);
    if(!living(target)) { delete effects(g)[uid]; continue; }
    for(const [id,entry] of Object.entries(entries))if(['provoke','cover'].includes(id)&&!living(actor(ctx,entry.sourceUID)))delete entries[id];
  }
  g.RealtimeSkillZones=(g.RealtimeSkillZones || []).filter(zone=>living(actor(ctx,zone.sourceUID)));
  if(g.PartyTempHPShieldSourceUID&&!living(actor(ctx,g.PartyTempHPShieldSourceUID))) {g.PartyTempHPShield=0;g.PartyWardBarrierActive=0;g.PartyWardBarrierVisualsByUID={};delete g.PartyTempHPShieldSourceUID;}
}
export function tickRealtimeHeroSkillZones(ctx) {
  const g=ctx.state.globals;
  if(g.GamePaused || g.CombatPaused || g.BattlePaused || g.DevToolingPaused || g.QaScenarioPaused)return;
  cleanupRealtimeSkillActors(ctx); ensureSkillBattle(ctx);
  const now=nowOf(g);
  for(const zone of g.RealtimeSkillZones || []) {
    const source=actor(ctx,zone.sourceUID);
    while(zone.nextTickAt<=Math.min(now,zone.expiresAt)) {
      for(const target of enemiesInSkillShape(ctx.state.entities.filter(a=>a.kind==='enemy'),{kind:'circle',center:zone.point,radius:zone.radius}))damage(ctx,source,target,zone.damagePct,'magic');
      zone.nextTickAt+=1;
    }
  }
  g.RealtimeSkillZones=(g.RealtimeSkillZones || []).filter(zone=>zone.expiresAt>now);
  for(const [uid,entries] of Object.entries(effects(g)))for(const [id,entry] of Object.entries(entries)) {
    const source=actor(ctx,entry.sourceUID),target=actor(ctx,uid);
    while(living(target)&&entry.ticksRemaining>0&&entry.nextTickAt<=Math.min(now,entry.expiresAt)) {
      if(id==='blight')rawDamage(ctx,source || {uid:entry.sourceUID},target,entry.data.rawDamage,'magic');
      else heal(ctx,source || {uid:entry.sourceUID},target,entry.data.healPctMaxHP);
      entry.ticksRemaining--;entry.nextTickAt+=entry.data.intervalSeconds;
    }
    if(entry.expiresAt<=now)delete entries[id];
  }
  cleanupRealtimeSkillActors(ctx); ensureSkillBattle(ctx);
}
export function realtimeBasicDamageMultiplier(g,source) {return projectCombatStat(1,'damageAmp',actorCombatModifiers(g,source));}
function castReaction(ctx,source,skillId,event,displacement={}) {
  if(!living(source))return false;
  const g=ctx.state.globals,skill=heroDefinition(source)?.actives.find(a=>a.skillId===skillId);
  if(!skill||!heroSkillUnlocked(source,skill))return false;
  const clocks=g.RealtimeHeroBasicClocks ||= {},clock=clocks[String(source.uid)] ||= {skillReadyAt:{}};
  if(Number(clock.skillReadyAt?.[skillId] || 0)>nowOf(g))return false;
  const fired=castRealtimeHeroSkill(ctx,source.uid,skill,{event},displacement);
  if(fired)(clock.skillReadyAt ||= {})[skillId]=nowOf(g)+skill.cooldownSeconds;
  return fired;
}
export function realtimeBasicFollowups(ctx,source,target,hpDamage,raw=0) {
  if(heroKey(source)!=='Runa'||hpDamage<=0)return false;
  return castReaction(ctx,source,'chain_strike',{sourceUID:source.uid,targetUID:target.uid,actionKind:'basic',isPrimary:true,hpDamage,rawDamage:raw,point:point(target)});
}
export function realtimeRetaliation(ctx,damagedHero,attackerUID,displacement={},hpDamage=1) {
  if(heroKey(damagedHero)!=='Falie'||Number(ctx.state.globals.ContinuousCombatStageLoop)!==1||hpDamage<=0)return false;
  return castReaction(ctx,damagedHero,'retaliation_burst',{sourceUID:attackerUID,targetUID:damagedHero.uid,actionKind:'enemy',isPrimary:true,hpDamage},displacement);
}
