import { state } from './state.js';

// Minimal neutral entity APIs. Extend with game-specific logic later.
export const ENTITY_UPDATE_MAX_FAILURES = 3;

const entityFailureState = new WeakMap();

function getEntityFailureEntry(entity) {
  let entry = entityFailureState.get(entity);
  if (!entry) {
    entry = { consecutiveFailures: 0, quarantined: false };
    entityFailureState.set(entity, entry);
  }
  return entry;
}

function ensureEntityUpdateDiagnostics() {
  state.globals = state.globals || {};
  if (!Array.isArray(state.globals.EntityUpdateTrace)) state.globals.EntityUpdateTrace = [];
  if (!state.globals.EntityQuarantineByKey || typeof state.globals.EntityQuarantineByKey !== 'object') {
    state.globals.EntityQuarantineByKey = {};
  }
  return state.globals;
}

function getEntityDiagnosticKey(entity, index) {
  const uid = Math.max(0, Math.floor(Number(entity?.uid) || 0));
  if (uid > 0) return `uid:${uid}`;
  const kind = String(entity?.kind || 'entity');
  const name = String(entity?.name || kind || 'entity').trim().toLowerCase() || 'entity';
  return `${kind}:${name}:${index}`;
}

function recordEntityUpdateFailure(entity, index, err, now) {
  const globals = ensureEntityUpdateDiagnostics();
  const entry = getEntityFailureEntry(entity);
  entry.consecutiveFailures += 1;
  entry.quarantined = entry.consecutiveFailures >= ENTITY_UPDATE_MAX_FAILURES;
  const key = getEntityDiagnosticKey(entity, index);
  const record = {
    key,
    uid: Math.max(0, Math.floor(Number(entity?.uid) || 0)),
    index: Number(index || 0),
    kind: String(entity?.kind || ''),
    name: String(entity?.name || ''),
    consecutiveFailures: Number(entry.consecutiveFailures || 0),
    quarantined: entry.quarantined ? 1 : 0,
    message: String(err?.message || err || ''),
    stack: String(err?.stack || ''),
    time: Number(now || 0),
  };
  globals.EntityUpdateTrace.push(record);
  if (globals.EntityUpdateTrace.length > 100) globals.EntityUpdateTrace.shift();
  if (entry.quarantined) globals.EntityQuarantineByKey[key] = record;
  console.warn('entity update failed', record, err);
  return record;
}

function clearEntityUpdateFailure(entity) {
  const entry = entityFailureState.get(entity);
  if (!entry) return;
  entry.consecutiveFailures = 0;
}

export function updateAllEntities() {
  const now = Date.now();
  if (!state.entities) return;
  for (const [index, e] of state.entities.entries()) {
    if (typeof e.update === 'function') {
      const entry = getEntityFailureEntry(e);
      if (entry.quarantined) continue;
      try {
        e.update(now);
        clearEntityUpdateFailure(e);
      } catch (err) {
        recordEntityUpdateFailure(e, index, err, now);
      }
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
