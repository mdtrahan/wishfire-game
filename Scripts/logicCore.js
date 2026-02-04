import { getRuntime } from './runtimeAdapter.js';
import { updateAllEntities } from './entities.js';

let registered = false;

export function startGameLoop() {
  const runtime = getRuntime();
  if (!runtime) {
    console.warn('startGameLoop: runtime not initialized; aborting');
    return;
  }
  if (registered) return;
  registered = true;

  // Prefer Construct tick event if available; otherwise fallback to timer.
  if (typeof runtime.addEventListener === 'function') {
    runtime.addEventListener('tick', () => {
      updateAllEntities();
    });
    console.log('logicCore: tick listener registered');
  } else {
    console.log('logicCore: no runtime tick hook; using setInterval');
    setInterval(updateAllEntities, 1000 / 60);
  }
}

export default { startGameLoop };
