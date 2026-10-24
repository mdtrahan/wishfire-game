import { CRIMSON_WARD, ELEVATE_SETS, heroDefinition, heroKey, heroSkillUnlocked } from './heroDefinitions.mjs';
import { selectRealtimeHeroSkillTarget } from './realtimeHeroTargeting.mjs';
import { isActorTargetInRange } from '../../../src/core/heroAttackTargetingRules.mjs';
import { activeCombatEffect, clamp, COMBAT_MODIFIER_LIMITS, incomingReduction, resolveBasicInterval, projectCombatStat, projectCombatMultiplier } from '../../../src/core/combatModifierRules.mjs';
import { heroPassive, heroPassiveIncomingCut, tickHeroPassiveAuras } from './realtimeHeroPassives.mjs';
import { dropHeroWard, grantHeroWard } from './heroWard.mjs';
import { ensureSkillBattle, realtimeCombatStat, actorCombatModifiers, rawCombatStat } from './realtimeSkillState.mjs';
import { heroStarSkillMultipliers } from './heroGrowthRules.mjs';
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
export const REALTIME_SKILL_ELEMENTS = Object.freeze({crimson_ward:'blood',shadow:'dark',bubble_pop:'water',elevate:'light'});
// Elevate's buff lasts until replaced by the next roll or until Kaja falls.
const UNTIL_REPLACED_SECONDS = 1e6;
export function realtimeSpecialCooldown(g, hero, skill) {
  return skill.cooldownSeconds * heroStarSkillMultipliers(g.HeroGrowth, hero.heroInstanceKey || hero.baseHeroName).specialCooldown;
}
// SPD buffs scale the basic interval by the clamped effective/base SPD ratio before Tempo-style effects.
export function realtimeBasicInterval(g,hero,ordinary) {
  const base=rawCombatStat(hero,'SPD'), effective=realtimeCombatStat(g,hero,'SPD');
  const rate=base>0?clamp(effective/base,...COMBAT_MODIFIER_LIMITS.SPD):1;
  return resolveBasicInterval(ordinary/rate,effects(g)[String(hero.uid)],nowOf(g));
}
export function realtimeIncomingDamage(ctx,target,source,amount) {
  const g=ctx.state.globals;
  if(Number(g.ContinuousCombatStageLoop)!==1||target?.kind!=='hero'||source?.kind!=='enemy')return amount;
  const cut=Math.min(.6,Math.max(incomingReduction(effects(g)[String(target.uid)] || {},nowOf(g)),heroPassiveIncomingCut(target,g)));
  return Math.max(0,Math.floor(amount*(1-cut)));
}
// Crimson Ward: every hero gains its own ward, capped at 50% of that hero's original max HP.
function castCrimsonWard(ctx,g,source,targets) {
  const battle=ensureSkillBattle(ctx);
  const original=hero=>Number(battle.baselinesByUID?.[String(hero.uid)]?.maxHP || hero.maxHP || 0);
  let gained=0;
  for(const hero of targets)gained+=grantHeroWard(g,hero,Math.floor(Number(hero.maxHP || 0)*CRIMSON_WARD.wardPctMaxHP/100),Math.floor(original(hero)*CRIMSON_WARD.capPctMaxHP/100));
  if(!(gained>0))return false;
  g.HeroWardSourceUID=source.uid;
  return true;
}
export function castRealtimeHeroSkill(ctx,heroUID,skill,selection,displacement={}) {
  const g=ctx.state.globals, source=actor(ctx,heroUID);
  if(!living(source)||!skill||!selection||!heroSkillUnlocked(source,skill))return false;
  ensureSkillBattle(ctx); const now=nowOf(g);
  // The action queue owns poll cooldowns. Commit rechecks live conditions and recipients.
  const fresh=selectRealtimeHeroSkillTarget({skill,hero:source,heroes:ctx.state.entities.filter(a=>a.kind==='hero'),enemies:ctx.state.entities.filter(a=>a.kind==='enemy'),globals:g,effects:effects(g),zones:g.RealtimeSkillZones,now,
    statReader:(a,stat)=>ctx.callFunction('GetEffectiveStat',a,stat)});
  if(!fresh)return false;
  source.actionState='cast';
  source.actionFacing=source.facing;
  source.actionStateStartedAt=now;
  source.actionImpactAt=now;
  source.actionStateUntil=now+0.42;
  const targets=fresh.targetUIDs.map(uid=>actor(ctx,uid)).filter(Boolean), target=actor(ctx,fresh.targetUID);
  const spec=skill.effectSpec, mode=heroKey(source)==='Runa'?'magic':'melee';
  const damagePct=(spec.damagePct || 0) * heroStarSkillMultipliers(g.HeroGrowth,source.heroInstanceKey || source.baseHeroName).specialMagnitude;
  let feedback='';
  switch(spec.kind) {
    case 'damageBlink':
      damage(ctx,source,target,damagePct,mode);
      displacement.blinkBehind?.(source,target,now); break;
    case 'damageRetreat':
      for(const victim of targets) {
        damage(ctx,source,victim,damagePct,'magic');
        if(living(victim) && victim.combatRank!=='boss')displacement.reverse?.(victim,now,skill.durationSeconds,source);
      }
      break;
    case 'ward':
      if(!castCrimsonWard(ctx,g,source,targets))return false; break;
    case 'elevate': {
      const random=Number(g.RuntimeRandom());
      if(skill.randomStats[Math.floor(random*skill.randomStats.length)]!==fresh.effectChoice)throw new Error('Combat RNG preview diverged from its owner');
      const set=ELEVATE_SETS[fresh.effectChoice];
      for(const entries of Object.values(effects(g)))if(entries.elevate?.sourceUID===source.uid)delete entries.elevate;
      for(const victim of targets)grant(g,source,victim,'elevate',UNTIL_REPLACED_SECONDS,{modifiers:set.modifiers.map(m=>({...m})),data:{set:fresh.effectChoice}});
      feedback=` (${set.label})`; break;
    }
    default: throw new Error(`Unknown skill effect: ${spec.kind}`);
  }
  g.LastRealtimeHeroSkill={heroUID:source.uid,skillId:skill.skillId,at:now,targetUID:target?.uid || 0,feedback};
  for(const recipient of targets)(g.CombatImpactRequests ||= []).push({at:now,heroUID:source.uid,targetUID:recipient.uid,...(recipient.kind==='enemy'?{point:point(recipient)}:{}),skillId:skill.skillId,elementalSlug:REALTIME_SKILL_ELEMENTS[skill.skillId],damage:damagePct || 0});
  ctx.callFunction('LogCombat',`${heroDefinition(source).name}: ${skill.displayName}${feedback}`);
  return true;
}
// Effects owned by a fallen source end with it; the ward pool persists (see Crimson Ward rules).
export function cleanupRealtimeSkillActors(ctx) {
  const g=ctx.state.globals;
  for(const hero of ctx.state.entities.filter(a=>a?.kind==='hero'&&!living(a)))dropHeroWard(g,hero);
  for(const [uid,entries] of Object.entries(effects(g))) {
    if(!living(actor(ctx,uid))) { delete effects(g)[uid]; continue; }
    for(const [id,entry] of Object.entries(entries))if(id==='elevate'&&!living(actor(ctx,entry.sourceUID)))delete entries[id];
  }
}
// Per-frame upkeep: expire effects, run passive auras, and refresh derived attack reach.
export function tickRealtimeHeroSkillZones(ctx) {
  const g=ctx.state.globals;
  if(g.GamePaused || g.CombatPaused || g.BattlePaused || g.DevToolingPaused || g.QaScenarioPaused)return;
  cleanupRealtimeSkillActors(ctx);
  const now=nowOf(g);
  for(const entries of Object.values(effects(g)))for(const [id,entry] of Object.entries(entries))if(entry.expiresAt<=now)delete entries[id];
  tickHeroPassiveAuras(ctx,(source,target,raw)=>rawDamage(ctx,source,target,raw,'magic'));
  for(const hero of ctx.state.entities.filter(a=>a?.kind==='hero'))hero.attackRangeMultiplier=projectCombatMultiplier('range',actorCombatModifiers(g,hero));
  ensureSkillBattle(ctx);
}
export function realtimeBasicDamageMultiplier(g,source) {return projectCombatStat(1,'damageAmp',actorCombatModifiers(g,source));}
export { heroPassive };
