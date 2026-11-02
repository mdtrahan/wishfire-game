// Live Rust heroes expose snapshots; progression commits mutate a detached meta copy.
const bindings = new WeakMap();
export function bindHeroPermanentInputs(actor, binding) {
  bindings.set(actor, binding);
  return () => bindings.delete(actor);
}
export function permanentHeroSource(actor) { return bindings.get(actor)?.read(); }
export function routeHeroPermanentInputs(actor, update) {
  const binding = bindings.get(actor);
  if (!binding) return null;
  const draft = structuredClone(binding.read());
  delete draft.combatMaxHPMultiplier;
  const result = update(draft);
  binding.commit(draft);
  return { result };
}
