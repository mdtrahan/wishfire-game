// Shared projection for temporary combat modifiers. Base stats never contain effects.
export const COMBAT_MODIFIER_LIMITS = Object.freeze({
  ATK: [.5, 1.75], DEF: [.5, 1.75], MAG: [.5, 1.75], RES: [.5, 1.75],
  HP: [.5, 1.5], SPD: [.5, 1.5], damageAmp: [.5, 1.5], incomingReduction: [0, .6],
});
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function activeCombatEffect(record, now) {
  return !!record && n(record.expiresAt) > now && (record.charges == null || n(record.charges) > 0);
}
export function combatModifiers(effects = {}, now = 0) {
  return Object.values(effects).filter(record => activeCombatEffect(record, now)).flatMap(record => record.modifiers || []);
}
export function projectCombatMultiplier(channel, modifiers = []) {
  const bounds=COMBAT_MODIFIER_LIMITS[channel];
  if(!bounds)throw new Error(`Missing combat bounds: ${channel}`);
  const matching=modifiers.filter(entry=>entry.channel===channel);
  const up=Math.max(0,...matching.filter(entry=>entry.direction==='up').map(entry=>n(entry.magnitude)));
  const down=Math.max(0,...matching.filter(entry=>entry.direction==='down').map(entry=>n(entry.magnitude)));
  return clamp(1+up-down,...bounds);
}
export function projectCombatStat(base, channel, modifiers = []) {
  if(!(n(base)>0))return channel==='HP'?1:0;
  const value=n(base)*projectCombatMultiplier(channel,modifiers);
  return channel==='HP'?Math.max(1,Math.floor(value+1e-9)):value;
}
export function modifierCanImprove(baseStats, current, proposed, beneficialDirection = null) {
  return proposed.some(modifier => {
    const base = n(baseStats[modifier.channel] ?? (modifier.channel === 'damageAmp' ? 1 : 0));
    const before = projectCombatStat(base, modifier.channel, current);
    const after = projectCombatStat(base, modifier.channel, [...current, ...proposed]);
    const direction = beneficialDirection || modifier.direction;
    return direction === 'down' ? after < before : after > before;
  });
}
export function resolveBasicInterval(ordinary, effects = {}, now = 0) {
  const base = Math.max(.01, n(ordinary));
  const floor = Math.max(.4, .25 * base), ceiling = Math.max(floor, 2 * base);
  const quick = activeCombatEffect(effects.quickload, now);
  const tempo = activeCombatEffect(effects.shared_tempo, now);
  return clamp(quick ? .4 : tempo ? base * .75 : base, floor, ceiling);
}
export function incomingReduction(effects = {}, now = 0) {
  return Math.min(.6, Math.max(0, ...Object.values(effects).filter(e => activeCombatEffect(e, now)).map(e => n(e.damageCutPct) / 100)));
}
