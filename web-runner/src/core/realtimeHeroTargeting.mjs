import { isActorTargetInRange } from '../../../src/core/heroAttackTargetingRules.mjs';
import { actorAttackReach } from '../../../src/core/arenaCombatRules.mjs';
import { evaluateSkillCondition, livingCombatActor as alive } from '../../../src/core/skillConditionRules.mjs';
import { realtimeCombatStat } from './realtimeSkillState.mjs';
import { previewSeededRng } from '../../../src/core/seededRngRules.mjs';
// Spatial combat owns foot coordinates. x/y still mirror feet for existing
// presentation consumers, but target geometry reads the semantic source.
const point = actor => ({x:Number(actor?.footX ?? actor?.x ?? 0),y:Number(actor?.footY ?? actor?.y ?? 0)});
export function isHeroSupportTargetInRange(hero, target) {
  const source = point(hero), destination = point(target);
  return Math.hypot(destination.x - source.x, destination.y - source.y) <= actorAttackReach(hero);
}
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
  const context = {self:hero,candidate:null,groups:{livingHeroes,deployedHeroes:heroes,attackableEnemies:inRange},effects,zones,now,event,
    stat:read,attackable:target=>isActorTargetInRange(hero,target),battle:globals.RealtimeSkillBattleState || {},resources:{wardHP:Object.values(globals.HeroWardHPByUID || {}).reduce((sum,hp)=>sum+Number(hp || 0),0)},
    shapeTargets:()=>[]};
  const matches = candidate => evaluateSkillCondition(skill.conditions,{...context,candidate});
  let anchor, targets;
  switch (rule.kind) {
    case 'party':
      if (!matches(hero)) return null;
      targets=livingHeroes.filter(a=>isHeroSupportTargetInRange(hero,a)||skill.partyWide); anchor=hero; break;
    case 'enemy':
      anchor=inRange.find(matches); targets=anchor?[anchor]:[]; break;
    case 'inRangeEnemies':
      if (!matches(hero)) return null;
      anchor=inRange[0]; targets=inRange; break;
    default: throw new Error(`Unknown target rule: ${rule.kind}`);
  }
  if (!targets?.length) return null;
  return {targetUID:anchor?.uid,targetUIDs:targets.map(a=>Number(a.uid)),point:point(anchor),event,effectChoice};
}
