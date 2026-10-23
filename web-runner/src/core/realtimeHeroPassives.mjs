import { heroDefinition } from './heroDefinitions.mjs';
import { isActorTargetInRange } from '../../../src/core/heroAttackTargetingRules.mjs';
// Passives have no clock and leave nothing behind: every read derives from the holder's
// live HP, so an effect starts and stops with its condition.
const living = actor => Number(actor?.hp || 0) > 0;
const hpRatio = actor => Number(actor.hp) / Math.max(1, Number(actor.maxHP));

export function heroPassive(actor) {
  if (actor?.kind !== 'hero' || !living(actor)) return null;
  const skill = heroDefinition(actor)?.passive, spec = skill?.passive;
  if (!spec) return null;
  if (spec.hpBelow != null && !(hpRatio(actor) < spec.hpBelow)) return null;
  if (spec.hpAbove != null && !(hpRatio(actor) > spec.hpAbove)) return null;
  return { skill, spec };
}
export const heroPassiveModifiers = actor => heroPassive(actor)?.spec.modifiers || [];
export const heroPassiveIncomingCut = actor => Number(heroPassive(actor)?.spec.incomingCutPct || 0) / 100;
export const heroPassiveBasicMultiplier = actor => Number(heroPassive(actor)?.spec.basicDamageMultiplier || 1);
export const heroPassiveTargetDEFScale = actor => 1 - Number(heroPassive(actor)?.spec.targetDEFDownPct || 0) / 100;

// Buff-signal channels for an active passive. Auras act on foes and do not signal.
export function heroPassiveSignals(actor) {
  const active = heroPassive(actor);
  if (!active) return [];
  const up = channel => ({ channel, direction: 'up' });
  const modifiers = [...(active.spec.modifiers || [])];
  if (active.spec.incomingCutPct) modifiers.push(up('damageReduction'));
  if (active.spec.basicDamageMultiplier > 1) modifiers.push(up('damageAmp'));
  return modifiers.length ? [{ key: `passive:${actor.uid}:${active.skill.skillId}`, modifiers }] : [];
}

// Aura passives hit every attackable foe in the holder's range once per interval.
export function tickHeroPassiveAuras(ctx, hit) {
  const g = ctx.state.globals, now = Number(g.time || 0), next = g.RealtimePassiveAuraAt ||= {};
  for (const hero of ctx.state.entities.filter(actor => actor?.kind === 'hero')) {
    const aura = heroPassive(hero)?.spec.aura, key = String(hero.uid);
    if (!aura) { delete next[key]; continue; }
    next[key] ??= now + aura.intervalSeconds;
    while (next[key] <= now) {
      for (const enemy of ctx.state.entities.filter(actor => actor?.kind === 'enemy' && living(actor) && actor.streamState !== 'approaching' && isActorTargetInRange(hero, actor))) hit(hero, enemy, aura.rawDamage);
      next[key] += aura.intervalSeconds;
    }
  }
}
