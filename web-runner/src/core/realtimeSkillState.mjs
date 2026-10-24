import { heroGrowthModifiers } from './heroGrowthRules.mjs';
import { combatModifiers, projectCombatStat, projectCombatMultiplier } from '../../../src/core/combatModifierRules.mjs';
import { clearHeroWards } from './heroWard.mjs';
import { heroPassiveModifiers } from './realtimeHeroPassives.mjs';
export const rawCombatStat = (actor, stat) => Number(actor?.stats?.[stat] ?? actor?.[stat] ?? 0) || 0;
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
  if (actor?.kind === 'hero') legacy.push(...permanentHeroModifiers(globals, actor));
  return [...legacy,...combatModifiers(globals.RealtimeSkillEffects?.[String(actor.uid)],Number(globals.time || 0)),...heroPassiveModifiers(actor,globals)];
}
export function permanentHeroModifiers(globals, actor) {
  const totals = {};
  for (const [trainingStat, combatStat] of [['ATK', 'ATK'], ['DEF', 'DEF'], ['MATK', 'MAG'], ['RES', 'RES']]) {
    const levels = Math.max(0, Math.floor(Number(globals.PartyTrainingLevels?.[trainingStat]) || 0));
    if (levels > 0) totals[combatStat] = Math.min(2, levels * 0.02);
  }
  for (const modifier of heroGrowthModifiers(globals.HeroGrowth, actor?.heroInstanceKey || actor?.baseHeroName)) totals[modifier.channel] = (totals[modifier.channel] || 0) + modifier.magnitude;
  return Object.entries(totals).filter(([stat]) => stat === 'HP' || rawCombatStat(actor, stat) > 0).map(([channel, magnitude]) => ({ channel, direction: 'up', magnitude }));
}
export function partyTrainingCombatStat(globals, actor, stat, value) {
  if (actor?.kind !== 'hero' || !['ATK', 'DEF', 'MAG', 'RES'].includes(stat)) return Math.max(0, Number(value) || 0);
  const modifiers = permanentHeroModifiers(globals, actor).filter(modifier => modifier.channel === stat);
  if (!modifiers.length) return Math.max(0, Number(value) || 0);
  return projectCombatStat(Math.max(0, Number(value) || 0), stat, modifiers);
}
export function realtimeCombatStat(globals, actor, stat, base = rawCombatStat(actor,stat), ownedValue = base) {
  const modifiers = actorCombatModifiers(globals,actor);
  const flat = Number(ownedValue) - Number(base);
  if (flat && base > 0) modifiers.push({channel:stat,direction:flat > 0 ? 'up':'down',magnitude:Math.abs(flat)/base});
  return projectCombatStat(base,stat,modifiers);
}
export function ensureSkillBattle(ctx) {
  const globals = ctx.state.globals;
  const battle = globals.RealtimeSkillBattleState ||= {attemptId:Number(globals.CombatSessionId || 0),baselinesByUID:{}};
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
// keepWard: a boss clear keeps Crimson Ward's pool; every other reset clears it.
export function resetRealtimeSkillAttempt(globals, entities = [], { keepWard = false } = {}) {
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
  globals.RealtimePassiveAuraAt = {};
  if (keepWard) return;
  clearHeroWards(globals);
}
