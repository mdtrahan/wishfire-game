import { activeCombatEffect } from './combatModifierRules.mjs';
const comparators = Object.freeze({ lt: (a,b) => a < b, lte: (a,b) => a <= b, eq: (a,b) => a === b, gte: (a,b) => a >= b, gt: (a,b) => a > b });
const keys = new Set(['actor.hp_ratio','actor.effect_active','actor.trait','actor.stat_compare','actors.count','enemy.attackable','zone.active','target.displacement_room','event.matches','modifier.can_improve','geometry.count','battle.flag','battle.resource']);
export const livingCombatActor = actor => Number(actor?.hp || 0) > 0;
export function validateSkillCondition(node) {
  if (!node || typeof node !== 'object') throw new Error('Missing condition node');
  const groupKeys=['all','any','not','key'].filter(key=>Object.hasOwn(node,key));
  if(groupKeys.length!==1)throw new Error('Condition requires one operator');
  if(node.all || node.any) {
    const children=node.all || node.any;
    if(!Array.isArray(children)||!children.length)throw new Error('Empty condition group');
    children.forEach(validateSkillCondition); return true;
  }
  if(node.not)return validateSkillCondition(node.not);
  if(!keys.has(node.key))throw new Error(`Unknown skill condition: ${node.key}`);
  const comparisons=['actor.hp_ratio','actor.stat_compare','actors.count','target.displacement_room','geometry.count','battle.flag','battle.resource'];
  if(comparisons.includes(node.key) && !comparators[node.operator])throw new Error('Missing or unknown comparison');
  if(node.subject && !['self','candidate'].includes(node.subject))throw new Error('Unknown subject');
  const groups=['livingHeroes','deployedHeroes','attackableEnemies'];
  if(node.key==='actors.count' && !groups.includes(node.group))throw new Error('Unknown actor group');
  if(node.filter)validateSkillCondition(node.filter);
  if(node.key==='actor.hp_ratio' && !(node.value>=0 && node.value<=1))throw new Error('HP condition requires a fraction');
  if(node.key==='actor.stat_compare' && (!['max','min','mean'].includes(node.aggregate)||!groups.includes(node.referenceGroup)||!['ATK','DEF','MAG','RES','SPD'].includes(node.stat)))throw new Error('Invalid stat comparison');
  const traits={lifeState:['alive','ko'],combatRank:['ordinary','subboss','boss'],magicThreat:[true,false]};
  if(node.key==='actor.trait' && Array.isArray(node.in) && node.in.some(value=>!traits[node.field]?.includes(value)))throw new Error('Unknown trait value');
  if(node.key==='actor.trait' && (!['lifeState','combatRank','magicThreat'].includes(node.field)||!Array.isArray(node.in)||!node.in.length))throw new Error('Unknown trait');
  if(['actor.effect_active','zone.active','modifier.can_improve'].includes(node.key) && !['provoke','brace','destiny','cover','hex_beacon','burn_sigil','null_field','blight','wishgrant','quickload','shared_tempo','fortunes_blessing','shrink'].includes(node.effectId))throw new Error('Unknown effect ID');
  if(node.key==='geometry.count' && !['circle','rectangle','horizontalLine','cone'].includes(node.shape?.kind))throw new Error('Unknown shape');
  if(node.key==='geometry.count') {
    const shape=node.shape;
    if(shape.kind==='circle' && !(shape.radius>0) || shape.kind==='rectangle' && !(shape.width>0 && shape.height>0) || shape.kind==='horizontalLine' && !(shape.width>0 && Number.isFinite(shape.toX)) || shape.kind==='cone' && !(shape.length>0 && shape.angleDegrees>0 && shape.angleDegrees<=180))throw new Error('Invalid shape parameters');
  }
  if(node.key==='battle.flag' && !['magicFruitUsed','growTier'].includes(node.name))throw new Error('Unknown battle flag');
  if(node.key==='battle.resource' && node.name!=='wardHP')throw new Error('Unknown battle resource');
  if(comparisons.includes(node.key) && node.key!=='actor.stat_compare' && !Number.isFinite(node.value))throw new Error('Invalid threshold');
  return true;
}
export function evaluateSkillCondition(node, context) {
  if (node.all) return node.all.every(child => evaluateSkillCondition(child, context));
  if (node.any) return node.any.some(child => evaluateSkillCondition(child, context));
  if (node.not) return !evaluateSkillCondition(node.not, context);
  if (!keys.has(node.key)) throw new Error(`Unknown skill condition: ${node.key}`);
  const actor = node.subject === 'self' ? context.self : context.candidate;
  const compare = (value, expected = node.value) => {
    if (!Number.isFinite(Number(value)) || !comparators[node.operator]) return false;
    return comparators[node.operator](Number(value), Number(expected));
  };
  const group = name => context.groups[name] || [];
  switch (node.key) {
    case 'actor.hp_ratio': return actor && compare(Number(actor.hp || 0) / Math.max(1, Number(actor.maxHP || 1)));
    case 'actor.effect_active': return activeCombatEffect(context.effects?.[String(actor?.uid)]?.[node.effectId], context.now);
    case 'actor.trait': {
      const value = node.field === 'lifeState' ? (livingCombatActor(actor) ? 'alive' : 'ko')
        : node.field === 'magicThreat' ? (actor?.attackType === 'magic' || actor?.streamDelivery === 'ranged' && context.stat(actor,'MAG') > context.stat(actor,'ATK'))
        : actor?.[node.field];
      return (node.in || []).includes(value);
    }
    case 'actor.stat_compare': {
      const values = group(node.referenceGroup).map(entry => context.stat(entry, node.stat));
      if (!actor || !values.length) return false;
      const aggregate = node.aggregate === 'max' ? Math.max(...values) : node.aggregate === 'min' ? Math.min(...values) : values.reduce((a,b) => a+b,0) / values.length;
      return compare(context.stat(actor,node.stat), aggregate);
    }
    case 'actors.count': return compare(group(node.group).filter(entry => !node.filter || evaluateSkillCondition(node.filter,{...context,candidate:entry})).length);
    case 'enemy.attackable': return context.attackable(actor);
    case 'zone.active': return (context.zones || []).some(zone => zone.kind === node.effectId && zone.expiresAt > context.now);
    case 'target.displacement_room': return actor?.combatRank !== 'boss' && compare(Math.min(node.maxDistance, context.attackLine - Number(actor?.x || 0)));
    case 'event.matches': {
      const event = context.event;
      return !!event && (!node.actionKind || event.actionKind === node.actionKind) && (!node.source || (node.source === 'self' ? event.sourceUID === context.self.uid : context.groups.attackableEnemies.some(e => e.uid === event.sourceUID)))
        && (!node.recipient || (node.recipient === 'self' ? event.targetUID === context.self.uid : context.groups.attackableEnemies.some(e => e.uid === event.targetUID)))
        && (node.isPrimary == null || event.isPrimary === node.isPrimary) && Number(event.hpDamage || 0) >= Number(node.minHpDamage || 0);
    }
    case 'modifier.can_improve': return context.canImprove(actor, node.effectId);
    case 'geometry.count': return compare(context.shapeTargets(node.shape, actor).filter(entry => !node.filter || evaluateSkillCondition(node.filter,{...context,candidate:entry})).length);
    case 'battle.flag': return compare(context.battle?.[node.name] ?? 0);
    case 'battle.resource': return compare(context.resources?.[node.name] ?? 0);
    default: return false;
  }
}
