import { state } from './state.js';

// Minimal neutral entity APIs. Extend with game-specific logic later.
export function updateAllEntities() {
  const now = Date.now();
  if (!state.entities) return;
  for (const e of state.entities) {
    if (typeof e.update === 'function') {
      try { e.update(now); } catch (err) { console.warn('entity update failed', err); }
    }
  }
}

export function registerEntity(entity) {
  state.entities = state.entities || [];
  state.entities.push(entity);
  return entity;
}

export function createActor(initial) {
  const actor = Object.assign({ x: 0, y: 0, update() {} }, initial || {});
  return registerEntity(actor);
}

export default { updateAllEntities, registerEntity, createActor };
