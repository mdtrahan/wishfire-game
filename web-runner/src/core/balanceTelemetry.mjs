import { actorFootPoint, isActorTargetInRange } from '../../../src/core/arenaCombatRules.mjs';

export function captureBalanceImpactGeometry(source, heroes) {
  const origin = actorFootPoint(source);
  return {
    source: { uid: Number(source?.uid || 0), name: String(source?.name || ''), combatTier: String(source?.combatTier || source?.routineTier || 'unknown'), x: origin.x, y: origin.y, arenaTargetUID: Number(source?.arenaTargetUID || 0), streamDelivery: String(source?.streamDelivery || '') },
    heroes: heroes.map((hero) => {
      const foot = actorFootPoint(hero);
      return { uid: Number(hero.uid || 0), x: foot.x, y: foot.y, hp: Number(hero.hp || 0), inReach: isActorTargetInRange(source, hero) };
    }),
  };
}

export function recordBalanceCombatEvent(globals, event) {
  if (globals?.DevBalanceCapture !== true) return;
  const id = Math.max(0, Number(globals.BalanceCombatEventSeq || 0)) + 1;
  globals.BalanceCombatEventSeq = id;
  const events = globals.BalanceCombatEvents ||= [];
  events.push({ id, time: Number(globals.time || 0), ...event });
  if (events.length > 4096) events.splice(0, events.length - 2048);
}
