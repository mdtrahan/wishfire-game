import { heroDefinition } from './heroDefinitions.mjs';
import { heroStarSkillMultipliers } from './heroGrowthRules.mjs';
import { isActorTargetInRange } from '../../../src/core/heroAttackTargetingRules.mjs';
// Passives have no clock: every read derives from the holder's live HP, so an effect starts
// and stops with its condition. On-hit debuffs are the exception and run on their own timer.
const living = actor => Number(actor?.hp || 0) > 0;
const hpRatio = actor => Number(actor.hp) / Math.max(1, Number(actor.maxHP));

export function heroPassive(actor, globals = {}) {
  if (actor?.kind !== 'hero' || !living(actor)) return null;
  const skill = heroDefinition(actor)?.passive, spec = skill?.passive;
  if (!spec) return null;
  if (spec.hpBelow != null && !(hpRatio(actor) < spec.hpBelow)) return null;
  if (spec.hpAbove != null && !(hpRatio(actor) > spec.hpAbove)) return null;
  const multiplier = heroStarSkillMultipliers(globals.HeroGrowth, actor.heroInstanceKey || actor.baseHeroName).passiveMagnitude;
  if (multiplier === 1) return { skill, spec };
  const scaled = { ...spec };
  for (const key of ['incomingCutPct', 'basicDamageMultiplier']) if (spec[key] != null) scaled[key] *= multiplier;
  if (spec.modifiers) scaled.modifiers = spec.modifiers.map(modifier => ({ ...modifier, magnitude: modifier.magnitude * multiplier }));
  if (spec.targetDebuff) scaled.targetDebuff = { ...spec.targetDebuff, magnitude: spec.targetDebuff.magnitude * multiplier };
  if (spec.aura) scaled.aura = { ...spec.aura, rawDamagePerChapter: spec.aura.rawDamagePerChapter * multiplier };
  return { skill, spec: scaled };
}
export const heroPassiveModifiers = (actor, globals) => heroPassive(actor, globals)?.spec.modifiers || [];
export const heroPassiveIncomingCut = (actor, globals) => Number(heroPassive(actor, globals)?.spec.incomingCutPct || 0) / 100;
export const heroPassiveBasicMultiplier = (actor, globals) => Number(heroPassive(actor, globals)?.spec.basicDamageMultiplier || 1);

// On-hit debuffs (Royalty) mark the struck foe for a fixed time. Every hero's hits read the
// mark; a repeat hit refreshes the timer instead of stacking.
export function applyHeroPassiveOnHit(globals, actor, target) {
  const active = heroPassive(actor, globals), debuff = active?.spec.targetDebuff;
  if (!debuff || target?.kind !== 'enemy' || !living(target)) return false;
  const now = Number(globals.time || 0), effects = globals.RealtimeSkillEffects ||= {};
  (effects[String(target.uid)] ||= {})[active.skill.skillId] = { sourceUID: actor.uid, appliedAt: now, expiresAt: now + debuff.durationSeconds,
    modifiers: [{ channel: debuff.channel, direction: 'down', magnitude: debuff.magnitude }] };
  return true;
}

// Buff-signal channels for an active passive. Auras act on foes and do not signal.
export function heroPassiveSignals(actor, globals) {
  const active = heroPassive(actor, globals);
  if (!active) return [];
  const up = channel => ({ channel, direction: 'up' });
  const modifiers = [...(active.spec.modifiers || [])];
  if (active.spec.incomingCutPct) modifiers.push(up('damageReduction'));
  if (active.spec.basicDamageMultiplier > 1) modifiers.push(up('damageAmp'));
  return modifiers.length ? [{ key: `passive:${actor.uid}:${active.skill.skillId}`, modifiers }] : [];
}

// Aura passives hit every attackable foe in the holder's range once per interval; damage
// scales with the chapter so the aura stays relevant.
export function tickHeroPassiveAuras(ctx, hit) {
  const g = ctx.state.globals, now = Number(g.time || 0), next = g.RealtimePassiveAuraAt ||= {};
  const chapter = Math.max(1, Math.floor(Number(g.ContinuousCombatStage?.region) || 1));
  for (const hero of ctx.state.entities.filter(actor => actor?.kind === 'hero')) {
    const aura = heroPassive(hero, g)?.spec.aura, key = String(hero.uid);
    if (!aura) { delete next[key]; continue; }
    next[key] ??= now + aura.intervalSeconds;
    while (next[key] <= now) {
      for (const enemy of ctx.state.entities.filter(actor => actor?.kind === 'enemy' && living(actor) && actor.streamState !== 'approaching' && isActorTargetInRange(hero, actor))) hit(hero, enemy, aura.rawDamagePerChapter * chapter);
      next[key] += aura.intervalSeconds;
    }
  }
}
