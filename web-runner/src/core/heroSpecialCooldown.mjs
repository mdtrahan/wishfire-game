import { SHADOW_DEFINITIONS } from '../../../src/core/combatShadowAdapter.mjs';
import { heroDefinition } from './heroDefinitions.mjs';
import { heroStarSkillMultipliers } from './heroGrowthRules.mjs';
import { cooldownSeconds } from './combatFormulas.mjs';
import { SPECIAL_CLOCKS } from './specialClockContent.mjs';

// Match the f32 meter-rate input and cooldown result used by Rust groove_timers.
export function heroSpecialCooldown(hero, growth) {
  const definition = heroDefinition(hero);
  const base = SPECIAL_CLOCKS[SHADOW_DEFINITIONS[definition.key].id];
  if (!(base > 0)) throw new Error(`Missing Rust special clock for ${definition.name}`);
  const multiplier = heroStarSkillMultipliers(growth, hero?.heroInstanceKey || definition.key).specialCooldown;
  const haste = (Math.fround(1 / multiplier) - 1) * 100;
  return Math.fround(cooldownSeconds(base, haste));
}

export const formatHeroSpecialCooldown = (hero, growth) => Number(heroSpecialCooldown(hero, growth).toFixed(2));
