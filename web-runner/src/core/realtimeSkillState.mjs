import { combatModifiers, projectCombatStat, projectCombatMultiplier, modifierCanImprove } from '../../../src/core/combatModifierRules.mjs';
export const rawCombatStat = (actor, stat) => Number(actor?.stats?.[stat] ?? actor?.[stat] ?? 0) || 0;
export function skillModifiers(id, choice) {
  const modifier = (channel, direction, magnitude) => ({ channel, direction, magnitude });
  switch (id) {
    case 'wishgrant': return ['ATK','MAG'].map(stat => modifier(stat,'up',.35));
    case 'fortunes_blessing': return [modifier(choice || 'ATK','up',.25)];
    case 'hex_beacon': return [modifier('RES','down',.25)];
    case 'shrink': return ['ATK','DEF'].map(stat => modifier(stat,'down',.35));
    default: return [];
  }
}
export function battleModifiers(globals, actor) {
  if (actor?.kind !== 'hero') return [];
  const battle = globals.RealtimeSkillBattleState;
  const result = [];
  if (battle?.fruitUIDs?.includes(Number(actor.uid))) result.push({channel:'HP',direction:'up',magnitude:.15});
  const growTier = Number(battle?.growTiersByUID?.[String(actor.uid)] || 0);
  if (growTier > 0) {
    const magnitude = [.08,.14,.20][Math.min(3,growTier)-1];
    result.push({channel:'HP',direction:'down',magnitude:magnitude*(battle?.fruitUIDs?.includes(Number(actor.uid))?1.15:1)},{channel:'damageAmp',direction:'up',magnitude});
  }
  return result;
}
export function actorCombatModifiers(globals, actor) {
  const legacy=[];
  for(const stat of ['ATK','DEF','MAG','RES','SPD']) {
    const base=rawCombatStat(actor,stat);
    if(base>0) {
      const up=actor.kind==='hero'?Number(globals['PartyBuff_'+stat] || 0):0;
      const down=actor.kind==='enemy'?Number(globals.EnemyDebuffs?.[actor.uid]?.[stat] || 0):0;
      if(up>0)legacy.push({channel:stat,direction:'up',magnitude:up/base});
      if(down>0)legacy.push({channel:stat,direction:'down',magnitude:down/base});
    }
    for(const status of actor.statuses || []) {
      if(status.duration<=0)continue;
      if(status.statusEffect===stat.toLowerCase()+'Up')legacy.push({channel:stat,direction:'up',magnitude:status.magnitude});
      if(status.statusEffect===stat.toLowerCase()+'Down')legacy.push({channel:stat,direction:'down',magnitude:status.magnitude});
    }
  }
  if (actor?.kind === 'hero') {
    for (const [trainingStat, combatStat] of [['ATK', 'ATK'], ['DEF', 'DEF'], ['MATK', 'MAG'], ['RES', 'RES']]) {
      const base = rawCombatStat(actor, combatStat);
      const levels = Math.max(0, Math.floor(Number(globals.PartyTrainingLevels?.[trainingStat]) || 0));
      if (base > 0 && levels > 0) legacy.push({ channel: combatStat, direction: 'up', magnitude: Math.min(2, levels * 0.02) });
    }
  }
  return [...legacy,...combatModifiers(globals.RealtimeSkillEffects?.[String(actor.uid)],Number(globals.time || 0)),...battleModifiers(globals,actor)];
}
export function partyTrainingCombatStat(globals, actor, stat, value) {
  if (actor?.kind !== 'hero' || !['ATK', 'DEF', 'MAG', 'RES'].includes(stat)) return Math.max(0, Number(value) || 0);
  const trainingStat = stat === 'MAG' ? 'MATK' : stat;
  const levels = Math.max(0, Math.floor(Number(globals.PartyTrainingLevels?.[trainingStat]) || 0));
  if (!levels) return Math.max(0, Number(value) || 0);
  return projectCombatStat(Math.max(0, Number(value) || 0), stat, [{ channel: stat, direction: 'up', magnitude: Math.min(2, levels * 0.02) }]);
}
export function realtimeCombatStat(globals, actor, stat, base = rawCombatStat(actor,stat), ownedValue = base) {
  const modifiers = actorCombatModifiers(globals,actor);
  const flat = Number(ownedValue) - Number(base);
  if (flat && base > 0) modifiers.push({channel:stat,direction:flat > 0 ? 'up':'down',magnitude:Math.abs(flat)/base});
  return projectCombatStat(base,stat,modifiers);
}
export function projectedSkillBenefit(globals, actor, effectId, choice) {
  const proposed = skillModifiers(effectId,choice);
  if (!proposed.length) return true;
  return modifierCanImprove(actor.stats || actor,actorCombatModifiers(globals,actor),proposed);
}
export function ensureSkillBattle(ctx) {
  const globals = ctx.state.globals;
  const battle = globals.RealtimeSkillBattleState ||= {attemptId:Number(globals.CombatSessionId || 0),baselinesByUID:{},magicFruitUsed:0,growTier:0,fruitUIDs:[]};
  for (const actor of ctx.state.entities.filter(a => a?.kind === 'hero')) {
    const uid = String(actor.uid), signature = JSON.stringify([actor.currentLevel,actor.stats,actor.equipmentStats]);
    let baseline = battle.baselinesByUID[uid];
    if (!baseline || signature !== baseline.signature) {
      baseline = battle.baselinesByUID[uid] = {maxHP:Number(actor.combatBaseMaxHP || (baseline && actor.maxHP===baseline.projectedMaxHP ? baseline.maxHP : actor.maxHP || 1)),signature,projectedMaxHP:Number(actor.maxHP || 1)};
    }
    const projected = projectCombatStat(baseline.maxHP,'HP',actorCombatModifiers(globals,actor));
    actor.combatMaxHPMultiplier=projectCombatMultiplier('HP',actorCombatModifiers(globals,actor));
    actor.maxHP = projected;
    if (actor.hp > 0) actor.hp = Math.min(actor.hp,projected);
    baseline.projectedMaxHP = projected;
  }
  return battle;
}
export function resetRealtimeSkillAttempt(globals, entities = []) {
  const battle = globals.RealtimeSkillBattleState;
  for (const hero of entities.filter(actor => actor?.kind === 'hero')) {
    const baseline = battle?.baselinesByUID?.[String(hero.uid)];
    delete hero.combatMaxHPMultiplier;
    if (baseline) { hero.maxHP = baseline.maxHP; if (hero.hp > 0) hero.hp = Math.min(hero.hp,hero.maxHP); }
  }
  delete globals.RealtimeSkillBattleState;
  globals.RealtimeSkillEffects = {};
  globals.RealtimeSkillZones = [];
  globals.RealtimeHeroBasicClocks = {};
  globals.RealtimeHeroBasicScheduledActions = {};
  globals.PartyTempHPShield = 0;
  globals.PartyWardBarrierActive=0;globals.PartyWardBarrierVisualsByUID={};
  delete globals.PartyTempHPShieldSourceUID;
  delete globals.PartyTempHPShieldTargetUIDs;
}
