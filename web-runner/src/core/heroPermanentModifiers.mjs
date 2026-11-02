import { heroGrowthModifiers } from "./heroGrowthRules.mjs";
import { projectCombatStat } from "../../../src/core/combatModifierRules.mjs";
const rawCombatStat = (actor, stat) => Number(actor?.stats?.[stat] ?? actor?.[stat] ?? 0) || 0;
function permanentHeroModifiers(globals, actor) {
  const totals = {};
  for (const [trainingStat, combatStat] of [["ATK", "ATK"], ["DEF", "DEF"], ["MATK", "MAG"], ["RES", "RES"]]) {
    const levels = Math.max(0, Math.floor(Number(globals.PartyTrainingLevels?.[trainingStat]) || 0));
    if (levels > 0) totals[combatStat] = Math.min(2, levels * 0.02);
  }
  for (const modifier of heroGrowthModifiers(globals.HeroGrowth, actor?.heroInstanceKey || actor?.baseHeroName)) totals[modifier.channel] = (totals[modifier.channel] || 0) + modifier.magnitude;
  return Object.entries(totals).filter(([stat]) => stat === "HP" || rawCombatStat(actor, stat) > 0).map(([channel, magnitude]) => ({ channel, direction: "up", magnitude }));
}
function partyTrainingCombatStat(globals, actor, stat, value) {
  if (actor?.kind !== "hero" || !["ATK", "DEF", "MAG", "RES"].includes(stat)) return Math.max(0, Number(value) || 0);
  const modifiers = permanentHeroModifiers(globals, actor).filter((modifier) => modifier.channel === stat);
  if (!modifiers.length) return Math.max(0, Number(value) || 0);
  return projectCombatStat(Math.max(0, Number(value) || 0), stat, modifiers);
}
export {
  partyTrainingCombatStat,
  permanentHeroModifiers,
  rawCombatStat
};
