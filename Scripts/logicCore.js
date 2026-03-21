import { getRuntime } from './runtimeAdapter.js';
import { updateAllEntities } from './entities.js';

let registered = false;
let loopMode = null;
let fallbackIntervalId = null;
let runtimeTickHandler = null;
let runtimeWithListener = null;
let tickRuntime = null;
let tickHandler = null;
let fallbackIntervalId = null;

export function startGameLoop() {
  const runtime = getRuntime();
  if (!runtime) {
    console.warn('startGameLoop: runtime not initialized; aborting');
    return false;
  }
  if (registered) return;

  // Prefer Construct tick event if available; otherwise fallback to timer.
  if (typeof runtime.addEventListener === 'function') {
    tickRuntime = runtime;
    tickHandler = () => {
      updateAllEntities();
    };
    runtime.addEventListener('tick', tickHandler);
    registered = true;
    console.log('logicCore: tick listener registered');
    return true;
  } else {
    if (fallbackIntervalId != null) return;
    console.log('logicCore: no runtime tick hook; using setInterval');
    fallbackIntervalId = setInterval(updateAllEntities, 1000 / 60);
    registered = true;
  }
  tickRuntime = null;
  tickHandler = null;
  registered = false;
  return stopped;
}

export function stopGameLoop() {
  if (fallbackIntervalId != null) {
    clearInterval(fallbackIntervalId);
    fallbackIntervalId = null;
  }
  if (tickRuntime && tickHandler && typeof tickRuntime.removeEventListener === 'function') {
    tickRuntime.removeEventListener('tick', tickHandler);
  }
  tickRuntime = null;
  tickHandler = null;
  registered = false;
}

export default { startGameLoop, stopGameLoop };
