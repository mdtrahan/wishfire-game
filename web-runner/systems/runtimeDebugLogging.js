export function debugLayoutLog(message) {
  if (!globalThis.DEBUG_LAYOUT) return;
  console.log(message);
}

export function startupDebugLog(...args) {
  if (!globalThis.STARTUP_DEBUG) return;
  console.log(...args);
}

export function isGemDebugEnabled(state) {
  if (globalThis.DEBUG_GEMS_QUERY) return true;
  if (state && state.globals && state.globals.DevTestMode === true) return true;
  if (state && state.globals && state.globals.DebugGemsMode === true) return true;
  try {
    const hook = typeof window !== 'undefined' ? window.__codexGame : null;
    if (hook && hook.globals && hook.globals.DevTestMode === true) return true;
    if (hook && hook.globals && hook.globals.DebugGemsMode === true) return true;
  } catch {}
  return false;
}

export function gemDebugLog(tag, payload, state) {
  if (!isGemDebugEnabled(state)) return;

  const allowedTags = new Set([
    '[TURN_RESTORE_PICK]',
    '[GEM_REJECT]',
    '[REFILL_STUCK]',
    '[GATE_STUCK_CANPICK]'
  ]);
  if (!allowedTags.has(tag)) return;

  console.log(tag, payload);
}
