// Defeat pictures outlive simulation removal without owning rewards or targeting.
const sessions = new WeakMap();
const KO_DURATION_SEC = 1;

function session(globals) {
  let current = sessions.get(globals);
  if (!current || current.id !== globals.CombatSessionId) {
    current = { id: globals.CombatSessionId, actors: new Map() };
    sessions.set(globals, current);
  }
  return current;
}

export function recordActorPuppetDefeat(globals, actor) {
  if (!globals || actor?.kind !== 'enemy' || Number(actor.hp) > 0 || !actor.uid) return;
  const actors = session(globals).actors;
  if (actors.has(actor.uid)) return;
  const now = Number(globals.time || 0);
  actors.set(actor.uid, { ...actor, hp: 0, isAlive: false, isPuppetDefeat: true,
    actionState: 'ko', actionFacing: actor.actionFacing || actor.facing,
    actionStateStartedAt: now, actionStateUntil: now + KO_DURATION_SEC,
    puppetDefeatEndsAt: now + KO_DURATION_SEC });
}

export function resetActorPuppetDefeats(globals) {
  if (globals) sessions.delete(globals);
}

export function combatEnemiesForPresentation(entities, globals) {
  const now = Number(globals.time || 0), actors = session(globals).actors;
  for (const [uid, actor] of actors) {
    if (now < actor.actionStateStartedAt || now >= actor.puppetDefeatEndsAt) actors.delete(uid);
  }
  const holds = globals.EnemyDeathVisualHoldByUID || {};
  const live = entities.filter(actor => actor.kind === 'enemy' && (Number(actor.hp) > 0 || holds[actor.uid]));
  const visible = new Set(live.map(actor => actor.uid));
  return [...live, ...[...actors.values()].filter(actor => !visible.has(actor.uid))]
    .sort((a, b) => Number(b.y ?? b.originY ?? 0) - Number(a.y ?? a.originY ?? 0));
}
