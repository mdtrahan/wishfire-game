import { getRuntime } from './runtimeAdapter.js';
import { updateAllEntities } from './entities.js';

let registered = false;
let tickRuntime = null;
let tickHandler = null;
let fallbackIntervalId = null;

export function startGameLoop() {
  const runtime = getRuntime();
  if (!runtime) {
    console.warn('startGameLoop: runtime not initialized; aborting');
    return false;
  }
  if (registered) return false;
  registered = true;

  // Prefer Construct tick event if available; otherwise fallback to timer.
  if (typeof runtime.addEventListener === 'function') {
    tickRuntime = runtime;
    tickHandler = () => {
      updateAllEntities();
    };
    runtime.addEventListener('tick', tickHandler);
    console.log('logicCore: tick listener registered');
    return true;
  } else {
    console.log('logicCore: no runtime tick hook; using setInterval');
    if (fallbackIntervalId == null) {
      fallbackIntervalId = setInterval(updateAllEntities, 1000 / 60);
    }
    return true;
  }
}

export function stopGameLoop() {
  let stopped = false;
  if (fallbackIntervalId != null) {
    clearInterval(fallbackIntervalId);
    fallbackIntervalId = null;
    stopped = true;
  }
  if (
    tickRuntime &&
    tickHandler &&
    typeof tickRuntime.removeEventListener === 'function'
  ) {
    tickRuntime.removeEventListener('tick', tickHandler);
    stopped = true;
  }
  tickRuntime = null;
  tickHandler = null;
  registered = false;
  return stopped;
}

export default { startGameLoop, stopGameLoop };
