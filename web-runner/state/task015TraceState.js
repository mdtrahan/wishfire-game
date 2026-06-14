export function getTask015TraceStore(gameState) {
  if (!gameState.task015Trace) {
    gameState.task015Trace = {
      storycardPlacement: [],
      yellowQueue: [],
      yellowRefillQueue: [],
      yellowWrites: [],
      yellowAnimation: [],
    };
  }
  return gameState.task015Trace;
}

export function updateStartupLoadState(gameState, patch = {}) {
  const prev = gameState.startupLoad && typeof gameState.startupLoad === 'object'
    ? gameState.startupLoad
    : { active: true, phase: 'boot', label: 'Booting runtime...', progress: 0 };
  const nextProgress = Math.max(0, Math.min(1, Number(
    Object.prototype.hasOwnProperty.call(patch, 'progress')
      ? patch.progress
      : prev.progress
  ) || 0));
  gameState.startupLoad = {
    ...prev,
    ...patch,
    progress: nextProgress,
  };
  return gameState.startupLoad;
}

export function traceTask015YellowQueue(gameState, queue) {
  const store = getTask015TraceStore(gameState);
  store.yellowQueue = (queue || []).map((item, idx) => ({
    idx: Number(idx),
    type: String(item.type || ''),
    cellR: Number(item.cellR || 0),
    cellC: Number(item.cellC || 0),
    reason: String(item.reason || ''),
    uid: Number(item.uid || 0),
    target: Number(item.target || 0),
  }));
}

export function traceTask015YellowWrite({ gameState, state, source, item, step }) {
  const store = getTask015TraceStore(gameState);
  store.yellowWrites.push({
    source: String(source || ''),
    step: Number(step || 0),
    cellR: Number(item.cellR || 0),
    cellC: Number(item.cellC || 0),
    type: String(item.type || ''),
    target: Number(item.target || 0),
    assignedColor: Number(item.target || 0),
    time: Number(state.globals.time || 0),
  });
  if (store.yellowWrites.length > 120) store.yellowWrites.shift();
}

export function traceTask015YellowAnimation({ gameState, state, stage, payload = {} }) {
  const store = getTask015TraceStore(gameState);
  store.yellowAnimation.push({
    stage: String(stage || ''),
    time: Number(state.globals.time || 0),
    ...payload,
  });
  if (store.yellowAnimation.length > 200) store.yellowAnimation.shift();
}
