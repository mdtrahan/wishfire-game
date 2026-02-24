import { getRuntime } from './runtimeAdapter.js';
import { updateAllEntities } from './entities.js';

let registered = false;
let loopMode = null;
let fallbackIntervalId = null;
let runtimeTickHandler = null;
let runtimeWithListener = null;

export function startGameLoop() {
  const runtime = getRuntime();
  if (!runtime) {
    console.warn('startGameLoop: runtime not initialized; aborting');
    return false;
  }
  if (registered) return false;
  registered = true;
  loopMode = null;

  // Prefer Construct tick event if available; otherwise fallback to timer.
  if (typeof runtime.addEventListener === 'function') {
    runtimeTickHandler = () => {
      updateAllEntities();
    };
    runtime.addEventListener('tick', runtimeTickHandler);
    runtimeWithListener = runtime;
    loopMode = 'event';
    console.log('logicCore: tick listener registered');
  } else {
    if (fallbackIntervalId == null) {
      console.log('logicCore: no runtime tick hook; using setInterval');
      fallbackIntervalId = setInterval(updateAllEntities, 1000 / 60);
    }
    loopMode = 'interval';
  }
  return true;
}

export function stopGameLoop() {
  if (fallbackIntervalId != null) {
    clearInterval(fallbackIntervalId);
    fallbackIntervalId = null;
  }
  if (
    runtimeWithListener &&
    runtimeTickHandler &&
    typeof runtimeWithListener.removeEventListener === 'function'
  ) {
    runtimeWithListener.removeEventListener('tick', runtimeTickHandler);
  }
  runtimeWithListener = null;
  runtimeTickHandler = null;
  loopMode = null;
  registered = false;
}

export function getGameLoopState() {
  return {
    registered,
    mode: loopMode,
    hasFallbackInterval: fallbackIntervalId != null,
    hasRuntimeTickHandler: !!runtimeTickHandler,
  };
}

export default { startGameLoop, stopGameLoop, getGameLoopState };
