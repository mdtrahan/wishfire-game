import { initRuntimeAdapter } from './runtimeAdapter.js';
import { startGameLoop } from './logicCore.js';

export function runOnStartup(runtime) {
  // Called by Construct at startup. Initialize adapter and start the game loop.
  initRuntimeAdapter(runtime);
  startGameLoop();
}

export default { runOnStartup };
