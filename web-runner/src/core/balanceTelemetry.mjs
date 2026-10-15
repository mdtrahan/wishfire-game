export function recordBalanceCombatEvent(globals, event) {
  if (globals?.DevBalanceCapture !== true) return;
  const id = Math.max(0, Number(globals.BalanceCombatEventSeq || 0)) + 1;
  globals.BalanceCombatEventSeq = id;
  const events = globals.BalanceCombatEvents ||= [];
  events.push({ id, time: Number(globals.time || 0), ...event });
  if (events.length > 4096) events.splice(0, events.length - 2048);
}
