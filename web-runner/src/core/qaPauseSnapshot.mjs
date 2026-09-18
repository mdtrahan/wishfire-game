export function serializeQaPauseCombatSnapshot({ state, getCurrentTurn = () => 0 } = {}) {
  const entities = Array.isArray(state?.entities) ? state.entities : [];
  const globals = state?.globals || {};
  const actor = entity => ({
    uid: Number(entity?.uid || 0),
    name: String(entity?.name || entity?.baseHeroName || ''),
    hp: Number(entity?.hp || 0),
  });
  return {
    heroes: entities.filter(entity => entity?.kind === 'hero').map(hero => ({ ...actor(hero), af: Math.min(100, Math.max(0, Number(hero?.flow || 0))) })),
    activeActorUID: Number(getCurrentTurn() || 0),
    turnSerial: Number(globals.TurnSerial || 0),
    schedulerToken: Number(globals.InitiativeCurrentUID || 0),
    enemies: entities.filter(entity => entity?.kind === 'enemy' && Number(entity?.hp || 0) > 0).map(actor),
  };
}
