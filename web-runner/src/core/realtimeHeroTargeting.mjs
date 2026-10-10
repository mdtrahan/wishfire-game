import {resolveBasicInterval} from '../../../src/core/combatModifierRules.mjs';
import { isActorTargetInRange } from '../../../src/core/heroAttackTargetingRules.mjs';
import { evaluateSkillCondition, livingCombatActor as alive } from '../../../src/core/skillConditionRules.mjs';
import { realtimeCooldownSeconds } from './realtimeCooldown.mjs';
import { rawCombatStat, realtimeCombatStat, projectedSkillBenefit } from './realtimeSkillState.mjs';
import { previewSeededRng } from '../../../src/core/seededRngRules.mjs';
// Spatial combat owns foot coordinates. x/y still mirror feet for existing
// presentation consumers, but target geometry reads the semantic source.
const point = actor => ({x:Number(actor?.footX ?? actor?.x ?? 0),y:Number(actor?.footY ?? actor?.y ?? 0)});
const ratio = actor => Number(actor.hp)/Math.max(1,Number(actor.maxHP));
export function filterContinuousEncounterEnemies(enemies = [], globals = {}, heroes = []) {
  const targetable = (enemies || []).filter(actor => alive(actor) && actor?.streamState !== 'approaching');
  if (Number(globals?.ContinuousCombatStageLoop || 0) !== 1) return targetable;
  return targetable.filter(actor => ['in_range', 'engaged', 'retreating'].includes(actor.streamState)
    || actor.arenaInReach === true
    || heroes.some(hero => alive(hero) && isActorTargetInRange(hero, actor)));
}
export function enemiesInSkillShape(enemies, shape) {
  return (enemies || []).filter(a=>alive(a) && a?.streamState !== 'approaching').filter(enemy => {
    const center = shape.center || shape.from;
    const enemyPoint = point(enemy);
    const dx = enemyPoint.x-center.x, dy = enemyPoint.y-center.y;
    switch (shape.kind) {
      case 'circle': return dx*dx+dy*dy <= shape.radius*shape.radius;
      case 'rectangle': return Math.abs(dx)<=shape.width/2 && Math.abs(dy)<=shape.height/2;
      case 'horizontalLine': return dx>=0 && enemyPoint.x<=shape.toX && Math.abs(dy)<=shape.width/2;
      case 'cone': return dx>=0 && dx*dx+dy*dy<=shape.length*shape.length && Math.abs(dy)<=dx*Math.tan(shape.angleDegrees*Math.PI/360)+1e-9;
      default: throw new Error(`Unknown skill shape: ${shape.kind}`);
    }
  });
}
export function selectRealtimeHeroSkillTarget({skill,hero,heroes=[],enemies=[],effects={},zones=[],now=0,globals={},event=null,statReader}={}) {
  if (!skill || !alive(hero)) return null;
  const livingHeroes = heroes.filter(alive), targetableEnemies = filterContinuousEncounterEnemies(enemies, globals, heroes), inRange = targetableEnemies.filter(a=>isActorTargetInRange(hero, a));
  const read = statReader || ((actor,stat)=>realtimeCombatStat({...globals,time:now,RealtimeSkillEffects:effects},actor,stat));
  const rule = skill.targetRule;
  if (!rule) throw new Error(`Missing target rule: ${skill.skillId}`);
  let effectChoice;
  if (skill.randomStats) {
    if (typeof globals.RuntimeRandom !== 'function' || !Number.isFinite(globals.RuntimeRandomSeed)) return null;
    effectChoice = skill.randomStats[Math.floor(previewSeededRng(globals.RuntimeRandomSeed,globals.RuntimeRandomDraws || 0)*skill.randomStats.length)];
  }
  const projectGlobals = {...globals,time:now,RealtimeSkillEffects:effects};
  const shapeAt = (shape, anchor) => ({...shape,center:point(['cone','horizontalLine'].includes(shape.kind)?hero:anchor)});
  const context = {self:hero,candidate:null,groups:{livingHeroes,deployedHeroes:heroes,attackableEnemies:inRange},effects,zones,now,event,
    stat:read,attackable:target=>isActorTargetInRange(hero,target),attackLine:Number(hero.footX ?? hero.x ?? 0) + 146,
    battle:globals.RealtimeSkillBattleState || {},resources:{wardHP:Number(globals.PartyTempHPShield || 0)},
    canImprove:(actor,id)=>projectedSkillBenefit(projectGlobals,actor,id,effectChoice),
    shapeTargets:(shape,anchor)=>enemiesInSkillShape(targetableEnemies,shapeAt(shape,anchor))};
  const matches = candidate => evaluateSkillCondition(skill.conditions,{...context,candidate});
  const effectId = skill.effectSpec.effectId || (skill.effectSpec.kind==='blight'?'blight':skill.skillId);
  const eligible = target => {
    if (skill.recipientPolicy==='skip_active' && Number(effects[String(target.uid)]?.[effectId]?.expiresAt)>now) return false;
    if (skill.effectSpec.kind==='modifier' && !context.canImprove(target,effectId)) return false;
    if (['heal','regen','sanctuary'].includes(skill.effectSpec.kind) && skill.effectSpec.kind!=='regen' && target.hp>=target.maxHP) return false;
    if (['tempo','quickload'].includes(skill.effectSpec.kind)) {
      const ordinary=realtimeCooldownSeconds({...target,type:0,speed:read(target,'SPD')}), current=effects[String(target.uid)] || {};
      if(resolveBasicInterval(ordinary,{...current,[effectId]:{expiresAt:now+skill.durationSeconds}},now)>=resolveBasicInterval(ordinary,current,now))return false;
    }
    return true;
  };
  let candidates, anchor, targets, shape;
  switch (rule.kind) {
    case 'self': anchor=hero; targets=matches(hero)&&eligible(hero)?[hero]:[]; break;
    case 'party':
      if (!matches(hero)) return null;
      targets=livingHeroes.filter(eligible); anchor=hero;
      if (skill.effectSpec.kind==='sanctuary') {
        const ko=heroes.find(a=>!alive(a)); if (ko) targets.push(ko);
      }
      break;
    case 'lowestHPAlly': case 'slowestAlly':
      candidates=livingHeroes.filter(a=>matches(a)&&eligible(a));
      candidates.sort(rule.kind==='lowestHPAlly' ? (a,b)=>ratio(a)-ratio(b) : (a,b)=>realtimeCooldownSeconds({...b,type:0,speed:read(b,'SPD')})-realtimeCooldownSeconds({...a,type:0,speed:read(a,'SPD')}));
      anchor=candidates[0]; targets=anchor?[anchor]:[]; break;
    case 'enemy':
      candidates=inRange.filter(a=>matches(a)&&eligible(a));
      if (rule.order==='highestBaseATK') candidates.sort((a,b)=>rawCombatStat(b,'ATK')-rawCombatStat(a,'ATK'));
      if (rule.order==='highestDEF') candidates.sort((a,b)=>read(b,'DEF')-read(a,'DEF'));
      if (rule.order==='lowestHP') candidates.sort((a,b)=>ratio(a)-ratio(b));
      if (rule.order==='furthestAdvanced') candidates.sort((a,b)=>point(a).x-point(b).x);
      anchor=candidates[0]; targets=anchor?[anchor]:[]; break;
    case 'firstArea': case 'bestArea':
      candidates=inRange.filter(matches).map(a=>({actor:a,shape:shapeAt(rule.shape,a)})).map(a=>({...a,targets:enemiesInSkillShape(targetableEnemies,a.shape).filter(eligible)})).filter(a=>a.targets.length);
      if (rule.kind==='bestArea') candidates.sort((a,b)=>{
        const preferred=entry=>rule.bossFirst && entry.actor.combatRank==='boss' && (rule.bossHP==null || ratio(entry.actor)<rule.bossHP);
        return Number(preferred(b))-Number(preferred(a)) || b.targets.length-a.targets.length;
      });
      anchor=candidates[0]?.actor; targets=candidates[0]?.targets || []; shape=candidates[0]?.shape; break;
    case 'horizontalLine': case 'cone':
      if (!matches(hero)) return null;
      anchor=hero; shape=shapeAt(rule.shape,hero); targets=enemiesInSkillShape(targetableEnemies,shape); break;
    case 'allEnemies':
      if (!matches(hero)) return null;
      anchor=targetableEnemies[0]; targets=targetableEnemies.filter(eligible); break;
    case 'eventArea': case 'eventChain':
      if (!matches(hero)) return null;
      anchor=targetableEnemies.find(a=>Number(a.uid)===Number(rule.kind==='eventArea'?event?.sourceUID:event?.targetUID));
      if (!anchor && rule.kind==='eventChain' && event?.point) anchor={uid:event.targetUID,...event.point};
      if (!anchor) return null;
      if (rule.kind==='eventArea') {
        if (!isActorTargetInRange(hero,anchor)) return null;
        shape=shapeAt(rule.shape,anchor); targets=enemiesInSkillShape(targetableEnemies,shape);
      } else { targets=targetableEnemies.filter(a=>a.uid!==anchor.uid).slice(0,rule.minimum); if(targets.length<rule.minimum)return null; }
      break;
    default: throw new Error(`Unknown target rule: ${rule.kind}`);
  }
  if (!targets?.length) return null;
  return {targetUID:anchor?.uid,targetUIDs:targets.map(a=>Number(a.uid)),point:point(anchor),shape,event,effectChoice};
}
