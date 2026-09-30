export function serializeQaPauseCombatSnapshot({ state } = {}) {
  const entities = Array.isArray(state?.entities) ? state.entities : [];
  const actor = entity => ({
    uid: Number(entity?.uid || 0),
    name: String(entity?.name || entity?.baseHeroName || ''),
    hp: Number(entity?.hp || 0),
  });
  return {
    heroes: entities.filter(entity => entity?.kind === 'hero').map(actor),
    enemies: entities.filter(entity => entity?.kind === 'enemy' && Number(entity?.hp || 0) > 0).map(actor),
  };
}
